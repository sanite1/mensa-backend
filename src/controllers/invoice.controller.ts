// invoice controller — thin request handlers, delegates to invoice.service
import { sendResponse } from '../helpers/sendResponse'
import * as invoiceService from '../services/invoice.service'
import type { ExpressFunction } from '../interfaces/express.interface'
import type {
  AdminListInvoicesQuery,
  UpdateInvoiceSettingsInput,
  UpsertInvoiceInput,
} from '../interfaces/invoice.interface'

type IdParams = { id: string }

/* ── GET /admin/invoices ── */
export const adminListInvoices: ExpressFunction = async (req, res, next) => {
  try {
    const query = req.query as unknown as AdminListInvoicesQuery
    sendResponse(res, await invoiceService.adminListInvoicesService(query))
  } catch (error) {
    next(error)
  }
}

/* ── GET /admin/invoices/products ── */
export const adminSearchInvoiceProducts: ExpressFunction = async (req, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : undefined
    sendResponse(res, await invoiceService.adminSearchInvoiceProductsService(q))
  } catch (error) {
    next(error)
  }
}

/* ── GET /admin/invoices/settings ── */
export const adminGetInvoiceSettings: ExpressFunction = async (_req, res, next) => {
  try {
    sendResponse(res, await invoiceService.getInvoiceSettingsService())
  } catch (error) {
    next(error)
  }
}

/* ── PUT /admin/invoices/settings ── */
export const adminUpdateInvoiceSettings: ExpressFunction<UpdateInvoiceSettingsInput> = async (
  req,
  res,
  next,
) => {
  try {
    sendResponse(res, await invoiceService.updateInvoiceSettingsService(req.body))
  } catch (error) {
    next(error)
  }
}

/* ── GET /admin/invoices/:id ── */
export const adminGetInvoice: ExpressFunction<unknown, IdParams> = async (req, res, next) => {
  try {
    sendResponse(res, await invoiceService.adminGetInvoiceService(req.params.id))
  } catch (error) {
    next(error)
  }
}

/* ── POST /admin/invoices ── */
export const adminCreateInvoice: ExpressFunction<UpsertInvoiceInput> = async (req, res, next) => {
  try {
    sendResponse(res, await invoiceService.adminCreateInvoiceService(req.body))
  } catch (error) {
    next(error)
  }
}

/* ── PUT /admin/invoices/:id ── */
export const adminUpdateInvoice: ExpressFunction<UpsertInvoiceInput, IdParams> = async (
  req,
  res,
  next,
) => {
  try {
    sendResponse(res, await invoiceService.adminUpdateInvoiceService(req.params.id, req.body))
  } catch (error) {
    next(error)
  }
}

/* ── POST /admin/invoices/:id/send ── */
export const adminSendInvoice: ExpressFunction<unknown, IdParams> = async (req, res, next) => {
  try {
    sendResponse(res, await invoiceService.adminSendInvoiceService(req.params.id))
  } catch (error) {
    next(error)
  }
}

/* ── POST /admin/invoices/:id/remind ── */
export const adminRemindInvoice: ExpressFunction<unknown, IdParams> = async (req, res, next) => {
  try {
    sendResponse(res, await invoiceService.adminRemindInvoiceService(req.params.id))
  } catch (error) {
    next(error)
  }
}

/* ── GET /invoices/:token ── (public) */
export const getPublicInvoice: ExpressFunction<unknown, { token: string }> = async (
  req,
  res,
  next,
) => {
  try {
    sendResponse(res, await invoiceService.getPublicInvoiceService(req.params.token))
  } catch (error) {
    next(error)
  }
}

/* ── POST /invoices/:token/pay ── (public) */
export const payInvoice: ExpressFunction<unknown, { token: string }> = async (req, res, next) => {
  try {
    sendResponse(res, await invoiceService.initializeInvoicePaymentService(req.params.token))
  } catch (error) {
    next(error)
  }
}

/* ── POST /invoices/:token/verify ── (public) */
export const verifyInvoice: ExpressFunction<unknown, { token: string }> = async (
  req,
  res,
  next,
) => {
  try {
    sendResponse(res, await invoiceService.verifyAndReconcileInvoiceService(req.params.token))
  } catch (error) {
    next(error)
  }
}

/* ── POST /admin/invoices/:id/void ── */
export const adminVoidInvoice: ExpressFunction<unknown, IdParams> = async (req, res, next) => {
  try {
    sendResponse(res, await invoiceService.adminVoidInvoiceService(req.params.id))
  } catch (error) {
    next(error)
  }
}
