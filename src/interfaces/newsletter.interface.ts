import type { Document, Types } from 'mongoose'

/** Where the visitor signed up. Lets us measure which surfaces drive the
 *  most subscribers. Extend as we add new entry points. */
export type NewsletterSource =
  | 'footer'
  | 'mobile_drawer'
  | 'partner_apply'
  | 'checkout'
  | 'other'

export type NewsletterStatus = 'subscribed' | 'unsubscribed'

export interface INewsletterSubscriber {
  email: string
  source: NewsletterSource
  status: NewsletterStatus
  subscribedAt: Date
  unsubscribedAt?: Date | null
  /** Future: Mailerlite remote id once we wire the integration. */
  mailerliteId?: string
  /** Single-use token included in unsubscribe links sent via email. */
  unsubscribeToken: string
  createdAt: Date
  updatedAt: Date
}

export type NewsletterSubscriberDocument = Document<
  Types.ObjectId,
  unknown,
  INewsletterSubscriber
> &
  INewsletterSubscriber

// ── DTOs ─────────────────────────────────────────────────────────

export interface SubscribeInput {
  email: string
  source?: NewsletterSource
}

export interface AdminListSubscribersQuery {
  status?: NewsletterStatus
  source?: NewsletterSource
  q?: string
  page?: number
  pageSize?: number
}

export interface AdminListSubscribersResult {
  items: NewsletterSubscriberDocument[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}
