// invoice.service.ts — admin issued invoices anyone can pay by link.
// Lines are frozen on the invoice like order lines. Catalogue stock is
// reserved when the invoice is SENT and released on void or when a sent
// invoice is edited, so an unpaid draft never holds stock. Overdue is
// derived from dueDate at read time and never stored.

import crypto from 'crypto'
import { Types } from 'mongoose'
import type { FilterQuery } from 'mongoose'

import { Invoice } from '../models/Invoice'
import { InvoiceSettings } from '../models/InvoiceSettings'
import { Product } from '../models/Product'
import { ApiError } from '../errors/apiError'
import { ApiResponse } from '../errors/apiResponse'
import { mintInvoiceNumber } from '../helpers/invoiceNumber'
import { reserveVariantStock, restoreVariantStock, type StockItem } from './stock.service'
import { sendMail } from './nodemailer/mail.service'
import { logger } from '../config/logger'
import type {
  AdminListInvoicesQuery,
  AdminListInvoicesResult,
  IInvoice,
  IInvoiceLine,
  IInvoiceSettings,
  IInvoiceTotals,
  InvoiceDocument,
  InvoiceLineInput,
  InvoiceProductPick,
  UpdateInvoiceSettingsInput,
  UpsertInvoiceInput,
} from '../interfaces/invoice.interface'
import type { ProductDocument } from '../interfaces/product.interface'

const DEFAULT_PAGE_SIZE = 24
const MAX_PAGE_SIZE = 100

const escapeRegex = (input: string): string => input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// ─── Maths ───────────────────────────────────────────────────────

/** Single source for invoice totals. Discount comes off the subtotal, VAT
 *  is charged on what remains, shipping is added last. All kobo. */
export function computeInvoiceTotals(
  lines: Pick<IInvoiceLine, 'lineTotal'>[],
  discountKobo: number,
  vatPercent: number | null,
  shippingKobo: number,
): IInvoiceTotals {
  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0)
  const discount = Math.min(subtotal, Math.max(0, discountKobo))
  const taxable = subtotal - discount
  const vat = vatPercent != null && vatPercent > 0 ? Math.round((taxable * vatPercent) / 100) : 0
  const shipping = Math.max(0, shippingKobo)
  return { subtotal, discount, vat, shipping, total: taxable + vat + shipping }
}

/** True for sent or viewed invoices whose due date has passed. */
export function isInvoiceOverdue(invoice: Pick<IInvoice, 'status' | 'dueDate'>): boolean {
  if (invoice.status !== 'sent' && invoice.status !== 'viewed') return false
  if (!invoice.dueDate) return false
  return invoice.dueDate.getTime() < Date.now()
}

// ─── Lines ───────────────────────────────────────────────────────

function variantLabelFor(product: ProductDocument, variant: ProductDocument['variants'][number]) {
  const optionTypes = product.optionTypes ?? []
  if (optionTypes.length === 0) return ''
  return optionTypes
    .map((t) => variant.options?.[t])
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
    .join(' · ')
}

/** Resolve the admin's line inputs into frozen invoice lines. Catalogue
 *  lines are looked up so the description, sku and default price are real,
 *  the admin can still override the price. */
