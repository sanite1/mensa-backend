import Joi from 'joi'
import { validate } from './validate'

const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .messages({ 'string.pattern.base': 'Malformed id.' })

const line = Joi.object({
  kind: Joi.string().valid('catalogue', 'custom').required(),
  productId: Joi.when('kind', {
    is: 'catalogue',
    then: objectId.required(),
    otherwise: Joi.forbidden(),
  }),
  variantId: Joi.when('kind', {
    is: 'catalogue',
    then: objectId.required(),
    otherwise: Joi.forbidden(),
  }),
  description: Joi.when('kind', {
    is: 'custom',
    then: Joi.string().trim().min(2).max(160).required().messages({
      'any.required': 'Custom lines need a description.',
      'string.min': 'Custom lines need a description.',
    }),
    otherwise: Joi.string().trim().max(160).allow(''),
  }),
  unitPrice: Joi.when('kind', {
    is: 'custom',
    then: Joi.number().integer().min(0).max(1_000_000_000).required().messages({
      'any.required': 'Custom lines need a price.',
    }),
    otherwise: Joi.number().integer().min(0).max(1_000_000_000),
  }),
  qty: Joi.number().integer().min(1).max(10_000).required(),
})

const customer = Joi.object({
  name: Joi.string().trim().min(2).max(120).required().messages({
    'any.required': 'Customer name is required.',
    'string.min': 'Customer name is required.',
  }),
  email: Joi.string().trim().email().required().messages({
    'string.email': 'Please enter a valid customer email.',
    'any.required': 'Customer email is required.',
  }),
  phone: Joi.string().trim().max(30).allow(''),
  address: Joi.string().trim().max(300).allow(''),
  userId: objectId.allow('', null),
  b2bOrgId: objectId.allow('', null),
})

const upsertBody = Joi.object({
  customer: customer.required(),
  lines: Joi.array().items(line).min(1).max(100).required().messages({
    'array.min': 'Add at least one line to the invoice.',
  }),
  discountKobo: Joi.number().integer().min(0).max(1_000_000_000).default(0),
  vatPercent: Joi.number().min(0).max(100).allow(null).default(null),
  shippingKobo: Joi.number().integer().min(0).max(1_000_000_000).default(0),
  shippingLabel: Joi.string().trim().max(60).allow(''),
  notes: Joi.string().trim().max(2000).allow(''),
  dueDate: Joi.date().iso().allow(null, ''),
})

// ── POST /admin/invoices ─────────────────────────────────────────
export const validateCreateInvoice = validate({ body: upsertBody })

// ── PUT /admin/invoices/:id ──────────────────────────────────────
export const validateUpdateInvoice = validate({
  params: Joi.object({ id: objectId.required() }),
  body: upsertBody,
})

// ── GET /admin/invoices ──────────────────────────────────────────
export const validateListInvoices = validate({
  query: Joi.object({
    status: Joi.string().valid('draft', 'sent', 'viewed', 'paid', 'void', 'overdue'),
    q: Joi.string().trim().max(120).allow(''),
    page: Joi.number().integer().min(1).default(1),
    pageSize: Joi.number().integer().min(1).max(100).default(24),
  }),
})

// ── GET /admin/invoices/products ─────────────────────────────────
export const validateSearchInvoiceProducts = validate({
  query: Joi.object({ q: Joi.string().trim().max(120).allow('') }),
})

// ── :id only ─────────────────────────────────────────────────────
export const validateInvoiceIdParam = validate({
  params: Joi.object({ id: objectId.required() }),
})

// ── PUT /admin/invoices/settings ─────────────────────────────────
export const validateUpdateInvoiceSettings = validate({
  body: Joi.object({
    bankName: Joi.string().trim().max(80).allow('').required(),
    accountName: Joi.string().trim().max(120).allow('').required(),
    accountNumber: Joi.string().trim().max(40).allow('').required(),
    contactPhone: Joi.string().trim().max(40).allow('').required(),
    contactAddress: Joi.string().trim().max(200).allow('').required(),
    contactWebsite: Joi.string().trim().max(120).allow('').required(),
    defaultVatPercent: Joi.number().min(0).max(100).allow(null).required(),
  }),
})
