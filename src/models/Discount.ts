import { Schema, model, type Model } from 'mongoose'
import type { DiscountType, IDiscount } from '../interfaces/discount.interface'

type DiscountModel = Model<IDiscount>

const DiscountSchema = new Schema<IDiscount, DiscountModel>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['percent', 'fixed'] satisfies DiscountType[],
      required: true,
    },
    value: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        // Guard against malformed percent values at write time. Fixed
        // amounts are bounded only by the order total at apply time.
        validator: function (this: IDiscount, v: number) {
          return this.type !== 'percent' || (v >= 1 && v <= 100)
        },
        message: 'Percent discounts must be between 1 and 100.',
      },
    },
    expiresAt: { type: Date, default: null },
    maxUses: { type: Number, default: null, min: 1 },
    usedCount: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
    description: { type: String, default: '', trim: true },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.__v
        return ret
      },
    },
  },
)

export const Discount = model<IDiscount, DiscountModel>('Discount', DiscountSchema)
