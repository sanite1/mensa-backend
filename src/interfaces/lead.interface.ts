import type { Document, Types } from 'mongoose'

/** The six sets the starter set finder can recommend. */
export type LeadResultCode = 'PADS' | 'PANT1' | 'PANT3' | 'PANT5' | 'PANT1_PADS' | 'PANT3_PADS'

/** new: just submitted the quiz. contacted: we followed up.
 *  ordered: a paid order with this email came in. */
export type LeadStatus = 'new' | 'contacted' | 'ordered'

export interface IStarterSetLead {
  name: string
  email: string
  /** The eight quiz answers keyed q1 to q8, stored verbatim for follow ups. */
  answers: Record<string, string>
  resultCode: LeadResultCode
  status: LeadStatus
  /** Order number that converted this lead, set by the paid order flow. */
  orderNumber?: string | null
  orderedAt?: Date | null
  contactedAt?: Date | null
  /** How many times this email completed the quiz. */
  retakes: number
  /** Why the set fits, as shown on the result page. Reused in the email. */
  resultReason?: string
  /** Storefront path of the recommended product, e.g. /shop/reusable-pads. */
  shopPath?: string
  /** Personal 10 percent code minted on first submission. Null on legacy leads. */
  discountCode: string | null
  discountIssuedAt: Date | null
  discountExpiresAt: Date | null
  discountRedeemedAt: Date | null
  discountRedeemedOrderNumber: string | null
  /** When the day 5 nudge went out, so it never goes twice. */
  reminderSentAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type StarterSetLeadDocument = Document<Types.ObjectId, unknown, IStarterSetLead> &
  IStarterSetLead

// ── DTOs ─────────────────────────────────────────────────────────

export interface SubmitLeadInput {
  name: string
  email: string
  answers: Record<string, string>
  resultCode: LeadResultCode
  reason?: string
  shopPath?: string
}

/** Code filter for the admin list. expired = unredeemed and past expiry. */
export type LeadCodeFilter = 'redeemed' | 'unredeemed' | 'expired'

export interface AdminListLeadsQuery {
  status?: LeadStatus
  code?: LeadCodeFilter
  q?: string
  page?: number
  pageSize?: number
}

export interface LeadCodeStats {
  issued: number
  redeemed: number
  expired: number
}

export interface AdminListLeadsResult {
  items: StarterSetLeadDocument[]
  codeStats: LeadCodeStats
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}
