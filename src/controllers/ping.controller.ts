import type { Request, Response } from 'express'
import { pingService } from '../services/ping.service'
import { sendSuccess } from '../helpers/sendResponse'

export function ping(req: Request, res: Response): void {
  const data = pingService.pong()
  sendSuccess(res, data)
}
