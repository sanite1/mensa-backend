// b2bOrg.service.ts — partnerships (B2BOrg) lifecycle: public application submit, admin list / verify / reject. Pricing tiers, quotes and invoicing are a later sprint.

import type { FilterQuery } from 'mongoose'
import { Types } from 'mongoose'

import { B2BOrg } from '../../models/b2b/B2BOrg'
import { ApiError } from '../../errors/apiError'
import { ApiResponse } from '../../errors/apiResponse'
import type {
  AdminListB2BOrgsQuery,
  AdminListB2BOrgsResult,
  B2BOrgDocument,
  IB2BOrg,
  SubmitB2BOrgInput,
  VerifyB2BOrgInput,
} from '../../interfaces/b2b/b2bOrg.interface'

const DEFAULT_PAGE_SIZE = 24
const MAX_PAGE_SIZE = 100

const escapeRegex = (input: string): string =>
  input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// ─── Public: submit a partnership application ────────────────────
export const submitB2BOrgService = async (
  input: SubmitB2BOrgInput,
): Promise<ApiResponse<{ org: B2BOrgDocument }>> => {
  const email = input.contactEmail.toLowerCase().trim()
  const existing = await B2BOrg.findOne({ contactEmail: email })
  if (existing) {
    throw new ApiError(
      409,
      'An application with that email already exists. We will get back to you.',
    )
  }

  const org = (await B2BOrg.create({
    name: input.name.trim(),
    type: input.type,
    registrationNumber: input.registrationNumber?.trim(),
    contactName: input.contactName.trim(),
    contactEmail: email,
    contactPhone: input.contactPhone.trim(),
    notes: input.notes?.trim() ?? '',
    verificationStatus: 'pending',
  })) as B2BOrgDocument

  return new ApiResponse(201, 'Application received.', { org })
}

// ─── Admin: list orgs ────────────────────────────────────────────
export const adminListB2BOrgsService = async (
  query: AdminListB2BOrgsQuery,
): Promise<ApiResponse<AdminListB2BOrgsResult>> => {
  const page = Math.max(1, query.page ?? 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE))

  const filter: FilterQuery<IB2BOrg> = {}
  if (query.verificationStatus) filter.verificationStatus = query.verificationStatus
  const q = query.q?.trim()
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i')
    filter.$or = [{ name: rx }, { contactEmail: rx }, { contactName: rx }]
  }

  const [items, total] = await Promise.all([
    B2BOrg.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize) as unknown as Promise<B2BOrgDocument[]>,
    B2BOrg.countDocuments(filter),
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

// ─── Admin: get one ──────────────────────────────────────────────
export const adminGetB2BOrgService = async (
  id: string,
): Promise<ApiResponse<{ org: B2BOrgDocument }>> => {
  if (!Types.ObjectId.isValid(id)) throw new ApiError(404, 'Partnership not found.')
  const org = (await B2BOrg.findById(id)) as B2BOrgDocument | null
  if (!org) throw new ApiError(404, 'Partnership not found.')
  return new ApiResponse(200, 'OK.', { org })
}

// ─── Admin: verify / reject ──────────────────────────────────────
export const adminVerifyB2BOrgService = async (
  id: string,
  input: VerifyB2BOrgInput,
  actorUserId: string | null,
): Promise<ApiResponse<{ org: B2BOrgDocument }>> => {
  if (!Types.ObjectId.isValid(id)) throw new ApiError(404, 'Partnership not found.')
  const org = (await B2BOrg.findById(id)) as B2BOrgDocument | null
  if (!org) throw new ApiError(404, 'Partnership not found.')

  if (org.verificationStatus === input.verificationStatus) {
    throw new ApiError(
      409,
      `Partnership is already ${input.verificationStatus}.`,
    )
  }

  org.verificationStatus = input.verificationStatus
  org.verificationNote = input.verificationNote?.trim() ?? ''
  if (input.verificationStatus === 'verified') {
    org.verifiedAt = new Date()
    org.verifiedBy = actorUserId ? new Types.ObjectId(actorUserId) : null
  } else {
    org.verifiedAt = null
    org.verifiedBy = null
  }

  await org.save()
  return new ApiResponse(200, `Partnership ${input.verificationStatus}.`, { org })
}
