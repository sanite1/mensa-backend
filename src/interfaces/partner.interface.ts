import type { Document, Types } from 'mongoose'

// ── Status enums ─────────────────────────────────────────────────

/** Individual partner application lifecycle.
 *  pending  -> submitted, awaiting admin review
 *  approved -> admin accepted, onboarding email sent, partner has not
 *              yet completed onboarding (no password / bank details).
 *  active   -> onboarding complete, partner can earn commission and
 *              request payouts.
 *  rejected -> admin declined; no portal access.
 *  suspended-> admin paused an active partner; no new accrual but
 *              past balance is preserved. */
export type PartnerStatus =
  | 'pending'
  | 'approved'
  | 'active'
  | 'rejected'
  | 'suspended'

/** Commission lifecycle for a single order.
 *  pending  -> order paid but not delivered. Counted as "expected"
 *              but not yet cashable.
 *  available-> order delivered, included in cashable balance.
 *  paid     -> bundled into a PayoutRequest that was marked paid.
 *  reversed -> order refunded or cancelled after accrual. */
export type PartnerCommissionStatus =
  | 'pending'
  | 'available'
  | 'paid'
  | 'reversed'

/** Payout request lifecycle.
 *  pending  -> partner clicked "Cash out", awaiting admin payment.
 *  paid     -> admin paid manually outside the system and recorded a
 *              reference. Commissions linked to this payout flip to 'paid'.
 *  rejected -> admin declined (with reason). Commissions reset to 'available'. */
export type PartnerPayoutStatus = 'pending' | 'paid' | 'rejected'

// ── Bank details ─────────────────────────────────────────────────

export interface IPartnerBankAccount {
  accountName: string
  accountNumber: string
  bankName: string
  /** Optional Paystack/CBN bank code, useful for automated payouts later. */
  bankCode?: string
}

// ── Partner ──────────────────────────────────────────────────────

export interface IPartner {
  /** Optional link to a User. Null while application is pending — the
   *  User is created when admin approves and the onboarding email is sent. */
  userId: Types.ObjectId | null

  // Application data (filled at apply time)
  name: string
  email: string
  phone: string
  socialHandle?: string
  notes?: string

  // Lifecycle
  status: PartnerStatus
  rejectionReason?: string
  approvedAt?: Date | null
  approvedBy?: Types.ObjectId | null
  activatedAt?: Date | null

  /** Onboarding token (SHA-256 hash) sent in the approval email. Single use:
   *  cleared the moment the partner completes onboarding. */
  onboardingTokenHash?: string | null
  onboardingTokenExpiresAt?: Date | null

  // Set on onboarding completion
  /** Unique, case-sensitive code used in referral URLs (?ref=CODE). */
  referralCode?: string
  /** Percent (0–100). Stored on the partner so admins can set per-partner rates. */
  commissionRate: number
  bankAccount?: IPartnerBankAccount

  // Denormalised aggregates so the dashboard loads in a single query.
  pendingBalanceKobo: number
  availableBalanceKobo: number
  lifetimeEarnedKobo: number
  lifetimePaidKobo: number

  createdAt: Date
  updatedAt: Date
}

export type PartnerDocument = Document<Types.ObjectId, unknown, IPartner> & IPartner

// ── PartnerCommission ────────────────────────────────────────────

export interface IPartnerCommission {
  partnerId: Types.ObjectId
  orderId: Types.ObjectId
  orderNumber: string
  /** Subtotal in kobo that the commission was computed against. */
  orderSubtotalKobo: number
  /** Snapshot of the rate used so adjusting the partner's rate later
   *  never rewrites historical commissions. */
  commissionRateAtTime: number
  amountKobo: number
  status: PartnerCommissionStatus
  /** When status flipped to 'available' (order delivered). */
  availableAt?: Date | null
  /** Payout request this commission was bundled into, if any. */
  payoutRequestId?: Types.ObjectId | null
  /** Set when status === 'reversed'. */
  reversedAt?: Date | null
  reversedReason?: string
  createdAt: Date
  updatedAt: Date
}

export type PartnerCommissionDocument = Document<
  Types.ObjectId,
  unknown,
  IPartnerCommission
> &
  IPartnerCommission

// ── PartnerPayoutRequest ─────────────────────────────────────────

export interface IPartnerPayoutRequest {
  partnerId: Types.ObjectId
  amountKobo: number
  /** Snapshot of the partner's bank account at request time, so a later
   *  account edit never changes what we said we'd pay against. */
  bankAccountSnapshot: IPartnerBankAccount
  status: PartnerPayoutStatus
  requestedAt: Date
  processedAt?: Date | null
  processedBy?: Types.ObjectId | null
  /** Admin's manual transfer reference. */
  paymentReference?: string
  adminNote?: string
  createdAt: Date
  updatedAt: Date
}

export type PartnerPayoutRequestDocument = Document<
  Types.ObjectId,
  unknown,
  IPartnerPayoutRequest
> &
  IPartnerPayoutRequest

// ── DTOs ─────────────────────────────────────────────────────────

export interface ApplyPartnerInput {
  name: string
  email: string
  phone: string
  socialHandle?: string
  notes?: string
}

export interface CompletePartnerOnboardingInput {
  password: string
  referralCode?: string
  bankAccount: IPartnerBankAccount
}

export interface AdminListPartnersQuery {
  status?: PartnerStatus
  q?: string
  page?: number
  pageSize?: number
}

export interface AdminApprovePartnerInput {
  commissionRate?: number
}

export interface AdminRejectPartnerInput {
  rejectionReason?: string
}

export interface AdminUpdatePartnerInput {
  commissionRate?: number
  status?: Extract<PartnerStatus, 'active' | 'suspended'>
}

export interface AdminListPayoutsQuery {
  status?: PartnerPayoutStatus
  page?: number
  pageSize?: number
}

export interface AdminMarkPayoutPaidInput {
  paymentReference: string
  adminNote?: string
}

export interface AdminRejectPayoutInput {
  adminNote?: string
}
