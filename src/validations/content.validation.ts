import Joi from 'joi'
import { validate } from './validate'

const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .messages({ 'string.pattern.base': 'Malformed id.' })

const kind = Joi.string().valid('journal', 'education')
const category = Joi.string().valid(
  'classroom',
  'product',
  'community',
  'policy',
  'care',
)
const status = Joi.string().valid('draft', 'published')

const slug = Joi.string()
  .trim()
  .lowercase()
  .min(1)
  .max(120)
  .pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .messages({
    'string.pattern.base': 'Slug must be lowercase letters, numbers, and dashes.',
    'string.empty': 'Slug is required.',
    'any.required': 'Slug is required.',
  })

const coverImage = Joi.object({
  url: Joi.string().uri().required(),
  publicId: Joi.string().allow(''),
  alt: Joi.string().allow('').default(''),
})

// ── GET /content (public) and /admin/content ─────────────────────
export const validateListContent = validate({
  query: Joi.object({
    kind,
    category,
    status,
    q: Joi.string().trim().max(120).allow(''),
    page: Joi.number().integer().min(1).default(1),
    pageSize: Joi.number().integer().min(1).max(100).default(24),
  }),
})

// ── GET /content/:slug ───────────────────────────────────────────
export const validateContentSlugParam = validate({
  params: Joi.object({
    slug: slug.required(),
  }),
})

// ── GET /admin/content/:id, DELETE /admin/content/:id ────────────
export const validateContentIdParam = validate({
  params: Joi.object({
    id: objectId.required().messages({ 'any.required': 'Post id is required.' }),
  }),
})

// ── POST /admin/content ──────────────────────────────────────────
export const validateCreateContent = validate({
  body: Joi.object({
    slug: slug.required(),
    kind: kind.required(),
    title: Joi.string().trim().min(1).max(200).required(),
    eyebrow: Joi.string().trim().max(80).allow(''),
    category: category.required(),
    excerpt: Joi.string().trim().max(400).allow('').default(''),
    body: Joi.string().allow('').default(''),
    coverImage,
    authorName: Joi.string().trim().min(1).max(120).required(),
    authorBio: Joi.string().trim().max(400).allow(''),
    readMinutes: Joi.number().integer().min(1).max(120).default(5),
    status: status.default('draft'),
  }),
})

// ── PUT /admin/content/:id ───────────────────────────────────────
export const validateUpdateContent = validate({
  params: Joi.object({
    id: objectId.required(),
  }),
  body: Joi.object({
    slug,
    kind,
    title: Joi.string().trim().min(1).max(200),
    eyebrow: Joi.string().trim().max(80).allow(''),
    category,
    excerpt: Joi.string().trim().max(400).allow(''),
    body: Joi.string().allow(''),
    coverImage: coverImage.allow(null),
    authorName: Joi.string().trim().min(1).max(120),
    authorBio: Joi.string().trim().max(400).allow(''),
    readMinutes: Joi.number().integer().min(1).max(120),
    status,
  }).min(1),
})
