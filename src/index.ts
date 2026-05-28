import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { validateEnv } from './config/validateEnv'
import { connectDB } from './config/db'
import { logger } from './config/logger'
import { globalErrorHandler } from './middlewares/globalErrorHandler'
import { requestLogger } from './middlewares/requestLogger'

// Routes
import pingRouter from './routes/ping.routes'
// import authRouter from './routes/auth.routes'
// import productRouter from './routes/product.routes'
// import orderRouter from './routes/order.routes'
// import discountRouter from './routes/discount.routes'
// import shippingRouter from './routes/shipping.routes'
// import contentRouter from './routes/content.routes'
// import webhookRouter from './routes/webhook.routes'
// import adminRouter from './routes/admin.routes'
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
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(morgan('dev'))
app.use(requestLogger)

// Health
app.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: { status: 'ok', env: process.env.NODE_ENV, ts: new Date().toISOString() },
    message: 'OK',
  })
})

// API routes
app.use('/api/v1', pingRouter)
// app.use('/api/v1/auth', authRouter)
// app.use('/api/v1/products', productRouter)
// app.use('/api/v1/orders', orderRouter)
// app.use('/api/v1/discounts', discountRouter)
// app.use('/api/v1/checkout', shippingRouter)
// app.use('/api/v1/content', contentRouter)
// app.use('/api/v1/webhooks', webhookRouter)
// app.use('/api/v1/admin', adminRouter)
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
