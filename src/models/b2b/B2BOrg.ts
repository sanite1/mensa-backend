import { Schema, model, type Model } from 'mongoose'
import type {
  B2BOrgType,
  B2BVerificationStatus,
  CreditTerms,
  IB2BOrg,
} from '../../interfaces/b2b/b2bOrg.interface'

type B2BOrgModel = Model<IB2BOrg>

const B2BOrgSchema = new Schema<IB2BOrg, B2BOrgModel>(
  {
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['school', 'ngo', 'council', 'other'] satisfies B2BOrgType[],
      required: true,
      index: true,
    },
    registrationNumber: { type: String, trim: true },
    contactName: { type: String, required: true, trim: true },
    contactEmail: { type: String, required: true, lowercase: true, trim: true },
    contactPhone: { type: String, required: true, trim: true },
    notes: { type: String, default: '', trim: true },
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'] satisfies B2BVerificationStatus[],
      default: 'pending',
      index: true,
    },
    verificationNote: { type: String, default: '', trim: true },
    verifiedAt: { type: Date, default: null },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    creditTerms: {
      type: String,
      enum: ['prepay', 'net_15', 'net_30'] satisfies CreditTerms[],
      default: 'prepay',
    },
    pricingTierId: { type: Schema.Types.ObjectId, ref: 'BulkPricingTier', default: null },
  },
  { timestamps: true },
)

B2BOrgSchema.index({ name: 'text', contactEmail: 'text' })

export const B2BOrg = model<IB2BOrg, B2BOrgModel>('B2BOrg', B2BOrgSchema)
