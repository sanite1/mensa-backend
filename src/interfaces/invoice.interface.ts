import type { Document, Types } from 'mongoose'

/** draft: being built. sent: emailed, stock reserved. viewed: the customer
 *  opened the link. paid: Paystack confirmed. void: cancelled, stock released.
 *  Overdue is derived from dueDate at read time, never stored. */
export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'paid' | 'void'

export type InvoiceLineKind = 'catalogue' | 'custom'

/** A line frozen on the invoice. Catalogue lines carry the product and
 *  variant they came from so a paid invoice can become an order. */
export interface IInvoiceLine {
  _id?: Types.ObjectId
  kind: InvoiceLineKind
  productId?: Types.ObjectId | null
  variantId?: Types.ObjectId | null
  /** Shown as the description on the invoice. */
  description: string
  variantLabel?: string
  sku?: string
  /** kobo, editable by the admin even for catalogue lines. */
  unitPrice: number
  qty: number
  lineTotal: number
}

export interface IInvoiceCustomer {
  name: string
  email: string
  phone?: string
  address?: string
  /** Optional links back to a registered customer or a B2B organisation. */
  userId?: Types.ObjectId | null
  b2bOrgId?: Types.ObjectId | null
}

export interface IInvoiceTotals {
  subtotal: number
  discount: number
  vat: number
  shipping: number
  total: number
}

export interface IInvoicePayment {
  /** Paystack reference, always the invoice number. */
  reference: string
  accessCode?: string
  authorizationUrl?: string
  paidAt?: Date
  lastWebhookPayload?: Record<string, unknown>
}

export interface IInvoice {
  /** INV-YYYY-NNNNN. Doubles as the Paystack reference. */
  invoiceNumber: string
  status: InvoiceStatus
  customer: IInvoiceCustomer
  lines: IInvoiceLine[]
  /** Flat discount in kobo. */
  discountKobo: number
  /** VAT percentage applied after the discount. Null means no VAT line. */
  vatPercent: number | null
  shippingKobo: number
  shippingLabel: string
  notes: string
  dueDate: Date | null
  totals: IInvoiceTotals
  /** Unguessable token in the public link. */
  accessToken: string
  /** True while catalogue stock is held for this invoice. */
  stockReserved: boolean
  sentAt?: Date | null
  viewedAt?: Date | null
  paidAt?: Date | null
  voidedAt?: Date | null
  payment: IInvoicePayment
  /** Order created from the catalogue lines once paid. */
  orderId?: Types.ObjectId | null
  createdAt: Date
  updatedAt: Date
}

export type InvoiceDocument = Document<Types.ObjectId, unknown, IInvoice> & IInvoice

/** Bank and contact details printed on every invoice. Admin editable. */
export interface IInvoiceSettings {
  key: 'invoice'
  bankName: string
  accountName: string
  accountNumber: string
  contactPhone: string
  contactAddress: string
  contactWebsite: string
  /** Default VAT percentage suggested in the builder. Null means off. */
  defaultVatPercent: number | null
  createdAt: Date
  updatedAt: Date
}

// ── DTOs ─────────────────────────────────────────────────────────

export interface InvoiceLineInput {
  kind: InvoiceLineKind
  productId?: string
  variantId?: string
  /** Required for custom lines, optional override for catalogue lines. */
  description?: string
  /** kobo. Optional for catalogue lines, the catalogue price fills in. */
  unitPrice?: number
  qty: number
}

export interface InvoiceCustomerInput {
  name: string
  email: string
  phone?: string
  address?: string
  userId?: string
  b2bOrgId?: string
}

export interface UpsertInvoiceInput {
  customer: InvoiceCustomerInput
  lines: InvoiceLineInput[]
  discountKobo?: number
  vatPercent?: number | null
  shippingKobo?: number
  shippingLabel?: string
  notes?: string
  dueDate?: string | null
}

export interface AdminListInvoicesQuery {
  status?: InvoiceStatus | 'overdue'
  q?: string
  page?: number
  pageSize?: number
}

export interface AdminListInvoicesResult {
  items: InvoiceDocument[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}

export interface UpdateInvoiceSettingsInput {
  bankName: string
  accountName: string
  accountNumber: string
  contactPhone: string
  contactAddress: string
  contactWebsite: string
  defaultVatPercent: number | null
}

/** A catalogue product flattened for the invoice line picker. */
export interface InvoiceProductPick {
  productId: string
  name: string
  slug: string
  isSoldOut: boolean
  variants: Array<{
    variantId: string
    label: string
    sku: string
    stockCount: number
    unitPrice: number
    isActive: boolean
  }>
}
