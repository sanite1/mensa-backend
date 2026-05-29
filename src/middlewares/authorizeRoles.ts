import type { Request, Response, NextFunction } from 'express'
import { ApiError } from '../errors/apiError'

export function authorizeRoles(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw new ApiError(401, 'You are not signed in.')
    if (!roles.includes(req.user.role)) {
      throw new ApiError(403, 'You do not have permission to perform this action.')
    }
    next()
  }
}
