// ═══════════════════════════════════════════════════════════════
// seedJournal.ts
//
// Idempotent upsert of a starter set of journal + education posts.
// Lets the public /journal page have content to render before the
// editorial team uses the admin Content CMS to add real ones.
//
// Re-running this script updates the same slugs in place — never
// duplicates. Run with: npm run seed:journal
// ═══════════════════════════════════════════════════════════════

import 'dotenv/config'
import mongoose from 'mongoose'
import { ContentPost } from '../models/ContentPost'
import type {
  ContentCategory,
  ContentKind,
  IContentCoverImage,
} from '../interfaces/content.interface'

interface SeedPost {
  slug: string
  kind: ContentKind
  title: string
  eyebrow: string
  category: ContentCategory
  excerpt: string
  body: string
  authorName: string
  authorBio?: string
  readMinutes: number
  coverImage?: IContentCoverImage
}

const POSTS: SeedPost[] = [
  {
    slug: 'why-we-built-reusable-pants',
    kind: 'journal',
    eyebrow: 'Volume 01 · April 2026',
    title: 'Why we built reusable period pants in Abuja, not Lagos.',
    category: 'community',
    excerpt:
      'Comfort, dignity, and a five year wear. A founder note on choosing reusables for Nigerian women and what it took to get the first batch out of our studio.',
    body: [
      '## A studio in Wuse II',
      '',
      'We started Mensa with one sewing machine and a question. Could we make a period product that felt better than every disposable we had used, and lasted longer than any single use pack we had bought?',
      '',
      'The answer took eighteen months, three rounds of patternmaking, and a lot of conversations with the women in our lives. Our mums. Our sisters. The girls who came through our friend\'s NGO and told us what was missing.',
      '',
      '## Built for the days we actually live',
      '',
      'Nigerian climate is real. Nigerian roads are real. A pair of period pants needs to handle a 35 degree afternoon, an okada ride, a long shift, and still feel like nothing the next morning.',
      '',
      'That meant a four layer construction with the wicking layer doing most of the work, a leakproof outer that breathes, and a fit cut for our bodies — not a US sample size scaled up.',
      '',
      '## Five years per pair',
      '',
      'One pair of Mensa pants replaces around 250 disposables. The starter set of three pants and five reusable pads gets a woman through every cycle for five years. The maths is good for our wallets and very good for our environment.',
      '',
      'We will keep writing here. About product. About menstrual health. About the women we are building for. Welcome to the journal.',
    ].join('\n'),
    authorName: 'Adaeze Okafor',
    authorBio: 'Co-founder, Mensa Period Products.',
    readMinutes: 4,
  },
  {
    slug: 'four-layer-construction-explained',
    kind: 'journal',
    eyebrow: 'Behind the design',
    title: 'A teardown of our four layer construction (and why the wicking layer matters most).',
    category: 'product',
    excerpt:
      'Each Mensa pant is four layers thick. We cut one open so you can see exactly what is doing what, and why we paid more for the wicking layer than any other component.',
    body: [
      '## What the four layers do',
      '',
      'Layer one sits against your skin. It is a soft, moisture-wicking fabric chosen so the surface feels dry within seconds of any fluid touching it. This is the layer that decides whether a period pant feels like underwear or like a hospital pad.',
      '',
      'Layer two is the absorbent core. It holds the equivalent of three to four regular tampons depending on the model. The fibre we use is rated for hundreds of washes without losing capacity.',
      '',
      'Layer three is a leakproof membrane. Quiet, breathable, and bonded so it never crinkles or shifts.',
      '',
      'Layer four is the outer shell — the part you actually see and feel from the outside. We pattern these in cotton-blend so they sit like everyday underwear under any outfit.',
      '',
      '## Why the wicking layer is the most important',
      '',
      'Most reusable pants on the market focus on absorbency numbers. We focused on dryness. A pant that absorbs perfectly but feels damp against your skin is a pant you will stop wearing.',
      '',
      'We import the wicking fabric from a Portuguese mill that supplies high-performance sportswear brands. It costs us about 38% of the bill of materials per pant. We think it is the difference between a customer who reorders and one who does not.',
    ].join('\n'),
    authorName: 'Tomilola Adesina',
    authorBio: 'Co-founder, head of product.',
    readMinutes: 5,
  },
  {
    slug: 'five-women-in-kano',
    kind: 'journal',
    eyebrow: 'Field notes',
    title: 'Five women in Kano on what reusable pants changed about their month.',
    category: 'community',
    excerpt:
      'We spent three days in Kano with the first cohort of women who switched to reusables through our partnership with a community clinic. Here is what they told us.',
    body: [
      '## The clinic',
      '',
      'In November we partnered with a community clinic in Kano to introduce reusable period products to 40 women, mostly traders and students. We provided the starter sets at no cost and committed to a follow up three months later.',
      '',
      'These are five of their stories, lightly edited and shared with permission.',
      '',
      '## Hauwa, trader',
      '',
      '"The first month I cried because I did not have to wake up early to find pads. I had everything I needed already washed and folded. Three months later I have not bought a single pad."',
      '',
      '## Aisha, student',
      '',
      '"I used to skip class on heavy days because of leaking. With Mensa I have not missed a class. My mother is asking for her own set now."',
      '',
      '## Maryam, nurse',
      '',
      '"I work twelve hour shifts. The pants stayed dry through the whole shift. My only complaint is that I want more pairs."',
      '',
      '## Khadija, mother of three',
      '',
      '"My daughter is starting to menstruate. I am buying her a set this month so she never knows what disposable pads feel like."',
      '',
      '## Zainab, teacher',
      '',
      '"I have told every female teacher at my school. We are doing a group order."',
      '',
      '## What we learned',
      '',
      'The cost barrier matters less than we expected once the math is shown clearly. The trust barrier matters more. A woman is unlikely to switch on her own — but a recommendation from a friend who has actually worn them for a month moves the needle every time.',
    ].join('\n'),
    authorName: 'Adaeze Okafor',
    readMinutes: 7,
  },
  {
    slug: 'caring-for-your-pants',
    kind: 'education',
    eyebrow: 'Care guide',
    title: 'How to wash, dry, and store your Mensa pants for five full years.',
    category: 'care',
    excerpt:
      'A short, practical guide to making your reusables last. Cold water, mild detergent, line dry. The details that matter and the mistakes to avoid.',
    body: [
      '## The 60 second rule',
      '',
      'Right after wearing, rinse the pant under cold water until the water runs clear. This stops anything from setting in. Sixty seconds, no soap needed.',
      '',
      '## Wash day',
      '',
      'Once or twice a week, machine wash your rinsed pants on a cold, gentle cycle with a mild detergent. Skip fabric softener — it coats the wicking layer and reduces dryness.',
      '',
      '## Dry naturally',
      '',
      'Line dry in shade. Direct sunlight bleaches the cotton-blend shell. Never tumble dry — heat slowly degrades the leakproof membrane.',
      '',
      '## Storage',
      '',
      'Fold flat in your underwear drawer. They take the same space as regular pants. No special storage needed.',
      '',
      '## What to avoid',
      '',
      '- Bleach. Damages the membrane.',
      '- Fabric softener. Reduces dryness.',
      '- Tumble dryer heat. Cuts useful life in half.',
      '- Ironing. Will melt the membrane.',
      '',
      'Treat them like you would a swimsuit and you get five years easily.',
    ].join('\n'),
    authorName: 'Mensa team',
    readMinutes: 3,
  },
  {
    slug: 'menstrual-health-in-the-classroom',
    kind: 'education',
    eyebrow: 'For educators',
    title: 'What schools in Abuja get wrong about menstrual health, and what we are doing about it.',
    category: 'classroom',
    excerpt:
      'Most school menstrual education in Nigeria is a one off chat with the nurse. We built a 40 minute classroom session and a card deck to do it better.',
    body: [
      '## The current state',
      '',
      'Across the schools we have visited in FCT and Lagos, the typical menstrual education is a single 30 minute talk delivered once, often by a nurse with no time for follow up questions. The girls leave with a pamphlet and not much else.',
      '',
      '## What works instead',
      '',
      'We built a 40 minute session designed around two assumptions: girls already know more than adults think, and the questions they actually want answered are practical.',
      '',
      'The session covers anatomy in five minutes — quickly, factually, without coyness. The remaining 35 minutes are about products, hygiene at school, talking to a parent, when to see a doctor, and yes, the social bits ("what if it shows on my uniform").',
      '',
      '## The deck',
      '',
      'We packaged the curriculum into a card deck called Period Conversations. Each card is one prompt. Teachers can run it as a 40 minute lesson or as a 10 minute warm up over a week. We are giving it to verified school partners at no cost.',
      '',
      'If you teach at a school in Nigeria, apply via our partnerships page and we will get you a kit.',
    ].join('\n'),
    authorName: 'Tomilola Adesina',
    readMinutes: 6,
  },
]

