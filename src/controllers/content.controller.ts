// content controller — thin request handlers, delegates to content.service
import { sendResponse } from '../helpers/sendResponse'
import * as contentService from '../services/content.service'
import type { ExpressFunction } from '../interfaces/express.interface'
import type {
  CreateContentPostInput,
  ListContentPostsQuery,
  UpdateContentPostInput,
} from '../interfaces/content.interface'

/* ── GET /content ── (public) */
export const listPublicContent: ExpressFunction = async (req, res, next) => {
  try {
    const query = req.query as unknown as ListContentPostsQuery
    const response = await contentService.listPublicContentService(query)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

/* ── GET /content/:slug ── (public) */
export const getPublicContentBySlug: ExpressFunction<unknown, { slug: string }> = async (
  req,
  res,
  next,
) => {
  try {
    const response = await contentService.getPublicContentBySlugService(req.params.slug)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

/* ── GET /admin/content ── (admin) */
export const adminListContent: ExpressFunction = async (req, res, next) => {
  try {
    const query = req.query as unknown as ListContentPostsQuery
    const response = await contentService.adminListContentService(query)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

/* ── GET /admin/content/:id ── (admin) */
export const adminGetContent: ExpressFunction<unknown, { id: string }> = async (
  req,
  res,
  next,
) => {
  try {
    const response = await contentService.adminGetContentService(req.params.id)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

/* ── POST /admin/content ── (admin) */
export const adminCreateContent: ExpressFunction<CreateContentPostInput> = async (
  req,
  res,
  next,
) => {
  try {
    const response = await contentService.adminCreateContentService(req.body)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

/* ── PUT /admin/content/:id ── (admin) */
export const adminUpdateContent: ExpressFunction<
  UpdateContentPostInput,
  { id: string }
> = async (req, res, next) => {
  try {
    const response = await contentService.adminUpdateContentService(req.params.id, req.body)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

/* ── DELETE /admin/content/:id ── (admin) */
export const adminDeleteContent: ExpressFunction<unknown, { id: string }> = async (
  req,
  res,
  next,
) => {
  try {
    const response = await contentService.adminDeleteContentService(req.params.id)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}
