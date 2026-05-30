import { Router } from 'express'
import * as productController from '../controllers/product.controller'
import * as orderController from '../controllers/order.controller'
import * as discountController from '../controllers/discount.controller'
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
import {
  validateAdminOrderIdParam,
  validateListOrders,
  validateUpdateOrderFulfilment,
} from '../validations/order.validation'
import {
  validateCreateDiscount,
  validateDiscountIdParam,
  validateListDiscounts,
  validateUpdateDiscount,
} from '../validations/discount.validation'

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

// ── Orders ────────────────────────────────────────────────────────
router.get('/orders', validateListOrders, orderController.adminListOrders)
router.get(
  '/orders/:id',
  validateAdminOrderIdParam,
  orderController.adminGetOrder,
)
router.patch(
  '/orders/:id/fulfilment',
  validateUpdateOrderFulfilment,
  orderController.adminUpdateOrderFulfilment,
)

// ── Discounts ─────────────────────────────────────────────────────
router.get(
  '/discounts',
  validateListDiscounts,
  discountController.adminListDiscounts,
)
router.get(
  '/discounts/:id',
  validateDiscountIdParam,
  discountController.adminGetDiscount,
)
router.post(
  '/discounts',
  validateCreateDiscount,
  discountController.adminCreateDiscount,
)
router.put(
  '/discounts/:id',
  validateUpdateDiscount,
  discountController.adminUpdateDiscount,
)
router.delete(
  '/discounts/:id',
  validateDiscountIdParam,
  discountController.adminDeleteDiscount,
)

export default router
