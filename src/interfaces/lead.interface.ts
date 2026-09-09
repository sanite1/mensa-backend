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
}

export interface AdminListLeadsQuery {
  status?: LeadStatus
  q?: string
  page?: number
  pageSize?: number
}

export interface AdminListLeadsResult {
  items: StarterSetLeadDocument[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}
