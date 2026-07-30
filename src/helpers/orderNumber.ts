// Order number minting — format MS-YYYY-NNNNN, 5 digit sequence resets each year, derived by counting the year's orders.
// Good enough at MVP volume, move to a Mongo counter document when daily counts climb.
import { Order } from '../models/Order'

export async function mintOrderNumber(): Promise<string> {
  const year = new Date().getUTCFullYear()
  const prefix = `MS-${year}-`

  // Count orders this year to derive the next sequence. We allow a few
  // attempts in case of a rare collision under concurrent checkouts.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const count = await Order.countDocuments({
      orderNumber: { $regex: `^${prefix}` },
    })
    const candidate = `${prefix}${String(count + 1 + attempt).padStart(5, '0')}`
    const existing = await Order.findOne({ orderNumber: candidate }).lean()
    if (!existing) return candidate
  }

  // Extremely unlikely fallthrough — fall back to a timestamp suffix.
  return `${prefix}${Date.now().toString().slice(-5)}`
}
