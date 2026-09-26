import { Schema, model, type Model } from 'mongoose'
import type { IStarterSetLead, LeadResultCode, LeadStatus } from '../interfaces/lead.interface'

type StarterSetLeadModel = Model<IStarterSetLead>

const StarterSetLeadSchema = new Schema<IStarterSetLead, StarterSetLeadModel>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    answers: { type: Schema.Types.Mixed, required: true, default: {} },
    resultCode: {
      type: String,
      required: true,
      enum: [
        'PADS',
        'PANT1',
        'PANT3',
        'PANT5',
        'PANT1_PADS',
        'PANT3_PADS',
      ] satisfies LeadResultCode[],
    },
    status: {
      type: String,
      enum: ['new', 'contacted', 'ordered'] satisfies LeadStatus[],
      default: 'new',
      index: true,
    },
    orderNumber: { type: String, default: null },
    orderedAt: { type: Date, default: null },
    contactedAt: { type: Date, default: null },
    retakes: { type: Number, default: 0 },
    resultReason: { type: String, default: '' },
    shopPath: { type: String, default: '' },
    discountCode: { type: String, default: null, index: true },
    discountIssuedAt: { type: Date, default: null },
    discountExpiresAt: { type: Date, default: null },
    discountRedeemedAt: { type: Date, default: null },
    discountRedeemedOrderNumber: { type: String, default: null },
    reminderSentAt: { type: Date, default: null },
  },
  { timestamps: true },
)

export const StarterSetLead = model<IStarterSetLead, StarterSetLeadModel>(
  'StarterSetLead',
  StarterSetLeadSchema,
)
