// admin.service.ts — cross cutting admin endpoints, currently dashboard stats and the recent orders strip.

import type { FilterQuery } from 'mongoose'
import { Types } from 'mongoose'

import { Order } from '../models/Order'
import { Product } from '../models/Product'
import { User } from '../models/User'
import { ApiError } from '../errors/apiError'
import { ApiResponse } from '../errors/apiResponse'
import { subscriberCountsService } from './newsletter.service'
import type { IOrder, OrderDocument } from '../interfaces/order.interface'
import type { IUser, UserRole } from '../interfaces/user.interface'

export interface AdminLowStockEntry {
  productSlug: string
  productName: string
  sku: string
  variantLabel: string
  stockCount: number
  lowStockThreshold: number
}

export interface AdminRecentOrder {
  _id: string
  orderNumber: string
  customerEmail: string
  totalKobo: number
  paymentStatus: string
  fulfilmentStatus: string
  createdAt: Date
}

export interface AdminStats {
  todaysOrders: number
  weekRevenueKobo: number
  pendingFulfilment: number
  lowStockCount: number
  lowStock: AdminLowStockEntry[]
  recentOrders: AdminRecentOrder[]
  newsletterSubscribers: number
  newsletterNewThisWeek: number
}

const startOfToday = (): Date => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

const sevenDaysAgo = (): Date => {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d
}

export const adminStatsService = async (): Promise<ApiResponse<AdminStats>> => {
  const todayStart = startOfToday()
  const weekStart = sevenDaysAgo()

  const [todaysOrders, revenueAgg, pendingFulfilment, products, recentOrdersRaw, subscriberCounts] =
    await Promise.all([
      Order.countDocuments({
        createdAt: { $gte: todayStart },
        'payment.status': 'paid',
      }),
      Order.aggregate<{ _id: null; total: number }>([
        {
          $match: {
            'payment.status': 'paid',
            'payment.paidAt': { $gte: weekStart },
          },
        },
        { $group: { _id: null, total: { $sum: '$totals.total' } } },
      ]),
      Order.countDocuments({
        'payment.status': 'paid',
        'fulfilment.status': { $in: ['pending', 'processing'] },
      }),
      Product.find({ isActive: true }).select('slug name variants').lean(),
      Order.find({}).sort({ createdAt: -1 }).limit(8).lean() as unknown as Promise<
        (OrderDocument & { _id: { toString(): string } })[]
      >,
      subscriberCountsService(),
    ])

  const weekRevenueKobo = revenueAgg[0]?.total ?? 0

  const lowStock: AdminLowStockEntry[] = []
  for (const product of products) {
    for (const variant of product.variants ?? []) {
      if (!variant.isActive) continue
      if (variant.stockCount > variant.lowStockThreshold) continue
      const optionLabel = Object.values(variant.options ?? {}).join(' / ') || '—'
      lowStock.push({
        productSlug: product.slug,
        productName: product.name,
        sku: variant.sku,
        variantLabel: optionLabel,
        stockCount: variant.stockCount,
        lowStockThreshold: variant.lowStockThreshold,
      })
    }
  }
  lowStock.sort((a, b) => a.stockCount - b.stockCount)

  const recentOrders: AdminRecentOrder[] = recentOrdersRaw.map((o) => ({
    _id: o._id.toString(),
    orderNumber: o.orderNumber,
    customerEmail: o.customerEmail,
    totalKobo: o.totals.total,
    paymentStatus: o.payment.status,
    fulfilmentStatus: o.fulfilment.status,
    createdAt: o.createdAt,
  }))

  return new ApiResponse(200, 'OK.', {
    todaysOrders,
    weekRevenueKobo,
    pendingFulfilment,
    lowStockCount: lowStock.length,
    lowStock: lowStock.slice(0, 10),
    recentOrders,
    newsletterSubscribers: subscriberCounts.totalSubscribed,
    newsletterNewThisWeek: subscriberCounts.newThisWeek,
  })
}

// ── Reports: charts + summaries for the dashboard ────────────────

export interface AdminReportDay {
  date: string
  revenueKobo: number
  orders: number
}

