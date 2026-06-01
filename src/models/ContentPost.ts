import { Schema, model, type Model } from 'mongoose'
import type {
  ContentCategory,
  ContentKind,
  ContentStatus,
  IContentCoverImage,
  IContentPost,
} from '../interfaces/content.interface'

type ContentPostModel = Model<IContentPost>

const CoverImageSchema = new Schema<IContentCoverImage>(
  {
    url: { type: String, required: true },
    publicId: { type: String },
    alt: { type: String, default: '' },
  },
  { _id: false },
)

const ContentPostSchema = new Schema<IContentPost, ContentPostModel>(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    kind: {
      type: String,
      enum: ['journal', 'education'] satisfies ContentKind[],
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    eyebrow: { type: String, default: '', trim: true },
    category: {
      type: String,
      enum: ['classroom', 'product', 'community', 'policy', 'care'] satisfies ContentCategory[],
      required: true,
      index: true,
    },
    excerpt: { type: String, default: '', trim: true },
    body: { type: String, default: '' },
    coverImage: { type: CoverImageSchema, default: undefined },
    authorName: { type: String, required: true, trim: true },
    authorBio: { type: String, default: '', trim: true },
    readMinutes: { type: Number, default: 5, min: 1 },
    status: {
      type: String,
      enum: ['draft', 'published'] satisfies ContentStatus[],
      default: 'draft',
      index: true,
    },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true },
)

ContentPostSchema.index({ title: 'text', excerpt: 'text', body: 'text' })

export const ContentPost = model<IContentPost, ContentPostModel>(
  'ContentPost',
  ContentPostSchema,
)
