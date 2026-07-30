import { cloudinary } from '../../config/cloudinary'
import { assertEnv } from '../../config/validateEnv'

// ── Guards: every public method asserts keys so a missing env fails meaningfully, not as an opaque SDK crash. ──
const REQUIRED_KEYS = [
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
] as const

export interface CloudinaryUploadResult {
  url: string
  publicId: string
  width: number
  height: number
  format: string
  bytes: number
}

export interface CloudinaryUploadOptions {
  /** Full folder path, e.g. `mensa/products/my-cycoo`. */
  folder: string
  /** Optional explicit public_id (without folder prefix). When omitted,
   *  Cloudinary auto generates one. */
  publicId?: string
  /** Source mimetype, used as the format hint. */
  mimetype?: string
}

export const cloudinaryService = {
  /** Streams a buffer to Cloudinary, pairs with Multer memoryStorage so files never hit disk. */
  async upload(
    buffer: Buffer,
    options: CloudinaryUploadOptions,
  ): Promise<CloudinaryUploadResult> {
    assertEnv([...REQUIRED_KEYS], 'Cloudinary')
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: options.folder,
          public_id: options.publicId,
          resource_type: 'image',
          format: options.mimetype?.split('/')[1],
        },
        (error, result) => {
          if (error || !result) {
            // Cloudinary rejects with a plain object like {message, http_code, name}.
            // Wrap into a real Error so downstream logging + error handling work.
            const raw = error as { message?: string; http_code?: number; name?: string } | undefined
            const message = raw?.message ?? 'Cloudinary upload returned no result'
            const wrapped = new Error(`Cloudinary upload failed: ${message}`)
            if (raw?.http_code) (wrapped as Error & { httpCode?: number }).httpCode = raw.http_code
            reject(wrapped)
            return
          }
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            width: result.width,
            height: result.height,
            format: result.format,
            bytes: result.bytes,
          })
        },
      )
      stream.end(buffer)
    })
  },

  /** Deletes by full public_id. Safe for missing assets, Cloudinary returns not found without throwing. */
  async delete(publicId: string): Promise<void> {
    assertEnv([...REQUIRED_KEYS], 'Cloudinary')
    await cloudinary.uploader.destroy(publicId)
  },
}

// ── Folder convention helpers (locked in Phase 1 of the brief) ────────
export const cloudinaryFolders = {
  product: (slug: string) => `mensa/products/${slug}`,
  contentJournal: (slug: string) => `mensa/content/journal/${slug}`,
  contentEducation: (slug: string) => `mensa/content/education/${slug}`,
  contentCovers: () => 'mensa/content/covers',
  brand: () => 'mensa/brand',
}
