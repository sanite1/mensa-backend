import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'
import { validateEnv } from './config/validateEnv'
import { connectDB } from './config/db'
import { logger } from './config/logger'
import { globalErrorHandler } from './middlewares/globalErrorHandler'
import { requestLogger } from './middlewares/requestLogger'

// Routes
import pingRouter from './routes/ping.routes'
import authRouter from './routes/auth.routes'
import productRouter from './routes/product.routes'
import adminRouter from './routes/admin.routes'
import orderRouter from './routes/order.routes'
import checkoutRouter from './routes/checkout.routes'
import webhookRouter from './routes/webhook.routes'
import userRouter from './routes/user.routes'
import partnerRouter from './routes/partner.routes'
import newsletterRouter from './routes/newsletter.routes'
import contactRouter from './routes/contact.routes'
import contentRouter from './routes/content.routes'
import b2bRouter from './routes/b2b/b2b.routes'

validateEnv()

const app = express()
const PORT = process.env.PORT ?? 5000

app.use(helmet())
app.use(cors({
  origin: [
    process.env.FRONTEND_PLATFORM_URL!,
    process.env.FRONTEND_ADMIN_URL!,
  ],
  credentials: true,
}))
// Capture the raw body on webhook paths so the HMAC verifier checks the exact bytes Paystack sent. Covers the canonical mount and the legacy /api/payment/webhook alias.
app.use(
  express.json({
    verify: (req, _res, buf) => {
      const url = req.url ?? ''
      if (
        url.startsWith('/api/v1/webhooks') ||
        url.startsWith('/api/payment/webhook')
      ) {
        ;(req as express.Request).rawBody = Buffer.from(buf)
      }
    },
  }),
)
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())
app.use(morgan('dev'))
app.use(requestLogger)

// Health
app.get('/health', (_req, res) => {
  res.json({
    statusCode: 200,
    message: 'OK',
    data: { status: 'ok', env: process.env.NODE_ENV, ts: new Date().toISOString() },
  })
})

// API routes
app.use('/api/v1', pingRouter)
app.use('/api/v1/auth', authRouter)
app.use('/api/v1/products', productRouter)
app.use('/api/v1/admin', adminRouter)
app.use('/api/v1/orders', orderRouter)
app.use('/api/v1/checkout', checkoutRouter)
app.use('/api/v1/webhooks', webhookRouter)
// Legacy alias, some Paystack dashboard configs still point at /api/payment/webhook/paystack.
app.use('/api/payment/webhook', webhookRouter)
app.use('/api/v1/users', userRouter)
app.use('/api/v1/partners', partnerRouter)
app.use('/api/v1/newsletter', newsletterRouter)
app.use('/api/v1/contact', contactRouter)
app.use('/api/v1/content', contentRouter)
app.use('/api/v1/b2b', b2bRouter)

app.use(globalErrorHandler)

async function start() {
  await connectDB()
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT} [${process.env.NODE_ENV}]`)
  })
}

start().catch((err) => {
  logger.error('Failed to start server', err)
  process.exit(1)
})

export default app