export interface AdminReportStatusRow {
  status: string
  count: number
}

export interface AdminReportProductRow {
  productName: string
  units: number
  revenueKobo: number
}

export interface AdminReportCategoryRow {
  category: string
  revenueKobo: number
}

export interface AdminReports {
  days: number
  summary: {
    totalRevenueKobo: number
    totalPaidOrders: number
    avgOrderValueKobo: number
    windowRevenueKobo: number
    windowOrders: number
    totalCustomers: number
  }
  revenueByDay: AdminReportDay[]
  ordersByStatus: AdminReportStatusRow[]
  topProducts: AdminReportProductRow[]
  categoryRevenue: AdminReportCategoryRow[]
}

export const adminReportsService = async (
  daysParam?: number,
): Promise<ApiResponse<AdminReports>> => {
  const days = Math.min(365, Math.max(7, daysParam ?? 30))
  const windowStart = new Date()
  windowStart.setDate(windowStart.getDate() - (days - 1))
  windowStart.setHours(0, 0, 0, 0)

  const paidInWindow = {
    'payment.status': 'paid',
    'payment.paidAt': { $gte: windowStart },
  }

  const [byDayAgg, statusAgg, productAgg, categoryAgg, allTimeAgg, totalCustomers] =
    await Promise.all([
      Order.aggregate<{ _id: string; revenueKobo: number; orders: number }>([
        { $match: paidInWindow },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$payment.paidAt' } },
            revenueKobo: { $sum: '$totals.total' },
            orders: { $sum: 1 },
          },
        },
      ]),
      Order.aggregate<{ _id: string; count: number }>([
        { $match: paidInWindow },
        { $group: { _id: '$fulfilment.status', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Order.aggregate<{ _id: string; units: number; revenueKobo: number }>([
        { $match: paidInWindow },
        { $unwind: '$lines' },
        {
          $group: {
            _id: '$lines.productName',
            units: { $sum: '$lines.qty' },
            revenueKobo: { $sum: '$lines.lineTotal' },
          },
        },
        { $sort: { revenueKobo: -1 } },
        { $limit: 8 },
      ]),
      Order.aggregate<{ _id: string; revenueKobo: number }>([
        { $match: paidInWindow },
        { $unwind: '$lines' },
        {
          $lookup: {
            from: 'products',
            localField: 'lines.productId',
            foreignField: '_id',
            as: 'product',
          },
        },
        { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: { $ifNull: ['$product.category', 'other'] },
            revenueKobo: { $sum: '$lines.lineTotal' },
          },
        },
        { $sort: { revenueKobo: -1 } },
      ]),
      Order.aggregate<{ _id: null; total: number; orders: number }>([
        { $match: { 'payment.status': 'paid' } },
        { $group: { _id: null, total: { $sum: '$totals.total' }, orders: { $sum: 1 } } },
      ]),
      User.countDocuments({ role: 'customer' }),
    ])

  // Fill every day in the window so the chart has a continuous axis.
  const byDayMap = new Map(byDayAgg.map((r) => [r._id, r]))
  const revenueByDay: AdminReportDay[] = []
  for (let i = 0; i < days; i++) {
    const d = new Date(windowStart)
    d.setDate(windowStart.getDate() + i)
    const key = d.toISOString().slice(0, 10)
    const row = byDayMap.get(key)
    revenueByDay.push({
      date: key,
      revenueKobo: row?.revenueKobo ?? 0,
      orders: row?.orders ?? 0,
    })
  }

  const totalRevenueKobo = allTimeAgg[0]?.total ?? 0
  const totalPaidOrders = allTimeAgg[0]?.orders ?? 0
  const windowRevenueKobo = revenueByDay.reduce((s, r) => s + r.revenueKobo, 0)
  const windowOrders = revenueByDay.reduce((s, r) => s + r.orders, 0)

  return new ApiResponse(200, 'OK.', {
    days,
    summary: {
      totalRevenueKobo,
      totalPaidOrders,
      avgOrderValueKobo: totalPaidOrders > 0 ? Math.round(totalRevenueKobo / totalPaidOrders) : 0,
      windowRevenueKobo,
      windowOrders,
      totalCustomers,
    },
    revenueByDay,
    ordersByStatus: statusAgg.map((r) => ({ status: r._id ?? 'unknown', count: r.count })),
    topProducts: productAgg.map((r) => ({
      productName: r._id,
      units: r.units,
      revenueKobo: r.revenueKobo,
    })),
    categoryRevenue: categoryAgg.map((r) => ({ category: r._id, revenueKobo: r.revenueKobo })),
  })
}

// ── Customers (admin): derived from orders, merged with accounts ──
// A customer is anyone who has placed an order, plus anyone who signed up.
// Guests are keyed by email, account holders by their user id, and the
// detail route accepts either. Reading straight from orders means past
// orders count immediately with no seeding step to drift.

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100

export type CustomerKind = 'account' | 'guest'

export interface AdminCustomerListItem {
  /** User id for account holders, email for guests. */
  _id: string
  name: string
  email: string
  phone: string
  /** Delivery state from the latest order, null for accounts with no orders. */
  state: string | null
  hasAccount: boolean
  userId: string | null
  role: UserRole | null
  emailVerified: boolean
  orderCount: number
  paidOrderCount: number
  lifetimeValueKobo: number
  firstOrderAt: Date | null
  lastOrderAt: Date | null
  /** Account creation date, or the first order for guests. */
  createdAt: Date
}

export interface AdminCustomersListParams {
  q?: string
  /** Kept for older clients, ignored. */
  role?: UserRole
  kind?: CustomerKind
  page?: number
  pageSize?: number
}

export interface AdminCustomersListResult {
  items: AdminCustomerListItem[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}

const escapeRegex = (input: string): string => input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

interface OrderGroup {
  _id: string
  name: string
  phone: string
  state: string
  orderCount: number
  paidOrderCount: number
  lifetimeValueKobo: number
  firstOrderAt: Date
  lastOrderAt: Date
}

/** One row per buyer email with the latest name, phone and state. */
async function groupOrdersByEmail(): Promise<OrderGroup[]> {
  return Order.aggregate<OrderGroup>([
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$customerEmail',
        name: { $first: '$address.fullName' },
        phone: { $first: '$customerPhone' },
        state: { $first: '$address.state' },
        orderCount: { $sum: 1 },
        paidOrderCount: { $sum: { $cond: [{ $eq: ['$payment.status', 'paid'] }, 1, 0] } },
        lifetimeValueKobo: {
          $sum: { $cond: [{ $eq: ['$payment.status', 'paid'] }, '$totals.total', 0] },
        },
        firstOrderAt: { $min: '$createdAt' },
        lastOrderAt: { $max: '$createdAt' },
      },
    },
  ])
}

