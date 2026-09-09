import { v2 as cloudinary } from 'cloudinary'

// Prefer the single CLOUDINARY_URL (cloudinary://key:secret@cloud) which the
// SDK parses itself, one value to paste means fewer signature mismatches.
// Fall back to the three explicit vars, trimmed because pasted env values
// often pick up stray whitespace that silently breaks request signing.
if (process.env.CLOUDINARY_URL) {
  cloudinary.config({ secure: true })
} else {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME?.trim(),
    api_key: process.env.CLOUDINARY_API_KEY?.trim(),
    api_secret: process.env.CLOUDINARY_API_SECRET?.trim(),
    secure: true,
  })
}

export { cloudinary }
