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
import { createLeadDiscountService } from './discount.service'
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

const LEAD_CODE_VALID_DAYS = 7
const LEAD_CODE_REMINDER_AFTER_DAYS = 5
const DAY_MS = 24 * 60 * 60 * 1000

const formatLongDate = (date: Date): string =>
  date.toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })

/** The code email (on submit) and its day 5 nudge. Best effort. */
async function dispatchLeadCodeEmail(
  lead: StarterSetLeadDocument,
  template: 'leadCode' | 'leadCodeReminder',
): Promise<void> {
  if (!lead.discountCode || !lead.discountExpiresAt) return
  const base = process.env.FRONTEND_PLATFORM_URL ?? ''
  const daysLeft = Math.max(1, Math.ceil((lead.discountExpiresAt.getTime() - Date.now()) / DAY_MS))
  try {
    await sendMail({
      to: lead.email,
      subject:
        template === 'leadCode'
          ? `Your starter set and a 10% code, ${lead.name.trim().split(' ')[0] || 'friend'}`
          : `Your 10% code ends in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`,
      template,
      data: {
        customerName: lead.name.trim().split(' ')[0] || 'there',
        resultName: RESULT_LABEL[lead.resultCode],
        reason: lead.resultReason || null,
        code: lead.discountCode,
        expiresOn: formatLongDate(lead.discountExpiresAt),
        daysLeft,
        dayWord: daysLeft === 1 ? 'day' : 'days',
        shopUrl: `${base}${lead.shopPath || '/shop'}`,
      },
      replyTo: process.env.SUPPORT_EMAIL,
    })
    logger.info(`[lead] ${template} dispatched to ${lead.email}`)
  } catch (err) {
    logger.error(`[lead] ${template} threw for ${lead.email}`, err)
  }
}

/** Called when an order that used a lead code is paid. */
export const markLeadCodeRedeemedService = async (
  code: string,
  orderNumber: string,
): Promise<void> => {
  const res = await StarterSetLead.updateOne(
    { discountCode: code.trim().toUpperCase(), discountRedeemedAt: null },
    { $set: { discountRedeemedAt: new Date(), discountRedeemedOrderNumber: orderNumber } },
  )
  if (res.modifiedCount > 0) logger.info(`[lead] code ${code} redeemed on ${orderNumber}`)
}

/** Daily cron: nudge everyone whose code is 5 days old, unused and still
 *  valid. reminderSentAt makes a rerun a no op. */
export const sendLeadCodeRemindersService = async (): Promise<
  ApiResponse<{ sent: number; skipped: number }>
> => {
  const now = new Date()
  const due = (await StarterSetLead.find({
    discountCode: { $ne: null },
    discountRedeemedAt: null,
    reminderSentAt: null,
    discountIssuedAt: { $lte: new Date(now.getTime() - LEAD_CODE_REMINDER_AFTER_DAYS * DAY_MS) },
    discountExpiresAt: { $gt: now },
  })) as StarterSetLeadDocument[]

  let sent = 0
  let skipped = 0
  for (const lead of due) {
    // Claim first so two overlapping runs cannot both send.
    const claimed = await StarterSetLead.updateOne(
      { _id: lead._id, reminderSentAt: null },
      { $set: { reminderSentAt: now } },
    )
    if (claimed.modifiedCount === 0) {
      skipped += 1
      continue
    }
    await dispatchLeadCodeEmail(lead, 'leadCodeReminder')
    sent += 1
  }
  logger.info(`[lead] reminder run: sent=${sent} skipped=${skipped}`)
  return new ApiResponse(200, 'Reminder run complete.', { sent, skipped })
}

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

  const lead = (await StarterSetLead.create({
    name,
    email,
    answers: input.answers,
    resultCode: input.resultCode,
    status: 'new',
    resultReason: input.reason?.trim() ?? '',
    shopPath: input.shopPath?.trim() ?? '',
  })) as StarterSetLeadDocument
  logger.info(`[lead] new lead ${email} result=${input.resultCode}`)

  // Personal 10 percent code, valid for a week. Best effort: a code failure
  // never blocks the result, the admin alert still says the lead arrived.
  try {
    const discount = await createLeadDiscountService(email, LEAD_CODE_VALID_DAYS)
    lead.discountCode = discount.code
    lead.discountIssuedAt = new Date()
    lead.discountExpiresAt = discount.expiresAt
    await lead.save()
    await dispatchLeadCodeEmail(lead, 'leadCode')
  } catch (err) {
    logger.error(`[lead] could not issue a code for ${email}`, err)
  }

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

  const now = new Date()
  const filter: FilterQuery<IStarterSetLead> = {}
  if (query.status) filter.status = query.status
  if (query.code === 'redeemed') filter.discountRedeemedAt = { $ne: null }
  if (query.code === 'unredeemed') {
    filter.discountCode = { $ne: null }
    filter.discountRedeemedAt = null
    filter.discountExpiresAt = { $gt: now }
  }
  if (query.code === 'expired') {
    filter.discountCode = { $ne: null }
    filter.discountRedeemedAt = null
    filter.discountExpiresAt = { $lte: now }
  }
  const q = query.q?.trim()
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i')
    filter.$or = [{ email: rx }, { name: rx }, { discountCode: rx }]
  }

  const [items, total, issued, redeemed, expired] = await Promise.all([
    StarterSetLead.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize) as unknown as Promise<StarterSetLeadDocument[]>,
    StarterSetLead.countDocuments(filter),
    StarterSetLead.countDocuments({ discountCode: { $ne: null } }),
    StarterSetLead.countDocuments({ discountRedeemedAt: { $ne: null } }),
    StarterSetLead.countDocuments({
      discountCode: { $ne: null },
      discountRedeemedAt: null,
      discountExpiresAt: { $lte: now },
    }),
  ])

  return new ApiResponse(200, 'OK.', {
    items,
    codeStats: { issued, redeemed, expired },
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