/** Every customer, buyers first by most recent order, then accounts that
 *  have never ordered by sign up date. Filtered and paged in memory, the
 *  whole set is a few hundred rows at most for a long while. */
async function buildCustomerList(): Promise<AdminCustomerListItem[]> {
  const [groups, users] = await Promise.all([
    groupOrdersByEmail(),
    User.find({ role: { $ne: 'admin' } }).lean(),
  ])
  const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]))
  const seen = new Set<string>()

  const items: AdminCustomerListItem[] = groups.map((g) => {
    const email = g._id.toLowerCase()
    seen.add(email)
    const user = userByEmail.get(email)
    return {
      _id: user ? user._id.toString() : email,
      name: user?.name || g.name || email,
      email,
      phone: user?.phone || g.phone || '',
      state: g.state || null,
      hasAccount: !!user,
      userId: user ? user._id.toString() : null,
      role: user?.role ?? null,
      emailVerified: user?.emailVerified ?? false,
      orderCount: g.orderCount,
      paidOrderCount: g.paidOrderCount,
      lifetimeValueKobo: g.lifetimeValueKobo,
      firstOrderAt: g.firstOrderAt,
      lastOrderAt: g.lastOrderAt,
      createdAt: user?.createdAt ?? g.firstOrderAt,
    }
  })

  for (const user of users) {
    const email = user.email.toLowerCase()
    if (seen.has(email)) continue
    items.push({
      _id: user._id.toString(),
      name: user.name,
      email,
      phone: user.phone ?? '',
      state: null,
      hasAccount: true,
      userId: user._id.toString(),
      role: user.role,
      emailVerified: user.emailVerified,
      orderCount: 0,
      paidOrderCount: 0,
      lifetimeValueKobo: 0,
      firstOrderAt: null,
      lastOrderAt: null,
      createdAt: user.createdAt,
    })
  }

  items.sort((a, b) => {
    const aTime = (a.lastOrderAt ?? a.createdAt).getTime()
    const bTime = (b.lastOrderAt ?? b.createdAt).getTime()
    return bTime - aTime
  })
  return items
}

