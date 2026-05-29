import type { Document, Types } from 'mongoose'

export type ProductCategory = 'pants' | 'pads' | 'bundles' | 'education'
export type BadgeTone = 'pink' | 'coral' | 'ink'

// ── Embedded subdocuments ──

export interface IProductImage {
  _id?: Types.ObjectId
  url: string
  publicId: string
  alt: string
  order: number
}

export interface IProductVariant {
  _id?: Types.ObjectId
  /** Auto-computed server side from slug + options. Admin never types this. */
  sku: string
  /** Free-form option map. Keys must match the parent product's `optionTypes`.
   *  Example: { Size: 'M', Color: 'Black' }. Empty object for sizeless / single-
   *  variant products. */
  options: Record<string, string>
  stockCount: number
  lowStockThreshold: number
  /** kobo. null means inherit from the parent product's basePriceB2C. */
  b2cPriceOverride: number | null
  /** kobo. null means inherit from the parent product's basePriceB2B. */
  b2bPriceOverride: number | null
  isActive: boolean
}

export interface IProductMetadata {
  badge?: string
  badgeTone?: BadgeTone
  rating?: number
  reviewCount?: number
}

/** A single "Product details / Care / Shipping" style accordion on the PDP.
 *  The admin authors these per product so the section never shows copy that
 *  doesn't apply (e.g. wash instructions for an education guide). */
export interface IProductAccordion {
  _id?: Types.ObjectId
  heading: string
  body: string
}

/** Allowed icons for trust lines. Each maps to a lucide / Mensa SVG icon
 *  on the frontend; using a fixed enum keeps the data schema simple and
 *  ensures we never render a missing-icon fallback. */
export type TrustIcon = 'truck' | 'shield' | 'leaf' | 'star' | 'check' | 'mail'

/** A one liner with an icon shown above the accordion block on the PDP.
 *  Admin authored per product so we can promise the right things for
 *  pants vs guides vs bundles. */
export interface IProductTrustLine {
  _id?: Types.ObjectId
  icon: TrustIcon
  text: string
}

// ── Root document ──

export interface IProduct {
  slug: string
  name: string
  subheading: string
  shortDescription: string
  description: string
  category: ProductCategory
  /** Default B2C price in kobo. Variants can override. */
  basePriceB2C: number
  /** Default B2B price in kobo. Variants can override. */
  basePriceB2B: number
  /** Sale price in kobo. null when not on sale. */
  salePrice: number | null
  /** Ordered list of option types for this product. e.g. `["Size"]` or
   *  `["Size", "Color"]`. Empty for single-variant products. The order
   *  determines the order of selectors on the PDP and the order in which
   *  values appear in the computed SKU. */
  optionTypes: string[]
  images: IProductImage[]
  variants: IProductVariant[]
  accordions: IProductAccordion[]
  trustLines: IProductTrustLine[]
  metadata: IProductMetadata
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export type ProductDocument = Document<Types.ObjectId, unknown, IProduct> & IProduct

// ── DTOs ──

export type ProductImageInput = Omit<IProductImage, '_id'>
export type ProductAccordionInput = Omit<IProductAccordion, '_id'>
export type ProductTrustLineInput = Omit<IProductTrustLine, '_id'>
/** Variant input as posted by the admin. SKU is omitted because the server
 *  computes it from slug + options. */
export type ProductVariantInput = Omit<IProductVariant, '_id' | 'sku'> & { sku?: string }

export interface CreateProductInput {
  slug: string
  name: string
  subheading?: string
  shortDescription?: string
  description?: string
  category: ProductCategory
  basePriceB2C: number
  basePriceB2B: number
  salePrice?: number | null
  optionTypes?: string[]
  variants: ProductVariantInput[]
  accordions?: ProductAccordionInput[]
  trustLines?: ProductTrustLineInput[]
  metadata?: IProductMetadata
  isActive?: boolean
}

export type UpdateProductInput = Partial<CreateProductInput>

export type ProductSort = 'price_asc' | 'price_desc' | 'newest' | 'featured'

export interface ListProductsQuery {
  category?: ProductCategory
  q?: string
  sort?: ProductSort
  page?: number
  pageSize?: number
  /** Admin only. When true, returns inactive products too. */
  includeInactive?: boolean
}

export interface Pagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface ListProductsResult {
  items: ProductDocument[]
  pagination: Pagination
}
