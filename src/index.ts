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
// import discountRouter from './routes/discount.routes'
// import contentRouter from './routes/content.routes'
// import b2bRouter from './routes/b2b/b2b.routes'
// import userRouter from './routes/user.routes'

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
// Capture the raw request body on any webhook-shaped path so the HMAC
// verifier can recompute the signature against the exact bytes Paystack
// sent (re-stringifying the parsed JSON would risk reordering keys and
// breaking the comparison).
//
// We honour both the canonical mount (/api/v1/webhooks/*) and the legacy
// alias (/api/payment/webhook/*) that some test integrations were pointed
// at before the route was finalised.
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
// Legacy / convenience alias. Some Paystack dashboard configs point at
// `/api/payment/webhook/paystack`; keep both alive so dashboard URL edits
// aren't a prerequisite for testing.
app.use('/api/payment/webhook', webhookRouter)
// app.use('/api/v1/discounts', discountRouter)
// app.use('/api/v1/content', contentRouter)
// app.use('/api/v1/b2b', b2bRouter)
// app.use('/api/v1/users', userRouter)

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
