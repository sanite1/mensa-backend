// lead.service.ts — starter set finder leads. Submit is an upsert keyed on
// email so retakes refresh the answers instead of duplicating rows, and the
// admin alert email only fires for a first submission. The paid order flow
// flips a matching lead to 'ordered', everything still 'new' is the follow
// up list.

import type { FilterQuery } from 'mongoose'

import { StarterSetLead } from '../models/StarterSetLead'
import { ApiError } from '../errors/apiError'
import { ApiResponse } from '../errors/apiResponse'
import { sendMail } from './nodemailer/mail.service'
import { logger } from '../config/logger'
import type {
  AdminListLeadsQuery,
  AdminListLeadsResult,
  IStarterSetLead,
  LeadResultCode,
  LeadStatus,
  StarterSetLeadDocument,
  SubmitLeadInput,
} from '../interfaces/lead.interface'

const DEFAULT_PAGE_SIZE = 24
const MAX_PAGE_SIZE = 200

const RESULT_LABEL: Record<LeadResultCode, string> = {
  PADS: 'Pack of Pads',
  PANT1: 'Single Pant',
  PANT3: 'Pack of 3 Pants',
  PANT5: 'Pack of 5 Pants',
  PANT1_PADS: 'Single Pant and a Pack of Pads',
  PANT3_PADS: 'Pack of 3 Pants and a Pack of Pads',
}

const escapeRegex = (input: string): string => input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// ─── Public: submit from the quiz ───────────────────────────────
export const submitLeadService = async (
  input: SubmitLeadInput,
): Promise<ApiResponse<{ received: true }>> => {
  const name = input.name.trim()
  const email = input.email.trim().toLowerCase()
  if (!name || !email) throw new ApiError(400, 'Name and email are required.')

  const existing = await StarterSetLead.findOne({ email })

  if (existing) {
    // A retake refreshes the profile but never downgrades an 'ordered' lead
    // and never re alerts the admin.
    existing.name = name
    existing.answers = input.answers
    existing.resultCode = input.resultCode
    existing.retakes += 1
    await existing.save()
    logger.info(`[lead] retake by ${email} result=${input.resultCode}`)
    return new ApiResponse(200, 'Thank you. Your recommendation is ready.', { received: true })
  }

  await StarterSetLead.create({
    name,
    email,
    answers: input.answers,
    resultCode: input.resultCode,
    status: 'new',
  })
  logger.info(`[lead] new lead ${email} result=${input.resultCode}`)

  // Alert the admin inbox. Best effort, a broken SMTP must never block the
  // quiz result from showing.
  try {
    const adminTo =
      process.env.ADMIN_NOTIFICATION_EMAIL ?? process.env.SUPPORT_EMAIL ?? process.env.SMTP_FROM
    if (!adminTo) {
      logger.warn('[lead] no admin notification address configured; skipping alert.')
    } else {
      await sendMail({
        to: adminTo,
        subject: `[Lead] ${name} · ${RESULT_LABEL[input.resultCode]}`,
        template: 'leadAlert',
        data: {
          name,
          email,
          resultName: RESULT_LABEL[input.resultCode],
          submittedAt: new Date().toLocaleString('en-NG', {
            dateStyle: 'medium',
            timeStyle: 'short',
          }),
          adminLeadsUrl: `${process.env.FRONTEND_ADMIN_URL}/leads`,
        },
        replyTo: email,
      })
      logger.info(`[lead] admin alert dispatched to=${adminTo}`)
    }
  } catch (err) {
    logger.error('[lead] admin alert threw unexpectedly', err)
  }

  return new ApiResponse(201, 'Thank you. Your recommendation is ready.', { received: true })
}

// ─── Paid order hook: mark a matching lead as converted ─────────
export const markLeadOrderedService = async (
  customerEmail: string,
  orderNumber: string,
): Promise<void> => {
  const email = customerEmail.trim().toLowerCase()
  if (!email) return
  const res = await StarterSetLead.updateOne(
    { email, status: { $ne: 'ordered' } },
    { $set: { status: 'ordered', orderNumber, orderedAt: new Date() } },
  )
  if (res.modifiedCount > 0) {
    logger.info(`[lead] ${email} converted by order ${orderNumber}`)
  }
}

// ─── Admin: list ────────────────────────────────────────────────
export const adminListLeadsService = async (
  query: AdminListLeadsQuery,
): Promise<ApiResponse<AdminListLeadsResult>> => {
  const page = Math.max(1, query.page ?? 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE))

  const filter: FilterQuery<IStarterSetLead> = {}
  if (query.status) filter.status = query.status
  const q = query.q?.trim()
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i')
    filter.$or = [{ email: rx }, { name: rx }]
  }

  const [items, total] = await Promise.all([
    StarterSetLead.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize) as unknown as Promise<StarterSetLeadDocument[]>,
    StarterSetLead.countDocuments(filter),
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

// ─── Admin: update status (new ⇄ contacted) ─────────────────────
export const adminUpdateLeadStatusService = async (
  id: string,
  status: Extract<LeadStatus, 'new' | 'contacted'>,
): Promise<ApiResponse<{ id: string; status: LeadStatus }>> => {
  const lead = await StarterSetLead.findById(id)
  if (!lead) throw new ApiError(404, 'Lead not found.')
  if (lead.status === 'ordered') {
    throw new ApiError(400, 'This lead already ordered, its status is final.')
  }
  lead.status = status
  lead.contactedAt = status === 'contacted' ? new Date() : null
  await lead.save()
  return new ApiResponse(200, 'Lead updated.', { id, status })
}

// ─── Admin: delete ──────────────────────────────────────────────
export const adminDeleteLeadService = async (id: string): Promise<ApiResponse<{ id: string }>> => {
  const lead = await StarterSetLead.findByIdAndDelete(id)
  if (!lead) throw new ApiError(404, 'Lead not found.')
  return new ApiResponse(200, 'Lead removed.', { id })
}
