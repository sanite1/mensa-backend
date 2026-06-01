import { Router } from 'express'
import * as newsletterController from '../controllers/newsletter.controller'
import { publicReadLimiter } from '../middlewares/rateLimiter'
import {
  validateSubscribe,
  validateUnsubscribe,
} from '../validations/newsletter.validation'

const router = Router()

router.post(
  '/subscribe',
  publicReadLimiter,
  validateSubscribe,
  newsletterController.subscribe,
)
router.post(
  '/unsubscribe',
  publicReadLimiter,
  validateUnsubscribe,
  newsletterController.unsubscribe,
)

export default router
