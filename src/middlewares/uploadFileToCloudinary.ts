import type { Request, Response, NextFunction } from 'express'
import { cloudinaryService } from '../services/external/cloudinary.service'
import { ApiError } from '../errors/apiError'

export function uploadFileToCloudinary(folder: string) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.file) { next(); return }

    try {
      const result = await cloudinaryService.upload(req.file.buffer, folder, req.file.mimetype)
      req.body._uploadedFile = result
      next()
    } catch (err) {
      next(ApiError.internal('Image upload failed'))
    }
  }
}
