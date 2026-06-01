import type { Document, Types } from 'mongoose'

export type ContentKind = 'journal' | 'education'
export type ContentCategory =
  | 'classroom'
  | 'product'
  | 'community'
  | 'policy'
  | 'care'
export type ContentStatus = 'draft' | 'published'

export interface IContentCoverImage {
  url: string
  /** Cloudinary public id, kept so we can clean up storage on delete. */
  publicId?: string
  alt: string
}

export interface IContentPost {
  slug: string
  kind: ContentKind
  title: string
  eyebrow: string
  category: ContentCategory
  excerpt: string
  /** Long form body in markdown. */
  body: string
  coverImage?: IContentCoverImage
  authorName: string
  authorBio?: string
  readMinutes: number
  status: ContentStatus
  publishedAt?: Date | null
  createdAt: Date
  updatedAt: Date
}

export type ContentPostDocument = Document<Types.ObjectId, unknown, IContentPost> &
  IContentPost

// ── DTOs ─────────────────────────────────────────────────────────

export interface CreateContentPostInput {
  slug: string
  kind: ContentKind
  title: string
  eyebrow?: string
  category: ContentCategory
  excerpt: string
  body: string
  coverImage?: IContentCoverImage
  authorName: string
  authorBio?: string
  readMinutes?: number
  status?: ContentStatus
}

export type UpdateContentPostInput = Partial<CreateContentPostInput>

export interface ListContentPostsQuery {
  kind?: ContentKind
  category?: ContentCategory
  status?: ContentStatus
  q?: string
  page?: number
  pageSize?: number
}

export interface ListContentPostsResult {
  items: ContentPostDocument[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}
