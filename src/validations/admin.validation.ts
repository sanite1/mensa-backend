import Joi from 'joi'
import { validate } from './validate'

const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .messages({ 'string.pattern.base': 'Malformed id.' })

const role = Joi.string().valid('customer', 'admin', 'b2b_admin', 'b2b_member')

// ── GET /admin/customers ──────────────────────────────────────────
export const validateListCustomers = validate({
  query: Joi.object({
    q: Joi.string().trim().max(120).allow(''),
    role,
    // account: has signed up. guest: only ever checked out as a guest.
    kind: Joi.string().valid('account', 'guest'),
    page: Joi.number().integer().min(1).default(1),
    pageSize: Joi.number().integer().min(1).max(100).default(24),
  }),
})

// ── GET /admin/customers/:id ──────────────────────────────────────
// Account holders are addressed by user id, guests by their email.
export const validateCustomerIdParam = validate({
  params: Joi.object({
    id: Joi.alternatives()
      .try(objectId, Joi.string().trim().lowercase().email())
      .required()
      .messages({ 'any.required': 'Customer id is required.' }),
  }),
})
