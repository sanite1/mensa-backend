import jwt, { type SignOptions } from 'jsonwebtoken'
import crypto from 'crypto'
import type { CookieOptions } from 'express'
import type { AccessTokenPayload, RefreshTokenPayload } from '../interfaces/auth.interface'

const ACCESS_TOKEN_TTL: SignOptions['expiresIn'] = '15m'
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
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: REFRESH_TOKEN_TTL_MS,
    domain: process.env.REFRESH_COOKIE_DOMAIN || undefined,
  }
}
