import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { ApiError } from '../errors/apiError'
import type { AccessTokenPayload } from '../interfaces/auth.interface'

declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload
      /** Raw request body buffer, captured by the express.json verify
       *  callback in index.ts. Required to verify webhook HMAC signatures
       *  (Paystack signs the raw bytes, not the parsed JSON). */
      rawBody?: Buffer
    }
  }
}

export function authenticatedMiddleWare(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    throw new ApiError(401, 'You are not signed in.')
  }

  const token = header.slice(7)
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as AccessTokenPayload
    req.user = payload
    next()
  } catch {
    throw new ApiError(401, 'Your session has expired. Please sign in again.')
  }
}
