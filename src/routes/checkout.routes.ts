import { Router } from 'express'
import * as controller from '../controllers/checkout.controller'
import * as discountController from '../controllers/discount.controller'
import { authedLimiter, publicReadLimiter } from '../middlewares/rateLimiter'
import {
  validateShippingRates,
  validateInitializeCheckout,
  validateVerifyCheckout,
} from '../validations/order.validation'
import { validateApplyDiscount } from '../validations/discount.validation'

const router = Router()

// Shipping rates are read-ish (no DB mutation), but keep them gated by a
// modest rate limit to stop scraping.
router.post(
  '/shipping-rates',
  publicReadLimiter,
  validateShippingRates,
  controller.shippingRates,
)

// Initialize is mutating + creates Paystack transactions, so use the heavier
// authed limiter even for guest checkouts.
router.post(
  '/initialize',
  authedLimiter,
  validateInitializeCheckout,
  controller.initializeCheckout,
)

// Verify on return, called by the confirmation page on mount for an immediate authoritative outcome without waiting on the webhook. Idempotent.
router.post(
  '/verify/:reference',
  publicReadLimiter,
  validateVerifyCheckout,
  controller.verifyCheckout,
)

// Discount preview, returns the kobo savings without committing. Rate limited to stop brute force code guessing.
router.post(
  '/apply-discount',
  publicReadLimiter,
  validateApplyDiscount,
  discountController.applyDiscount,
)

export default router
