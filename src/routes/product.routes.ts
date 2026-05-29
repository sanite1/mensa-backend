import { Router } from 'express'
import * as controller from '../controllers/product.controller'
import { publicReadLimiter } from '../middlewares/rateLimiter'
import {
  validateListProducts,
  validateProductSlugParam,
} from '../validations/product.validation'

const router = Router()

// ── Public storefront routes ───────────────────────────────────────
router.get('/', publicReadLimiter, validateListProducts, controller.listProducts)
router.get('/:slug', publicReadLimiter, validateProductSlugParam, controller.getProductBySlug)

export default router
