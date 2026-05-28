import 'dotenv/config'
import mongoose from 'mongoose'
import bcrypt from 'bcrypt'

// Seed script: creates the initial admin user from env vars.
// Run with: npx ts-node src/scripts/seedAdmin.ts

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

  // Dynamic import so the model is available after DB connects
  const { User } = await import('../models/User')
  const existing = await User.findOne({ email })
  if (existing) {
    console.log('Admin already exists:', email)
  } else {
    await User.create({ email, passwordHash: hash, name, phone: '+2340000000000', role: 'admin' })
    console.log('Admin created:', email)
  }

  await mongoose.disconnect()
}

seed().catch((err) => { console.error(err); process.exit(1) })
