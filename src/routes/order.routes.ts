import { Router } from 'express'
import * as controller from '../controllers/order.controller'
import { authenticatedMiddleWare } from '../middlewares/authenticatedMiddleWare'
import { authedLimiter, publicReadLimiter } from '../middlewares/rateLimiter'
import {
  validateListOrders,
  validateOrderIdParam,
  validateTrackOrder,
} from '../validations/order.validation'

const router = Router()

// Public tracking by order number + email (no auth, but rate-limited).
router.get(
  '/track/:orderNumber',
  publicReadLimiter,
  validateTrackOrder,
  controller.trackOrder,
)

// Authenticated customer reads.
router.use(authenticatedMiddleWare, authedLimiter)
router.get('/', validateListOrders, controller.listMyOrders)
router.get('/:id', validateOrderIdParam, controller.getMyOrder)

export default router
