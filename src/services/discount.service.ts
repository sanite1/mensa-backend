// discount.service.ts — admin CRUD plus apply (code + subtotal to kobo savings), used by /checkout/apply-discount and order initialize.
// reserveRedemptionByCode atomically increments usedCount under the cap, releaseRedemptionByCode decrements when a reserving order fails or cancels.

import type { FilterQuery } from 'mongoose'
import { Types } from 'mongoose'

import { Discount } from '../models/Discount'
import { ApiError } from '../errors/apiError'
import { ApiResponse } from '../errors/apiResponse'
import type {
  ApplyDiscountResult,
  CreateDiscountInput,
  DiscountDocument,
  IDiscount,
  ListDiscountsQuery,
  ListDiscountsResult,
  UpdateDiscountInput,
} from '../interfaces/discount.interface'

const DEFAULT_PAGE_SIZE = 24
const MAX_PAGE_SIZE = 100

// ─── Helpers ─────────────────────────────────────────────────────

function normaliseCode(code: string): string {
  return code.trim().toUpperCase()
}

/** Compute the kobo savings for a subtotal. Clamped: percent discounts
 *  cap at the subtotal, fixed discounts cap at the subtotal too, so we
 *  never end up with negative line totals. */
export function computeDiscountKobo(
  discount: Pick<IDiscount, 'type' | 'value'>,
  subtotalKobo: number,
): number {
  if (subtotalKobo <= 0) return 0
  if (discount.type === 'percent') {
    const raw = Math.round((subtotalKobo * discount.value) / 100)
    return Math.min(raw, subtotalKobo)
  }
  // fixed: value is kobo
  return Math.min(discount.value, subtotalKobo)
}

function describeDiscount(d: Pick<IDiscount, 'type' | 'value'>): string {
  if (d.type === 'percent') return `${d.value}% off`
  return `₦${(d.value / 100).toLocaleString('en-NG')} off`
}

/** Pure validation: throws if a code is expired / inactive / capped out. */
function assertDiscountUsable(discount: IDiscount): void {
  if (!discount.isActive) {
    throw new ApiError(409, `Code "${discount.code}" is no longer active.`)
  }
  if (discount.expiresAt && discount.expiresAt.getTime() <= Date.now()) {
    throw new ApiError(409, `Code "${discount.code}" has expired.`)
  }
  if (discount.maxUses != null && discount.usedCount >= discount.maxUses) {
    throw new ApiError(409, `Code "${discount.code}" has reached its usage limit.`)
  }
}

// ─── Public: apply a code to a subtotal (preview) ────────────────

export const applyDiscountService = async (
  code: string,
  subtotalKobo: number,
): Promise<ApiResponse<ApplyDiscountResult>> => {
  if (subtotalKobo <= 0) throw new ApiError(400, 'No items in cart.')
  const normalised = normaliseCode(code)
  if (!normalised) throw new ApiError(422, 'Enter a discount code.')

  const discount = (await Discount.findOne({ code: normalised })) as DiscountDocument | null
  if (!discount) {
    throw new ApiError(404, `We could not find a code matching "${normalised}".`)
  }
  assertDiscountUsable(discount)

  const discountKobo = computeDiscountKobo(discount, subtotalKobo)

  return new ApiResponse(200, 'OK.', {
    code: discount.code,
    type: discount.type,
    discountKobo,
    description: describeDiscount(discount),
  })
}

// ─── Internal helpers for the checkout flow ──────────────────────

/** Find + validate a code without mutating it. Used inside
 *  initializeCheckoutService to surface a friendly error before any
 *  stock is reserved. */
export const findUsableDiscountByCode = async (
  code: string,
): Promise<DiscountDocument | null> => {
  const normalised = normaliseCode(code)
  if (!normalised) return null
  const discount = (await Discount.findOne({ code: normalised })) as DiscountDocument | null
  if (!discount) {
    throw new ApiError(404, `We could not find a code matching "${normalised}".`)
  }
  assertDiscountUsable(discount)
  return discount
}

/** Atomically increment usedCount, refusing to overshoot maxUses.
 *  Returns true on success, false if the cap was hit between the
 *  earlier preview and the actual reservation. */
