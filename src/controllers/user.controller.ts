import { sendResponse } from '../helpers/sendResponse'
import { ApiError } from '../errors/apiError'
import * as service from '../services/user.service'
import type { ExpressFunction } from '../interfaces/express.interface'
import type {
  UpdateUserAddressInput,
  UserAddressInput,
} from '../interfaces/user.interface'

function requireUserId(userId: string | undefined): string {
  if (!userId) throw new ApiError(401, 'You are not signed in.')
  return userId
}

/* ── GET /users/me/addresses ── */
export const listMyAddresses: ExpressFunction = async (req, res, next) => {
  try {
    const userId = requireUserId(req.user?.userId)
    const response = await service.listMyAddressesService(userId)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

/* ── POST /users/me/addresses ── */
export const addMyAddress: ExpressFunction<UserAddressInput> = async (
  req,
  res,
  next,
) => {
  try {
    const userId = requireUserId(req.user?.userId)
    const response = await service.addMyAddressService(userId, req.body)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

/* ── PUT /users/me/addresses/:id ── */
export const updateMyAddress: ExpressFunction<
  UpdateUserAddressInput,
  { id: string }
> = async (req, res, next) => {
  try {
    const userId = requireUserId(req.user?.userId)
    const response = await service.updateMyAddressService(
      userId,
      req.params.id,
      req.body,
    )
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

/* ── PUT /users/me/addresses/:id/default ── */
export const setDefaultMyAddress: ExpressFunction<unknown, { id: string }> = async (
  req,
  res,
  next,
) => {
  try {
    const userId = requireUserId(req.user?.userId)
    const response = await service.setDefaultAddressService(userId, req.params.id)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}

/* ── DELETE /users/me/addresses/:id ── */
export const deleteMyAddress: ExpressFunction<unknown, { id: string }> = async (
  req,
  res,
  next,
) => {
  try {
    const userId = requireUserId(req.user?.userId)
    const response = await service.deleteMyAddressService(userId, req.params.id)
    sendResponse(res, response)
  } catch (error) {
    next(error)
  }
}
