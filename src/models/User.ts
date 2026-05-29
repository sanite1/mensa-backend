import { Schema, model, Model } from 'mongoose'
import bcrypt from 'bcrypt'
import type { IUser, IUserMethods, UserDocument, UserRole } from '../interfaces/user.interface'

type UserModel = Model<IUser, unknown, IUserMethods>

const AddressSchema = new Schema(
  {
    label: { type: String, trim: true },
    line1: { type: String, required: true, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    country: { type: String, required: true, default: 'NG', trim: true },
    postal: { type: String, trim: true },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true, timestamps: false },
)

const UserSchema = new Schema<IUser, UserModel, IUserMethods>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    role: {
      type: String,
      enum: ['customer', 'admin', 'b2b_admin', 'b2b_member'] satisfies UserRole[],
      default: 'customer',
      index: true,
    },
    b2bOrgId: { type: Schema.Types.ObjectId, ref: 'B2BOrg', default: null, index: true },
    addresses: { type: [AddressSchema], default: [] },
    emailVerified: { type: Boolean, default: false },
    resetPasswordTokenHash: { type: String, default: null, select: false },
    resetPasswordExpires: { type: Date, default: null, select: false },
    refreshTokenHash: { type: String, default: null, select: false },
    lastLoginAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.passwordHash
        delete ret.resetPasswordTokenHash
        delete ret.resetPasswordExpires
        delete ret.refreshTokenHash
        delete ret.__v
        return ret
      },
    },
  },
)

UserSchema.methods.comparePassword = function (plain: string): Promise<boolean> {
  return bcrypt.compare(plain, this.passwordHash)
}

export const User = model<IUser, UserModel>('User', UserSchema)
export type { UserDocument }
