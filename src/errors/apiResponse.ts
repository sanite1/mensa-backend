export class ApiResponse<T = unknown> {
  statusCode: number
  message: string
  data?: T

  constructor(statusCode: number, message: string, data?: T) {
    this.statusCode = statusCode
    this.message = message
    if (data !== undefined) this.data = data
  }
}

export default ApiResponse
