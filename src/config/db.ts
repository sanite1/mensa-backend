import mongoose from 'mongoose'
import { logger } from './logger'

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGO_URI!

  mongoose.connection.on('connected', () => logger.info('MongoDB connected'))
  mongoose.connection.on('error', (err) => logger.error('MongoDB error', err))
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'))

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 })
}
