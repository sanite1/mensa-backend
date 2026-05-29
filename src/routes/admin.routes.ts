import { Router } from 'express'
import * as productController from '../controllers/product.controller'
import { authenticatedMiddleWare } from '../middlewares/authenticatedMiddleWare'
import { isAdmin } from '../middlewares/isAdmin'
import { authedLimiter } from '../middlewares/rateLimiter'
import { upload } from '../config/upload'
import {
  validateListProducts,
  validateProductSlugParam,
  validateCreateProduct,
  validateUpdateProduct,
  validateAddProductImage,
  validateRemoveProductImage,
  validateReorderImages,
} from '../validations/product.validation'

const router = Router()

// ── All admin routes require Bearer auth + admin role + auth rate limit ──
router.use(authenticatedMiddleWare, isAdmin, authedLimiter)

// ── Products ──────────────────────────────────────────────────────
router.get('/products', validateListProducts, productController.adminListProducts)
router.get(
  '/products/:slug',
  validateProductSlugParam,
  productController.adminGetProductBySlug,
)
router.post('/products', validateCreateProduct, productController.createProduct)
router.put('/products/:slug', validateUpdateProduct, productController.updateProduct)
router.delete(
  '/products/:slug',
  validateProductSlugParam,
  productController.deleteProduct,
)

// Image management (multipart for upload, json for reorder/remove)
router.post(
  '/products/:slug/images',
  upload.single('image'),
  validateAddProductImage,
  productController.addProductImage,
)
router.put(
  '/products/:slug/images/order',
  validateReorderImages,
  productController.reorderProductImages,
)
router.delete(
  '/products/:slug/images/:imageId',
  validateRemoveProductImage,
  productController.removeProductImage,
)

export default router
