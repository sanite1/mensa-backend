import Joi from 'joi'
import { validate } from './validate'

// ── Reusable atoms ──────────────────────────────────────────────────

const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .messages({ 'string.pattern.base': 'Malformed id.' })

const code = Joi.string()
  .trim()
  .pattern(/^[A-Za-z0-9_-]{2,40}$/)
  .messages({
    'string.empty': 'Code is required.',
    'any.required': 'Code is required.',
    'string.pattern.base':
      'Code must be 2-40 characters, letters / numbers / dash / underscore only.',
  })

const type = Joi.string().valid('percent', 'fixed').messages({
  'any.only': 'Type must be either percent or fixed.',
})

// Type aware: percent 1 to 100, fixed >= 1 kobo. Mongoose validates the range too, but rejecting at the edge gives a cleaner 422.
const value = Joi.alternatives().conditional('type', {
  is: 'percent',
  then: Joi.number().integer().min(1).max(100).required().messages({
    'number.max': 'Percent discounts must be between 1 and 100.',
    'number.min': 'Percent discounts must be at least 1.',
  }),
  otherwise: Joi.number().integer().min(1).required().messages({
    'number.min': 'Fixed discount must be at least 1 kobo.',
  }),
})

const expiresAt = Joi.string().isoDate().allow(null, '')
const maxUses = Joi.number().integer().min(1).allow(null)
const description = Joi.string().trim().max(200).allow('')

// ── List query ──────────────────────────────────────────────────────
export const validateListDiscounts = validate({
  query: Joi.object({
    isActive: Joi.boolean(),
    page: Joi.number().integer().min(1).default(1),
    pageSize: Joi.number().integer().min(1).max(100).default(24),
  }),
})

// ── Id param ────────────────────────────────────────────────────────
export const validateDiscountIdParam = validate({
  params: Joi.object({
    id: objectId.required().messages({ 'any.required': 'Discount id is required.' }),
  }),
})

// ── Create ──────────────────────────────────────────────────────────
export const validateCreateDiscount = validate({
  body: Joi.object({
    code: code.required(),
    type: type.required(),
    value,
    expiresAt,
    maxUses,
    isActive: Joi.boolean().default(true),
    description,
  }),
})

// ── Update ──────────────────────────────────────────────────────────
export const validateUpdateDiscount = validate({
  params: Joi.object({ id: objectId.required() }),
  body: Joi.object({
    code,
    type,
    value: Joi.number().integer().min(1),
    expiresAt,
    maxUses,
    isActive: Joi.boolean(),
    description,
  }).min(1).messages({
    'object.min': 'Send at least one field to update.',
  }),
})

// ── Public: POST /checkout/apply-discount ──────────────────────────
export const validateApplyDiscount = validate({
  body: Joi.object({
    code: code.required(),
    subtotal: Joi.number().integer().min(1).required().messages({
      'number.min': 'Subtotal must be at least 1 kobo.',
      'any.required': 'Subtotal is required.',
    }),
  }),
})
