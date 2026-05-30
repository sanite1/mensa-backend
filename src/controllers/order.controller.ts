import { sendResponse } from '../helpers/sendResponse'
import { ApiError } from '../errors/apiError'
import * as service from '../services/order.service'
import type { ExpressFunction } from '../interfaces/express.interface'
import type {
  ListOrdersQuery,
  UpdateOrderFulfilmentInput,
} from '../interfaces/order.interface'

/* ── GET /orders ── (authenticated, current user) */
export const listMyOrders: ExpressFunction = async (req, res, next) => {
  try {
    const userId = req.user?.userId
    if (!userId) throw new ApiError(401, 'You are not signed in.')
    const query = req.query as unknown as ListOrdersQuery
    const response = await service.listMyOrdersService(userId, query)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

/* ── GET /orders/:id ── (authenticated, current user) */
export const getMyOrder: ExpressFunction<unknown, { id: string }> = async (
  req,
  res,
  next,
) => {
  try {
    const userId = req.user?.userId
    if (!userId) throw new ApiError(401, 'You are not signed in.')
    const response = await service.getMyOrderService(userId, req.params.id)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

/* ── GET /orders/track/:orderNumber?email=... ── (public) */
export const trackOrder: ExpressFunction<unknown, { orderNumber: string }> = async (
  req,
  res,
  next,
) => {
  try {
    const email = String(req.query.email ?? '')
    const response = await service.trackOrderService(
      req.params.orderNumber,
      email,
    )
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

/* ── GET /admin/orders ── (admin) */
export const adminListOrders: ExpressFunction = async (req, res, next) => {
  try {
    const query = req.query as unknown as ListOrdersQuery
    const response = await service.adminListOrdersService(query)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

/* ── GET /admin/orders/:id ── (admin) */
export const adminGetOrder: ExpressFunction<unknown, { id: string }> = async (
  req,
  res,
  next,
) => {
  try {
    const response = await service.adminGetOrderService(req.params.id)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

/* ── PATCH /admin/orders/:id/fulfilment ── (admin) */
export const adminUpdateOrderFulfilment: ExpressFunction<
  UpdateOrderFulfilmentInput,
  { id: string }
> = async (req, res, next) => {
  try {
    const actorUserId = req.user?.userId ?? null
    const response = await service.adminUpdateOrderFulfilmentService(
      req.params.id,
      req.body,
      actorUserId,
    )
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}
