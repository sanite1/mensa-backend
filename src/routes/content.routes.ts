import { Router } from 'express'
import * as contentController from '../controllers/content.controller'
import {
  validateContentSlugParam,
  validateListContent,
} from '../validations/content.validation'

const router = Router()

router.get('/', validateListContent, contentController.listPublicContent)
router.get('/:slug', validateContentSlugParam, contentController.getPublicContentBySlug)

export default router
