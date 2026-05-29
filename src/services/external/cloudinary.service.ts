import { cloudinary } from '../../config/cloudinary'
import { assertEnv } from '../../config/validateEnv'

// ── Guards: every public method asserts the keys are set so a missing
//    .env value produces a meaningful runtime error rather than an opaque
//    SDK crash. ──
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
  /**
   * Uploads a buffer to Cloudinary via the streaming API. Designed to pair
   * with Multer's memoryStorage so the file never hits disk.
   */
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
            reject(error ?? new Error('Cloudinary upload returned no result'))
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

  /**
   * Removes an asset by its full public_id (folder prefix included, no extension).
   * Safe to call for assets that no longer exist; Cloudinary returns `not found`
   * but no exception is thrown.
   */
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
  brand: () => 'mensa/brand',
}