async function buildLines(inputs: InvoiceLineInput[]): Promise<Omit<IInvoiceLine, '_id'>[]> {
  if (inputs.length === 0) throw new ApiError(422, 'Add at least one line to the invoice.')

  const lines: Omit<IInvoiceLine, '_id'>[] = []
  for (const input of inputs) {
    if (input.qty < 1) throw new ApiError(422, 'Each line needs a quantity of at least 1.')

    if (input.kind === 'custom') {
      const description = input.description?.trim()
      if (!description) throw new ApiError(422, 'Custom lines need a description.')
      if (input.unitPrice == null || input.unitPrice < 0) {
        throw new ApiError(422, `"${description}" needs a price.`)
      }
      lines.push({
        kind: 'custom',
        productId: null,
        variantId: null,
        description,
        unitPrice: input.unitPrice,
        qty: input.qty,
        lineTotal: input.unitPrice * input.qty,
      })
      continue
    }

    if (
      !input.productId ||
      !input.variantId ||
      !Types.ObjectId.isValid(input.productId) ||
      !Types.ObjectId.isValid(input.variantId)
    ) {
      throw new ApiError(422, 'Catalogue lines need a product and a variant.')
    }
    const product = (await Product.findById(input.productId)) as ProductDocument | null
    if (!product || !product.isActive) {
      throw new ApiError(404, 'One of the products on this invoice is no longer available.')
    }
    const variant = product.variants.find((v) => String(v._id) === input.variantId)
    if (!variant || !variant.isActive) {
      throw new ApiError(
        404,
        `One of the selected options for "${product.name}" is no longer available.`,
      )
    }
    const defaultPrice = variant.b2cPriceOverride ?? product.salePrice ?? product.basePriceB2C
    const unitPrice = input.unitPrice ?? defaultPrice
    if (unitPrice < 0) throw new ApiError(422, `"${product.name}" needs a valid price.`)

    lines.push({
      kind: 'catalogue',
      productId: product._id,
      variantId: variant._id as Types.ObjectId,
      description: input.description?.trim() || product.name,
      variantLabel: variantLabelFor(product, variant),
      sku: variant.sku,
      unitPrice,
      qty: input.qty,
      lineTotal: unitPrice * input.qty,
    })
  }
  return lines
}

function stockItemsFor(lines: IInvoiceLine[]): StockItem[] {
  return lines
    .filter((l) => l.kind === 'catalogue' && l.productId && l.variantId)
    .map((l) => ({
      productId: l.productId as Types.ObjectId,
      variantId: l.variantId as Types.ObjectId,
      qty: l.qty,
    }))
}

/** Every catalogue line must be in stock right now. Used before sending so
 *  the admin hears about a shortfall before the customer does. */
async function assertLinesInStock(lines: IInvoiceLine[]): Promise<void> {
  for (const line of lines) {
    if (line.kind !== 'catalogue' || !line.productId) continue
    const product = (await Product.findById(line.productId)) as ProductDocument | null
    const variant = product?.variants.find((v) => String(v._id) === String(line.variantId))
    if (!product || !variant) {
      throw new ApiError(409, `"${line.description}" is no longer in the catalogue.`)
    }
    if (product.isSoldOut || variant.stockCount < line.qty) {
      throw new ApiError(
        409,
        `Only ${Math.max(0, variant.stockCount)} of "${line.description}${line.variantLabel ? ` (${line.variantLabel})` : ''}" left. Reduce the quantity before sending.`,
      )
    }
  }
}

function applyInputs(
  invoice: InvoiceDocument,
  input: UpsertInvoiceInput,
  lines: Omit<IInvoiceLine, '_id'>[],
) {
  const vatPercent = input.vatPercent ?? null
  const discountKobo = input.discountKobo ?? 0
  const shippingKobo = input.shippingKobo ?? 0

  invoice.customer = {
    name: input.customer.name.trim(),
    email: input.customer.email.trim().toLowerCase(),
    phone: input.customer.phone?.trim() || undefined,
    address: input.customer.address?.trim() || undefined,
    userId:
      input.customer.userId && Types.ObjectId.isValid(input.customer.userId)
        ? new Types.ObjectId(input.customer.userId)
        : null,
    b2bOrgId:
      input.customer.b2bOrgId && Types.ObjectId.isValid(input.customer.b2bOrgId)
        ? new Types.ObjectId(input.customer.b2bOrgId)
        : null,
  }
  invoice.lines = lines as IInvoiceLine[]
  invoice.discountKobo = discountKobo
  invoice.vatPercent = vatPercent
  invoice.shippingKobo = shippingKobo
  invoice.shippingLabel = input.shippingLabel?.trim() || 'Delivery'
  invoice.notes = input.notes?.trim() ?? ''
  invoice.dueDate = input.dueDate ? new Date(input.dueDate) : null
  invoice.totals = computeInvoiceTotals(lines, discountKobo, vatPercent, shippingKobo)
}

