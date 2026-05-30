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

// Verify-on-return. Called by the confirmation page on mount so the
// customer sees an authoritative payment outcome immediately without
// having to wait on the asynchronous webhook. Idempotent.
router.post(
  '/verify/:reference',
  publicReadLimiter,
  validateVerifyCheckout,
  controller.verifyCheckout,
)

// Discount preview. Customer types a code, frontend posts here to find
// out (without committing) what the kobo savings would be. Rate-limited
// to stop brute-force code guessing.
router.post(
  '/apply-discount',
  publicReadLimiter,
  validateApplyDiscount,
  discountController.applyDiscount,
)

export default router