export const adminListCustomersService = async (
  params: AdminCustomersListParams,
): Promise<ApiResponse<AdminCustomersListResult>> => {
  const page = Math.max(1, params.page ?? 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE))

  let items = await buildCustomerList()
  if (params.kind === 'account') items = items.filter((c) => c.hasAccount)
  if (params.kind === 'guest') items = items.filter((c) => !c.hasAccount)

  const q = params.q?.trim()
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i')
    items = items.filter((c) => rx.test(c.name) || rx.test(c.email) || rx.test(c.phone))
  }

  const total = items.length
  const start = (page - 1) * pageSize
  return new ApiResponse(200, 'OK.', {
    items: items.slice(start, start + pageSize),
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  })
}

export interface AdminCustomerDetailOrder {
  _id: string
  orderNumber: string
  totalKobo: number
  paymentStatus: string
  fulfilmentStatus: string
  createdAt: Date
}

export interface AdminCustomerDetail {
  _id: string
  name: string
  email: string
  phone: string
  hasAccount: boolean
  role: UserRole | null
  emailVerified: boolean
  addresses: IUser['addresses']
  /** Where the most recent order went, handy for guests with no saved addresses. */
  lastOrderAddress: OrderDocument['address'] | null
  createdAt: Date
  lastLoginAt: Date | null
  orderCount: number
  paidOrderCount: number
  lifetimeValueKobo: number
  orders: AdminCustomerDetailOrder[]
}

export const adminGetCustomerService = async (
  key: string,
): Promise<ApiResponse<{ customer: AdminCustomerDetail }>> => {
  // Account holders arrive as a user id, guests as an email.
  const user = Types.ObjectId.isValid(key)
    ? await User.findById(key).lean()
    : await User.findOne({ email: key.toLowerCase() }).lean()
  const email = (user?.email ?? key).toLowerCase()

  const orderFilter: FilterQuery<IOrder> = user
    ? { $or: [{ customerEmail: email }, { userId: user._id }] }
    : { customerEmail: email }
  const ordersRaw = (await Order.find(orderFilter)
    .sort({ createdAt: -1 })
    .lean()) as unknown as (OrderDocument & { _id: { toString(): string } })[]

  if (!user && ordersRaw.length === 0) throw new ApiError(404, 'Customer not found.')

  const latest = ordersRaw[0] ?? null
  const paid = ordersRaw.filter((o) => o.payment.status === 'paid')

  return new ApiResponse(200, 'OK.', {
    customer: {
      _id: user ? user._id.toString() : email,
      name: user?.name || latest?.address.fullName || email,
      email,
      phone: user?.phone || latest?.customerPhone || '',
      hasAccount: !!user,
      role: user?.role ?? null,
      emailVerified: user?.emailVerified ?? false,
      addresses: user?.addresses ?? [],
      lastOrderAddress: latest?.address ?? null,
      createdAt: user?.createdAt ?? latest?.createdAt ?? new Date(),
      lastLoginAt: user?.lastLoginAt ?? null,
      orderCount: ordersRaw.length,
      paidOrderCount: paid.length,
      lifetimeValueKobo: paid.reduce((sum, o) => sum + o.totals.total, 0),
      orders: ordersRaw.map((o) => ({
        _id: o._id.toString(),
        orderNumber: o.orderNumber,
        totalKobo: o.totals.total,
        paymentStatus: o.payment.status,
        fulfilmentStatus: o.fulfilment.status,
        createdAt: o.createdAt,
      })),
    },
  })
}
