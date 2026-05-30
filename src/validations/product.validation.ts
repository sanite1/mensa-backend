import Joi from 'joi'
import { validate } from './validate'

// ── Reusable atoms ────────────────────────────────────────────────────

const slug = Joi.string()
  .trim()
  .lowercase()
  .pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(120)
  .messages({
    'string.empty': 'Slug is required.',
    'any.required': 'Slug is required.',
    'string.pattern.base': 'Slug must be lowercase letters, numbers, and dashes.',
    'string.max': 'Slug must be 120 characters or fewer.',
  })

const category = Joi.string().valid('pants', 'pads', 'bundles', 'education').messages({
  'any.only': 'Category must be pants, pads, bundles, or education.',
  'string.empty': 'Category is required.',
  'any.required': 'Category is required.',
})

const priceKobo = Joi.number().integer().min(0).messages({
  'number.base': 'Price must be a whole number of kobo.',
  'number.integer': 'Price must be a whole number of kobo.',
  'number.min': 'Price cannot be negative.',
})

const variant = Joi.object({
  // SKU is auto-computed server side. Admin may still send one (it's just
  // ignored) so the same DTO works for round-tripping a fetched product.
  sku: Joi.string().trim().max(80).allow('').optional(),
  options: Joi.object().pattern(Joi.string(), Joi.string().allow('')).default({}),
  stockCount: Joi.number().integer().min(0).default(0).messages({
    'number.integer': 'Stock count must be a whole number.',
    'number.min': 'Stock count cannot be negative.',
  }),
  lowStockThreshold: Joi.number().integer().min(0).default(5),
  b2cPriceOverride: priceKobo.allow(null).default(null),
  b2bPriceOverride: priceKobo.allow(null).default(null),
  isActive: Joi.boolean().default(true),
})

const optionTypes = Joi.array()
  .items(Joi.string().trim().min(1).max(40))
  .default([])
  .messages({
    'array.includesRequiredUnknowns': 'Each option type must be a short label.',
  })

const trustLine = Joi.object({
  icon: Joi.string()
    .valid('truck', 'shield', 'leaf', 'star', 'check', 'mail')
    .required()
    .messages({
      'any.only': 'Trust line icon must be one of truck, shield, leaf, star, check, mail.',
      'any.required': 'Trust line icon is required.',
    }),
  text: Joi.string().trim().min(1).max(200).required().messages({
    'string.empty': 'Trust line text is required.',
    'any.required': 'Trust line text is required.',
    'string.max': 'Trust line text must be 200 characters or fewer.',
  }),
})

const accordion = Joi.object({
  heading: Joi.string().trim().min(1).max(80).required().messages({
    'string.empty': 'Section heading is required.',
    'any.required': 'Section heading is required.',
    'string.max': 'Section heading must be 80 characters or fewer.',
  }),
  body: Joi.string().trim().min(1).max(4000).required().messages({
    'string.empty': 'Section body is required.',
    'any.required': 'Section body is required.',
    'string.max': 'Section body must be 4000 characters or fewer.',
  }),
})

const metadata = Joi.object({
  badge: Joi.string().max(40).allow(''),
  badgeTone: Joi.string().valid('pink', 'coral', 'ink'),
  rating: Joi.number().min(0).max(5),
  reviewCount: Joi.number().integer().min(0),
})

// ── List ──────────────────────────────────────────────────────────────
export const validateListProducts = validate({
  query: Joi.object({
    category: Joi.string().valid('pants', 'pads', 'bundles', 'education'),
    q: Joi.string().trim().max(120).allow(''),
    sort: Joi.string().valid('price_asc', 'price_desc', 'newest', 'featured'),
    page: Joi.number().integer().min(1).default(1),
    pageSize: Joi.number().integer().min(1).max(200).default(24),
    includeInactive: Joi.boolean().default(false),
  }),
})

// ── Slug param (for get / update / delete) ────────────────────────────
export const validateProductSlugParam = validate({
  params: Joi.object({
    slug: slug.required(),
  }),
})

// ── Create ────────────────────────────────────────────────────────────
export const validateCreateProduct = validate({
  body: Joi.object({
    slug: slug.required(),
    name: Joi.string().trim().min(1).max(160).required().messages({
      'string.empty': 'Name is required.',
      'any.required': 'Name is required.',
      'string.max': 'Name must be 160 characters or fewer.',
    }),
    subheading: Joi.string().trim().max(220).allow(''),
    shortDescription: Joi.string().trim().max(280).allow(''),
    description: Joi.string().allow(''),
    category: category.required(),
    basePriceB2C: priceKobo.required().messages({
      'any.required': 'Base B2C price is required.',
    }),
    basePriceB2B: priceKobo.required().messages({
      'any.required': 'Base B2B price is required.',
    }),
    salePrice: priceKobo.allow(null).default(null),
    optionTypes,
    variants: Joi.array().items(variant).min(1).required().messages({
      'array.min': 'Add at least one variant.',
      'any.required': 'Variants are required.',
    }),
    accordions: Joi.array().items(accordion).default([]),
    trustLines: Joi.array().items(trustLine).default([]),
    metadata: metadata.default(() => ({})),
    isActive: Joi.boolean().default(true),
    isSoldOut: Joi.boolean().default(false),
  }),
})

// ── Update ────────────────────────────────────────────────────────────
export const validateUpdateProduct = validate({
  params: Joi.object({ slug: slug.required() }),
  body: Joi.object({
    slug,
    name: Joi.string().trim().min(1).max(160),
    subheading: Joi.string().trim().max(220).allow(''),
    shortDescription: Joi.string().trim().max(280).allow(''),
    description: Joi.string().allow(''),
    category,
    basePriceB2C: priceKobo,
    basePriceB2B: priceKobo,
    salePrice: priceKobo.allow(null),
    optionTypes: Joi.array().items(Joi.string().trim().min(1).max(40)),
    variants: Joi.array().items(variant).min(1),
    accordions: Joi.array().items(accordion),
    trustLines: Joi.array().items(trustLine),
    metadata,
    isActive: Joi.boolean(),
    isSoldOut: Joi.boolean(),
  }).min(1).messages({
    'object.min': 'Send at least one field to update.',
  }),
})

// ── Image upload metadata (multipart body fields) ─────────────────────
export const validateAddProductImage = validate({
  params: Joi.object({ slug: slug.required() }),
  body: Joi.object({
    alt: Joi.string().trim().max(200).allow(''),
  }),
})

// ── Image removal ─────────────────────────────────────────────────────
export const validateRemoveProductImage = validate({
  params: Joi.object({
    slug: slug.required(),
    imageId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        'string.pattern.base': 'Image id is malformed.',
        'any.required': 'Image id is required.',
      }),
  }),
})

// ── Image reorder ─────────────────────────────────────────────────────
export const validateReorderImages = validate({
  params: Joi.object({ slug: slug.required() }),
  body: Joi.object({
    orderedImageIds: Joi.array()
      .items(
        Joi.string()
          .pattern(/^[0-9a-fA-F]{24}$/)
          .messages({ 'string.pattern.base': 'Image id is malformed.' }),
      )
      .min(1)
      .required()
      .messages({
        'array.min': 'At least one image id is required.',
        'any.required': 'orderedImageIds is required.',
      }),
  }),
})
