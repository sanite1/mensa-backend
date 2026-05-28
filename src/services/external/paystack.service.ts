import { paystackClient } from '../../config/paystack'

export interface PaystackInitResult {
  authorizationUrl: string
  accessCode: string
  reference: string
}

export const paystackService = {
  async initializeTransaction(email: string, amountKobo: number, reference: string): Promise<PaystackInitResult> {
    const { data } = await paystackClient.post('/transaction/initialize', {
      email,
      amount: amountKobo,
      reference,
      currency: 'NGN',
    })
    return {
      authorizationUrl: data.data.authorization_url,
      accessCode: data.data.access_code,
      reference: data.data.reference,
    }
  },

  async verifyTransaction(reference: string): Promise<{ status: string; amountKobo: number; email: string }> {
    const { data } = await paystackClient.get(`/transaction/verify/${reference}`)
    return {
      status: data.data.status,
      amountKobo: data.data.amount,
      email: data.data.customer.email,
    }
  },

  async refund(transactionId: string, amountKobo?: number): Promise<void> {
    await paystackClient.post('/refund', {
      transaction: transactionId,
      ...(amountKobo !== undefined ? { amount: amountKobo } : {}),
    })
  },
}
