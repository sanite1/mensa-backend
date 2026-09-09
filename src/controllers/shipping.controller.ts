// shipping controller — thin request handlers, delegates to shipping.service
import { sendResponse } from '../helpers/sendResponse'
import * as shippingService from '../services/shipping.service'
import type { ExpressFunction } from '../interfaces/express.interface'
import type { UpdateShippingSettingsInput } from '../interfaces/shipping.interface'

/* ── GET /admin/shipping-settings ── (admin) */
export const adminGetShippingSettings: ExpressFunction = async (_req, res, next) => {
  try {
    const response = await shippingService.getShippingSettingsService()
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

/* ── PUT /admin/shipping-settings ── (admin) */
export const adminUpdateShippingSettings: ExpressFunction<UpdateShippingSettingsInput> = async (
  req,
  res,
  next,
) => {
  try {
    const response = await shippingService.updateShippingSettingsService(req.body)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}
