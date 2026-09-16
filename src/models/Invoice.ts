import { Schema, model, type Model } from 'mongoose'
import type {
  IInvoice,
  IInvoiceCustomer,
  IInvoiceLine,
  IInvoicePayment,
  IInvoiceTotals,
  InvoiceLineKind,
  InvoiceStatus,
} from '../interfaces/invoice.interface'

type InvoiceModel = Model<IInvoice>

const LineSchema = new Schema<IInvoiceLine>(
  {
    kind: {
      type: String,
      enum: ['catalogue', 'custom'] satisfies InvoiceLineKind[],
      required: true,
    },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', default: null },
    variantId: { type: Schema.Types.ObjectId, default: null },
    description: { type: String, required: true, trim: true },
    variantLabel: { type: String, trim: true },
    sku: { type: String, trim: true },
    unitPrice: { type: Number, required: true, min: 0 },
    qty: { type: Number, required: true, min: 1 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: true },
)

const CustomerSchema = new Schema<IInvoiceCustomer>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    b2bOrgId: { type: Schema.Types.ObjectId, ref: 'B2BOrg', default: null },
  },
  { _id: false },
)

const TotalsSchema = new Schema<IInvoiceTotals>(
  {
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, required: true, min: 0 },
    vat: { type: Number, required: true, min: 0 },
    shipping: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
  },
  { _id: false },
)

const PaymentSchema = new Schema<IInvoicePayment>(
  {
    reference: { type: String, required: true, trim: true },
    accessCode: { type: String },
    authorizationUrl: { type: String },
    paidAt: { type: Date },
    lastWebhookPayload: { type: Schema.Types.Mixed },
  },
  { _id: false },
)

const InvoiceSchema = new Schema<IInvoice, InvoiceModel>(
  {
    invoiceNumber: { type: String, required: true, unique: true, trim: true, index: true },
    status: {
      type: String,
      enum: ['draft', 'sent', 'viewed', 'paid', 'void'] satisfies InvoiceStatus[],
      default: 'draft',
      index: true,
    },
    customer: { type: CustomerSchema, required: true },
    lines: { type: [LineSchema], default: [] },
    discountKobo: { type: Number, default: 0, min: 0 },
    vatPercent: { type: Number, default: null, min: 0, max: 100 },
    shippingKobo: { type: Number, default: 0, min: 0 },
    shippingLabel: { type: String, default: 'Delivery', trim: true },
    notes: { type: String, default: '', trim: true },
    dueDate: { type: Date, default: null, index: true },
    totals: { type: TotalsSchema, required: true },
    accessToken: { type: String, required: true, unique: true, index: true },
    stockReserved: { type: Boolean, default: false },
    sentAt: { type: Date, default: null },
    viewedAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    voidedAt: { type: Date, default: null },
    payment: { type: PaymentSchema, required: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', default: null },
  },
  { timestamps: true },
)

InvoiceSchema.index({ 'customer.email': 1 })
InvoiceSchema.index({ createdAt: -1 })

export const Invoice = model<IInvoice, InvoiceModel>('Invoice', InvoiceSchema)
