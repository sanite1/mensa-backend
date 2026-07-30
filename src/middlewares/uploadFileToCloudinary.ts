import type { Request, Response, NextFunction } from 'express'
import { cloudinaryService } from '../services/external/cloudinary.service'
import { ApiError } from '../errors/apiError'

/** Uploads req.file to Cloudinary and attaches the result to req.body._uploadedFile. folder can be a string or a function of the request for dynamic folders. */
export function uploadFileToCloudinary(folder: string | ((req: Request) => string)) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.file) {
      next()
      return
    }

    try {
      const resolvedFolder = typeof folder === 'function' ? folder(req) : folder
      const result = await cloudinaryService.upload(req.file.buffer, {
        folder: resolvedFolder,
        mimetype: req.file.mimetype,
      })
      req.body._uploadedFile = result
      next()
    } catch {
      next(new ApiError(500, 'Image upload failed.'))
    }
  }
}
