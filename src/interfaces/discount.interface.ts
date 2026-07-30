import type { Document, Types } from 'mongoose'

/** percent deducts 0 to 100 percent of the subtotal, fixed deducts a flat kobo amount. At most one code per order, stacking is deliberately unsupported. */
export type DiscountType = 'percent' | 'fixed'

export interface IDiscount {
  /** Stored uppercase + trimmed. Case-insensitive at apply time. */
  code: string
  type: DiscountType
  /** For percent: 1-100. For fixed: kobo, integer >= 1. */
  value: number
  /** Optional ISO date. If set and in the past, the code is invalid. */
  expiresAt: Date | null
  /** Optional cap on total redemptions across all customers. Null = unlimited. */
  maxUses: number | null
  /** Atomically incremented on each successful order that used this code. */
  usedCount: number
  /** Admin can pause a code without deleting it. */
  isActive: boolean
  /** Free-form admin label e.g. "Influencer · Tolu · Q2 2026". Not shown to customers. */
  description: string
  createdAt: Date
  updatedAt: Date
}

export type DiscountDocument = Document<Types.ObjectId, unknown, IDiscount> & IDiscount

// ── DTOs ─────────────────────────────────────────────────────────────

export interface CreateDiscountInput {
  code: string
  type: DiscountType
  value: number
  expiresAt?: string | null
  maxUses?: number | null
  isActive?: boolean
  description?: string
}

export type UpdateDiscountInput = Partial<CreateDiscountInput>

/** Returned by POST /checkout/apply-discount so the frontend can preview
 *  the calculated kobo savings before the customer commits to checkout. */
export interface ApplyDiscountResult {
  code: string
  type: DiscountType
  /** kobo subtracted from the subtotal (always positive, never exceeds subtotal). */
  discountKobo: number
  /** Human readable summary shown next to the discount line, e.g. "10% off"
   *  or "₦2,000 off". */
  description: string
}

// ── Query params ────────────────────────────────────────────────────

export interface ListDiscountsQuery {
  isActive?: boolean
  page?: number
  pageSize?: number
}

export interface Pagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface ListDiscountsResult {
  items: DiscountDocument[]
  pagination: Pagination
}
