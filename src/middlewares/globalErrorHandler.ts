import type { Request, Response, NextFunction } from 'express'
import { ApiError } from '../errors/apiError'
import { logger } from '../config/logger'

export function globalErrorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ApiError) {
    logger.warn(`[${err.statusCode}] ${err.message}`, { details: err.details })
    res.status(err.statusCode).json({
      statusCode: err.statusCode,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    })
    return
  }

  // Unknown / programmer errors — don't leak internals
  logger.error('Unhandled error', err)
  res.status(500).json({
    statusCode: 500,
    message: 'An unexpected error occurred.',
  })
}
