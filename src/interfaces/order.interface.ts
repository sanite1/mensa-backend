import type { Document, Types } from 'mongoose'

// ── Status enums ─────────────────────────────────────────────────────

export type PaymentStatus =
  | 'pending'
  | 'paid'
  | 'failed'
  | 'refunded'
  | 'partial_refund'

export type FulfilmentStatus =
  | 'pending'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'

export type ShippingMethod = 'inhouse' | 'sendbox'

export type OrderSource = 'web' | 'manual' | 'imported'

// ── Embedded subdocuments ────────────────────────────────────────────

/** Snapshot of a single product/variant at order time. We freeze the
 *  product name, options, image, and unit price so a later edit to the
 *  product never rewrites order history. */
export interface IOrderLine {
  _id?: Types.ObjectId
  productId: Types.ObjectId
  variantId: Types.ObjectId
  /** Auto-computed SKU as it was on the variant at order time. */
  sku: string
  productName: string
  variantLabel: string
  imageUrl?: string
  slug: string
  /** Unit price in kobo at order time (post any sale price + variant override). */
  unitPrice: number
  qty: number
  /** unitPrice * qty, in kobo. Pre-computed so reads are simple. */
  lineTotal: number
}

/** Delivery address snapshotted on the order. Distinct from User.addresses
 *  so editing the user's saved address doesn't mutate completed orders. */
export interface IOrderAddress {
  _id?: Types.ObjectId
  fullName: string
  phone: string
  line1: string
  line2?: string
  city: string
  state: string
  country: string
  postal?: string
}

export interface IOrderTotals {
  /** Sum of line totals in kobo. */
  subtotal: number
  /** Selected shipping rate in kobo. */
  shipping: number
  /** Discount applied in kobo. */
  discount: number
  /** subtotal + shipping − discount, in kobo. The Paystack charge amount. */
  total: number
}

export interface IOrderPayment {
  status: PaymentStatus
  /** Paystack reference (also our order number). */
  reference: string
  /** Paystack access code from initialize, used by the Inline modal. */
  accessCode?: string
  /** Paystack authorization URL (fallback if Inline can't open). */
  authorizationUrl?: string
  /** When `status` moved to `paid`. */
  paidAt?: Date
  /** Last raw webhook payload for audit / debugging. */
  lastWebhookPayload?: Record<string, unknown>
}

export interface IOrderFulfilment {
  status: FulfilmentStatus
  shippingMethod: ShippingMethod
  /** Sendbox tracking code (when shippingMethod = 'sendbox'). */
  trackingCode?: string
  trackingUrl?: string
  shippedAt?: Date
  deliveredAt?: Date
}

// ── Root document ────────────────────────────────────────────────────

export interface IOrder {
  /** Human readable order number in format MS-YYYY-NNNNN. Also used as
   *  the Paystack `reference`. */
  orderNumber: string
  source: OrderSource
  /** Null for guest checkout. */
  userId: Types.ObjectId | null
  /** Customer contact snapshot, distinct from user record. */
  customerEmail: string
  customerPhone: string
  lines: IOrderLine[]
  address: IOrderAddress
  totals: IOrderTotals
  payment: IOrderPayment
  fulfilment: IOrderFulfilment
  /** Discount code (if any) used at checkout. */
  discountCode?: string
  /** Partner referral code captured at checkout. Used to accrue commission
   *  for the partner once the order is paid. Set once at order creation
   *  time; never rewritten after the fact. */
  referralCode?: string | null
  /** Free form admin notes shown only in admin. */
  internalNotes?: string
  createdAt: Date
  updatedAt: Date
}

export type OrderDocument = Document<Types.ObjectId, unknown, IOrder> & IOrder

// ── DTOs ─────────────────────────────────────────────────────────────

export interface CheckoutLineInput {
  productId: string
  variantId: string
  qty: number
}

export interface CheckoutAddressInput {
  fullName: string
  phone: string
  line1: string
  line2?: string
  city: string
  state: string
  country: string
  postal?: string
}

/** Body posted to POST /checkout/shipping-rates. */
export interface ShippingRatesInput {
  lines: CheckoutLineInput[]
  destination: {
    city: string
    state: string
    country: string
    postal?: string
  }
}

/** One option returned by the shipping rates endpoint. */
export interface ShippingRateOption {
  method: ShippingMethod
  /** Human label shown to the customer. */
  name: string
  /** Lead time in plain English. */
  eta: string
  /** Cost in kobo. */
  amount: number
}

/** Body posted to POST /checkout/initialize. */
export interface InitializeCheckoutInput {
  lines: CheckoutLineInput[]
  address: CheckoutAddressInput
  customerEmail: string
  customerPhone: string
  shippingMethod: ShippingMethod
  /** Selected rate amount in kobo (must match an option returned by /shipping-rates). */
  shippingAmount: number
  discountCode?: string
  /** Partner referral code from ?ref=, resolved server side. Invalid or inactive codes are silently dropped so checkout never fails on a stale referral. */
  referralCode?: string
}

export interface InitializeCheckoutResult {
  orderNumber: string
  reference: string
  accessCode: string
  authorizationUrl: string
  amount: number
  publicKey: string
}

// ── Query params ─────────────────────────────────────────────────────

export interface ListOrdersQuery {
  paymentStatus?: PaymentStatus
  fulfilmentStatus?: FulfilmentStatus
  page?: number
  pageSize?: number
}

/** Body for PATCH /admin/orders/:id/fulfilment. Moves the order forward through the lifecycle or cancels before shipping. On shipped, optional trackingCode / trackingUrl covers in house rider orders. */
export interface UpdateOrderFulfilmentInput {
  status: FulfilmentStatus
  trackingCode?: string
  trackingUrl?: string
  /** Free-form note shown to admin only. Appended to internalNotes. */
  note?: string
}

export interface Pagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface ListOrdersResult {
  items: OrderDocument[]
  pagination: Pagination
}
