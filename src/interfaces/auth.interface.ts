import type { UserRole } from './user.interface'

export interface AccessTokenPayload {
  userId: string
  role: UserRole
  b2bOrgId?: string
}

export interface RefreshTokenPayload {
  userId: string
  jti: string
}