export const reserveRedemptionByCode = async (code: string): Promise<boolean> => {
  const normalised = normaliseCode(code)
  if (!normalised) return false

  // The $expr clause is the race-safe gate: only increment when
  // usedCount + 1 <= maxUses (or maxUses is null = unlimited).
  const result = await Discount.findOneAndUpdate(
    {
      code: normalised,
      isActive: true,
      $or: [
        { maxUses: null },
        { $expr: { $lt: ['$usedCount', '$maxUses'] } },
      ],
    },
    { $inc: { usedCount: 1 } },
    { new: true },
  )
  return result !== null
}

/** Inverse of reserveRedemptionByCode. Used when an order that
 *  reserved a redemption fails to complete. Never goes below 0. */
export const releaseRedemptionByCode = async (code: string): Promise<void> => {
  const normalised = normaliseCode(code)
  if (!normalised) return
  await Discount.updateOne(
    { code: normalised, usedCount: { $gt: 0 } },
    { $inc: { usedCount: -1 } },
  )
}

// ─── Admin: list ─────────────────────────────────────────────────

export const adminListDiscountsService = async (
  query: ListDiscountsQuery,
): Promise<ApiResponse<ListDiscountsResult>> => {
  const page = Math.max(1, query.page ?? 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE))
  const filter: FilterQuery<IDiscount> = {}
  if (query.isActive !== undefined) filter.isActive = query.isActive

  const [items, total] = await Promise.all([
    Discount.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize) as unknown as Promise<DiscountDocument[]>,
    Discount.countDocuments(filter),
  ])

  return new ApiResponse(200, 'OK.', {
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  })
}

// ─── Admin: get by id ────────────────────────────────────────────

export const adminGetDiscountService = async (
  id: string,
): Promise<ApiResponse<{ discount: DiscountDocument }>> => {
  if (!Types.ObjectId.isValid(id)) throw new ApiError(404, 'Discount not found.')
  const discount = (await Discount.findById(id)) as DiscountDocument | null
  if (!discount) throw new ApiError(404, 'Discount not found.')
  return new ApiResponse(200, 'OK.', { discount })
}

// ─── Admin: create ───────────────────────────────────────────────

export const adminCreateDiscountService = async (
  input: CreateDiscountInput,
): Promise<ApiResponse<{ discount: DiscountDocument }>> => {
  const code = normaliseCode(input.code)
  if (!code) throw new ApiError(422, 'Code is required.')

  const existing = await Discount.findOne({ code }).lean()
  if (existing) {
    throw new ApiError(409, `A code "${code}" already exists.`)
  }

  const discount = (await Discount.create({
    code,
    type: input.type,
    value: input.value,
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    maxUses: input.maxUses ?? null,
    isActive: input.isActive ?? true,
    description: input.description?.trim() ?? '',
  })) as DiscountDocument

  return new ApiResponse(201, 'Discount created.', { discount })
}

// ─── Admin: update ───────────────────────────────────────────────

export const adminUpdateDiscountService = async (
  id: string,
  input: UpdateDiscountInput,
): Promise<ApiResponse<{ discount: DiscountDocument }>> => {
  if (!Types.ObjectId.isValid(id)) throw new ApiError(404, 'Discount not found.')
  const discount = (await Discount.findById(id)) as DiscountDocument | null
  if (!discount) throw new ApiError(404, 'Discount not found.')

  if (input.code !== undefined) {
    const next = normaliseCode(input.code)
    if (!next) throw new ApiError(422, 'Code cannot be empty.')
    if (next !== discount.code) {
      const taken = await Discount.findOne({ code: next }).lean()
      if (taken) throw new ApiError(409, `A code "${next}" already exists.`)
      discount.code = next
    }
  }
  if (input.type !== undefined) discount.type = input.type
  if (input.value !== undefined) discount.value = input.value
  if (input.expiresAt !== undefined) {
    discount.expiresAt = input.expiresAt ? new Date(input.expiresAt) : null
  }
  if (input.maxUses !== undefined) discount.maxUses = input.maxUses ?? null
  if (input.isActive !== undefined) discount.isActive = input.isActive
  if (input.description !== undefined) discount.description = input.description.trim()

  await discount.save()
  return new ApiResponse(200, 'Discount updated.', { discount })
}

// ─── Admin: delete (hard delete; codes are cheap to recreate) ────

export const adminDeleteDiscountService = async (
  id: string,
): Promise<ApiResponse> => {
  if (!Types.ObjectId.isValid(id)) throw new ApiError(404, 'Discount not found.')
  const result = await Discount.deleteOne({ _id: id })
  if (result.deletedCount === 0) throw new ApiError(404, 'Discount not found.')
  return new ApiResponse(200, 'Discount deleted.')
}
