import { Router } from 'express'
import * as b2bController from '../../controllers/b2b/b2b.controller'
import { validateSubmitB2BOrg } from '../../validations/b2b.validation'

const router = Router()

// Public — submit a partnership application
router.post('/apply', validateSubmitB2BOrg, b2bController.submitB2BOrg)

export default router
