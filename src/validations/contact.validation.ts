import Joi from 'joi'
import { validate } from './validate'

const topic = Joi.string().valid('order', 'product', 'partnership', 'press', 'other')

export const validateSubmitContact = validate({
  body: Joi.object({
    name: Joi.string().trim().min(2).max(120).required().messages({
      'any.required': 'Your name is required.',
      'string.min': 'Name is too short.',
    }),
    email: Joi.string().trim().email().required().messages({
      'string.email': 'Please enter a valid email.',
      'any.required': 'Email is required.',
    }),
    topic: topic.required().messages({
      'any.required': 'Pick a topic.',
      'any.only': 'Pick a valid topic.',
    }),
    // Only relevant when topic is 'order'. We don't enforce the format
    // strictly — accept anything that looks like a reference, so the
    // visitor isn't blocked by a typo when they're already frustrated.
    orderNumber: Joi.string().trim().max(40).allow(''),
    message: Joi.string().trim().min(10).max(4000).required().messages({
      'string.min': 'Message must be at least 10 characters.',
      'any.required': 'Message is required.',
    }),
  }),
})
