export interface ApiSuccessResponse<T> {
  success: true
  data: T
  message: string
}

export function apiResponse<T>(data: T, message = 'OK'): ApiSuccessResponse<T> {
  return { success: true, data, message }
}
