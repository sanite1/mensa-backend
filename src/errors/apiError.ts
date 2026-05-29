export class ApiError extends Error {
  statusCode: number
  details?: Record<string, unknown>

  constructor(statusCode: number, message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    if (details) this.details = details
    Error.captureStackTrace(this, this.constructor)
  }
}

export default ApiError
