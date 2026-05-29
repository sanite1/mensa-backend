import { pingService } from '../services/ping.service'
import { sendResponse } from '../helpers/sendResponse'
import type { ExpressFunction } from '../interfaces/express.interface'

/* ── Ping ── */
export const ping: ExpressFunction = async (_req, res, next) => {
  try {
    const response = await pingService()
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}
