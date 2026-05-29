import { ApiResponse } from '../errors/apiResponse'

/* ── Ping ── */
export const pingService = async () => {
  return new ApiResponse(200, 'pong', { ts: new Date().toISOString() })
}
