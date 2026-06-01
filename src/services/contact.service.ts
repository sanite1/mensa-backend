// ═══════════════════════════════════════════════════════════════
// contact.service.ts
//
// Lightweight "send us a message" form. We forward the submission
// to the support inbox via the existing nodemailer plumbing — no
// dedicated model or queue, since the volume is low and the inbox
// is the source of truth.
//
// `replyTo` is set on the outgoing email so the support team can
// hit Reply and respond to the visitor directly without retyping
// their address.
// ═══════════════════════════════════════════════════════════════

import { ApiError } from '../errors/apiError'
import { ApiResponse } from '../errors/apiResponse'
import { sendMail } from './nodemailer/mail.service'
import { logger } from '../config/logger'

export type ContactTopic =
  | 'order'
  | 'product'
  | 'partnership'
  | 'press'
  | 'other'

export interface ContactMessageInput {
  name: string
  email: string
  topic: ContactTopic
  /** Optional order number when the topic is 'order'. */
  orderNumber?: string
  message: string
}

const TOPIC_LABEL: Record<ContactTopic, string> = {
  order: 'Order question',
  product: 'Product or sizing question',
  partnership: 'Partnership enquiry',
  press: 'Press / media',
  other: 'Something else',
}

export const submitContactMessageService = async (
  input: ContactMessageInput,
): Promise<ApiResponse<{ received: true }>> => {
  const name = input.name.trim()
  const email = input.email.trim().toLowerCase()
  const message = input.message.trim()
  const orderNumber = input.orderNumber?.trim()

  if (!name || !email || !message) {
    throw new ApiError(400, 'Name, email and message are required.')
  }

  // Resolve the destination. Falls back to SMTP_FROM (the brand
  // mailbox) so a fresh deploy without a dedicated SUPPORT_EMAIL
  // still routes contact form mail somewhere visible.
  const to = process.env.SUPPORT_EMAIL ?? process.env.SMTP_FROM
  if (!to) {
    logger.error('[contact] no SUPPORT_EMAIL or SMTP_FROM configured; dropping message.')
    throw new ApiError(500, 'Contact is offline right now. Email us at hi@mensaproducts.com.')
  }

  try {
    await sendMail({
      to,
      // Make support's inbox sortable at a glance.
      subject: `[Contact · ${TOPIC_LABEL[input.topic]}] ${name}`,
      template: 'contactMessage',
      data: {
        name,
        email,
        topic: TOPIC_LABEL[input.topic],
        orderNumber: orderNumber || null,
        message,
        receivedAt: new Date().toLocaleString('en-NG', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }),
      },
      // Hitting Reply in the support inbox should land back with the visitor.
      replyTo: email,
    })
    logger.info(`[contact] message from ${email} on topic=${input.topic} dispatched.`)
  } catch (err) {
    logger.error(`[contact] sendMail threw for ${email}`, err)
    throw new ApiError(500, 'We could not send your message. Try again in a moment.')
  }

  return new ApiResponse(201, 'Your message is on its way.', { received: true })
}
