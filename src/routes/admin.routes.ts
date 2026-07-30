import { Router } from 'express'
import * as adminController from '../controllers/admin.controller'
import * as productController from '../controllers/product.controller'
import * as orderController from '../controllers/order.controller'
import * as discountController from '../controllers/discount.controller'
import * as contentController from '../controllers/content.controller'
import * as b2bController from '../controllers/b2b/b2b.controller'
import * as partnerController from '../controllers/partner.controller'
import * as newsletterController from '../controllers/newsletter.controller'
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
import {
  validateCustomerIdParam,
  validateListCustomers,
} from '../validations/admin.validation'
import {
  validateContentIdParam,
  validateCreateContent,
  validateListContent,
  validateUpdateContent,
} from '../validations/content.validation'
import {
  validateListPartnerships,
  validatePartnershipIdParam,
  validateVerifyPartnership,
} from '../validations/b2b.validation'
import {
  validateAdminListPartners,
  validateApprovePartner,
  validateListPayouts,
  validateMarkPayoutPaid,
  validatePartnerIdParam,
  validateRejectPartner,
  validateRejectPayout,
  validateUpdatePartner,
} from '../validations/partner.validation'
import {
  validateAdminListSubscribers,
  validateSubscriberIdParam,
} from '../validations/newsletter.validation'

const router = Router()

// ── All admin routes require Bearer auth + admin role + auth rate limit ──
router.use(authenticatedMiddleWare, isAdmin, authedLimiter)

// ── Dashboard ─────────────────────────────────────────────────────
router.get('/stats', adminController.getAdminStats)

// ── Customers ─────────────────────────────────────────────────────
router.get('/customers', validateListCustomers, adminController.adminListCustomers)
router.get(
  '/customers/:id',
  validateCustomerIdParam,
  adminController.adminGetCustomer,
)

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

// ── Content posts ────────────────────────────────────────────────
// Standalone cover upload (multipart). Registered before the :id routes
// so "upload-image" can never be captured as a post id.
router.post(
  '/content/upload-image',
  upload.single('image'),
  contentController.adminUploadContentImage,
)
router.get('/content', validateListContent, contentController.adminListContent)
router.get('/content/:id', validateContentIdParam, contentController.adminGetContent)
router.post('/content', validateCreateContent, contentController.adminCreateContent)
router.put('/content/:id', validateUpdateContent, contentController.adminUpdateContent)
router.delete(
  '/content/:id',
  validateContentIdParam,
  contentController.adminDeleteContent,
)

// ── Partnerships ─────────────────────────────────────────────────
// Specific sub-paths (individuals, payouts) MUST come before the
// catch-all `/partnerships/:id` org route — otherwise :id captures
// "individuals" / "payouts" and routes them to the org controller.

// Individual partners (referral programme)
router.get(
  '/partnerships/individuals',
  validateAdminListPartners,
  partnerController.adminListPartners,
)
router.get(
  '/partnerships/individuals/:id',
  validatePartnerIdParam,
  partnerController.adminGetPartner,
)
router.patch(
  '/partnerships/individuals/:id/approve',
  validateApprovePartner,
  partnerController.adminApprovePartner,
)
router.patch(
  '/partnerships/individuals/:id/reject',
  validateRejectPartner,
  partnerController.adminRejectPartner,
)
router.patch(
  '/partnerships/individuals/:id',
  validateUpdatePartner,
  partnerController.adminUpdatePartner,
)

// Payouts
router.get('/partnerships/payouts', validateListPayouts, partnerController.adminListPayouts)
router.patch(
  '/partnerships/payouts/:id/pay',
  validateMarkPayoutPaid,
  partnerController.adminMarkPayoutPaid,
)
router.patch(
  '/partnerships/payouts/:id/reject',
  validateRejectPayout,
  partnerController.adminRejectPayout,
)

// ── Newsletter subscribers ──────────────────────────────────────
router.get(
  '/newsletter/subscribers',
  validateAdminListSubscribers,
  newsletterController.adminListSubscribers,
)
router.delete(
  '/newsletter/subscribers/:id',
  validateSubscriberIdParam,
  newsletterController.adminDeleteSubscriber,
)

// B2B organisation partnerships (apply / list / verify)
router.get(
  '/partnerships',
  validateListPartnerships,
  b2bController.adminListPartnerships,
)
router.get(
  '/partnerships/:id',
  validatePartnershipIdParam,
  b2bController.adminGetPartnership,
)
router.patch(
  '/partnerships/:id/verify',
  validateVerifyPartnership,
  b2bController.adminVerifyPartnership,
)

export default router
