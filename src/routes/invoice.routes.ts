import { Router } from 'express'
import * as invoiceController from '../controllers/invoice.controller'
import { publicReadLimiter } from '../middlewares/rateLimiter'
import { validateInvoiceTokenParam } from '../validations/invoice.validation'

const router = Router()

// Public, the token in the link is the only credential.
router.get(
  '/:token',
  publicReadLimiter,
  validateInvoiceTokenParam,
  invoiceController.getPublicInvoice,
)

export default router
