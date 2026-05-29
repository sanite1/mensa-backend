import type { Request, Response, NextFunction } from 'express'
import { cloudinaryService } from '../services/external/cloudinary.service'
import { ApiError } from '../errors/apiError'

/**
 * Uploads `req.file` (set by Multer single upload middleware) to Cloudinary
 * and attaches the result to `req.body._uploadedFile`.
 *
 * `folder` can be a static string or a function of the request, so dynamic
 * folders like `mensa/products/<slug>` are supported.
 */
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
