// ═══════════════════════════════════════════════════════════════
// user.service.ts
//
// Right now this owns the customer address book (saved delivery
// addresses). User profile editing, B2B org linking, etc. will land
// here as the customer dashboard grows.
//
// Invariant: at most one address per user has isDefault=true. The
// service enforces this when adding / updating, NOT the model — a
// mongoose pre-save hook on a sub-doc array gets messy with $push.
// ═══════════════════════════════════════════════════════════════

import { Types } from 'mongoose'

import { User } from '../models/User'
import { ApiError } from '../errors/apiError'
import { ApiResponse } from '../errors/apiResponse'
import type {
  IUserAddress,
  UpdateUserAddressInput,
  UserAddressInput,
} from '../interfaces/user.interface'

// ─── Helpers ─────────────────────────────────────────────────────

function normaliseAddress(input: UserAddressInput): Omit<IUserAddress, '_id' | 'isDefault'> {
  return {
    label: input.label?.trim() || undefined,
    fullName: input.fullName.trim(),
    phone: input.phone.trim(),
    line1: input.line1.trim(),
    line2: input.line2?.trim() || undefined,
    city: input.city.trim(),
    state: input.state.trim(),
    country: (input.country ?? 'NG').trim(),
    postal: input.postal?.trim() || undefined,
  }
}

/** Cheap fingerprint of an address so we can dedupe identical entries
 *  the customer might re-submit at checkout. Case-insensitive on the
 *  open-text fields. */
function addressFingerprint(a: Pick<IUserAddress, 'line1' | 'line2' | 'city' | 'state' | 'postal'>): string {
  return [
    a.line1.toLowerCase().trim(),
    (a.line2 ?? '').toLowerCase().trim(),
    a.city.toLowerCase().trim(),
    a.state.toLowerCase().trim(),
    (a.postal ?? '').toLowerCase().trim(),
  ].join('|')
}

function requireUserObjectId(userId: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(userId)) throw new ApiError(401, 'Not signed in.')
  return new Types.ObjectId(userId)
}

// ─── List ────────────────────────────────────────────────────────

export const listMyAddressesService = async (
  userId: string,
): Promise<ApiResponse<{ addresses: IUserAddress[] }>> => {
  const _id = requireUserObjectId(userId)
  const user = await User.findById(_id).select('addresses').lean()
  if (!user) throw new ApiError(404, 'User not found.')
  return new ApiResponse(200, 'OK.', { addresses: user.addresses ?? [] })
}

// ─── Add ─────────────────────────────────────────────────────────

export const addMyAddressService = async (
  userId: string,
  input: UserAddressInput,
): Promise<ApiResponse<{ address: IUserAddress; addresses: IUserAddress[] }>> => {
  const _id = requireUserObjectId(userId)
  const user = await User.findById(_id)
  if (!user) throw new ApiError(404, 'User not found.')

  const next = normaliseAddress(input)

  // Dedupe: if this exact address already exists, return it instead of
  // creating a clone. This is what makes the checkout-save flow idempotent
  // (customer placing repeat orders to the same address never grows the
  // book).
  const fp = addressFingerprint(next)
  const existing = user.addresses.find((a) => addressFingerprint(a) === fp)
  if (existing) {
    if (input.isDefault && !existing.isDefault) {
      user.addresses.forEach((a) => {
        a.isDefault = a._id?.toString() === existing._id?.toString()
      })
      await user.save()
    }
    return new ApiResponse(200, 'Address already saved.', {
      address: existing,
      addresses: user.addresses,
    })
  }

  // First-ever address is default automatically. Otherwise honour the
  // explicit flag; if set, demote everything else.
  const shouldDefault = user.addresses.length === 0 || !!input.isDefault
  if (shouldDefault) user.addresses.forEach((a) => (a.isDefault = false))

  user.addresses.push({ ...next, isDefault: shouldDefault } as IUserAddress)
  await user.save()
  const created = user.addresses[user.addresses.length - 1]

  return new ApiResponse(201, 'Address saved.', {
    address: created,
    addresses: user.addresses,
  })
}

// ─── Update ──────────────────────────────────────────────────────

export const updateMyAddressService = async (
  userId: string,
  addressId: string,
  input: UpdateUserAddressInput,
): Promise<ApiResponse<{ address: IUserAddress; addresses: IUserAddress[] }>> => {
  const _id = requireUserObjectId(userId)
  if (!Types.ObjectId.isValid(addressId)) throw new ApiError(404, 'Address not found.')

  const user = await User.findById(_id)
  if (!user) throw new ApiError(404, 'User not found.')

  const address = user.addresses.find((a) => a._id?.toString() === addressId)
  if (!address) throw new ApiError(404, 'Address not found.')

  if (input.label !== undefined) address.label = input.label.trim() || undefined
  if (input.fullName !== undefined) address.fullName = input.fullName.trim()
  if (input.phone !== undefined) address.phone = input.phone.trim()
  if (input.line1 !== undefined) address.line1 = input.line1.trim()
  if (input.line2 !== undefined) address.line2 = input.line2.trim() || undefined
  if (input.city !== undefined) address.city = input.city.trim()
  if (input.state !== undefined) address.state = input.state.trim()
  if (input.country !== undefined) address.country = input.country.trim() || 'NG'
  if (input.postal !== undefined) address.postal = input.postal.trim() || undefined

  if (input.isDefault === true && !address.isDefault) {
    user.addresses.forEach((a) => {
      a.isDefault = a._id?.toString() === addressId
    })
  }

  await user.save()
  return new ApiResponse(200, 'Address updated.', {
    address,
    addresses: user.addresses,
  })
}

// ─── Set default ─────────────────────────────────────────────────

export const setDefaultAddressService = async (
  userId: string,
  addressId: string,
): Promise<ApiResponse<{ addresses: IUserAddress[] }>> => {
  const _id = requireUserObjectId(userId)
  if (!Types.ObjectId.isValid(addressId)) throw new ApiError(404, 'Address not found.')

  const user = await User.findById(_id)
  if (!user) throw new ApiError(404, 'User not found.')

  const target = user.addresses.find((a) => a._id?.toString() === addressId)
  if (!target) throw new ApiError(404, 'Address not found.')

  user.addresses.forEach((a) => {
    a.isDefault = a._id?.toString() === addressId
  })
  await user.save()

  return new ApiResponse(200, 'Default address updated.', {
    addresses: user.addresses,
  })
}

// ─── Delete ──────────────────────────────────────────────────────

export const deleteMyAddressService = async (
  userId: string,
  addressId: string,
): Promise<ApiResponse<{ addresses: IUserAddress[] }>> => {
  const _id = requireUserObjectId(userId)
  if (!Types.ObjectId.isValid(addressId)) throw new ApiError(404, 'Address not found.')

  const user = await User.findById(_id)
  if (!user) throw new ApiError(404, 'User not found.')

  const before = user.addresses.length
  const wasDefault = user.addresses.find(
    (a) => a._id?.toString() === addressId,
  )?.isDefault
  user.addresses = user.addresses.filter(
    (a) => a._id?.toString() !== addressId,
  ) as typeof user.addresses
  if (user.addresses.length === before) {
    throw new ApiError(404, 'Address not found.')
  }

  // If we removed the default, promote the most recently added survivor.
  if (wasDefault && user.addresses.length > 0) {
    user.addresses[user.addresses.length - 1].isDefault = true
  }

  await user.save()
  return new ApiResponse(200, 'Address removed.', {
    addresses: user.addresses,
  })
}
