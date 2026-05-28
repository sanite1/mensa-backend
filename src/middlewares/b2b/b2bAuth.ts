import type { Request, Response, NextFunction } from 'express'
import { ApiError } from '../../errors/apiError'

export function b2bAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) throw ApiError.unauthorized()
  if (!['b2b_admin', 'b2b_member'].includes(req.user.role)) throw ApiError.forbidden()
  next()
}