// ─── Admin: create / update ──────────────────────────────────────

export const adminCreateInvoiceService = async (
  input: UpsertInvoiceInput,
): Promise<ApiResponse<{ invoice: InvoiceDocument }>> => {
  const lines = await buildLines(input.lines)
  const invoiceNumber = await mintInvoiceNumber()

  const invoice = new Invoice({
    invoiceNumber,
    status: 'draft',
    accessToken: crypto.randomBytes(24).toString('hex'),
    payment: { reference: invoiceNumber },
    customer: { name: '', email: '' },
    totals: { subtotal: 0, discount: 0, vat: 0, shipping: 0, total: 0 },
  }) as InvoiceDocument
  applyInputs(invoice, input, lines)
  if (invoice.totals.total <= 0) {
    throw new ApiError(422, 'The invoice total must be more than zero.')
  }
  await invoice.save()
  logger.info(`[invoice] created ${invoiceNumber} for ${invoice.customer.email}`)
  return new ApiResponse(201, 'Invoice draft saved.', { invoice })
}

export const adminUpdateInvoiceService = async (
  id: string,
  input: UpsertInvoiceInput,
): Promise<ApiResponse<{ invoice: InvoiceDocument }>> => {
  const invoice = (await Invoice.findById(id)) as InvoiceDocument | null
  if (!invoice) throw new ApiError(404, 'Invoice not found.')
  if (invoice.status === 'paid' || invoice.status === 'void') {
    throw new ApiError(400, `A ${invoice.status} invoice cannot be edited.`)
  }

  const lines = await buildLines(input.lines)

  // A sent invoice already holds stock. Release the old lines, then hold the
  // new ones, so the customer's link always reflects what is reserved.
  const wasReserved = invoice.stockReserved
  if (wasReserved) {
    await restoreVariantStock(stockItemsFor(invoice.lines))
    invoice.stockReserved = false
  }

  applyInputs(invoice, input, lines)
  if (invoice.totals.total <= 0) {
    if (wasReserved) await reserveVariantStock(stockItemsFor(invoice.lines))
    throw new ApiError(422, 'The invoice total must be more than zero.')
  }

  if (wasReserved) {
    await reserveVariantStock(stockItemsFor(invoice.lines))
    invoice.stockReserved = true
  }

  await invoice.save()
  return new ApiResponse(200, 'Invoice updated.', { invoice })
}

// ─── Emails ──────────────────────────────────────────────────────

const formatNairaKobo = (kobo: number): string => `₦${(kobo / 100).toLocaleString('en-NG')}`

const formatDueDate = (date: Date | null | undefined): string | null =>
  date ? date.toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' }) : null

export const publicInvoiceUrl = (invoice: Pick<IInvoice, 'accessToken'>): string =>
  `${process.env.FRONTEND_PLATFORM_URL}/invoice/${invoice.accessToken}`

function firstName(name: string): string {
  return name.trim().split(' ')[0] || 'there'
}

