import type { Response } from 'express'
import { apiResponse } from '../errors/apiResponse'
import { paginatedResponse, type Pagination } from '../errors/paginatedResponse'

export function sendSuccess<T>(res: Response, data: T, message = 'OK', statusCode = 200): void {
  res.status(statusCode).json(apiResponse(data, message))
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  pagination: Pagination,
  message = 'OK',
): void {
  res.status(200).json(paginatedResponse(data, pagination, message))
}

export function sendCreated<T>(res: Response, data: T, message = 'Created'): void {
  res.status(201).json(apiResponse(data, message))
}
