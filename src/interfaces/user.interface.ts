import type { Document, Types } from 'mongoose'

export type UserRole = 'customer' | 'admin' | 'b2b_admin' | 'b2b_member' | 'partner'

/** Saved delivery address, mirrors the checkout shape for prefill. Orders snapshot their own immutable copy, so edits here never rewrite history. */
export interface IUserAddress {
  _id?: Types.ObjectId
  /** Optional friendly tag, e.g. "Home", "Office". */
  label?: string
  fullName: string
  phone: string
  line1: string
  line2?: string
  city: string
  state: string
  country: string
  postal?: string
  /** Exactly one address per user should be the default; enforced in the
   *  service layer, not the schema. */
  isDefault: boolean
}

export interface IUser {
  name: string
  email: string
  /** bcrypt hash of the password — never the plaintext. select:false on the
   *  schema so it's only loaded when explicitly requested. */
  passwordHash: string
  phone: string
  role: UserRole
  b2bOrgId?: Types.ObjectId | null
  addresses: IUserAddress[]
  emailVerified: boolean
  /** SHA-256 of the active refresh token. Cleared on logout / rotated on
   *  refresh. select:false on the schema. */
  refreshTokenHash?: string | null
  lastLoginAt?: Date | null
  /** SHA-256 of the active forgot-password reset token. select:false. */
  resetPasswordTokenHash?: string | null
  resetPasswordExpires?: Date | null
  createdAt: Date
  updatedAt: Date
}

export type UserDocument = Document<Types.ObjectId, unknown, IUser> & IUser

// ── Auth response shapes ──────────────────────────────────────────────

/** Safe user view returned to clients — never contains a hash or secret. */
export interface AuthUser {
  id: string
  email: string
  name: string
  phone: string
  role: UserRole
  b2bOrgId: string | null
  emailVerified: boolean
}

export interface AuthData {
  user: AuthUser
  accessToken: string
  refreshToken: string
}

// ── Auth request payloads ─────────────────────────────────────────────

export interface RegisterInput {
  name: string
  email: string
  phone: string
  password: string
}

export interface LoginInput {
  email: string
  password: string
}

// ── DTOs ─────────────────────────────────────────────────────────────

export interface UserAddressInput {
  label?: string
  fullName: string
  phone: string
  line1: string
  line2?: string
  city: string
  state: string
  country?: string
  postal?: string
  /** When true, this address becomes the default and any existing default
   *  is demoted. */
  isDefault?: boolean
}

export type UpdateUserAddressInput = Partial<UserAddressInput>
