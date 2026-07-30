// webhook.controller.ts — Paystack webhook entry. Verifies the HMAC signature against the raw body captured in index.ts, then dispatches to the order service.
// Always responds 200, even on bad signatures, so Paystack stops retrying and response codes leak nothing. Dev only /webhooks/paystack/dev-fire simulates events without a tunnel.

import type { Request, Response, NextFunction } from 'express'
import { paystackService } from '../services/external/paystack.service'
import {
  markOrderFailedService,
  markOrderPaidService,
} from '../services/order.service'
import { sendResponse } from '../helpers/sendResponse'
import { ApiError } from '../errors/apiError'
import { ApiResponse } from '../errors/apiResponse'
import { logger } from '../config/logger'
import type { ExpressFunction } from '../interfaces/express.interface'

/* ── POST /webhooks/paystack ── */
export const paystackWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const signature = req.headers['x-paystack-signature']
    const sig = Array.isArray(signature) ? signature[0] : signature
    const rawBody = req.rawBody?.toString('utf8') ?? JSON.stringify(req.body)
    const event = req.body?.event as string | undefined
    const data = (req.body?.data ?? {}) as Record<string, unknown>
    const reference = (data?.reference as string | undefined) ?? ''

    logger.info(
      `[Paystack webhook] hit path=${req.originalUrl} event=${event} ref=${reference} hasRawBody=${!!req.rawBody} sigPresent=${!!sig}`,
    )

    const valid = paystackService.verifyWebhookSignature(rawBody, sig)
    if (!valid) {
      logger.warn(
        `[Paystack webhook] Signature mismatch for ref=${reference}. ` +
          `Check that PAYSTACK_SECRET_KEY in .env matches the secret key the ` +
          `Paystack dashboard signed with.`,
      )
      // Still 200 so Paystack stops retrying.
      res.status(200).json({ received: true })
      return
    }

    if (!reference) {
      logger.warn(`[Paystack webhook] Missing reference on event ${event}`)
      res.status(200).json({ received: true })
      return
    }

    if (event === 'charge.success') {
      logger.info(`[Paystack webhook] charge.success → markOrderPaid(${reference})`)
      await markOrderPaidService(reference, data)
    } else if (event === 'charge.failed') {
      logger.info(`[Paystack webhook] charge.failed → markOrderFailed(${reference})`)
      await markOrderFailedService(reference)
    } else {
      logger.info(`[Paystack webhook] Ignoring unhandled event: ${event}`)
    }

    res.status(200).json({ received: true })
  } catch (error) {
    // Log + 200; we don't want Paystack to retry on our bugs.
    logger.error('[Paystack webhook] Handler threw', error)
    res.status(200).json({ received: true })
    next() // keep next() in scope; never propagates because response is sent.
  }
}

/* ── POST /webhooks/paystack/dev-fire — local only fake event firing, gated by NODE_ENV !== 'production'. ── */
interface DevFireBody {
  reference: string
  event?: 'charge.success' | 'charge.failed'
}

export const paystackDevFire: ExpressFunction<DevFireBody> = async (
  req,
  res,
  next,
) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      throw new ApiError(403, 'Dev-fire is disabled in production.')
    }
    const { reference, event = 'charge.success' } = req.body
    if (event === 'charge.success') {
      await markOrderPaidService(reference, { simulated: true })
    } else {
      await markOrderFailedService(reference)
    }
    sendResponse(
      res,
      new ApiResponse(200, `Simulated ${event} for ${reference}.`, { reference, event }),
    )
  } catch (error) {
    next(error)
  }
}
