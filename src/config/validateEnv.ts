import { logger } from './logger'

// ── Core envs: server cannot start without these ──
const CORE_REQUIRED = [
  'NODE_ENV',
  'PORT',
  'MONGO_URI',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'SMTP_FROM',
  'FRONTEND_PLATFORM_URL',
  'FRONTEND_ADMIN_URL',
] as const

// ── Feature-gated envs: warned at boot, throw only when the relevant
//    feature service is actually called (Cloudinary upload, Paystack
//    init, Sendbox quote). Lets you build auth/Sprint 1 without filling
//    in keys for later sprints. ──
const FEATURE_GATED: Record<string, string[]> = {
  Cloudinary: ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'],
  Paystack: ['PAYSTACK_SECRET_KEY', 'PAYSTACK_PUBLIC_KEY', 'PAYSTACK_WEBHOOK_SECRET'],
  Sendbox: ['SENDBOX_API_KEY'],
}

export function validateEnv(): void {
  // Hard-fail on core misses.
  const missingCore = CORE_REQUIRED.filter((key) => !process.env[key])
  if (missingCore.length > 0) {
    console.error(
      `\n[validateEnv] Missing required environment variables:\n  ${missingCore.join('\n  ')}\n`,
    )
    process.exit(1)
  }

  // Soft-warn on feature gaps so dev can proceed.
  for (const [feature, keys] of Object.entries(FEATURE_GATED)) {
    const missing = keys.filter((key) => !process.env[key])
    if (missing.length > 0) {
      logger.warn(
        `[${feature}] Not configured. Endpoints that use this feature will throw at call time. Missing: ${missing.join(', ')}`,
      )
    }
  }
}

/**
 * Use inside a feature service (e.g. cloudinaryService.upload) to assert that
 * the required envs were filled. Produces a clean ApiError-shaped runtime
 * error rather than a silent SDK crash if the keys are blank.
 */
export function assertEnv(keys: string[], feature: string): void {
  const missing = keys.filter((key) => !process.env[key])
  if (missing.length > 0) {
    throw new Error(
      `[${feature}] Cannot run. Missing env vars: ${missing.join(', ')}. ` +
        `Set them in .env before using this feature.`,
    )
  }
}
