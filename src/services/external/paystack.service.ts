// ─────────────────────────────────────────────────────────────────────────
// Paystack service.
//
// Methods assert env keys are present at call time (rather than at import),
// so the rest of the app boots fine in environments where Paystack isn't
// configured yet. Auth header is rebuilt per request so dotenv loads
// timing never bites us.
// ─────────────────────────────────────────────────────────────────────────
import axios from 'axios'
import crypto from 'crypto'
import { assertEnv } from '../../config/validateEnv'

const REQUIRED_KEYS = ['PAYSTACK_SECRET_KEY'] as const
const WEBHOOK_REQUIRED = ['PAYSTACK_WEBHOOK_SECRET'] as const

const BASE_URL = 'https://api.paystack.co'

function client() {
  return axios.create({
    baseURL: BASE_URL,
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    timeout: 15_000,
  })
}

export interface PaystackInitResult {
  authorizationUrl: string
  accessCode: string
  reference: string
}

export interface PaystackVerifyResult {
  status: string
  amount: number
  email: string
  reference: string
  paidAt?: Date
}

export const paystackService = {
  async initializeTransaction(input: {
    email: string
    amountKobo: number
    reference: string
    callbackUrl?: string
    metadata?: Record<string, unknown>
  }): Promise<PaystackInitResult> {
    assertEnv([...REQUIRED_KEYS], 'Paystack')
    const { data } = await client().post('/transaction/initialize', {
      email: input.email,
      amount: input.amountKobo,
      reference: input.reference,
      currency: 'NGN',
      callback_url: input.callbackUrl,
      metadata: input.metadata,
    })
    return {
      authorizationUrl: data.data.authorization_url,
      accessCode: data.data.access_code,
      reference: data.data.reference,
    }
  },

  async verifyTransaction(reference: string): Promise<PaystackVerifyResult> {
    assertEnv([...REQUIRED_KEYS], 'Paystack')
    const { data } = await client().get(`/transaction/verify/${reference}`)
    return {
      status: data.data.status,
      amount: data.data.amount,
      email: data.data.customer?.email,
      reference: data.data.reference,
      paidAt: data.data.paid_at ? new Date(data.data.paid_at) : undefined,
    }
  },

  async refund(transactionId: string, amountKobo?: number): Promise<void> {
    assertEnv([...REQUIRED_KEYS], 'Paystack')
    await client().post('/refund', {
      transaction: transactionId,
      ...(amountKobo !== undefined ? { amount: amountKobo } : {}),
    })
  },

  /**
   * Verify a Paystack webhook signature. Paystack signs the raw request body
   * with the webhook secret using HMAC-SHA512; we recompute and compare.
   *
   * Throws if the webhook secret isn't configured (we can't safely accept
   * webhook calls without verification).
   */
  verifyWebhookSignature(rawBody: string, signature: string | undefined): boolean {
    assertEnv([...WEBHOOK_REQUIRED], 'Paystack')
    if (!signature) return false
    const expected = crypto
      .createHmac('sha512', process.env.PAYSTACK_WEBHOOK_SECRET as string)
      .update(rawBody)
      .digest('hex')
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  },
}
