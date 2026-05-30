import { Router } from 'express'
import * as controller from '../controllers/user.controller'
import { authenticatedMiddleWare } from '../middlewares/authenticatedMiddleWare'
import { authedLimiter } from '../middlewares/rateLimiter'
import {
  validateAddAddress,
  validateAddressIdParam,
  validateUpdateAddress,
} from '../validations/user.validation'

const router = Router()

// Everything below is "/me" — signed in only.
router.use(authenticatedMiddleWare, authedLimiter)

// ── Saved address book ────────────────────────────────────────────
router.get('/me/addresses', controller.listMyAddresses)
router.post('/me/addresses', validateAddAddress, controller.addMyAddress)
router.put(
  '/me/addresses/:id',
  validateUpdateAddress,
  controller.updateMyAddress,
)
router.put(
  '/me/addresses/:id/default',
  validateAddressIdParam,
  controller.setDefaultMyAddress,
)
router.delete(
  '/me/addresses/:id',
  validateAddressIdParam,
  controller.deleteMyAddress,
)

export default router
