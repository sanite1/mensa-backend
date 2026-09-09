import { Schema, model, type Model } from 'mongoose'
import type { IShippingOption, IShippingSettings } from '../interfaces/shipping.interface'

type ShippingSettingsModel = Model<IShippingSettings>

const ShippingOptionSchema = new Schema<IShippingOption>(
  {
    id: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    feeKobo: { type: Number, required: true, min: 0 },
    etaMinDays: { type: Number, required: true, min: 0 },
    etaMaxDays: { type: Number, required: true, min: 0 },
    coverage: { type: String, enum: ['all', 'states'], required: true },
    states: { type: [String], default: [] },
    enabled: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: false },
)

const ShippingSettingsSchema = new Schema<IShippingSettings, ShippingSettingsModel>(
  {
    key: { type: String, required: true, unique: true, default: 'shipping' },
    freeDeliveryThresholdKobo: { type: Number, default: null, min: 0 },
    options: { type: [ShippingOptionSchema], default: [] },
  },
  { timestamps: true },
)

export const ShippingSettings = model<IShippingSettings, ShippingSettingsModel>(
  'ShippingSettings',
  ShippingSettingsSchema,
)
