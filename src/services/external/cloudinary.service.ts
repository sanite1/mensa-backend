import { cloudinary } from '../../config/cloudinary'

export interface CloudinaryUploadResult {
  url: string
  publicId: string
}

export const cloudinaryService = {
  async upload(buffer: Buffer, folder: string, mimetype?: string): Promise<CloudinaryUploadResult> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'image', format: mimetype?.split('/')[1] },
        (error, result) => {
          if (error || !result) { reject(error ?? new Error('Upload failed')); return }
          resolve({ url: result.secure_url, publicId: result.public_id })
        },
      )
      uploadStream.end(buffer)
    })
  },

  async delete(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId)
  },
}
