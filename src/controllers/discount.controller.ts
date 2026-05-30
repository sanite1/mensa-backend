import { sendResponse } from '../helpers/sendResponse'
import * as service from '../services/discount.service'
import type { ExpressFunction } from '../interfaces/express.interface'
import type {
  CreateDiscountInput,
  ListDiscountsQuery,
  UpdateDiscountInput,
} from '../interfaces/discount.interface'

/* ── POST /checkout/apply-discount ── (public) */
export const applyDiscount: ExpressFunction<{ code: string; subtotal: number }> = async (
  req,
  res,
  next,
) => {
  try {
    const response = await service.applyDiscountService(req.body.code, req.body.subtotal)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

/* ── GET /admin/discounts ── */
export const adminListDiscounts: ExpressFunction = async (req, res, next) => {
  try {
    const query = req.query as unknown as ListDiscountsQuery
    const response = await service.adminListDiscountsService(query)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

/* ── GET /admin/discounts/:id ── */
export const adminGetDiscount: ExpressFunction<unknown, { id: string }> = async (
  req,
  res,
  next,
) => {
  try {
    const response = await service.adminGetDiscountService(req.params.id)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

/* ── POST /admin/discounts ── */
export const adminCreateDiscount: ExpressFunction<CreateDiscountInput> = async (
  req,
  res,
  next,
) => {
  try {
    const response = await service.adminCreateDiscountService(req.body)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

/* ── PUT /admin/discounts/:id ── */
export const adminUpdateDiscount: ExpressFunction<
  UpdateDiscountInput,
  { id: string }
> = async (req, res, next) => {
  try {
    const response = await service.adminUpdateDiscountService(req.params.id, req.body)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

/* ── DELETE /admin/discounts/:id ── */
export const adminDeleteDiscount: ExpressFunction<unknown, { id: string }> = async (
  req,
  res,
  next,
) => {
  try {
    const response = await service.adminDeleteDiscountService(req.params.id)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}
