import { Schema, model, type Model } from 'mongoose'
import type {
  FulfilmentStatus,
  IOrder,
  IOrderAddress,
  IOrderFulfilment,
  IOrderLine,
  IOrderPayment,
  IOrderTotals,
  OrderSource,
  PaymentStatus,
  ShippingMethod,
} from '../interfaces/order.interface'

type OrderModel = Model<IOrder>

const LineSchema = new Schema<IOrderLine>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: Schema.Types.ObjectId, required: true },
    sku: { type: String, required: true, trim: true },
    productName: { type: String, required: true, trim: true },
    variantLabel: { type: String, required: true, trim: true },
    imageUrl: { type: String },
    slug: { type: String, required: true, trim: true },
    unitPrice: { type: Number, required: true, min: 0 },
    qty: { type: Number, required: true, min: 1 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: true, timestamps: false },
)

const AddressSchema = new Schema<IOrderAddress>(
  {
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    line1: { type: String, required: true, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    country: { type: String, required: true, default: 'NG', trim: true },
    postal: { type: String, trim: true },
  },
  { _id: true, timestamps: false },
)

const TotalsSchema = new Schema<IOrderTotals>(
  {
    subtotal: { type: Number, required: true, min: 0 },
    shipping: { type: Number, required: true, min: 0 },
    discount: { type: Number, required: true, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0 },
  },
  { _id: false },
)

const PaymentSchema = new Schema<IOrderPayment>(
  {
    status: {
      type: String,
      enum: [
        'pending',
        'paid',
        'failed',
        'refunded',
        'partial_refund',
      ] satisfies PaymentStatus[],
      default: 'pending',
      index: true,
    },
    reference: { type: String, required: true, index: true },
    accessCode: { type: String },
    authorizationUrl: { type: String },
    paidAt: { type: Date },
    lastWebhookPayload: { type: Schema.Types.Mixed },
  },
  { _id: false },
)

const FulfilmentSchema = new Schema<IOrderFulfilment>(
  {
    status: {
      type: String,
      enum: [
        'pending',
        'processing',
        'shipped',
        'delivered',
        'cancelled',
      ] satisfies FulfilmentStatus[],
      default: 'pending',
      index: true,
    },
    shippingMethod: {
      type: String,
      enum: ['inhouse', 'sendbox'] satisfies ShippingMethod[],
      required: true,
    },
    trackingCode: { type: String },
    trackingUrl: { type: String },
    shippedAt: { type: Date },
    deliveredAt: { type: Date },
  },
  { _id: false },
)

const OrderSchema = new Schema<IOrder, OrderModel>(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    source: {
      type: String,
      enum: ['web', 'manual', 'imported'] satisfies OrderSource[],
      default: 'web',
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    customerEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
    customerPhone: { type: String, required: true, trim: true },
    lines: { type: [LineSchema], default: [] },
    address: { type: AddressSchema, required: true },
    totals: { type: TotalsSchema, required: true },
    payment: { type: PaymentSchema, required: true },
    fulfilment: { type: FulfilmentSchema, required: true },
    discountCode: { type: String, trim: true },
    internalNotes: { type: String },
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

// Quick lookup of "my latest orders" page.
OrderSchema.index({ userId: 1, createdAt: -1 })

export const Order = model<IOrder, OrderModel>('Order', OrderSchema)
