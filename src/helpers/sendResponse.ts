import type { Response } from 'express'
import { ApiResponse } from '../errors/apiResponse'
import { REFRESH_COOKIE_NAME, refreshCookieOptions } from './jwt'

export function sendResponse<T>(res: Response, response: ApiResponse<T>): void {
  res.status(response.statusCode).json(response)
}

/**
 * For auth flows. If the response carries a refreshToken in its data, set it
 * as the httpOnly cookie and strip it from the JSON body so the client never
 * sees the refresh token.
 */
export function sendAuthResponse<T extends { refreshToken?: string }>(
  res: Response,
  response: ApiResponse<T>,
): void {
  if (response.data?.refreshToken) {
    res.cookie(REFRESH_COOKIE_NAME, response.data.refreshToken, refreshCookieOptions())
    delete response.data.refreshToken
  }
  sendResponse(res, response)
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions())
}
