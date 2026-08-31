// admin.service.ts — cross cutting admin endpoints, currently dashboard stats and the recent orders strip.

import type { FilterQuery } from 'mongoose'
import { Types } from 'mongoose'

import { Order } from '../models/Order'
import { Product } from '../models/Product'
import { User } from '../models/User'
import { ApiError } from '../errors/apiError'
import { ApiResponse } from '../errors/apiResponse'
import { subscriberCountsService } from './newsletter.service'
import type { OrderDocument } from '../interfaces/order.interface'
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

  const [
    todaysOrders,
    revenueAgg,
    pendingFulfilment,
    products,
    recentOrdersRaw,
    subscriberCounts,
  ] = await Promise.all([
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

// ── Customers (admin): list + detail ─────────────────────────────

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100

export interface AdminCustomerListItem {
  _id: string
  name: string
  email: string
  phone: string
  role: UserRole
  emailVerified: boolean
  createdAt: Date
  lastLoginAt: Date | null
  orderCount: number
  lifetimeValueKobo: number
}

export interface AdminCustomersListParams {
  q?: string
  role?: UserRole
  page?: number
  pageSize?: number
}

export interface AdminCustomersListResult {
  items: AdminCustomerListItem[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}

const escapeRegex = (input: string): string =>
  input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const adminListCustomersService = async (
  params: AdminCustomersListParams,
): Promise<ApiResponse<AdminCustomersListResult>> => {
  const page = Math.max(1, params.page ?? 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE))

  // Staff accounts are not customers, exclude admins unless explicitly asked for.
  const filter: FilterQuery<IUser> = params.role
    ? { role: params.role }
    : { role: { $ne: 'admin' } }

  const q = params.q?.trim()
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i')
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }]
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    User.countDocuments(filter),
  ])

  // Aggregate lifetime value + order count per user in a single round trip.
  const userIds = users.map((u) => u._id)
  const orderAgg = await Order.aggregate<{
    _id: Types.ObjectId
    orderCount: number
    lifetimeValueKobo: number
  }>([
    {
      $match: {
        userId: { $in: userIds },
        'payment.status': 'paid',
      },
    },
    {
      $group: {
        _id: '$userId',
        orderCount: { $sum: 1 },
        lifetimeValueKobo: { $sum: '$totals.total' },
      },
    },
  ])
  const aggMap = new Map<string, { orderCount: number; lifetimeValueKobo: number }>()
  for (const row of orderAgg) {
    aggMap.set(row._id.toString(), {
      orderCount: row.orderCount,
      lifetimeValueKobo: row.lifetimeValueKobo,
    })
  }

  const items: AdminCustomerListItem[] = users.map((u) => {
    const agg = aggMap.get(u._id.toString())
    return {
      _id: u._id.toString(),
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      emailVerified: u.emailVerified,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt ?? null,
      orderCount: agg?.orderCount ?? 0,
      lifetimeValueKobo: agg?.lifetimeValueKobo ?? 0,
    }
  })

  return new ApiResponse(200, 'OK.', {
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
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
  role: UserRole
  emailVerified: boolean
  addresses: IUser['addresses']
  createdAt: Date
  lastLoginAt: Date | null
  orderCount: number
  lifetimeValueKobo: number
  orders: AdminCustomerDetailOrder[]
}

export const adminGetCustomerService = async (
  customerId: string,
): Promise<ApiResponse<{ customer: AdminCustomerDetail }>> => {
  if (!Types.ObjectId.isValid(customerId)) {
    throw new ApiError(404, 'Customer not found.')
  }

  const user = await User.findById(customerId).lean()
  if (!user) throw new ApiError(404, 'Customer not found.')

  const ordersRaw = (await Order.find({ userId: user._id })
    .sort({ createdAt: -1 })
    .lean()) as unknown as (OrderDocument & { _id: { toString(): string } })[]

  const orders: AdminCustomerDetailOrder[] = ordersRaw.map((o) => ({
    _id: o._id.toString(),
    orderNumber: o.orderNumber,
    totalKobo: o.totals.total,
    paymentStatus: o.payment.status,
    fulfilmentStatus: o.fulfilment.status,
    createdAt: o.createdAt,
  }))

  const lifetimeValueKobo = ordersRaw
    .filter((o) => o.payment.status === 'paid')
    .reduce((sum, o) => sum + o.totals.total, 0)
  const orderCount = ordersRaw.filter((o) => o.payment.status === 'paid').length

  return new ApiResponse(200, 'OK.', {
    customer: {
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      emailVerified: user.emailVerified,
      addresses: user.addresses,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt ?? null,
      orderCount,
      lifetimeValueKobo,
      orders,
    },
  })
}
