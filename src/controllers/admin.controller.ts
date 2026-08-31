// admin controller — thin request handlers, delegates to admin.service
import { sendResponse } from '../helpers/sendResponse'
import * as adminService from '../services/admin.service'
import type { ExpressFunction } from '../interfaces/express.interface'
import type { AdminCustomersListParams } from '../services/admin.service'

/* ── GET /admin/stats ── (admin only) */
export const getAdminStats: ExpressFunction = async (_req, res, next) => {
  try {
    const response = await adminService.adminStatsService()
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

/* ── GET /admin/reports ── (admin only) */
export const getAdminReports: ExpressFunction = async (req, res, next) => {
  try {
    const days = req.query.days ? Number(req.query.days) : undefined
    const response = await adminService.adminReportsService(
      Number.isFinite(days) ? days : undefined,
    )
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

/* ── GET /admin/customers ── (admin only) */
export const adminListCustomers: ExpressFunction = async (req, res, next) => {
  try {
    const params = req.query as unknown as AdminCustomersListParams
    const response = await adminService.adminListCustomersService(params)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

/* ── GET /admin/customers/:id ── (admin only) */
export const adminGetCustomer: ExpressFunction<unknown, { id: string }> = async (
  req,
  res,
  next,
) => {
  try {
    const response = await adminService.adminGetCustomerService(req.params.id)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}
