import Joi from 'joi'
import { validate } from './validate'

// ── Reusable atoms ────────────────────────────────────────────────────

const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .messages({ 'string.pattern.base': 'Malformed id.' })

const checkoutLine = Joi.object({
  productId: objectId.required(),
  variantId: objectId.required(),
  qty: Joi.number().integer().min(1).max(99).required().messages({
    'number.min': 'Quantity must be at least 1.',
    'number.max': 'Quantity cannot exceed 99 per line.',
    'any.required': 'Quantity is required.',
  }),
})

const address = Joi.object({
  fullName: Joi.string().trim().min(2).max(120).required().messages({
    'string.empty': 'Full name is required.',
    'any.required': 'Full name is required.',
  }),
  phone: Joi.string()
    .trim()
    .pattern(/^\+?[0-9\s-]{7,20}$/)
    .required()
    .messages({
      'string.empty': 'Phone number is required.',
      'string.pattern.base': 'Please enter a valid phone number.',
      'any.required': 'Phone number is required.',
    }),
  line1: Joi.string().trim().min(2).max(200).required().messages({
    'string.empty': 'Street address is required.',
    'any.required': 'Street address is required.',
  }),
  line2: Joi.string().trim().max(200).allow(''),
  city: Joi.string().trim().min(2).max(80).required().messages({
    'string.empty': 'City is required.',
    'any.required': 'City is required.',
  }),
  state: Joi.string().trim().min(2).max(80).required().messages({
    'string.empty': 'State is required.',
    'any.required': 'State is required.',
  }),
  country: Joi.string().trim().min(2).max(80).default('NG'),
  postal: Joi.string().trim().max(20).allow(''),
})

const orderStatus = Joi.string().valid(
  'pending',
  'paid',
  'failed',
  'refunded',
  'partial_refund',
)
const fulfilmentStatus = Joi.string().valid(
  'pending',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
)

// ── POST /checkout/shipping-rates ─────────────────────────────────────
export const validateShippingRates = validate({
  body: Joi.object({
    lines: Joi.array().items(checkoutLine).min(1).required().messages({
      'array.min': 'Your bag is empty.',
      'any.required': 'Order lines are required.',
    }),
    destination: Joi.object({
      city: Joi.string().trim().min(2).max(80).required(),
      state: Joi.string().trim().min(2).max(80).required().messages({
        'any.required': 'Delivery state is required.',
      }),
      country: Joi.string().trim().min(2).max(80).default('NG'),
      postal: Joi.string().trim().max(20).allow(''),
    }).required(),
  }),
})

// ── POST /checkout/initialize ─────────────────────────────────────────
export const validateInitializeCheckout = validate({
  body: Joi.object({
    lines: Joi.array().items(checkoutLine).min(1).required().messages({
      'array.min': 'Your bag is empty.',
      'any.required': 'Order lines are required.',
    }),
    address: address.required(),
    customerEmail: Joi.string().trim().lowercase().email().required().messages({
      'string.email': 'Please enter a valid email address.',
      'any.required': 'Email is required.',
    }),
    customerPhone: Joi.string()
      .trim()
      .pattern(/^\+?[0-9\s-]{7,20}$/)
      .required()
      .messages({
        'string.pattern.base': 'Please enter a valid phone number.',
        'any.required': 'Phone number is required.',
      }),
    shippingMethod: Joi.string().valid('inhouse', 'sendbox').required().messages({
      'any.only': 'Pick a valid shipping method.',
      'any.required': 'Pick a shipping method.',
    }),
    shippingAmount: Joi.number().integer().min(0).required().messages({
      'any.required': 'Shipping amount is required.',
    }),
    discountCode: Joi.string().trim().max(40).allow(''),
    referralCode: Joi.string().trim().max(40).allow(''),
  }),
})

// ── POST /checkout/verify/:reference ──────────────────────────────────
export const validateVerifyCheckout = validate({
  params: Joi.object({
    reference: Joi.string()
      .trim()
      .pattern(/^MS-\d{4}-\d{5}$/)
      .required()
      .messages({
        'string.pattern.base': 'Reference must be a Mensa order number (MS-YYYY-NNNNN).',
        'any.required': 'Reference is required.',
      }),
  }),
})

// ── PATCH /admin/orders/:id/fulfilment ────────────────────────────────
export const validateAdminOrderIdParam = validate({
  params: Joi.object({
    id: objectId.required().messages({ 'any.required': 'Order id is required.' }),
  }),
})

export const validateUpdateOrderFulfilment = validate({
  params: Joi.object({
    id: objectId.required().messages({ 'any.required': 'Order id is required.' }),
  }),
  body: Joi.object({
    status: fulfilmentStatus.required().messages({
      'any.only':
        'Status must be one of pending, processing, shipped, delivered, cancelled.',
      'any.required': 'Status is required.',
    }),
    trackingCode: Joi.string().trim().max(120).allow(''),
    trackingUrl: Joi.string().trim().uri().max(500).allow(''),
    note: Joi.string().trim().max(1000).allow(''),
  }),
})

// ── GET /orders + /admin/orders query params ──────────────────────────
export const validateListOrders = validate({
  query: Joi.object({
    paymentStatus: orderStatus,
    fulfilmentStatus,
    page: Joi.number().integer().min(1).default(1),
    pageSize: Joi.number().integer().min(1).max(100).default(24),
  }),
})

// ── GET /orders/:id ────────────────────────────────────────────────────
export const validateOrderIdParam = validate({
  params: Joi.object({
    id: objectId.required().messages({ 'any.required': 'Order id is required.' }),
  }),
})

// ── GET /orders/track/:orderNumber?email=... ──────────────────────────
export const validateTrackOrder = validate({
  params: Joi.object({
    orderNumber: Joi.string()
      .trim()
      .pattern(/^MS-\d{4}-\d{5}$/)
      .required()
      .messages({
        'string.pattern.base': 'Order number must look like MS-YYYY-NNNNN.',
        'any.required': 'Order number is required.',
      }),
  }),
  query: Joi.object({
    email: Joi.string().trim().lowercase().email().required().messages({
      'string.email': 'Please enter the email you used at checkout.',
      'any.required': 'Email is required to look up an order.',
    }),
  }),
})

// ── POST /webhooks/paystack/dev-fire ──────────────────────────────────
export const validateDevFireWebhook = validate({
  body: Joi.object({
    reference: Joi.string()
      .trim()
      .pattern(/^MS-\d{4}-\d{5}$/)
      .required()
      .messages({
        'string.pattern.base': 'Reference must be a Mensa order number (MS-YYYY-NNNNN).',
        'any.required': 'Reference is required.',
      }),
    event: Joi.string().valid('charge.success', 'charge.failed').default('charge.success'),
  }),
})
