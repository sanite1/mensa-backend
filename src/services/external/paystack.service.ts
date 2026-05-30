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
   * with your **secret key** (not a separate webhook secret — that does not
   * exist in their dashboard) using HMAC-SHA512. We recompute and compare in
   * constant time.
   *
   * Returns false if either the secret key or the signature header is
   * missing — caller should 200 the request anyway so Paystack doesn't
   * indefinitely retry our misconfiguration.
   */
  verifyWebhookSignature(rawBody: string, signature: string | undefined): boolean {
    const secret = process.env.PAYSTACK_SECRET_KEY
    if (!secret || !signature) return false
    const expected = crypto
      .createHmac('sha512', secret)
      .update(rawBody)
      .digest('hex')
    // Equal-length buffers required by timingSafeEqual.
    if (expected.length !== signature.length) return false
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  },
}
