import type { RequestHandler } from 'express'
import type { ParamsDictionary } from 'express-serve-static-core'
import type { ParsedQs } from 'qs'

/** Typed Express handler so req.body is correctly typed. */
export type ExpressFunction<
  TBody = unknown,
  TParams extends ParamsDictionary = ParamsDictionary,
  TQuery extends ParsedQs = ParsedQs,
> = RequestHandler<TParams, unknown, TBody, TQuery>
