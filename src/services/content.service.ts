// content.service.ts — CRUD for ContentPost. Public surface returns published posts only, admin surface includes drafts.

import type { FilterQuery } from 'mongoose'
import { Types } from 'mongoose'

import { ContentPost } from '../models/ContentPost'
import { ApiError } from '../errors/apiError'
import { ApiResponse } from '../errors/apiResponse'
import { cloudinaryService, cloudinaryFolders } from './external/cloudinary.service'
import type {
  ContentPostDocument,
  CreateContentPostInput,
  IContentPost,
  ListContentPostsQuery,
  ListContentPostsResult,
  UpdateContentPostInput,
} from '../interfaces/content.interface'

const DEFAULT_PAGE_SIZE = 24
const MAX_PAGE_SIZE = 100

const escapeRegex = (input: string): string =>
  input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function buildFilter(query: ListContentPostsQuery): FilterQuery<IContentPost> {
  const filter: FilterQuery<IContentPost> = {}
  if (query.kind) filter.kind = query.kind
  if (query.category) filter.category = query.category
  if (query.status) filter.status = query.status
  const q = query.q?.trim()
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i')
    filter.$or = [{ title: rx }, { excerpt: rx }]
  }
  return filter
}

// ─── Public: list published posts ────────────────────────────────
export const listPublicContentService = async (
  query: ListContentPostsQuery,
): Promise<ApiResponse<ListContentPostsResult>> => {
  const page = Math.max(1, query.page ?? 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE))
  const filter = buildFilter({ ...query, status: 'published' })

  const [items, total] = await Promise.all([
    ContentPost.find(filter)
      .sort({ publishedAt: -1, createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize) as unknown as Promise<ContentPostDocument[]>,
    ContentPost.countDocuments(filter),
  ])

  return new ApiResponse(200, 'OK.', {
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  })
}

// ─── Public: get by slug ─────────────────────────────────────────
export const getPublicContentBySlugService = async (
  slug: string,
): Promise<ApiResponse<{ post: ContentPostDocument }>> => {
  const post = (await ContentPost.findOne({
    slug: slug.toLowerCase(),
    status: 'published',
  })) as ContentPostDocument | null
  if (!post) throw new ApiError(404, 'Post not found.')
  return new ApiResponse(200, 'OK.', { post })
}

// ─── Admin: list (all statuses) ──────────────────────────────────
export const adminListContentService = async (
  query: ListContentPostsQuery,
): Promise<ApiResponse<ListContentPostsResult>> => {
  const page = Math.max(1, query.page ?? 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE))
  const filter = buildFilter(query)

  const [items, total] = await Promise.all([
    ContentPost.find(filter)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize) as unknown as Promise<ContentPostDocument[]>,
    ContentPost.countDocuments(filter),
  ])

  return new ApiResponse(200, 'OK.', {
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  })
}

// ─── Admin: get by id ────────────────────────────────────────────
export const adminGetContentService = async (
  id: string,
): Promise<ApiResponse<{ post: ContentPostDocument }>> => {
  if (!Types.ObjectId.isValid(id)) throw new ApiError(404, 'Post not found.')
  const post = (await ContentPost.findById(id)) as ContentPostDocument | null
  if (!post) throw new ApiError(404, 'Post not found.')
  return new ApiResponse(200, 'OK.', { post })
}

// ─── Admin: create ──────────────────────────────────────────────
export const adminCreateContentService = async (
  input: CreateContentPostInput,
): Promise<ApiResponse<{ post: ContentPostDocument }>> => {
  const slug = input.slug.toLowerCase().trim()
  const existing = await ContentPost.findOne({ slug })
  if (existing) throw new ApiError(409, `A post with slug "${slug}" already exists.`)

  const status = input.status ?? 'draft'
  const post = (await ContentPost.create({
    ...input,
    slug,
    status,
    publishedAt: status === 'published' ? new Date() : null,
  })) as ContentPostDocument
  return new ApiResponse(201, 'Post created.', { post })
}

// ─── Admin: update ──────────────────────────────────────────────
export const adminUpdateContentService = async (
  id: string,
  input: UpdateContentPostInput,
): Promise<ApiResponse<{ post: ContentPostDocument }>> => {
  if (!Types.ObjectId.isValid(id)) throw new ApiError(404, 'Post not found.')
  const post = (await ContentPost.findById(id)) as ContentPostDocument | null
  if (!post) throw new ApiError(404, 'Post not found.')

  if (input.slug && input.slug.toLowerCase() !== post.slug) {
    const slug = input.slug.toLowerCase().trim()
    const clash = await ContentPost.findOne({ slug, _id: { $ne: post._id } })
    if (clash) throw new ApiError(409, `A post with slug "${slug}" already exists.`)
    post.slug = slug
  }

  if (input.kind !== undefined) post.kind = input.kind
  if (input.title !== undefined) post.title = input.title
  if (input.eyebrow !== undefined) post.eyebrow = input.eyebrow
  if (input.category !== undefined) post.category = input.category
  if (input.excerpt !== undefined) post.excerpt = input.excerpt
  if (input.body !== undefined) post.body = input.body
  if (input.coverImage !== undefined) post.coverImage = input.coverImage
  if (input.authorName !== undefined) post.authorName = input.authorName
  if (input.authorBio !== undefined) post.authorBio = input.authorBio
  if (input.readMinutes !== undefined) post.readMinutes = input.readMinutes

  if (input.status !== undefined && input.status !== post.status) {
    post.status = input.status
    // Stamp publishedAt only on first publish so draft flips never erase the original date.
    if (input.status === 'published' && !post.publishedAt) {
      post.publishedAt = new Date()
    }
  }

  await post.save()
  return new ApiResponse(200, 'Post updated.', { post })
}

// ─── Admin: delete ──────────────────────────────────────────────
export const adminDeleteContentService = async (
  id: string,
): Promise<ApiResponse<{ id: string }>> => {
  if (!Types.ObjectId.isValid(id)) throw new ApiError(404, 'Post not found.')
  const post = await ContentPost.findByIdAndDelete(id)
  if (!post) throw new ApiError(404, 'Post not found.')
  return new ApiResponse(200, 'Post deleted.', { id })
}

// ─── Admin: upload cover image ──────────────────────────────────
// Standalone upload so the editor can attach a cover before the post exists, returns the URL + publicId for the post's coverImage.
export const adminUploadContentImageService = async (file: {
  buffer: Buffer
  mimetype: string
}): Promise<ApiResponse<{ url: string; publicId: string }>> => {
  const uploaded = await cloudinaryService.upload(file.buffer, {
    folder: cloudinaryFolders.contentCovers(),
    mimetype: file.mimetype,
  })
  return new ApiResponse(201, 'Image uploaded.', {
    url: uploaded.url,
    publicId: uploaded.publicId,
  })
}
