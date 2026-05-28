export interface Pagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface PaginatedApiResponse<T> {
  success: true
  data: T[]
  pagination: Pagination
  message: string
}

export function paginatedResponse<T>(
  data: T[],
  pagination: Pagination,
  message = 'OK',
): PaginatedApiResponse<T> {
  return { success: true, data, pagination, message }
}

export function buildPagination(page: number, pageSize: number, total: number): Pagination {
  return { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
}
