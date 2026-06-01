import { Schema, model, type Model } from 'mongoose'
import type {
  INewsletterSubscriber,
  NewsletterSource,
  NewsletterStatus,
} from '../interfaces/newsletter.interface'

type NewsletterSubscriberModel = Model<INewsletterSubscriber>

const NewsletterSubscriberSchema = new Schema<
  INewsletterSubscriber,
  NewsletterSubscriberModel
>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    source: {
      type: String,
      enum: [
        'footer',
        'mobile_drawer',
        'partner_apply',
        'checkout',
        'other',
      ] satisfies NewsletterSource[],
      default: 'other',
      index: true,
    },
    status: {
      type: String,
      enum: ['subscribed', 'unsubscribed'] satisfies NewsletterStatus[],
      default: 'subscribed',
      index: true,
    },
    subscribedAt: { type: Date, required: true, default: () => new Date() },
    unsubscribedAt: { type: Date, default: null },
    mailerliteId: { type: String, default: null },
    unsubscribeToken: { type: String, required: true, select: false },
  },
  { timestamps: true },
)

export const NewsletterSubscriber = model<
  INewsletterSubscriber,
  NewsletterSubscriberModel
>('NewsletterSubscriber', NewsletterSubscriberSchema)
