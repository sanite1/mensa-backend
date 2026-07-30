import type { FilterQuery, SortOrder } from 'mongoose'
import { Product } from '../models/Product'
import { ApiError } from '../errors/apiError'
import { ApiResponse } from '../errors/apiResponse'
import { cloudinaryService, cloudinaryFolders } from './external/cloudinary.service'
import { computeSku } from '../helpers/sku'
import type {
  CreateProductInput,
  IProduct,
  IProductImage,
  ListProductsQuery,
  ListProductsResult,
  ProductDocument,
  ProductVariantInput,
  UpdateProductInput,
} from '../interfaces/product.interface'

const DEFAULT_PAGE_SIZE = 24
const MAX_PAGE_SIZE = 200

// ── Helpers ─────────────────────────────────────────────────────────────

function buildFilter(query: ListProductsQuery): FilterQuery<IProduct> {
  const filter: FilterQuery<IProduct> = {}
  if (!query.includeInactive) filter.isActive = true
  if (query.category) filter.category = query.category
  if (query.q && query.q.trim().length > 0) {
    filter.$text = { $search: query.q.trim() }
  }
  return filter
}

function buildSort(query: ListProductsQuery): Record<string, SortOrder> {
  switch (query.sort) {
    case 'price_asc':
      return { basePriceB2C: 1 }
    case 'price_desc':
      return { basePriceB2C: -1 }
    case 'newest':
      return { createdAt: -1 }
    case 'featured':
    default:
      return { createdAt: -1 }
  }
}

function assertUniqueSkus(variants: { sku: string }[]): void {
  const seen = new Set<string>()
  for (const v of variants) {
    const sku = v.sku.trim().toLowerCase()
    if (seen.has(sku)) {
      throw new ApiError(
        422,
        `Two variants share the same options (and therefore the same SKU "${v.sku}"). Each variant must have a unique option combination.`,
      )
    }
    seen.add(sku)
  }
}

/** Strip whitespace + drop empty entries from an admin-submitted optionTypes
 *  list. Order is preserved. */
function normaliseOptionTypes(types: string[] | undefined): string[] {
  if (!types) return []
  return types.map((t) => t.trim()).filter(Boolean)
}

/** Normalise options on a variant: trim keys + values, drop empty pairs. */
function normaliseOptions(options: Record<string, string> | undefined): Record<string, string> {
  if (!options) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(options)) {
    const key = k.trim()
    const value = typeof v === 'string' ? v.trim() : ''
    if (key && value) out[key] = value
  }
  return out
}

/** Decorate every variant with a server-computed SKU. Called before save on
 *  both create and update. */
function applyComputedSkus(
  slug: string,
  optionTypes: string[],
  variants: ProductVariantInput[],
): (ProductVariantInput & { sku: string })[] {
  return variants.map((v) => {
    const options = normaliseOptions(v.options)
    return {
      ...v,
      options,
      sku: computeSku(slug, options, optionTypes),
    }
  })
}

/* ─── Public: list products ────────────────────────────────────────── */
export const listProductsService = async (
  query: ListProductsQuery,
): Promise<ApiResponse<ListProductsResult>> => {
  const page = Math.max(1, query.page ?? 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE))
  const filter = buildFilter(query)
  const sort = buildSort(query)

  const [items, total] = await Promise.all([
    Product.find(filter)
      .sort(sort)
      .skip((page - 1) * pageSize)
      .limit(pageSize) as unknown as Promise<ProductDocument[]>,
    Product.countDocuments(filter),
  ])

  return new ApiResponse(200, 'OK.', {
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  })
}

/* ─── Public: get product by slug ──────────────────────────────────── */
export const getProductBySlugService = async (
  slug: string,
  opts: { includeInactive?: boolean } = {},
): Promise<ApiResponse<{ product: ProductDocument }>> => {
  const filter: FilterQuery<IProduct> = { slug: slug.toLowerCase().trim() }
  if (!opts.includeInactive) filter.isActive = true

  const product = (await Product.findOne(filter)) as ProductDocument | null
  if (!product) throw new ApiError(404, 'Product not found.')

  return new ApiResponse(200, 'OK.', { product })
}

/* ─── Admin: create product ────────────────────────────────────────── */
export const createProductService = async (
  input: CreateProductInput,
): Promise<ApiResponse<{ product: ProductDocument }>> => {
  const slug = input.slug.toLowerCase().trim()

  const existing = await Product.findOne({ slug }).lean()
  if (existing) throw new ApiError(409, 'A product with this slug already exists.')

  const optionTypes = normaliseOptionTypes(input.optionTypes)
  const variantsWithSkus = applyComputedSkus(slug, optionTypes, input.variants)
  assertUniqueSkus(variantsWithSkus)

  const product = (await Product.create({
    ...input,
    slug,
    optionTypes,
    variants: variantsWithSkus,
    images: [],
  })) as ProductDocument

  return new ApiResponse(201, 'Product created.', { product })
}