/** Best effort, a broken SMTP never fails the send action itself. */
async function dispatchInvoiceEmail(
  invoice: InvoiceDocument,
  template: 'invoiceSent' | 'invoiceReminder',
): Promise<void> {
  const subject =
    template === 'invoiceSent'
      ? `Your Mensa invoice ${invoice.invoiceNumber}`
      : `Reminder: invoice ${invoice.invoiceNumber} is still open`
  try {
    await sendMail({
      to: invoice.customer.email,
      subject,
      template,
      data: {
        invoiceNumber: invoice.invoiceNumber,
        customerName: firstName(invoice.customer.name),
        dueDate: formatDueDate(invoice.dueDate),
        overdue: isInvoiceOverdue(invoice),
        total: formatNairaKobo(invoice.totals.total),
        lines: invoice.lines.map((l) => ({
          description: l.description,
          variantLabel: l.variantLabel ?? null,
          qty: l.qty,
          lineTotal: formatNairaKobo(l.lineTotal),
        })),
        invoiceUrl: publicInvoiceUrl(invoice),
      },
      replyTo: process.env.SUPPORT_EMAIL,
    })
    logger.info(`[invoice] ${template} dispatched for ${invoice.invoiceNumber}`)
  } catch (err) {
    logger.error(`[invoice] ${template} threw for ${invoice.invoiceNumber}`, err)
  }
}

// ─── Admin: send / remind / void ─────────────────────────────────

/** Moves a draft to sent, holds catalogue stock and emails the link. Works
 *  for resend too: stock stays held, the email goes out again. */
export const adminSendInvoiceService = async (
  id: string,
): Promise<ApiResponse<{ invoice: InvoiceDocument }>> => {
  const invoice = (await Invoice.findById(id)) as InvoiceDocument | null
  if (!invoice) throw new ApiError(404, 'Invoice not found.')
  if (invoice.status === 'paid') throw new ApiError(400, 'This invoice is already paid.')
  if (invoice.status === 'void') throw new ApiError(400, 'A void invoice cannot be sent.')

  if (!invoice.stockReserved) {
    await assertLinesInStock(invoice.lines)
    await reserveVariantStock(stockItemsFor(invoice.lines))
    invoice.stockReserved = true
  }
  if (invoice.status === 'draft') invoice.status = 'sent'
  invoice.sentAt = new Date()
  await invoice.save()
  logger.info(`[invoice] ${invoice.invoiceNumber} sent to ${invoice.customer.email}`)

  await dispatchInvoiceEmail(invoice, 'invoiceSent')
  return new ApiResponse(200, 'Invoice sent.', { invoice })
}

export const adminRemindInvoiceService = async (
  id: string,
): Promise<ApiResponse<{ invoice: InvoiceDocument }>> => {
  const invoice = (await Invoice.findById(id)) as InvoiceDocument | null
  if (!invoice) throw new ApiError(404, 'Invoice not found.')
  if (invoice.status !== 'sent' && invoice.status !== 'viewed') {
    throw new ApiError(400, 'Reminders only go out for sent invoices that are still unpaid.')
  }
  await dispatchInvoiceEmail(invoice, 'invoiceReminder')
  return new ApiResponse(200, 'Reminder sent.', { invoice })
}

// ─── Public: view by token ───────────────────────────────────────

/** The customer's view. Drafts are invisible, a first open flips sent to
 *  viewed. Settings ride along so the page can print the bank details. */
export const getPublicInvoiceService = async (
  token: string,
): Promise<ApiResponse<{ invoice: InvoiceDocument; settings: IInvoiceSettings }>> => {
  const invoice = (await Invoice.findOne({ accessToken: token })) as InvoiceDocument | null
  if (!invoice || invoice.status === 'draft') throw new ApiError(404, 'Invoice not found.')

  if (invoice.status === 'sent') {
    invoice.status = 'viewed'
    invoice.viewedAt = new Date()
    await invoice.save()
  }
  const settings = (await getInvoiceSettingsService()).data as IInvoiceSettings
  return new ApiResponse(200, 'OK.', { invoice, settings })
}

