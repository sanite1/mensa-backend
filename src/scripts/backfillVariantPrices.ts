// backfillVariantPrices.ts — one-off migration: give every variant an explicit price.
// Fills null b2cPriceOverride with the product's current selling price
// (salePrice when set, else basePriceB2C, so nothing changes at checkout)
// and null b2bPriceOverride with basePriceB2B. Idempotent, variants that
// already have a price are left alone. Run with: npm run backfill:variant-prices
import 'dotenv/config'
import mongoose from 'mongoose'
import { Product } from '../models/Product'

async function run() {
  const uri = process.env.MONGO_URI
  if (!uri) throw new Error('MONGO_URI is not set')
  await mongoose.connect(uri)

  const products = await Product.find({})
  let touchedProducts = 0
  let touchedVariants = 0

  for (const product of products) {
    const b2cPrice = product.salePrice ?? product.basePriceB2C
    const b2bPrice = product.basePriceB2B
    let dirty = false

    for (const variant of product.variants) {
      if (variant.b2cPriceOverride == null) {
        variant.b2cPriceOverride = b2cPrice
        dirty = true
        touchedVariants++
      }
      if (variant.b2bPriceOverride == null) {
        variant.b2bPriceOverride = b2bPrice
        dirty = true
      }
    }

    if (dirty) {
      await product.save()
      touchedProducts++
      console.log(`✔ ${product.slug}: variants priced at ₦${(b2cPrice / 100).toLocaleString()}`)
    }
  }

  console.log(
    `Done. ${touchedProducts} product(s) updated, ${touchedVariants} variant price(s) filled.`,
  )
  await mongoose.disconnect()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
