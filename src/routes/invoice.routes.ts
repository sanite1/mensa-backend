import { Router } from 'express'
import * as invoiceController from '../controllers/invoice.controller'
import { authedLimiter, publicReadLimiter } from '../middlewares/rateLimiter'
import { validateInvoiceTokenParam } from '../validations/invoice.validation'

const router = Router()

// Public, the token in the link is the only credential.
router.get(
  '/:token',
  publicReadLimiter,
  validateInvoiceTokenParam,
  invoiceController.getPublicInvoice,
)

// Pay creates a Paystack transaction, so it takes the heavier limiter like
// checkout initialize. Verify is idempotent and called on page load.
router.post('/:token/pay', authedLimiter, validateInvoiceTokenParam, invoiceController.payInvoice)
router.post(
  '/:token/verify',
  publicReadLimiter,
  validateInvoiceTokenParam,
  invoiceController.verifyInvoice,
)

export default router
