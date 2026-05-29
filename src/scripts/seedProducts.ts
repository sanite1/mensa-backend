import 'dotenv/config'
import mongoose from 'mongoose'
import { Product } from '../models/Product'
import { computeSku } from '../helpers/sku'
import type {
  BadgeTone,
  CreateProductInput,
  ProductAccordionInput,
  ProductCategory,
  ProductTrustLineInput,
  ProductVariantInput,
} from '../interfaces/product.interface'

// Seed script: idempotent upsert of the launch catalogue (8 SKUs).
// Re-running updates fields in place. Images are left empty so the admin
// can upload via the dashboard once Cloudinary assets are ready.
// Run with: npm run seed:products

const PANTS_SIZES = ['S', 'M', 'L', 'XL', '2XL']

// ── Helpers ──────────────────────────────────────────────────────────

/** ₦n,nnn → kobo (integer). */
const naira = (amount: number): number => Math.round(amount * 100)

/** B2B starts at 70% off B2C. Rounded to whole naira (kobo % 100 === 0). */
const b2bFromB2c = (kobo: number): number => Math.round((kobo * 0.7) / 100) * 100

interface SeedSpec {
  slug: string
  name: string
  subheading: string
  shortDescription: string
  description: string
  category: ProductCategory
  basePriceNaira: number
  sized: boolean
  defaultStock: number
  badge?: { label: string; tone: BadgeTone }
  accordions: ProductAccordionInput[]
  trustLines: ProductTrustLineInput[]
}

// ── Trust line presets ────────────────────────────────────────────────

const PANTS_TRUST_LINES: ProductTrustLineInput[] = [
  { icon: 'truck', text: 'Ships nationwide in 2 to 5 days.' },
  { icon: 'shield', text: '30 day comfort guarantee. Wear them once, return for a refund.' },
  { icon: 'leaf', text: 'Each pair lasts 5 years. Replaces 250+ disposables.' },
]

const PADS_TRUST_LINES: ProductTrustLineInput[] = [
  { icon: 'truck', text: 'Ships nationwide in 2 to 5 days.' },
  { icon: 'shield', text: '30 day comfort guarantee.' },
  { icon: 'leaf', text: 'Reusable for about 5 years. Far less waste than disposables.' },
]

const EDUCATION_TRUST_LINES: ProductTrustLineInput[] = [
  { icon: 'mail', text: 'Print and digital editions included.' },
  { icon: 'truck', text: 'Ships nationwide in 2 to 5 days.' },
  { icon: 'check', text: 'Plain Nigerian English. Made for real life.' },
]

const BUNDLE_TRUST_LINES: ProductTrustLineInput[] = [
  { icon: 'truck', text: 'Ships nationwide in 2 to 5 days.' },
  { icon: 'shield', text: '30 day comfort guarantee on the whole set.' },
  { icon: 'leaf', text: 'Replaces hundreds of disposables. Five years of wear.' },
]

// ── Accordion presets ─────────────────────────────────────────────────

const SHIPPING_ACCORDION: ProductAccordionInput = {
  heading: 'Shipping and returns',
  body: 'Ships from Abuja within 1 working day. Nationwide delivery in 2 to 5 days. 30 day comfort guarantee.',
}

const PANTS_ACCORDIONS: ProductAccordionInput[] = [
  {
    heading: 'Details and materials',
    body: 'Outer: 95% cotton, 5% spandex. Wicking layer: bamboo rayon blend. Absorbent core holds up to 30ml (about four tampons). Leak proof PUL membrane, phthalate free. Sewn in Abuja, FCT.',
  },
  {
    heading: 'Care instructions',
    body: 'Cold rinse before first wash. Machine wash cold on a delicate cycle with neutral detergent. Hang to dry. No tumble, no bleach. Do not iron the gusset.',
  },
  SHIPPING_ACCORDION,
]

const PADS_ACCORDIONS: ProductAccordionInput[] = [
  {
    heading: 'Details and materials',
    body: 'Cotton flannel top layer. Bamboo absorbent core. PUL leak proof backing. Snap closure secures to underwear. Five reusable pads per pack.',
  },
  {
    heading: 'Care instructions',
    body: 'Rinse in cold water after use. Machine wash cold on a gentle cycle. Hang dry. Avoid fabric softeners as they coat the absorbent core. Lasts about five years with care.',
  },
  SHIPPING_ACCORDION,
]

