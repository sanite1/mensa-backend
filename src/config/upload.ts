import multer from 'multer'
import type { Request, Response, NextFunction, RequestHandler } from 'express'
import { ApiError } from '../errors/apiError'

// Store in memory so we can stream directly to Cloudinary
const multerInstance = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new ApiError(400, 'Only image files are allowed.'))
      return
    }
    cb(null, true)
  },
})

// Wrap multer middleware so multer errors (file too big, wrong field name,
// fileFilter rejections) come out as proper ApiError responses instead of
// opaque 500s from the global handler.
function wrap(mw: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    mw(req, res, (err: unknown) => {
      if (!err) return next()
      if (err instanceof ApiError) return next(err)
      if (err instanceof multer.MulterError) {
        const msg =
          err.code === 'LIMIT_FILE_SIZE'
            ? 'File is larger than the 10 MB limit.'
            : err.code === 'LIMIT_UNEXPECTED_FILE'
              ? `Unexpected file field "${err.field}".`
              : err.message
        return next(new ApiError(400, msg))
      }
      return next(err)
    })
  }
}

export const upload = {
  single: (field: string) => wrap(multerInstance.single(field)),
  array: (field: string, max?: number) => wrap(multerInstance.array(field, max)),
}
