import type { Request, Response, NextFunction } from 'express'
import { logger } from '../config/logger'

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now()
  res.on('finish', () => {
    const ms = Date.now() - start
    logger.debug(`${req.method} ${req.originalUrl} → ${res.statusCode} (${ms}ms)`)
  })
  next()
}