/* ─── Admin: update product ────────────────────────────────────────── */
export const updateProductService = async (
  slug: string,
  input: UpdateProductInput,
): Promise<ApiResponse<{ product: ProductDocument }>> => {
  const product = (await Product.findOne({
    slug: slug.toLowerCase().trim(),
  })) as ProductDocument | null
  if (!product) throw new ApiError(404, 'Product not found.')

  // Slug change: ensure the new slug is free.
  if (input.slug && input.slug.toLowerCase().trim() !== product.slug) {
    const taken = await Product.findOne({ slug: input.slug.toLowerCase().trim() }).lean()
    if (taken) throw new ApiError(409, 'A product with this slug already exists.')
    product.slug = input.slug.toLowerCase().trim()
  }

  // optionTypes is normalised first because it drives SKU computation, the new value wins when both are sent.
  if (input.optionTypes) {
    product.set('optionTypes', normaliseOptionTypes(input.optionTypes))
  }

  if (input.variants) {
    const variantsWithSkus = applyComputedSkus(
      product.slug,
      product.optionTypes ?? [],
      input.variants,
    )
    assertUniqueSkus(variantsWithSkus)
    product.set('variants', variantsWithSkus)
  } else if (input.slug || input.optionTypes) {
    // The slug or optionTypes changed but variants did not. Re-derive SKUs
    // from the existing variants against the new identifiers.
    const refreshed = product.variants.map((v) => {
      // Mongoose subdoc → plain object so we can mutate sku safely.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const plain = (v as any).toObject ? (v as any).toObject() : { ...v }
      plain.sku = computeSku(product.slug, plain.options ?? {}, product.optionTypes ?? [])
      return plain
    })
    product.set('variants', refreshed)
  }

  if (input.accordions) {
    product.set('accordions', input.accordions)
  }

  if (input.trustLines) {
    product.set('trustLines', input.trustLines)
  }

  const updatable: (keyof UpdateProductInput)[] = [
    'name',
    'subheading',
    'shortDescription',
    'description',
    'category',
    'basePriceB2C',
    'basePriceB2B',
    'salePrice',
    'metadata',
    'isActive',
    'isSoldOut',
    'showSizeGuide',
  ]
  for (const key of updatable) {
    if (input[key] !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(product as any)[key] = input[key]
    }
  }

  await product.save()
  return new ApiResponse(200, 'Product updated.', { product })
}

/* ─── Admin: soft delete ───────────────────────────────────────────── */
export const deleteProductService = async (slug: string): Promise<ApiResponse> => {
  const product = (await Product.findOne({
    slug: slug.toLowerCase().trim(),
  })) as ProductDocument | null
  if (!product) throw new ApiError(404, 'Product not found.')

  product.isActive = false
  await product.save()

  return new ApiResponse(200, 'Product archived.')
}

/* ─── Admin: add image ─────────────────────────────────────────────── */
export const addProductImageService = async (
  slug: string,
  file: { buffer: Buffer; mimetype: string },
  meta: { alt?: string } = {},
): Promise<ApiResponse<{ product: ProductDocument; image: IProductImage }>> => {
  const product = (await Product.findOne({
    slug: slug.toLowerCase().trim(),
  })) as ProductDocument | null
  if (!product) throw new ApiError(404, 'Product not found.')

  const uploaded = await cloudinaryService.upload(file.buffer, {
    folder: cloudinaryFolders.product(product.slug),
    mimetype: file.mimetype,
  })

  const nextOrder = product.images.length
  product.images.push({
    url: uploaded.url,
    publicId: uploaded.publicId,
    alt: meta.alt ?? product.name,
    order: nextOrder,
  })
  await product.save()

  const saved = product.images[product.images.length - 1]
  return new ApiResponse(201, 'Image added.', { product, image: saved })
}

/* ─── Admin: remove image ──────────────────────────────────────────── */
export const removeProductImageService = async (
  slug: string,
  imageId: string,
): Promise<ApiResponse<{ product: ProductDocument }>> => {
  const product = (await Product.findOne({
    slug: slug.toLowerCase().trim(),
  })) as ProductDocument | null
  if (!product) throw new ApiError(404, 'Product not found.')

  const image = product.images.find((img) => String(img._id) === imageId)
  if (!image) throw new ApiError(404, 'Image not found on this product.')

  try {
    await cloudinaryService.delete(image.publicId)
  } catch {
    // Best effort. If Cloudinary deletion fails, still detach from the
    // product so the user is not stuck with a dangling image record.
  }

  product.images = product.images.filter((img) => String(img._id) !== imageId)
  // Re index the order field so the remaining images stay sequential.
  product.images.forEach((img, idx) => {
    img.order = idx
  })
  await product.save()

  return new ApiResponse(200, 'Image removed.', { product })
}

/* ─── Admin: reorder images ────────────────────────────────────────── */
export const reorderProductImagesService = async (
  slug: string,
  orderedImageIds: string[],
): Promise<ApiResponse<{ product: ProductDocument }>> => {
  const product = (await Product.findOne({
    slug: slug.toLowerCase().trim(),
  })) as ProductDocument | null
  if (!product) throw new ApiError(404, 'Product not found.')

  const lookup = new Map(product.images.map((img) => [String(img._id), img]))
  const reordered: IProductImage[] = []
  for (const id of orderedImageIds) {
    const img = lookup.get(id)
    if (!img) throw new ApiError(422, `Image id "${id}" does not belong to this product.`)
    reordered.push(img)
  }
  if (reordered.length !== product.images.length) {
    throw new ApiError(422, 'Reorder list must include every image on the product.')
  }

  reordered.forEach((img, idx) => {
    img.order = idx
  })
  product.images = reordered
  await product.save()

  return new ApiResponse(200, 'Image order updated.', { product })
}
