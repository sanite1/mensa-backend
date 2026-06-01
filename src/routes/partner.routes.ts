import { Router } from 'express'
import * as partnerController from '../controllers/partner.controller'
import { authenticatedMiddleWare } from '../middlewares/authenticatedMiddleWare'
import { authedLimiter, publicReadLimiter } from '../middlewares/rateLimiter'
import {
  validateApplyAsPartner,
  validateCompleteOnboarding,
  validateOnboardingTokenQuery,
  validateUpdateBankAccount,
} from '../validations/partner.validation'

const router = Router()

// ── Public ───────────────────────────────────────────────────────
router.post('/apply', publicReadLimiter, validateApplyAsPartner, partnerController.applyAsPartner)
router.get(
  '/onboarding',
  publicReadLimiter,
  validateOnboardingTokenQuery,
  partnerController.verifyOnboardingToken,
)
router.post(
  '/onboarding/complete',
  publicReadLimiter,
  validateCompleteOnboarding,
  partnerController.completePartnerOnboarding,
)

// ── Authed (partner self) ────────────────────────────────────────
router.get(
  '/me',
  authenticatedMiddleWare,
  authedLimiter,
  partnerController.getPartnerSelfDashboard,
)
router.patch(
  '/me/bank-account',
  authenticatedMiddleWare,
  authedLimiter,
  validateUpdateBankAccount,
  partnerController.updatePartnerBankAccount,
)
router.post(
  '/me/payouts',
  authenticatedMiddleWare,
  authedLimiter,
  partnerController.requestPartnerPayout,
)

export default router
