import type { Request, Response, NextFunction } from 'express'

// When using multipart/form-data, JSON fields arrive as strings.
// This middleware parses specified field names back to objects.
export function parseJsonFields(...fields: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    for (const field of fields) {
      if (typeof req.body?.[field] === 'string') {
        try {
          req.body[field] = JSON.parse(req.body[field] as string)
        } catch {
          // leave as string if not valid JSON
        }
      }
    }
    next()
  }
}
