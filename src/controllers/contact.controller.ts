// contact controller — thin handler, delegates to contact.service
import { sendResponse } from '../helpers/sendResponse'
import * as contactService from '../services/contact.service'
import type { ExpressFunction } from '../interfaces/express.interface'
import type { ContactMessageInput } from '../services/contact.service'

/* ── POST /contact ── (public) */
export const submitContactMessage: ExpressFunction<ContactMessageInput> = async (
  req,
  res,
  next,
) => {
  try {
    const response = await contactService.submitContactMessageService(req.body)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}
