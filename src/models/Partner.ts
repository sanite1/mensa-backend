import { Schema, model, type Model } from 'mongoose'
import type {
  IPartner,
  IPartnerBankAccount,
  IPartnerCommission,
  IPartnerPayoutRequest,
  PartnerCommissionStatus,
  PartnerPayoutStatus,
  PartnerStatus,
} from '../interfaces/partner.interface'

const BankAccountSchema = new Schema<IPartnerBankAccount>(
  {
    accountName: { type: String, required: true, trim: true },
    accountNumber: { type: String, required: true, trim: true },
    bankName: { type: String, required: true, trim: true },
    bankCode: { type: String, trim: true },
  },
  { _id: false },
)

// ── Partner ─────────────────────────────────────────────────────

type PartnerModelType = Model<IPartner>

const PartnerSchema = new Schema<IPartner, PartnerModelType>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },

    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: { type: String, required: true, trim: true },
    socialHandle: { type: String, trim: true },
    notes: { type: String, default: '', trim: true },

    status: {
      type: String,
      enum: [
        'pending',
        'approved',
        'active',
        'rejected',
        'suspended',
      ] satisfies PartnerStatus[],
      default: 'pending',
      index: true,
    },
    rejectionReason: { type: String, default: '', trim: true },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    activatedAt: { type: Date, default: null },

    onboardingTokenHash: { type: String, default: null, select: false },
    onboardingTokenExpiresAt: { type: Date, default: null, select: false },

    referralCode: {
      type: String,
      default: undefined,
      unique: true,
      sparse: true,
      trim: true,
      index: true,
    },
    commissionRate: { type: Number, default: 10, min: 0, max: 100 },
    bankAccount: { type: BankAccountSchema, default: undefined },

    pendingBalanceKobo: { type: Number, default: 0, min: 0 },
    // availableBalanceKobo can go NEGATIVE when an already-paid commission
    // is reversed (e.g. customer refund post-payout). Future earnings net
    // against the deficit before the partner can cash out again — that's
    // the claw-back. We deliberately drop the min:0 constraint here.
    availableBalanceKobo: { type: Number, default: 0 },
    lifetimeEarnedKobo: { type: Number, default: 0, min: 0 },
    lifetimePaidKobo: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
)

PartnerSchema.index({ name: 'text', email: 'text', socialHandle: 'text' })

export const Partner = model<IPartner, PartnerModelType>('Partner', PartnerSchema)

// ── PartnerCommission ───────────────────────────────────────────

type PartnerCommissionModelType = Model<IPartnerCommission>

const PartnerCommissionSchema = new Schema<IPartnerCommission, PartnerCommissionModelType>(
  {
    partnerId: { type: Schema.Types.ObjectId, ref: 'Partner', required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    orderNumber: { type: String, required: true, trim: true },
    orderSubtotalKobo: { type: Number, required: true, min: 0 },
    commissionRateAtTime: { type: Number, required: true, min: 0, max: 100 },
    amountKobo: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: [
        'pending',
        'available',
        'paid',
        'reversed',
      ] satisfies PartnerCommissionStatus[],
      default: 'pending',
      index: true,
    },
    availableAt: { type: Date, default: null },
    payoutRequestId: {
      type: Schema.Types.ObjectId,
      ref: 'PartnerPayoutRequest',
      default: null,
    },
    reversedAt: { type: Date, default: null },
    reversedReason: { type: String, default: '', trim: true },
  },
  { timestamps: true },
)

// One commission per (partner, order) — never accrue twice for the same order.
PartnerCommissionSchema.index({ partnerId: 1, orderId: 1 }, { unique: true })

export const PartnerCommission = model<IPartnerCommission, PartnerCommissionModelType>(
  'PartnerCommission',
  PartnerCommissionSchema,
)

// ── PartnerPayoutRequest ────────────────────────────────────────

type PartnerPayoutRequestModelType = Model<IPartnerPayoutRequest>

const PartnerPayoutRequestSchema = new Schema<
  IPartnerPayoutRequest,
  PartnerPayoutRequestModelType
>(
  {
    partnerId: { type: Schema.Types.ObjectId, ref: 'Partner', required: true, index: true },
    amountKobo: { type: Number, required: true, min: 0 },
    bankAccountSnapshot: { type: BankAccountSchema, required: true },
    status: {
      type: String,
      enum: ['pending', 'paid', 'rejected'] satisfies PartnerPayoutStatus[],
      default: 'pending',
      index: true,
    },
    requestedAt: { type: Date, required: true, default: () => new Date() },
    processedAt: { type: Date, default: null },
    processedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    paymentReference: { type: String, default: '', trim: true },
    adminNote: { type: String, default: '', trim: true },
  },
  { timestamps: true },
)

export const PartnerPayoutRequest = model<
  IPartnerPayoutRequest,
  PartnerPayoutRequestModelType
>('PartnerPayoutRequest', PartnerPayoutRequestSchema)
