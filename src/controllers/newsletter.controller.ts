// newsletter controller — thin request handlers, delegates to newsletter.service
import { sendResponse } from '../helpers/sendResponse'
import { ApiError } from '../errors/apiError'
import * as newsletterService from '../services/newsletter.service'
import type { ExpressFunction } from '../interfaces/express.interface'
import type {
  AdminListSubscribersQuery,
  SubscribeInput,
} from '../interfaces/newsletter.interface'

/* ── POST /newsletter/subscribe ── (public) */
export const subscribe: ExpressFunction<SubscribeInput> = async (req, res, next) => {
  try {
    const response = await newsletterService.subscribeService(req.body)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

/* ── POST /newsletter/unsubscribe ── (public, token in body) */
export const unsubscribe: ExpressFunction<{ token: string }> = async (req, res, next) => {
  try {
    const token = req.body?.token
    if (!token) throw new ApiError(400, 'Unsubscribe token is required.')
    const response = await newsletterService.unsubscribeService(token)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

/* ── GET /admin/newsletter/subscribers ── (admin) */
export const adminListSubscribers: ExpressFunction = async (req, res, next) => {
  try {
    const query = req.query as unknown as AdminListSubscribersQuery
    const response = await newsletterService.adminListSubscribersService(query)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

/* ── DELETE /admin/newsletter/subscribers/:id ── (admin) */
export const adminDeleteSubscriber: ExpressFunction<unknown, { id: string }> = async (
  req,
  res,
  next,
) => {
  try {
    const response = await newsletterService.adminDeleteSubscriberService(req.params.id)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}
