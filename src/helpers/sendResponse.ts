import type { Response } from 'express'
import { ApiResponse } from '../errors/apiResponse'
import { REFRESH_COOKIE_NAME, refreshCookieOptions } from './jwt'

export function sendResponse<T>(res: Response, response: ApiResponse<T>): void {
  res.status(response.statusCode).json(response)
}

/** Auth flows: moves any refreshToken from the JSON body into the httpOnly cookie so the client never sees it. */
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
