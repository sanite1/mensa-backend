import { Schema, model, type Model } from 'mongoose'
import type { IInvoiceSettings } from '../interfaces/invoice.interface'

type InvoiceSettingsModel = Model<IInvoiceSettings>

const InvoiceSettingsSchema = new Schema<IInvoiceSettings, InvoiceSettingsModel>(
  {
    key: { type: String, required: true, unique: true, default: 'invoice' },
    bankName: { type: String, default: '', trim: true },
    accountName: { type: String, default: '', trim: true },
    accountNumber: { type: String, default: '', trim: true },
    contactPhone: { type: String, default: '', trim: true },
    contactAddress: { type: String, default: '', trim: true },
    contactWebsite: { type: String, default: 'www.mensaproducts.com', trim: true },
    defaultVatPercent: { type: Number, default: null, min: 0, max: 100 },
  },
  { timestamps: true },
)

export const InvoiceSettings = model<IInvoiceSettings, InvoiceSettingsModel>(
  'InvoiceSettings',
  InvoiceSettingsSchema,
)
