import Joi from 'joi'
import { validate } from './validate'

const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .messages({ 'string.pattern.base': 'Malformed id.' })

const resultCode = Joi.string().valid('PADS', 'PANT1', 'PANT3', 'PANT5', 'PANT1_PADS', 'PANT3_PADS')

// ── POST /leads/starter-set ──────────────────────────────────────
export const validateSubmitLead = validate({
  body: Joi.object({
    name: Joi.string().trim().min(2).max(120).required().messages({
      'string.min': 'Please enter your name.',
      'any.required': 'Name is required.',
    }),
    email: Joi.string().trim().email().required().messages({
      'string.email': 'Please enter a valid email.',
      'any.required': 'Email is required.',
    }),
    // The eight quiz answers, q1 to q8. Values are short option keys.
    answers: Joi.object()
      .pattern(/^q[1-8]$/, Joi.string().trim().max(40))
      .max(8)
      .required(),
    resultCode: resultCode.required(),
  }),
})

// ── GET /admin/leads ─────────────────────────────────────────────
export const validateAdminListLeads = validate({
  query: Joi.object({
    status: Joi.string().valid('new', 'contacted', 'ordered'),
    q: Joi.string().trim().max(120).allow(''),
    page: Joi.number().integer().min(1).default(1),
    pageSize: Joi.number().integer().min(1).max(200).default(24),
  }),
})

// ── PATCH /admin/leads/:id ───────────────────────────────────────
export const validateUpdateLeadStatus = validate({
  params: Joi.object({ id: objectId.required() }),
  body: Joi.object({
    status: Joi.string().valid('new', 'contacted').required(),
  }),
})

// ── DELETE /admin/leads/:id ──────────────────────────────────────
export const validateLeadIdParam = validate({
  params: Joi.object({ id: objectId.required() }),
})
