import fs from 'fs'
import path from 'path'
import Handlebars from 'handlebars'
import { transporter } from './nodemailer'
import { logger } from '../../config/logger'

const TEMPLATES_DIR = path.join(__dirname, 'templates')
const PARTIALS_DIR = path.join(TEMPLATES_DIR, '_partials')

// ── Register every file in _partials/ as a Handlebars partial at module
//    load. Filename (without extension) is the partial name. ──
function registerPartials(): void {
  if (!fs.existsSync(PARTIALS_DIR)) return
  for (const file of fs.readdirSync(PARTIALS_DIR)) {
    if (!file.endsWith('.handlebars') && !file.endsWith('.hbs')) continue
    const name = file.replace(/\.(handlebars|hbs)$/, '')
    const src = fs.readFileSync(path.join(PARTIALS_DIR, file), 'utf-8')
    Handlebars.registerPartial(name, src)
  }
}
registerPartials()

function compile(templateName: string, data: Record<string, unknown>): string {
  const filePath = path.join(TEMPLATES_DIR, `${templateName}.handlebars`)
  const source = fs.readFileSync(filePath, 'utf-8')
  return Handlebars.compile(source)(data)
}

export async function sendMail(opts: {
  to: string
  subject: string
  template: string
  data: Record<string, unknown>
  attachments?: Array<{ filename: string; path: string; contentType?: string }>
  /** Optional Reply-To header. Useful for forwarded inbound messages
   *  (e.g. the contact form) so support can hit Reply and respond to
   *  the original sender, not the brand mailbox. */
  replyTo?: string
}): Promise<void> {
  try {
    const html = compile(opts.template, opts.data)

    // Gmail-via-app-password rewrites the From to the authenticated user
    // and, in some accounts, silently dedupes a message whose To matches.
    // Surface this at warn level so it's obvious from logs alone.
    const smtpUser = (process.env.SMTP_USER ?? '').toLowerCase().trim()
    if (smtpUser && smtpUser === opts.to.toLowerCase().trim()) {
      logger.warn(
        `[sendMail] to=${opts.to} matches SMTP_USER. Gmail can quietly drop ` +
          `self-sends or merge them into your existing thread — if the email ` +
          `does not arrive, try a different test recipient or check All Mail.`,
      )
    }

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: opts.to,
      subject: opts.subject,
      html,
      attachments: opts.attachments,
      replyTo: opts.replyTo,
    })
    logger.info(
      `Email sent: template=${opts.template} to=${opts.to} messageId=${info.messageId ?? '?'} accepted=${(info.accepted ?? []).length} rejected=${(info.rejected ?? []).length}`,
    )
    if ((info.rejected ?? []).length > 0) {
      logger.warn(
        `Email rejected addresses for ${opts.template}: ${JSON.stringify(info.rejected)}`,
      )
    }
  } catch (err) {
    // Surface the SMTP-side reason — most "no email arrived" reports trace
    // back to a Gmail app-password mismatch or a from-address Gmail doesn't
    // own. Logging the message + code makes it diagnosable from logs alone.
    const e = err as { message?: string; code?: string; response?: string }
    logger.error(
      `Email failed: template=${opts.template} to=${opts.to} code=${e.code ?? '?'} msg=${e.message ?? '?'} resp=${e.response ?? '?'}`,
    )
    // Don't throw — email failures should not break the transaction
  }
}
