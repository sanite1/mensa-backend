import Joi from 'joi'
import { validate } from './validate'

const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .messages({ 'string.pattern.base': 'Malformed id.' })

const source = Joi.string().valid(
  'footer',
  'mobile_drawer',
  'partner_apply',
  'checkout',
  'other',
)
const status = Joi.string().valid('subscribed', 'unsubscribed')

// ── POST /newsletter/subscribe ───────────────────────────────────
export const validateSubscribe = validate({
  body: Joi.object({
    email: Joi.string().trim().email().required().messages({
      'string.email': 'Please enter a valid email.',
      'any.required': 'Email is required.',
    }),
    source,
  }),
})

// ── POST /newsletter/unsubscribe ────────────────────────────────
export const validateUnsubscribe = validate({
  body: Joi.object({
    token: Joi.string().trim().min(20).max(200).required(),
  }),
})

// ── GET /admin/newsletter/subscribers ───────────────────────────
export const validateAdminListSubscribers = validate({
  query: Joi.object({
    status,
    source,
    q: Joi.string().trim().max(120).allow(''),
    page: Joi.number().integer().min(1).default(1),
    pageSize: Joi.number().integer().min(1).max(200).default(24),
  }),
})

// ── DELETE /admin/newsletter/subscribers/:id ────────────────────
export const validateSubscriberIdParam = validate({
  params: Joi.object({
    id: objectId.required(),
  }),
})
