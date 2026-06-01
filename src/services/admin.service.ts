// ═══════════════════════════════════════════════════════════════
// admin.service.ts
//
// Cross-cutting admin endpoints that don't belong to a single
// domain service. Right now: dashboard stats (today's orders,
// rolling weekly revenue, fulfilment backlog, low-stock SKUs)
// plus the recent-orders strip rendered under the KPI cards.
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
//  Customers (admin) — list + detail
// ═══════════════════════════════════════════════════════════════

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

  const filter: FilterQuery<IUser> = {}
  if (params.role) filter.role = params.role

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
