import type { Request, Response, NextFunction } from 'express'
import { ApiError } from '../../errors/apiError'

export function b2bAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) throw new ApiError(401, 'You are not signed in.')
  if (!['b2b_admin', 'b2b_member'].includes(req.user.role)) {
    throw new ApiError(403, 'You do not have access to the partnerships portal.')
  }
  next()
}
