import type { Request, Response, NextFunction, RequestHandler } from 'express'
import type { ObjectSchema } from 'joi'
import { ApiError } from '../errors/apiError'

type Segment = 'body' | 'query' | 'params'

export type ValidationSchema = Partial<Record<Segment, ObjectSchema>>

const JOI_OPTS = { abortEarly: false, stripUnknown: true, convert: true } as const

export function validate(schema: ValidationSchema): RequestHandler {
  const segments = Object.entries(schema) as Array<[Segment, ObjectSchema]>
  return (req: Request, _res: Response, next: NextFunction): void => {
    const details: Record<string, string> = {}
    for (const [segment, joiSchema] of segments) {
      const { value, error } = joiSchema.validate(req[segment], JOI_OPTS)
      if (error) {
        for (const item of error.details) {
          const field = item.path.join('.') || 'unknown'
          if (!details[field]) details[field] = item.message.replace(/"/g, '')
        }
      } else {
        ;(req as unknown as Record<Segment, unknown>)[segment] = value
      }
    }
    if (Object.keys(details).length > 0) {
      const first = Object.values(details)[0]
      throw new ApiError(422, first, details)
    }
    next()
  }
}
