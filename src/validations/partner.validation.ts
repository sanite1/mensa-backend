import Joi from 'joi'
import { validate } from './validate'

const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .messages({ 'string.pattern.base': 'Malformed id.' })

const partnerStatus = Joi.string().valid(
  'pending',
  'approved',
  'active',
  'rejected',
  'suspended',
)

const payoutStatus = Joi.string().valid('pending', 'paid', 'rejected')

// ── POST /partners/apply ─────────────────────────────────────────
export const validateApplyAsPartner = validate({
  body: Joi.object({
    name: Joi.string().trim().min(2).max(120).required().messages({
      'any.required': 'Your name is required.',
    }),
    email: Joi.string().trim().email().required().messages({
      'string.email': 'Please enter a valid email.',
    }),
    phone: Joi.string()
      .trim()
      .pattern(/^\+?[0-9\s-]{7,20}$/)
      .required()
      .messages({
        'string.pattern.base': 'Please enter a valid phone number.',
      }),
    socialHandle: Joi.string().trim().max(80).allow(''),
    notes: Joi.string().trim().max(1000).allow(''),
  }),
})

// ── GET /partners/onboarding (verify token via ?token=) ──────────
export const validateOnboardingTokenQuery = validate({
  query: Joi.object({
    token: Joi.string().trim().min(20).max(200).required(),
  }),
})

// ── POST /partners/onboarding/complete ───────────────────────────
const bankAccountSchema = Joi.object({
  accountName: Joi.string().trim().min(2).max(120).required(),
  accountNumber: Joi.string()
    .trim()
    .pattern(/^[0-9]{6,12}$/)
    .required()
    .messages({
      'string.pattern.base': 'Account number must be 6 to 12 digits.',
    }),
  bankName: Joi.string().trim().min(2).max(120).required(),
  bankCode: Joi.string().trim().max(20).allow(''),
})

export const validateCompleteOnboarding = validate({
  body: Joi.object({
    token: Joi.string().trim().min(20).max(200).required(),
    password: Joi.string().min(8).max(200).required().messages({
      'string.min': 'Password must be at least 8 characters.',
    }),
    referralCode: Joi.string()
      .trim()
      .uppercase()
      .pattern(/^[A-Z0-9]{3,16}$/)
      .allow(''),
    bankAccount: bankAccountSchema.required(),
  }),
})

// ── PATCH /partners/me/bank-account ──────────────────────────────
export const validateUpdateBankAccount = validate({
  body: bankAccountSchema,
})

// ── Admin: GET /admin/partnerships/individuals ───────────────────
export const validateAdminListPartners = validate({
  query: Joi.object({
    status: partnerStatus,
    q: Joi.string().trim().max(120).allow(''),
    page: Joi.number().integer().min(1).default(1),
    pageSize: Joi.number().integer().min(1).max(100).default(24),
  }),
})

export const validatePartnerIdParam = validate({
  params: Joi.object({
    id: objectId.required(),
  }),
})

// ── Admin: PATCH /admin/partnerships/individuals/:id/approve ────
export const validateApprovePartner = validate({
  params: Joi.object({
    id: objectId.required(),
  }),
  body: Joi.object({
    commissionRate: Joi.number().min(0).max(100),
  }),
})

// ── Admin: PATCH /admin/partnerships/individuals/:id/reject ─────
export const validateRejectPartner = validate({
  params: Joi.object({
    id: objectId.required(),
  }),
  body: Joi.object({
    rejectionReason: Joi.string().trim().max(1000).allow(''),
  }),
})

// ── Admin: PATCH /admin/partnerships/individuals/:id ────────────
export const validateUpdatePartner = validate({
  params: Joi.object({
    id: objectId.required(),
  }),
  body: Joi.object({
    commissionRate: Joi.number().min(0).max(100),
    status: Joi.string().valid('active', 'suspended'),
  }).min(1),
})

// ── Admin: GET /admin/partnerships/payouts ──────────────────────
export const validateListPayouts = validate({
  query: Joi.object({
    status: payoutStatus,
    page: Joi.number().integer().min(1).default(1),
    pageSize: Joi.number().integer().min(1).max(100).default(24),
  }),
})

// ── Admin: PATCH /admin/partnerships/payouts/:id/pay ────────────
export const validateMarkPayoutPaid = validate({
  params: Joi.object({
    id: objectId.required(),
  }),
  body: Joi.object({
    paymentReference: Joi.string().trim().min(1).max(120).required().messages({
      'any.required': 'A payment reference is required.',
    }),
    adminNote: Joi.string().trim().max(1000).allow(''),
  }),
})

// ── Admin: PATCH /admin/partnerships/payouts/:id/reject ─────────
export const validateRejectPayout = validate({
  params: Joi.object({
    id: objectId.required(),
  }),
  body: Joi.object({
    adminNote: Joi.string().trim().max(1000).allow(''),
  }),
})
