// B2B controller — thin request handlers for the B2B sub-domain feature
import { sendResponse } from '../../helpers/sendResponse'
import * as b2bOrgService from '../../services/b2b/b2bOrg.service'
import type { ExpressFunction } from '../../interfaces/express.interface'
import type {
  AdminListB2BOrgsQuery,
  SubmitB2BOrgInput,
  VerifyB2BOrgInput,
} from '../../interfaces/b2b/b2bOrg.interface'

/* ── POST /b2b/apply ── (public) */
export const submitB2BOrg: ExpressFunction<SubmitB2BOrgInput> = async (req, res, next) => {
  try {
    const response = await b2bOrgService.submitB2BOrgService(req.body)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

/* ── GET /admin/partnerships ── (admin) */
export const adminListPartnerships: ExpressFunction = async (req, res, next) => {
  try {
    const query = req.query as unknown as AdminListB2BOrgsQuery
    const response = await b2bOrgService.adminListB2BOrgsService(query)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

/* ── GET /admin/partnerships/:id ── (admin) */
export const adminGetPartnership: ExpressFunction<unknown, { id: string }> = async (
  req,
  res,
  next,
) => {
  try {
    const response = await b2bOrgService.adminGetB2BOrgService(req.params.id)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

/* ── PATCH /admin/partnerships/:id/verify ── (admin) */
export const adminVerifyPartnership: ExpressFunction<
  VerifyB2BOrgInput,
  { id: string }
> = async (req, res, next) => {
  try {
    const actorUserId = req.user?.userId ?? null
    const response = await b2bOrgService.adminVerifyB2BOrgService(
      req.params.id,
      req.body,
      actorUserId,
    )
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}
