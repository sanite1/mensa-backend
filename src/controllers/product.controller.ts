import { ApiError } from '../errors/apiError'
import { sendResponse } from '../helpers/sendResponse'
import * as service from '../services/product.service'
import type { ExpressFunction } from '../interfaces/express.interface'
import type {
  CreateProductInput,
  ListProductsQuery,
  UpdateProductInput,
} from '../interfaces/product.interface'

/* ── Public: list products ────────────────────────────────────────── */
export const listProducts: ExpressFunction = async (req, res, next) => {
  try {
    const query = req.query as unknown as ListProductsQuery
    // Force includeInactive=false for the public surface, even if the client tried.
    const response = await service.listProductsService({ ...query, includeInactive: false })
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

/* ── Public: get by slug ──────────────────────────────────────────── */
export const getProductBySlug: ExpressFunction<unknown, { slug: string }> = async (
  req,
  res,
  next,
) => {
  try {
    const response = await service.getProductBySlugService(req.params.slug)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

/* ── Admin: list (includes inactive) ──────────────────────────────── */
export const adminListProducts: ExpressFunction = async (req, res, next) => {
  try {
    const query = req.query as unknown as ListProductsQuery
    const response = await service.listProductsService({ ...query, includeInactive: true })
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

/* ── Admin: get by slug (includes inactive) ───────────────────────── */
export const adminGetProductBySlug: ExpressFunction<unknown, { slug: string }> = async (
  req,
  res,
  next,
) => {
  try {
    const response = await service.getProductBySlugService(req.params.slug, {
      includeInactive: true,
    })
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

/* ── Admin: create ────────────────────────────────────────────────── */
export const createProduct: ExpressFunction<CreateProductInput> = async (req, res, next) => {
  try {
    const response = await service.createProductService(req.body)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

/* ── Admin: update ────────────────────────────────────────────────── */
export const updateProduct: ExpressFunction<UpdateProductInput, { slug: string }> = async (
  req,
  res,
  next,
) => {
  try {
    const response = await service.updateProductService(req.params.slug, req.body)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

/* ── Admin: soft delete ───────────────────────────────────────────── */
export const deleteProduct: ExpressFunction<unknown, { slug: string }> = async (
  req,
  res,
  next,
) => {
  try {
    const response = await service.deleteProductService(req.params.slug)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

/* ── Admin: add image (multipart) ─────────────────────────────────── */
export const addProductImage: ExpressFunction<{ alt?: string }, { slug: string }> = async (
  req,
  res,
  next,
) => {
  try {
    if (!req.file) throw new ApiError(400, 'No image was uploaded.')
    const response = await service.addProductImageService(
      req.params.slug,
      { buffer: req.file.buffer, mimetype: req.file.mimetype },
      { alt: req.body.alt },
    )
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

/* ── Admin: remove image ──────────────────────────────────────────── */
export const removeProductImage: ExpressFunction<
  unknown,
  { slug: string; imageId: string }
> = async (req, res, next) => {
  try {
    const response = await service.removeProductImageService(req.params.slug, req.params.imageId)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

/* ── Admin: reorder images ────────────────────────────────────────── */
export const reorderProductImages: ExpressFunction<
  { orderedImageIds: string[] },
  { slug: string }
> = async (req, res, next) => {
  try {
    const response = await service.reorderProductImagesService(
      req.params.slug,
      req.body.orderedImageIds,
    )
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}
