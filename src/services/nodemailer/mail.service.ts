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
}): Promise<void> {
  try {
    const html = compile(opts.template, opts.data)
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
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
