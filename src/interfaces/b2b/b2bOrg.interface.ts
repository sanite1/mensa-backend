import type { Document, Types } from 'mongoose'

export type B2BOrgType = 'school' | 'ngo' | 'council' | 'other'
export type B2BVerificationStatus = 'pending' | 'verified' | 'rejected'
export type CreditTerms = 'prepay' | 'net_15' | 'net_30'

export interface IB2BOrg {
  name: string
  type: B2BOrgType
  /** Registration/RC number from CAC, ministry, etc. Optional at submission. */
  registrationNumber?: string
  contactName: string
  contactEmail: string
  contactPhone: string
  /** Free form note from the applicant describing what they want to do. */
  notes?: string
  verificationStatus: B2BVerificationStatus
  /** Admin note recorded alongside a verify/reject action. */
  verificationNote?: string
  verifiedAt?: Date | null
  verifiedBy?: Types.ObjectId | null
  creditTerms: CreditTerms
  pricingTierId?: Types.ObjectId | null
  createdAt: Date
  updatedAt: Date
}

export type B2BOrgDocument = Document<Types.ObjectId, unknown, IB2BOrg> & IB2BOrg

// ── DTOs ─────────────────────────────────────────────────────────

export interface SubmitB2BOrgInput {
  name: string
  type: B2BOrgType
  registrationNumber?: string
  contactName: string
  contactEmail: string
  contactPhone: string
  notes?: string
}

export interface AdminListB2BOrgsQuery {
  verificationStatus?: B2BVerificationStatus
  q?: string
  page?: number
  pageSize?: number
}

export interface AdminListB2BOrgsResult {
  items: B2BOrgDocument[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}

export interface VerifyB2BOrgInput {
  verificationStatus: 'verified' | 'rejected'
  verificationNote?: string
}
