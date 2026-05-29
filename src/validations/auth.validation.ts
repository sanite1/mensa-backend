import Joi from 'joi'
import { validate } from './validate'

const email = Joi.string().trim().lowercase().email().required().messages({
  'string.empty': 'Email is required.',
  'any.required': 'Email is required.',
  'string.email': 'Please enter a valid email address.',
})

const password = Joi.string()
  .min(8)
  .max(128)
  .pattern(/[A-Za-z]/, { name: 'letter' })
  .pattern(/[0-9]/, { name: 'number' })
  .required()
  .messages({
    'string.empty': 'Password is required.',
    'any.required': 'Password is required.',
    'string.min': 'Password must be at least 8 characters.',
    'string.max': 'Password cannot be longer than 128 characters.',
    'string.pattern.name': 'Password must contain at least one {#name}.',
  })

const name = Joi.string().trim().min(2).max(80).required().messages({
  'string.empty': 'Name is required.',
  'any.required': 'Name is required.',
  'string.min': 'Name must be at least 2 characters.',
  'string.max': 'Name cannot be longer than 80 characters.',
})

const phone = Joi.string()
  .trim()
  .pattern(/^\+?[0-9\s-]{7,20}$/)
  .required()
  .messages({
    'string.empty': 'Phone number is required.',
    'any.required': 'Phone number is required.',
    'string.pattern.base': 'Please enter a valid phone number.',
  })

export const validateRegister = validate({
  body: Joi.object({ email, password, name, phone }),
})

export const validateLogin = validate({
  body: Joi.object({
    email,
    password: Joi.string().required().messages({
      'string.empty': 'Password is required.',
      'any.required': 'Password is required.',
    }),
  }),
})

export const validateForgotPassword = validate({
  body: Joi.object({ email }),
})

export const validateResetPassword = validate({
  body: Joi.object({
    token: Joi.string().min(32).required().messages({
      'string.empty': 'Reset token is required.',
      'any.required': 'Reset token is required.',
      'string.min': 'Reset link is invalid.',
    }),
    password,
  }),
})
