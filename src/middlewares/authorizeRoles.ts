import type { Request, Response, NextFunction } from 'express'
import { ApiError } from '../errors/apiError'

export function authorizeRoles(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw ApiError.unauthorized()
    if (!roles.includes(req.user.role)) throw ApiError.forbidden()
    next()
  }
}
