import type { Document, Types } from 'mongoose'

export type UserRole = 'customer' | 'admin' | 'b2b_admin' | 'b2b_member'

export interface IAddress {
  _id?: Types.ObjectId
  label?: string
  line1: string
  line2?: string
  city: string
  state: string
  country: string
  postal?: string
  isDefault?: boolean
}

export interface IUser {
  email: string
  passwordHash: string
  name: string
  phone: string
  role: UserRole
  b2bOrgId: Types.ObjectId | null
  addresses: IAddress[]
  emailVerified: boolean
  resetPasswordTokenHash: string | null
  resetPasswordExpires: Date | null
  refreshTokenHash: string | null
  lastLoginAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface IUserMethods {
  comparePassword(plain: string): Promise<boolean>
}

export type UserDocument = Document<Types.ObjectId, unknown, IUser> & IUser & IUserMethods

/** Shape returned to clients — never contains secrets. */
export interface AuthUser {
  id: string
  email: string
  name: string
  phone: string
  role: UserRole
  b2bOrgId: string | null
  emailVerified: boolean
}

export interface RegisterInput {
  email: string
  password: string
  name: string
  phone: string
}

export interface LoginInput {
  email: string
  password: string
}

/** Auth response payload sent back to clients. `refreshToken` is stripped
 *  by the controller before serialisation (it's set as an httpOnly cookie
 *  instead). */
export interface AuthData {
  user: AuthUser
  accessToken: string
  refreshToken?: string
}
