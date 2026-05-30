import { sendResponse } from '../helpers/sendResponse'
import * as service from '../services/order.service'
import type { ExpressFunction } from '../interfaces/express.interface'
import type {
  InitializeCheckoutInput,
  ShippingRatesInput,
} from '../interfaces/order.interface'

/* ── POST /checkout/shipping-rates ── */
export const shippingRates: ExpressFunction<ShippingRatesInput> = async (
  req,
  res,
  next,
) => {
  try {
    const response = await service.getShippingRatesService(req.body)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

/* ── POST /checkout/initialize ── */
export const initializeCheckout: ExpressFunction<InitializeCheckoutInput> = async (
  req,
  res,
  next,
) => {
  try {
    const userId = req.user?.userId ?? null
    const response = await service.initializeCheckoutService(req.body, userId)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

/* ── POST /checkout/verify/:reference ──
 *
 * Called by the confirmation page on mount. We ask Paystack directly
 * whether the reference completed, then reconcile locally — no waiting
 * on the webhook. */
export const verifyCheckout: ExpressFunction<unknown, { reference: string }> = async (
  req,
  res,
  next,
) => {
  try {
    const response = await service.verifyAndReconcileOrderService(req.params.reference)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}
