import fs from 'fs'
import path from 'path'
import Handlebars from 'handlebars'
import { transporter } from './nodemailer'
import { logger } from '../../config/logger'

const TEMPLATES_DIR = path.join(__dirname, 'templates')

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
}): Promise<void> {
  try {
    const html = compile(opts.template, opts.data)
    await transporter.sendMail({
      from: `"Mensa Period Products" <${process.env.SMTP_USER}>`,
      to: opts.to,
      subject: opts.subject,
      html,
      attachments: opts.attachments,
    })
    logger.info(`Email sent: ${opts.template} → ${opts.to}`)
  } catch (err) {
    logger.error(`Email failed: ${opts.template} → ${opts.to}`, err)
    // Don't throw — email failures should not break the transaction
  }
}