export const adminVoidInvoiceService = async (
  id: string,
): Promise<ApiResponse<{ invoice: InvoiceDocument }>> => {
  const invoice = (await Invoice.findById(id)) as InvoiceDocument | null
  if (!invoice) throw new ApiError(404, 'Invoice not found.')
  if (invoice.status === 'paid') {
    throw new ApiError(400, 'A paid invoice cannot be voided. Refund the order instead.')
  }
  if (invoice.status === 'void')
    return new ApiResponse(200, 'Invoice is already void.', { invoice })

  if (invoice.stockReserved) {
    await restoreVariantStock(stockItemsFor(invoice.lines))
    invoice.stockReserved = false
  }
  invoice.status = 'void'
  invoice.voidedAt = new Date()
  await invoice.save()
  logger.info(`[invoice] ${invoice.invoiceNumber} voided`)
  return new ApiResponse(200, 'Invoice voided.', { invoice })
}

// ─── Admin: reads ────────────────────────────────────────────────

export const adminListInvoicesService = async (
  query: AdminListInvoicesQuery,
): Promise<ApiResponse<AdminListInvoicesResult>> => {
  const page = Math.max(1, query.page ?? 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE))

  const filter: FilterQuery<IInvoice> = {}
  if (query.status === 'overdue') {
    filter.status = { $in: ['sent', 'viewed'] }
    filter.dueDate = { $lt: new Date() }
  } else if (query.status) {
    filter.status = query.status
  }
  const q = query.q?.trim()
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i')
    filter.$or = [{ invoiceNumber: rx }, { 'customer.name': rx }, { 'customer.email': rx }]
  }

  const [items, total] = await Promise.all([
    Invoice.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize) as unknown as Promise<InvoiceDocument[]>,
    Invoice.countDocuments(filter),
  ])

  return new ApiResponse(200, 'OK.', {
    items,
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  })
}

export const adminGetInvoiceService = async (
  id: string,
): Promise<ApiResponse<{ invoice: InvoiceDocument }>> => {
  const invoice = (await Invoice.findById(id)) as InvoiceDocument | null
  if (!invoice) throw new ApiError(404, 'Invoice not found.')
  return new ApiResponse(200, 'OK.', { invoice })
}

/** Catalogue search for the line picker, every variant with its live stock
 *  so the admin never invoices something that is not there. */
export const adminSearchInvoiceProductsService = async (
  q: string | undefined,
): Promise<ApiResponse<{ products: InvoiceProductPick[] }>> => {
  const filter: FilterQuery<ProductDocument> = { isActive: true }
  const term = q?.trim()
  if (term) filter.name = new RegExp(escapeRegex(term), 'i')

  const products = (await Product.find(filter)
    .sort({ name: 1 })
    .limit(40)) as unknown as ProductDocument[]

  const picks: InvoiceProductPick[] = products.map((p) => ({
    productId: String(p._id),
    name: p.name,
    slug: p.slug,
    isSoldOut: p.isSoldOut,
    variants: p.variants.map((v) => ({
      variantId: String(v._id),
      label: variantLabelFor(p, v) || p.name,
      sku: v.sku,
      stockCount: v.stockCount,
      unitPrice: v.b2cPriceOverride ?? p.salePrice ?? p.basePriceB2C,
      isActive: v.isActive,
    })),
  }))

  return new ApiResponse(200, 'OK.', { products: picks })
}

// ─── Settings ────────────────────────────────────────────────────

export const getInvoiceSettingsService = async (): Promise<ApiResponse<IInvoiceSettings>> => {
  const doc = await InvoiceSettings.findOneAndUpdate(
    { key: 'invoice' },
    { $setOnInsert: { key: 'invoice' } },
    { upsert: true, new: true },
  )
  return new ApiResponse(200, 'OK.', doc as IInvoiceSettings)
}

export const updateInvoiceSettingsService = async (
  input: UpdateInvoiceSettingsInput,
): Promise<ApiResponse<IInvoiceSettings>> => {
  const doc = await InvoiceSettings.findOneAndUpdate(
    { key: 'invoice' },
    { $set: input },
    { upsert: true, new: true },
  )
  return new ApiResponse(200, 'Invoice settings saved.', doc as IInvoiceSettings)
}
