// ─────────────────────────────────────────────────────────────────────────
// Order number minting.
//
// Format: MS-YYYY-NNNNN where NNNNN is a 5-digit zero-padded sequence that
// resets each calendar year. We derive the sequence by counting existing
// orders in the current year and incrementing — good enough at MVP volume.
// When daily order counts climb into the hundreds we'll move to a proper
// Mongo counter document.
// ─────────────────────────────────────────────────────────────────────────
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
