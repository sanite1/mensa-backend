import type { RequestHandler } from 'express'
import type { ParamsDictionary } from 'express-serve-static-core'
import type { ParsedQs } from 'qs'

/**
 * Typed Express handler. Lets you write:
 *   export const login: ExpressFunction<ILoginInput> = async (req, res, next) => { ... }
 * and have `req.body` correctly typed.
 */
export type ExpressFunction<
  TBody = unknown,
  TParams extends ParamsDictionary = ParamsDictionary,
  TQuery extends ParsedQs = ParsedQs,
> = RequestHandler<TParams, unknown, TBody, TQuery>
