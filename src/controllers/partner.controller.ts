// partner controller — thin request handlers, delegates to partner.service
import { sendResponse } from '../helpers/sendResponse'
import { ApiError } from '../errors/apiError'
import * as partnerService from '../services/partner.service'
import type { ExpressFunction } from '../interfaces/express.interface'
import type {
  AdminApprovePartnerInput,
  AdminListPartnersQuery,
  AdminListPayoutsQuery,
  AdminMarkPayoutPaidInput,
  AdminRejectPartnerInput,
  AdminRejectPayoutInput,
  AdminUpdatePartnerInput,
  ApplyPartnerInput,
  CompletePartnerOnboardingInput,
} from '../interfaces/partner.interface'

// ── Public ───────────────────────────────────────────────────────

export const applyAsPartner: ExpressFunction<ApplyPartnerInput> = async (req, res, next) => {
  try {
    const response = await partnerService.applyAsPartnerService(req.body)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

export const verifyOnboardingToken: ExpressFunction = async (req, res, next) => {
    try {
      const token = String(req.query.token ?? '')
      if (!token) throw new ApiError(400, 'Onboarding token is required.')
    const response = await partnerService.verifyOnboardingTokenService(token)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

export const completePartnerOnboarding: ExpressFunction<
  CompletePartnerOnboardingInput & { token: string }
> = async (req, res, next) => {
  try {
    const { token, ...input } = req.body
    if (!token) throw new ApiError(400, 'Onboarding token is required.')
    const response = await partnerService.completePartnerOnboardingService(token, input)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

// ── Authed partner self ──────────────────────────────────────────

export const getPartnerSelfDashboard: ExpressFunction = async (req, res, next) => {
  try {
    const userId = req.user?.userId
    if (!userId) throw new ApiError(401, 'You are not signed in.')
    const response = await partnerService.getPartnerSelfDashboardService(userId)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

export const updatePartnerBankAccount: ExpressFunction<{
  accountName: string
  accountNumber: string
  bankName: string
  bankCode?: string
}> = async (req, res, next) => {
  try {
    const userId = req.user?.userId
    if (!userId) throw new ApiError(401, 'You are not signed in.')
    const response = await partnerService.updatePartnerBankAccountService(userId, req.body)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

export const requestPartnerPayout: ExpressFunction = async (req, res, next) => {
  try {
    const userId = req.user?.userId
    if (!userId) throw new ApiError(401, 'You are not signed in.')
    const response = await partnerService.requestPartnerPayoutService(userId)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

// ── Admin ────────────────────────────────────────────────────────

export const adminListPartners: ExpressFunction = async (req, res, next) => {
  try {
    const query = req.query as unknown as AdminListPartnersQuery
    const response = await partnerService.adminListPartnersService(query)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

export const adminGetPartner: ExpressFunction<unknown, { id: string }> = async (
  req,
  res,
  next,
) => {
  try {
    const response = await partnerService.adminGetPartnerService(req.params.id)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

export const adminApprovePartner: ExpressFunction<
  AdminApprovePartnerInput,
  { id: string }
> = async (req, res, next) => {
  try {
    const actorUserId = req.user?.userId ?? null
    const response = await partnerService.adminApprovePartnerService(
      req.params.id,
      req.body,
      actorUserId,
    )
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

export const adminRejectPartner: ExpressFunction<
  AdminRejectPartnerInput,
  { id: string }
> = async (req, res, next) => {
  try {
    const response = await partnerService.adminRejectPartnerService(req.params.id, req.body)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

export const adminUpdatePartner: ExpressFunction<
  AdminUpdatePartnerInput,
  { id: string }
> = async (req, res, next) => {
  try {
    const response = await partnerService.adminUpdatePartnerService(req.params.id, req.body)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

export const adminListPayouts: ExpressFunction = async (req, res, next) => {
  try {
    const query = req.query as unknown as AdminListPayoutsQuery
    const response = await partnerService.adminListPayoutsService(query)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

export const adminMarkPayoutPaid: ExpressFunction<
  AdminMarkPayoutPaidInput,
  { id: string }
> = async (req, res, next) => {
  try {
    const actorUserId = req.user?.userId ?? null
    const response = await partnerService.adminMarkPayoutPaidService(
      req.params.id,
      req.body,
      actorUserId,
    )
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

export const adminRejectPayout: ExpressFunction<
  AdminRejectPayoutInput,
  { id: string }
> = async (req, res, next) => {
  try {
    const actorUserId = req.user?.userId ?? null
    const response = await partnerService.adminRejectPayoutService(
      req.params.id,
      req.body,
      actorUserId,
    )
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}
