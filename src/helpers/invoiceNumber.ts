// Invoice number minting — INV-YYYY-NNNNN, same scheme as order numbers.
// The INV prefix is what the Paystack reference router keys on, keep it.
import { Invoice } from '../models/Invoice'

export const INVOICE_REFERENCE_PREFIX = 'INV-'

export async function mintInvoiceNumber(): Promise<string> {
  const year = new Date().getUTCFullYear()
  const prefix = `${INVOICE_REFERENCE_PREFIX}${year}-`

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const count = await Invoice.countDocuments({ invoiceNumber: { $regex: `^${prefix}` } })
    const candidate = `${prefix}${String(count + 1 + attempt).padStart(5, '0')}`
    const existing = await Invoice.findOne({ invoiceNumber: candidate }).lean()
    if (!existing) return candidate
  }

  return `${prefix}${Date.now().toString().slice(-5)}`
}
