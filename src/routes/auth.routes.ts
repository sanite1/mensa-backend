import { Router } from 'express'
import * as controller from '../controllers/auth.controller'
import { authenticatedMiddleWare } from '../middlewares/authenticatedMiddleWare'
import { authLimiter, registerLimiter } from '../middlewares/rateLimiter'
import {
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
} from '../validations/auth.validation'

const router = Router()

router.post('/register', registerLimiter, validateRegister, controller.register)
router.post('/login', authLimiter, validateLogin, controller.login)
router.post('/refresh', controller.refresh)
router.post('/logout', controller.logout)
router.get('/me', authenticatedMiddleWare, controller.getMe)
router.post('/forgot-password', authLimiter, validateForgotPassword, controller.forgotPassword)
router.post('/reset-password', authLimiter, validateResetPassword, controller.resetPassword)

export default router
