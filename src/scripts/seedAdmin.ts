import 'dotenv/config'
import mongoose from 'mongoose'
import bcrypt from 'bcrypt'
import { User } from '../models/User'

// Seed script: creates or resets the admin user from env vars, the stored hash is always re synced with SEED_ADMIN_PASSWORD. Safe to re run.
// Run with: npm run seed:admin

async function seed() {
  const uri = process.env.MONGO_URI
  const email = process.env.SEED_ADMIN_EMAIL
  const password = process.env.SEED_ADMIN_PASSWORD
  const name = process.env.SEED_ADMIN_NAME ?? 'Admin'

  if (!uri || !email || !password) {
    console.error('Set MONGO_URI, SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in .env')
    process.exit(1)
  }

  await mongoose.connect(uri)
  const hash = await bcrypt.hash(password, 12)
  const normalisedEmail = email.toLowerCase().trim()

  const existing = await User.findOne({ email: normalisedEmail }).select('+passwordHash')

  if (existing) {
    existing.passwordHash = hash
    existing.name = name
    existing.role = 'admin'
    existing.refreshTokenHash = null
    await existing.save()
    console.log('Admin password reset:', normalisedEmail)
  } else {
    await User.create({
      email: normalisedEmail,
      passwordHash: hash,
      name,
      phone: '+2340000000000',
      role: 'admin',
    })
    console.log('Admin created:', normalisedEmail)
  }

  await mongoose.disconnect()
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})
