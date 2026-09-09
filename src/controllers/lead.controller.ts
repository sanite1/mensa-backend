// lead controller — thin request handlers, delegates to lead.service
import { sendResponse } from '../helpers/sendResponse'
import * as leadService from '../services/lead.service'
import type { ExpressFunction } from '../interfaces/express.interface'
import type { AdminListLeadsQuery, LeadStatus, SubmitLeadInput } from '../interfaces/lead.interface'

/* ── POST /leads/starter-set ── (public) */
export const submitLead: ExpressFunction<SubmitLeadInput> = async (req, res, next) => {
  try {
    const response = await leadService.submitLeadService(req.body)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

/* ── GET /admin/leads ── (admin) */
export const adminListLeads: ExpressFunction = async (req, res, next) => {
  try {
    const query = req.query as unknown as AdminListLeadsQuery
    const response = await leadService.adminListLeadsService(query)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

/* ── PATCH /admin/leads/:id ── (admin) */
export const adminUpdateLeadStatus: ExpressFunction<
  { status: Extract<LeadStatus, 'new' | 'contacted'> },
  { id: string }
> = async (req, res, next) => {
  try {
    const response = await leadService.adminUpdateLeadStatusService(req.params.id, req.body.status)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

/* ── DELETE /admin/leads/:id ── (admin) */
export const adminDeleteLead: ExpressFunction<unknown, { id: string }> = async (req, res, next) => {
  try {
    const response = await leadService.adminDeleteLeadService(req.params.id)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}
