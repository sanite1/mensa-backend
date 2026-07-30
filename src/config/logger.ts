// logger.ts — Winston logger. Console transport always, file transports (daily rotate) only in production on a writable FS.
// Serverless runtimes (Vercel, Netlify, Lambda) have a read only FS, so file logging is skipped there, their platform already captures stdout. Override with LOG_TO_FILE.

import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import path from 'path'

const { combine, timestamp, printf, colorize, errors } = winston.format

const logFormat = printf((info) => {
  const { level, message, timestamp: ts, stack, ...rest } = info as Record<string, unknown> & {
    level: string
    message: unknown
    timestamp?: string
    stack?: string
  }
  const base = `${ts} [${level}] ${stack ?? message}`
  const extras = Object.keys(rest).filter((k) => k !== 'splat' && k !== Symbol.for('level').toString())
  if (extras.length === 0) return base
  const meta: Record<string, unknown> = {}
  for (const k of extras) meta[k] = rest[k]
  try {
    return `${base} ${JSON.stringify(meta)}`
  } catch {
    return base
  }
})

/** Detect a serverless / read-only-FS runtime. Vercel, Netlify, AWS
 *  Lambda, Cloudflare Workers all set their own marker env vars. */
function isServerlessRuntime(): boolean {
  return !!(
    process.env.VERCEL ||
    process.env.NETLIFY ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.CF_PAGES
  )
}

/** File logging: explicit LOG_TO_FILE wins, otherwise on in production when not serverless. */
function shouldLogToFile(): boolean {
  const explicit = process.env.LOG_TO_FILE?.toLowerCase()
  if (explicit === 'true') return true
  if (explicit === 'false') return false
  return process.env.NODE_ENV === 'production' && !isServerlessRuntime()
}

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: combine(
      colorize(),
      errors({ stack: true }),
      timestamp({ format: 'HH:mm:ss' }),
      logFormat,
    ),
  }),
]

if (shouldLogToFile()) {
  transports.push(
    new DailyRotateFile({
      dirname: path.join(process.cwd(), 'logs'),
      filename: 'mensa-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
      zippedArchive: true,
    }),
    new DailyRotateFile({
      dirname: path.join(process.cwd(), 'logs'),
      filename: 'mensa-error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxFiles: '30d',
      zippedArchive: true,
    }),
  )
}

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat,
  ),
  transports,
})
