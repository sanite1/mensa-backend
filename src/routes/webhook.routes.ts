import { Router } from 'express'
import * as controller from '../controllers/webhook.controller'
import { validateDevFireWebhook } from '../validations/order.validation'

const router = Router()

// Paystack -> us. No auth header; verification happens via HMAC inside
// the controller using the raw request body captured in index.ts.
router.post('/paystack', controller.paystackWebhook)

// Dev-only helper to simulate a Paystack callback without exposing a
// tunnel. Disabled in production inside the controller itself.
router.post('/paystack/dev-fire', validateDevFireWebhook, controller.paystackDevFire)

export default router
