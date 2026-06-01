import Joi from 'joi'
import { validate } from './validate'

const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .messages({ 'string.pattern.base': 'Malformed id.' })

const orgType = Joi.string().valid('school', 'ngo', 'council', 'other')
const verificationStatus = Joi.string().valid('pending', 'verified', 'rejected')

// ── POST /b2b/apply ──────────────────────────────────────────────
export const validateSubmitB2BOrg = validate({
  body: Joi.object({
    name: Joi.string().trim().min(2).max(200).required().messages({
      'any.required': 'Organisation name is required.',
    }),
    type: orgType.required(),
    registrationNumber: Joi.string().trim().max(80).allow(''),
    contactName: Joi.string().trim().min(2).max(120).required(),
    contactEmail: Joi.string().trim().email().required().messages({
      'string.email': 'Please enter a valid email.',
    }),
    contactPhone: Joi.string()
      .trim()
      .pattern(/^\+?[0-9\s-]{7,20}$/)
      .required()
      .messages({
        'string.pattern.base': 'Please enter a valid phone number.',
      }),
    notes: Joi.string().trim().max(1000).allow(''),
  }),
})

// ── GET /admin/partnerships ──────────────────────────────────────
export const validateListPartnerships = validate({
  query: Joi.object({
    verificationStatus,
    q: Joi.string().trim().max(120).allow(''),
    page: Joi.number().integer().min(1).default(1),
    pageSize: Joi.number().integer().min(1).max(100).default(24),
  }),
})

// ── GET /admin/partnerships/:id ──────────────────────────────────
export const validatePartnershipIdParam = validate({
  params: Joi.object({
    id: objectId.required().messages({ 'any.required': 'Partnership id is required.' }),
  }),
})

// ── PATCH /admin/partnerships/:id/verify ─────────────────────────
export const validateVerifyPartnership = validate({
  params: Joi.object({
    id: objectId.required(),
  }),
  body: Joi.object({
    verificationStatus: Joi.string().valid('verified', 'rejected').required(),
    verificationNote: Joi.string().trim().max(1000).allow(''),
  }),
})
