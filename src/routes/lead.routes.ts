import { Router } from 'express'
import * as leadController from '../controllers/lead.controller'
import { publicReadLimiter } from '../middlewares/rateLimiter'
import { validateSubmitLead } from '../validations/lead.validation'

const router = Router()

router.post('/starter-set', publicReadLimiter, validateSubmitLead, leadController.submitLead)

export default router