async function seed(): Promise<void> {
  const uri = process.env.MONGO_URI
  if (!uri) {
    throw new Error('MONGO_URI is not set in .env')
  }

  await mongoose.connect(uri)
  console.log(`Connected. Seeding ${POSTS.length} journal/education posts…\n`)

  let created = 0
  let updated = 0

  for (const post of POSTS) {
    const existing = await ContentPost.findOne({ slug: post.slug })
    if (existing) {
      existing.kind = post.kind
      existing.title = post.title
      existing.eyebrow = post.eyebrow
      existing.category = post.category
      existing.excerpt = post.excerpt
      existing.body = post.body
      existing.authorName = post.authorName
      existing.authorBio = post.authorBio
      existing.readMinutes = post.readMinutes
      if (post.coverImage) existing.coverImage = post.coverImage
      // Make sure seeded posts are publicly visible. Stamp publishedAt
      // on the first transition so the order on the index is stable.
      if (existing.status !== 'published') {
        existing.status = 'published'
        if (!existing.publishedAt) existing.publishedAt = new Date()
      }
      await existing.save()
      updated += 1
      console.log(`updated: ${post.slug}`)
    } else {
      await ContentPost.create({
        ...post,
        status: 'published',
        publishedAt: new Date(),
      })
      created += 1
      console.log(`created: ${post.slug}`)
    }
  }

  console.log(`\nDone. created=${created} updated=${updated} total=${POSTS.length}`)
  await mongoose.disconnect()
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})