const EDUCATION_ACCORDIONS: ProductAccordionInput[] = [
  {
    heading: 'What is inside',
    body: 'An illustrated guide covering the menstrual cycle, hormones, hygiene, and answers to common questions. Written for Nigerian girls and young women. 48 pages.',
  },
  {
    heading: 'Format',
    body: 'Available as a printed booklet or digital PDF. Both editions are included with every order.',
  },
  SHIPPING_ACCORDION,
]

const BUNDLE_ACCORDIONS: ProductAccordionInput[] = [
  {
    heading: 'What is in the set',
    body: 'Three Mensa period pants in your chosen size, plus five reusable pads. The full kit for switching away from disposables.',
  },
  ...PANTS_ACCORDIONS,
]

const catalogue: SeedSpec[] = [
  {
    slug: 'single-pant',
    name: 'Single Pant',
    subheading: 'Try one. See for yourself.',
    shortDescription: 'One pair. Light to medium days.',
    description:
      'Made for women who want to try Mensa before committing to a pack. Comfortable, breathable, and built to last five years of wear.',
    category: 'pants',
    basePriceNaira: 6500,
    sized: true,
    defaultStock: 100,
    accordions: PANTS_ACCORDIONS,
    trustLines: PANTS_TRUST_LINES,
  },
  {
    slug: 'pack-of-3-pants',
    name: 'Pack of 3',
    subheading: 'A few days covered.',
    shortDescription: 'Three pairs. Light to medium days.',
    description:
      'Three pairs of Mensa period pants. Rotate through your week without thinking about restock.',
    category: 'pants',
    basePriceNaira: 16500,
    sized: true,
    defaultStock: 80,
    accordions: PANTS_ACCORDIONS,
    trustLines: PANTS_TRUST_LINES,
  },
  {
    slug: 'pack-of-5-pants',
    name: 'Pack of 5',
    subheading: 'A full cycle, sorted.',
    shortDescription: 'Five pairs. Light to heavy days.',
    description:
      'Five pairs. The most popular pack. Covers a full cycle with one pair to spare. Best value per pair.',
    category: 'pants',
    basePriceNaira: 25000,
    sized: true,
    defaultStock: 80,
    badge: { label: 'Bestseller', tone: 'pink' },
    accordions: PANTS_ACCORDIONS,
    trustLines: PANTS_TRUST_LINES,
  },
  {
    slug: 'sport-pant',
    name: 'Sport Pant',
    subheading: 'Move through your days.',
    shortDescription: 'Light to medium days. Active fit.',
    description:
      'Lower rise, lighter fabric, built for movement. Wear under leggings or shorts on active days.',
    category: 'pants',
    basePriceNaira: 7500,
    sized: true,
    defaultStock: 60,
    accordions: PANTS_ACCORDIONS,
    trustLines: PANTS_TRUST_LINES,
  },
  {
    slug: 'pads-regular',
    name: 'Reusable Pads, Pack of 5',
    subheading: 'For lighter days.',
    shortDescription: 'Five reusable pads. Regular absorbency.',
    description:
      'Five reusable cotton flannel pads. Snap closure, breathable backing, machine washable. Regular absorbency for light to medium days.',
    category: 'pads',
    basePriceNaira: 4500,
    sized: false,
    defaultStock: 150,
    accordions: PADS_ACCORDIONS,
    trustLines: PADS_TRUST_LINES,
  },
  {
    slug: 'pads-heavy',
    name: 'Reusable Pads, Pack of 5, Heavy',
    subheading: 'For heavier days.',
    shortDescription: 'Five reusable pads. Heavy absorbency.',
    description:
      'Five reusable pads with extra layers for heavier flow days. Same comfortable cotton flannel. Machine washable.',
    category: 'pads',
    basePriceNaira: 6500,
    sized: false,
    defaultStock: 120,
    accordions: PADS_ACCORDIONS,
    trustLines: PADS_TRUST_LINES,
  },
  {
    slug: 'starter-set',
    name: 'The Starter Set',
    subheading: 'Everything you need to switch.',
    shortDescription: 'Three pants and five pads. The complete switch.',
    description:
      'Three Mensa period pants and five reusable pads in one set. The cleanest way to swap out disposables for the next five years.',
    category: 'bundles',
    basePriceNaira: 22500,
    sized: true,
    defaultStock: 60,
    badge: { label: 'Starter set', tone: 'pink' },
    accordions: BUNDLE_ACCORDIONS,
    trustLines: BUNDLE_TRUST_LINES,
  },
  {
    slug: 'my-cycoo',
    name: 'My Cycoo',
    subheading: 'A guide to your cycle.',
    shortDescription: 'Educational guide. Print and digital.',
    description:
      'Mensa\'s illustrated cycle education guide. Written for Nigerian girls and young women. Covers periods, hormones, hygiene, and common questions answered with care.',
    category: 'education',
    basePriceNaira: 2500,
    sized: false,
    defaultStock: 200,
    accordions: EDUCATION_ACCORDIONS,
    trustLines: EDUCATION_TRUST_LINES,
  },
]

