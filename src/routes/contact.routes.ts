import { Router } from 'express'
import * as contactController from '../controllers/contact.controller'
import { publicReadLimiter } from '../middlewares/rateLimiter'
import { validateSubmitContact } from '../validations/contact.validation'

const router = Router()

router.post(
  '/',
  publicReadLimiter,
  validateSubmitContact,
  contactController.submitContactMessage,
)

export default router
