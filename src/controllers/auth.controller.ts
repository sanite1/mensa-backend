import { ApiError } from '../errors/apiError'
import { sendResponse, sendAuthResponse, clearAuthCookie } from '../helpers/sendResponse'
import { REFRESH_COOKIE_NAME } from '../helpers/jwt'
import * as service from '../services/auth.service'
import type { ExpressFunction } from '../interfaces/express.interface'
import type { LoginInput, RegisterInput } from '../interfaces/user.interface'

/* ── Register ── */
export const register: ExpressFunction<RegisterInput> = async (req, res, next) => {
  try {
    const response = await service.registerService(req.body)
    sendAuthResponse(res, response)
  } catch (error) {
    next(error)
  }
}

/* ── Login ── */
export const login: ExpressFunction<LoginInput> = async (req, res, next) => {
  try {
    const response = await service.loginService(req.body)
    sendAuthResponse(res, response)
  } catch (error) {
    next(error)
  }
}

/* ── Refresh ── */
export const refresh: ExpressFunction = async (req, res, next) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE_NAME]
    const response = await service.refreshService(token)
    sendAuthResponse(res, response)
  } catch (error) {
    next(error)
  }
}

/* ── Logout ── */
export const logout: ExpressFunction = async (req, res, next) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE_NAME]
    const response = await service.logoutService(token)
    clearAuthCookie(res)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

/* ── Me ── */
export const getMe: ExpressFunction = async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'You are not signed in.')
    const response = await service.getMeService(req.user.userId)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

/* ── Forgot password ── */
export const forgotPassword: ExpressFunction<{ email: string }> = async (req, res, next) => {
  try {
    const response = await service.forgotPasswordService(req.body.email)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

/* ── Reset password ── */
export const resetPassword: ExpressFunction<{ token: string; password: string }> = async (
  req,
  res,
  next,
) => {
  try {
    const response = await service.resetPasswordService(req.body.token, req.body.password)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}
