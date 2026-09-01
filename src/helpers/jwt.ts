import jwt, { type SignOptions } from 'jsonwebtoken'
import crypto from 'crypto'
import type { CookieOptions } from 'express'
import type { AccessTokenPayload, RefreshTokenPayload } from '../interfaces/auth.interface'

// Override with JWT_ACCESS_TTL (e.g. '8h', '1d'). A working day by default so
// admins are not bounced mid session if the silent refresh ever fails.
const ACCESS_TOKEN_TTL: SignOptions['expiresIn'] = (process.env.JWT_ACCESS_TTL ??
  '8h') as SignOptions['expiresIn']
const REFRESH_TOKEN_TTL: SignOptions['expiresIn'] = '30d'
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000

export const REFRESH_COOKIE_NAME = 'mensa_rt'

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: ACCESS_TOKEN_TTL })
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, { expiresIn: REFRESH_TOKEN_TTL })
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, process.env.JWT_SECRET!) as AccessTokenPayload
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as RefreshTokenPayload
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function newJti(): string {
  return crypto.randomBytes(16).toString('hex')
}

export function refreshCookieOptions(): CookieOptions {
  const isProd = process.env.NODE_ENV === 'production'
  return {
    httpOnly: true,
    secure: isProd,
    // Production runs the frontend and API on different sites, and 'lax'
    // cookies are not sent on cross site XHR, which silently killed the
    // refresh flow (users were logged out when the access token expired).
    // 'none' requires secure, so dev (http) stays on 'lax'.
    sameSite: isProd ? 'none' : 'lax',
    path: '/api/v1/auth',
    maxAge: REFRESH_TOKEN_TTL_MS,
    domain: process.env.REFRESH_COOKIE_DOMAIN || undefined,
  }
}
