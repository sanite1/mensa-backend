import Joi from 'joi'
import { validate } from './validate'

const option = Joi.object({
  id: Joi.string().trim().max(64).allow(''),
  name: Joi.string().trim().min(2).max(80).required().messages({
    'string.min': 'Every delivery option needs a name.',
    'any.required': 'Every delivery option needs a name.',
  }),
  feeKobo: Joi.number().integer().min(0).max(100_000_000).required().messages({
    'number.min': 'Delivery fees cannot be negative.',
    'any.required': 'Every delivery option needs a price.',
  }),
  etaMinDays: Joi.number().integer().min(0).max(60).required(),
  etaMaxDays: Joi.number().integer().min(Joi.ref('etaMinDays')).max(90).required().messages({
    'number.min': 'The latest delivery day cannot be before the earliest.',
  }),
  coverage: Joi.string().valid('all', 'states').required(),
  states: Joi.when('coverage', {
    is: 'states',
    then: Joi.array().items(Joi.string().trim().min(2).max(40)).min(1).required().messages({
      'array.min': 'Pick at least one state, or switch the option to all states.',
    }),
    otherwise: Joi.array().items(Joi.string()).default([]),
  }),
  enabled: Joi.boolean().required(),
  sortOrder: Joi.number().integer().min(0).default(0),
})

// ── PUT /admin/shipping-settings ─────────────────────────────────
export const validateUpdateShippingSettings = validate({
  body: Joi.object({
    freeDeliveryThresholdKobo: Joi.number()
      .integer()
      .min(0)
      .max(1_000_000_000)
      .allow(null)
      .required(),
    options: Joi.array().items(option).min(1).max(30).required().messages({
      'array.min': 'Add at least one delivery option.',
    }),
  }),
})