function buildVariants(spec: SeedSpec): ProductVariantInput[] {
  // Pre-compute SKUs here so the seed can write straight to Mongoose
  // without going through the service layer.
  const types = optionTypesFor(spec)
  if (!spec.sized) {
    return [
      {
        sku: computeSku(spec.slug, {}, types),
        options: {},
        stockCount: spec.defaultStock,
        lowStockThreshold: 10,
        b2cPriceOverride: null,
        b2bPriceOverride: null,
        isActive: true,
      },
    ]
  }
  return PANTS_SIZES.map((size) => {
    const options = { Size: size }
    return {
      sku: computeSku(spec.slug, options, types),
      options,
      stockCount: spec.defaultStock,
      lowStockThreshold: 10,
      b2cPriceOverride: null,
      b2bPriceOverride: null,
      isActive: true,
    }
  })
}

function optionTypesFor(spec: SeedSpec): string[] {
  return spec.sized ? ['Size'] : []
}

function toCreateInput(spec: SeedSpec): CreateProductInput {
  const basePriceB2C = naira(spec.basePriceNaira)
  return {
    slug: spec.slug,
    name: spec.name,
    subheading: spec.subheading,
    shortDescription: spec.shortDescription,
    description: spec.description,
    category: spec.category,
    basePriceB2C,
    basePriceB2B: b2bFromB2c(basePriceB2C),
    salePrice: null,
    optionTypes: optionTypesFor(spec),
    variants: buildVariants(spec),
    accordions: spec.accordions,
    trustLines: spec.trustLines,
    metadata: spec.badge
      ? { badge: spec.badge.label, badgeTone: spec.badge.tone }
      : {},
    isActive: true,
  }
}

async function seed() {
  const uri = process.env.MONGO_URI
  if (!uri) {
    console.error('Set MONGO_URI in .env')
    process.exit(1)
  }
  await mongoose.connect(uri)

  let created = 0
  let updated = 0
  for (const spec of catalogue) {
    const input = toCreateInput(spec)
    const existing = await Product.findOne({ slug: spec.slug })
    if (existing) {
      // Don't overwrite images or variant stock counts on re-run.
      const preservedImages = existing.images
      const optionsKey = (opts: Record<string, string>): string =>
        Object.entries(opts)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => `${k}=${v}`)
          .join('|')
      const preservedStock = new Map(
        existing.variants.map((v) => [optionsKey(v.options ?? {}), v.stockCount]),
      )

      // Preserve admin authored accordions / trust lines if they've already
      // edited them. Empty arrays get backfilled with the seed defaults.
      const preservedAccordions =
        existing.accordions.length > 0 ? existing.accordions : input.accordions
      const preservedTrustLines =
        existing.trustLines.length > 0 ? existing.trustLines : input.trustLines

      existing.set({
        name: input.name,
        subheading: input.subheading,
        shortDescription: input.shortDescription,
        description: input.description,
        category: input.category,
        basePriceB2C: input.basePriceB2C,
        basePriceB2B: input.basePriceB2B,
        salePrice: input.salePrice,
        optionTypes: input.optionTypes,
        metadata: input.metadata,
        isActive: input.isActive,
        variants: input.variants.map((v) => ({
          ...v,
          stockCount: preservedStock.get(optionsKey(v.options)) ?? v.stockCount,
        })),
        accordions: preservedAccordions,
        trustLines: preservedTrustLines,
        images: preservedImages,
      })
      await existing.save()
      updated += 1
      console.log(`updated: ${spec.slug}`)
    } else {
      await Product.create(input)
      created += 1
      console.log(`created: ${spec.slug}`)
    }
  }

  console.log(`\nDone. created=${created} updated=${updated} total=${catalogue.length}`)
  await mongoose.disconnect()
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})
