// newsletter.service.ts — subscribe / unsubscribe / admin list. Subscribe is idempotent, resubmits reactivate instead of 409ing. mailerliteId is stored so a future Mailerlite sync needs no schema change.

import crypto from 'crypto'
import type { FilterQuery } from 'mongoose'

import { NewsletterSubscriber } from '../models/NewsletterSubscriber'
import { ApiError } from '../errors/apiError'
import { ApiResponse } from '../errors/apiResponse'
import { logger } from '../config/logger'
import type {
  AdminListSubscribersQuery,
  AdminListSubscribersResult,
  INewsletterSubscriber,
  NewsletterSubscriberDocument,
  SubscribeInput,
} from '../interfaces/newsletter.interface'

const DEFAULT_PAGE_SIZE = 24
const MAX_PAGE_SIZE = 200

const escapeRegex = (input: string): string =>
  input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// ─── Public: subscribe ──────────────────────────────────────────
export const subscribeService = async (
  input: SubscribeInput,
): Promise<ApiResponse<{ subscribed: true }>> => {
  const email = input.email.toLowerCase().trim()
  if (!email) throw new ApiError(400, 'Email is required.')

  const source = input.source ?? 'other'
  const existing = await NewsletterSubscriber.findOne({ email })

  if (existing) {
    // Re subscribe flips an unsubscribed record back and refreshes the source, already subscribed records are a no op.
    if (existing.status === 'unsubscribed') {
      existing.status = 'subscribed'
      existing.subscribedAt = new Date()
      existing.unsubscribedAt = null
      existing.source = source
      await existing.save()
      logger.info(`Newsletter resubscribed: ${email} source=${source}`)
    } else {
      logger.info(`Newsletter no-op (already subscribed): ${email}`)
    }
    return new ApiResponse(200, 'You are on the list.', { subscribed: true })
  }

  await NewsletterSubscriber.create({
    email,
    source,
    status: 'subscribed',
    subscribedAt: new Date(),
    unsubscribeToken: crypto.randomBytes(24).toString('hex'),
  })
  logger.info(`Newsletter subscribed: ${email} source=${source}`)
  return new ApiResponse(201, 'You are on the list. Welcome.', { subscribed: true })
}

// ─── Public: unsubscribe via token ──────────────────────────────
export const unsubscribeService = async (
  token: string,
): Promise<ApiResponse<{ unsubscribed: true }>> => {
  if (!token) throw new ApiError(400, 'Unsubscribe token is required.')
  const sub = (await NewsletterSubscriber.findOne({
    unsubscribeToken: token,
  }).select('+unsubscribeToken')) as NewsletterSubscriberDocument | null

  if (!sub) {
    // Don't leak whether the token is real. Return the same response
    // either way so an attacker can't enumerate emails.
    return new ApiResponse(200, 'You have been unsubscribed.', { unsubscribed: true })
  }
  if (sub.status === 'subscribed') {
    sub.status = 'unsubscribed'
    sub.unsubscribedAt = new Date()
    await sub.save()
  }
  return new ApiResponse(200, 'You have been unsubscribed.', { unsubscribed: true })
}

// ─── Admin: list ───────────────────────────────────────────────
export const adminListSubscribersService = async (
  query: AdminListSubscribersQuery,
): Promise<ApiResponse<AdminListSubscribersResult>> => {
  const page = Math.max(1, query.page ?? 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE))

  const filter: FilterQuery<INewsletterSubscriber> = {}
  if (query.status) filter.status = query.status
  if (query.source) filter.source = query.source
  const q = query.q?.trim()
  if (q) filter.email = new RegExp(escapeRegex(q), 'i')

  const [items, total] = await Promise.all([
    NewsletterSubscriber.find(filter)
      .sort({ subscribedAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize) as unknown as Promise<NewsletterSubscriberDocument[]>,
    NewsletterSubscriber.countDocuments(filter),
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

// ─── Admin: delete (hard-delete a subscriber row) ──────────────
export const adminDeleteSubscriberService = async (
  id: string,
): Promise<ApiResponse<{ id: string }>> => {
  const sub = await NewsletterSubscriber.findByIdAndDelete(id)
  if (!sub) throw new ApiError(404, 'Subscriber not found.')
  return new ApiResponse(200, 'Subscriber removed.', { id })
}

// ─── Counts used by /admin/stats ───────────────────────────────
export const subscriberCountsService = async (): Promise<{
  totalSubscribed: number
  /** Sub count for "this week" — subscribed in the last 7 days. */
  newThisWeek: number
}> => {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const [totalSubscribed, newThisWeek] = await Promise.all([
    NewsletterSubscriber.countDocuments({ status: 'subscribed' }),
    NewsletterSubscriber.countDocuments({
      status: 'subscribed',
      subscribedAt: { $gte: sevenDaysAgo },
    }),
  ])
  return { totalSubscribed, newThisWeek }
}
