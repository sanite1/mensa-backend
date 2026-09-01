import { Schema, model, type Model } from 'mongoose'
import type { IUser, IUserAddress, UserRole } from '../interfaces/user.interface'

type UserModel = Model<IUser>

const AddressSchema = new Schema<IUserAddress>(
  {
    label: { type: String, trim: true },
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    line1: { type: String, required: true, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    country: { type: String, default: 'NG', trim: true },
    postal: { type: String, trim: true },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true, timestamps: false },
)

const UserSchema = new Schema<IUser, UserModel>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Hashing is the service layer's job, pre save hooks don't fire on updateOne / findOneAndUpdate.
    passwordHash: { type: String, required: true, select: false },
    phone: { type: String, required: true, trim: true },
    role: {
      type: String,
      enum: ['customer', 'admin', 'b2b_admin', 'b2b_member', 'partner'] satisfies UserRole[],
      default: 'customer',
    },
    b2bOrgId: { type: Schema.Types.ObjectId, ref: 'B2BOrg', default: null },
    addresses: { type: [AddressSchema], default: [] },
    emailVerified: { type: Boolean, default: false },
    refreshTokenHash: { type: String, default: null, select: false },
    // One hash per active session (device/browser), capped in issueTokens.
    // The legacy single refreshTokenHash above is still read for sessions
    // issued before this field existed.
    refreshTokenHashes: { type: [String], default: [], select: false },
    lastLoginAt: { type: Date, default: null },
    resetPasswordTokenHash: { type: String, default: null, select: false },
    resetPasswordExpires: { type: Date, default: null, select: false },
  },
  {
    timestamps: true,
  },
)

export const User = model<IUser, UserModel>('User', UserSchema)
