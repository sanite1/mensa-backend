// sitemap.routes.ts — dynamic XML sitemap of live catalogue + published content.
// Static brand routes live in the frontend's public/sitemap.xml, this feed
// covers the slugs that change: products and journal/education posts.
import { Router } from 'express'
import { Product } from '../models/Product'
import { ContentPost } from '../models/ContentPost'
import { logger } from '../config/logger'

const router = Router()

const SITE_URL = process.env.SITE_URL ?? 'https://mensaproducts.com'

const escapeXml = (s: string) =>
  s.replace(/[<>&'"]/g, (c) =>
    c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '&' ? '&amp;' : c === "'" ? '&apos;' : '&quot;',
  )

router.get('/sitemap.xml', async (_req, res) => {
  try {
    const [products, posts] = await Promise.all([
      Product.find({ isActive: true }).select('slug updatedAt').lean(),
      ContentPost.find({ status: 'published' })
        .select('slug kind updatedAt')
        .lean(),
    ])

    const urls: { loc: string; lastmod?: string }[] = [
      ...products.map((p) => ({
        loc: `${SITE_URL}/shop/${p.slug}`,
        lastmod: p.updatedAt ? new Date(p.updatedAt).toISOString().slice(0, 10) : undefined,
      })),
      ...posts.map((c) => ({
        loc: `${SITE_URL}/${c.kind === 'education' ? 'education' : 'journal'}/${c.slug}`,
        lastmod: c.updatedAt ? new Date(c.updatedAt).toISOString().slice(0, 10) : undefined,
      })),
    ]

    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      urls
        .map(
          (u) =>
            `  <url><loc>${escapeXml(u.loc)}</loc>${
              u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''
            }</url>`,
        )
        .join('\n') +
      '\n</urlset>\n'

    res
      .status(200)
      .set('Content-Type', 'application/xml; charset=utf-8')
      // Cache at the edge for an hour, the catalogue does not change faster than that.
      .set('Cache-Control', 'public, max-age=3600')
      .send(xml)
  } catch (err) {
    logger.error('[sitemap] generation failed', err)
    res.status(500).set('Content-Type', 'text/plain').send('sitemap unavailable')
  }
})

export default router
