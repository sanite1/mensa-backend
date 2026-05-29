import bcrypt from 'bcrypt'
import crypto from 'crypto'
import { User } from '../models/User'
import { ApiError } from '../errors/apiError'
import { ApiResponse } from '../errors/apiResponse'
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashRefreshToken,
  newJti,
} from '../helpers/jwt'
import { sendMail } from './nodemailer/mail.service'
import { logger } from '../config/logger'
import type {
  AuthData,
  AuthUser,
  LoginInput,
  RegisterInput,
  UserDocument,
  UserRole,
} from '../interfaces/user.interface'

const BCRYPT_COST = 12
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour

function toAuthUser(user: UserDocument): AuthUser {
  return {
    id: String(user._id),
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role,
    b2bOrgId: user.b2bOrgId ? user.b2bOrgId.toString() : null,
    emailVerified: user.emailVerified,
  }
}

async function issueTokens(
  userId: string,
  role: UserRole,
  b2bOrgId: string | null,
): Promise<{ accessToken: string; refreshToken: string }> {
  const jti = newJti()
  const accessToken = signAccessToken({ userId, role, ...(b2bOrgId ? { b2bOrgId } : {}) })
  const refreshToken = signRefreshToken({ userId, jti })
  await User.updateOne(
    { _id: userId },
    { $set: { refreshTokenHash: hashRefreshToken(refreshToken), lastLoginAt: new Date() } },
  )
  return { accessToken, refreshToken }
}

/* ── Register ── */
export const registerService = async (input: RegisterInput): Promise<ApiResponse<AuthData>> => {
  const email = input.email.toLowerCase().trim()
  const existing = await User.findOne({ email }).lean()
  if (existing) throw new ApiError(409, 'An account with this email already exists.')

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST)
  const user = (await User.create({
    email,
    passwordHash,
    name: input.name.trim(),
    phone: input.phone.trim(),
    role: 'customer',
  })) as UserDocument

  const tokens = await issueTokens(String(user._id), user.role, null)

  await sendMail({
    to: user.email,
    subject: 'Welcome to Mensa',
    template: 'welcome',
    data: { name: user.name, platformUrl: process.env.FRONTEND_PLATFORM_URL },
  })

  return new ApiResponse(201, 'Account created.', {
    user: toAuthUser(user),
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  })
}

/* ── Login ── */
export const loginService = async (input: LoginInput): Promise<ApiResponse<AuthData>> => {
  const email = input.email.toLowerCase().trim()
  const user = (await User.findOne({ email }).select('+passwordHash')) as UserDocument | null
  if (!user) throw new ApiError(401, 'Invalid email or password.')

  const isValidPassword = await bcrypt.compare(input.password, user.passwordHash)
  if (!isValidPassword) throw new ApiError(401, 'Invalid email or password.')

  const b2bOrgId = user.b2bOrgId ? user.b2bOrgId.toString() : null
  const tokens = await issueTokens(String(user._id), user.role, b2bOrgId)

  return new ApiResponse(200, 'Logged in.', {
    user: toAuthUser(user),
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  })
}

/* ── Refresh ── */
export const refreshService = async (
  refreshToken: string | undefined,
): Promise<ApiResponse<AuthData>> => {
  if (!refreshToken) throw new ApiError(401, 'Missing refresh token.')

  let payload
  try {
    payload = verifyRefreshToken(refreshToken)
  } catch {
    throw new ApiError(401, 'Your session has expired. Please sign in again.')
  }

  const user = (await User.findById(payload.userId).select(
    '+refreshTokenHash',
  )) as UserDocument | null
  if (!user) throw new ApiError(401, 'Your session is no longer valid.')

  const presentedHash = hashRefreshToken(refreshToken)
  if (!user.refreshTokenHash || user.refreshTokenHash !== presentedHash) {
    // Token rotated or revoked. Defensively clear the stored hash.
    await User.updateOne({ _id: user._id }, { $set: { refreshTokenHash: null } })
    throw new ApiError(401, 'Your session is no longer valid.')
  }

  const b2bOrgId = user.b2bOrgId ? user.b2bOrgId.toString() : null
  const tokens = await issueTokens(String(user._id), user.role, b2bOrgId)

  return new ApiResponse(200, 'Token refreshed.', {
    user: toAuthUser(user),
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  })
}

/* ── Logout ── */
export const logoutService = async (refreshToken: string | undefined): Promise<ApiResponse> => {
  if (refreshToken) {
    try {
      const payload = verifyRefreshToken(refreshToken)
      await User.updateOne({ _id: payload.userId }, { $set: { refreshTokenHash: null } })
    } catch {
      // Token already invalid — nothing to do.
    }
  }
  return new ApiResponse(200, 'Logged out.')
}

/* ── Me ── */
export const getMeService = async (userId: string): Promise<ApiResponse<{ user: AuthUser }>> => {
  const user = (await User.findById(userId)) as UserDocument | null
  if (!user) throw new ApiError(401, 'You are not signed in.')
  return new ApiResponse(200, 'OK.', { user: toAuthUser(user) })
}

/* ── Forgot password ── */
export const forgotPasswordService = async (email: string): Promise<ApiResponse> => {
  const normalised = email.toLowerCase().trim()
  const user = await User.findOne({ email: normalised })

  if (user) {
    const token = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const expires = new Date(Date.now() + RESET_TOKEN_TTL_MS)

    await User.updateOne(
      { _id: user._id },
      { $set: { resetPasswordTokenHash: tokenHash, resetPasswordExpires: expires } },
    )

    const resetUrl = `${process.env.FRONTEND_PLATFORM_URL}/reset-password?token=${token}`
    await sendMail({
      to: user.email,
      subject: 'Reset your Mensa password',
      template: 'passwordReset',
      data: { name: user.name, resetUrl, expiresInMinutes: 60 },
    })
  } else {
    // Silent — never reveal whether the email is registered.
    logger.info(`Forgot-password request for unknown email: ${normalised}`)
  }

  return new ApiResponse(
    200,
    'If an account with that email exists, a reset link has been sent.',
  )
}

/* ── Reset password ── */
export const resetPasswordService = async (
  token: string,
  newPassword: string,
): Promise<ApiResponse> => {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  const user = await User.findOne({
    resetPasswordTokenHash: tokenHash,
    resetPasswordExpires: { $gt: new Date() },
  }).select('+resetPasswordTokenHash +resetPasswordExpires')

  if (!user) throw new ApiError(400, 'Reset link is invalid or has expired.')

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST)
  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        passwordHash,
        resetPasswordTokenHash: null,
        resetPasswordExpires: null,
        refreshTokenHash: null,
      },
    },
  )

  return new ApiResponse(200, 'Password updated. Please sign in.')
}
