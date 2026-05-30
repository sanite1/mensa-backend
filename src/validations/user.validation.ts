import Joi from 'joi'
import { validate } from './validate'

const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .messages({ 'string.pattern.base': 'Malformed id.' })

// Mirror of the checkout address schema so saved addresses can prefill
// checkout without any field gymnastics.
const addressBody = {
  label: Joi.string().trim().max(40).allow(''),
  fullName: Joi.string().trim().min(2).max(120).messages({
    'string.empty': 'Full name is required.',
  }),
  phone: Joi.string()
    .trim()
    .pattern(/^\+?[0-9\s-]{7,20}$/)
    .messages({
      'string.empty': 'Phone number is required.',
      'string.pattern.base': 'Please enter a valid phone number.',
    }),
  line1: Joi.string().trim().min(2).max(200).messages({
    'string.empty': 'Street address is required.',
  }),
  line2: Joi.string().trim().max(200).allow(''),
  city: Joi.string().trim().min(2).max(80).messages({
    'string.empty': 'City is required.',
  }),
  state: Joi.string().trim().min(2).max(80).messages({
    'string.empty': 'State is required.',
  }),
  country: Joi.string().trim().min(2).max(80).default('NG'),
  postal: Joi.string().trim().max(20).allow(''),
  isDefault: Joi.boolean(),
}

export const validateAddressIdParam = validate({
  params: Joi.object({
    id: objectId.required().messages({ 'any.required': 'Address id is required.' }),
  }),
})

export const validateAddAddress = validate({
  body: Joi.object({
    ...addressBody,
    fullName: addressBody.fullName.required(),
    phone: addressBody.phone.required(),
    line1: addressBody.line1.required(),
    city: addressBody.city.required(),
    state: addressBody.state.required(),
  }),
})

export const validateUpdateAddress = validate({
  params: Joi.object({ id: objectId.required() }),
  body: Joi.object(addressBody).min(1).messages({
    'object.min': 'Send at least one field to update.',
  }),
})
