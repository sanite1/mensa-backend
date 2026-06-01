import { Schema, model, type Model } from 'mongoose'
import type {
  IProduct,
  IProductAccordion,
  IProductImage,
  IProductMetadata,
  IProductTrustLine,
  IProductVariant,
  ProductCategory,
  BadgeTone,
  TrustIcon,
} from '../interfaces/product.interface'

type ProductModel = Model<IProduct>

const ImageSchema = new Schema<IProductImage>(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    alt: { type: String, default: '' },
    order: { type: Number, default: 0 },
  },
  { _id: true, timestamps: false },
)

const VariantSchema = new Schema<IProductVariant>(
  {
    sku: { type: String, required: true, trim: true },
    options: { type: Object, default: () => ({}) },
    stockCount: { type: Number, required: true, default: 0, min: 0 },
    lowStockThreshold: { type: Number, required: true, default: 5, min: 0 },
    b2cPriceOverride: { type: Number, default: null, min: 0 },
    b2bPriceOverride: { type: Number, default: null, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { _id: true, timestamps: false },
)

const AccordionSchema = new Schema<IProductAccordion>(
  {
    heading: { type: String, required: true, trim: true },
    body: { type: String, required: true },
  },
  { _id: true, timestamps: false },
)

const TrustLineSchema = new Schema<IProductTrustLine>(
  {
    icon: {
      type: String,
      enum: ['truck', 'shield', 'leaf', 'star', 'check', 'mail'] satisfies TrustIcon[],
      required: true,
    },
    text: { type: String, required: true, trim: true },
  },
  { _id: true, timestamps: false },
)

const MetadataSchema = new Schema<IProductMetadata>(
  {
    badge: { type: String, required: false },
    badgeTone: {
      type: String,
      enum: ['pink', 'coral', 'ink'] satisfies BadgeTone[],
      required: false,
    },
    rating: { type: Number, required: false, min: 0, max: 5 },
    reviewCount: { type: Number, required: false, min: 0 },
  },
  { _id: false },
)

const ProductSchema = new Schema<IProduct, ProductModel>(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    subheading: { type: String, default: '', trim: true },
    shortDescription: { type: String, default: '', trim: true },
    description: { type: String, default: '' },
    category: {
      type: String,
      enum: ['pants', 'pads', 'bundles', 'education'] satisfies ProductCategory[],
      required: true,
      index: true,
    },
    basePriceB2C: { type: Number, required: true, min: 0 },
    basePriceB2B: { type: Number, required: true, min: 0 },
    salePrice: { type: Number, default: null, min: 0 },
    optionTypes: { type: [String], default: [] },
    images: { type: [ImageSchema], default: [] },
    variants: { type: [VariantSchema], default: [] },
    accordions: { type: [AccordionSchema], default: [] },
    trustLines: { type: [TrustLineSchema], default: [] },
    metadata: { type: MetadataSchema, default: () => ({}) },
    isActive: { type: Boolean, default: true, index: true },
    isSoldOut: { type: Boolean, default: false },
    showSizeGuide: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.__v
        return ret
      },
    },
  },
)

// Full text search across the customer facing copy fields.
ProductSchema.index({ name: 'text', shortDescription: 'text', description: 'text' })

export const Product = model<IProduct, ProductModel>('Product', ProductSchema)
