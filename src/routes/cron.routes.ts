// Scheduled jobs, hit by Vercel Cron (see vercel.json). Vercel sends
// Authorization: Bearer <CRON_SECRET>, anything else is refused.
import { Router } from 'express'
import * as leadController from '../controllers/lead.controller'

const router = Router()

router.get('/lead-reminders', leadController.runLeadCodeReminders)

export default router
