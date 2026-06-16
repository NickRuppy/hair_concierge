export const PRODUCT_INTAKE_BUCKET = "product-intake"
export const PRODUCT_INTAKE_MAX_IMAGE_BYTES = 10 * 1024 * 1024

const MIME_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
} as const

export type ProductIntakeImageKind = "front" | "barcode"
export type ProductIntakeValidatedImage = {
  bytes: Uint8Array
  mimeType: keyof typeof MIME_EXTENSIONS
  extension: (typeof MIME_EXTENSIONS)[keyof typeof MIME_EXTENSIONS]
  size: number
  validationStatus: "uncertain"
  validationMetadata: {
    kind: ProductIntakeImageKind
    validation: "file_signature_only"
    mime_type: keyof typeof MIME_EXTENSIONS
    size_bytes: number
  }
}

export class ProductIntakeImageValidationError extends Error {
  readonly code:
    | "missing_file"
    | "file_too_large"
    | "unsupported_image_type"
    | "invalid_image_signature"

  constructor(
    code: ProductIntakeImageValidationError["code"],
    message = "Bild konnte nicht validiert werden.",
  ) {
    super(message)
    this.name = "ProductIntakeImageValidationError"
    this.code = code
  }
}

function detectMimeType(bytes: Uint8Array): keyof typeof MIME_EXTENSIONS | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg"
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png"
  }

  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp"
  }

  if (
    bytes.length >= 12 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  ) {
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]).toLowerCase()
    if (brand.startsWith("hei") || brand.startsWith("mif")) {
      return brand === "heic" || brand === "heix" ? "image/heic" : "image/heif"
    }
  }

  return null
}

export async function validateProductIntakeImageFile(
  file: File | null | undefined,
  kind: ProductIntakeImageKind,
): Promise<ProductIntakeValidatedImage> {
  if (!file) {
    throw new ProductIntakeImageValidationError("missing_file", "Bitte lade ein Bild hoch.")
  }

  if (file.size > PRODUCT_INTAKE_MAX_IMAGE_BYTES) {
    throw new ProductIntakeImageValidationError(
      "file_too_large",
      "Das Bild ist zu groß. Bitte lade ein kleineres Bild hoch.",
    )
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const detectedMime = detectMimeType(bytes)

  if (!detectedMime) {
    throw new ProductIntakeImageValidationError(
      "invalid_image_signature",
      "Bitte lade ein JPG-, PNG-, WebP-, HEIC- oder HEIF-Bild hoch.",
    )
  }

  if (file.type && file.type !== detectedMime) {
    throw new ProductIntakeImageValidationError(
      "unsupported_image_type",
      "Der Dateityp passt nicht zum Bildinhalt.",
    )
  }

  return {
    bytes,
    mimeType: detectedMime,
    extension: MIME_EXTENSIONS[detectedMime],
    size: bytes.length,
    validationStatus: "uncertain",
    validationMetadata: {
      kind,
      validation: "file_signature_only",
      mime_type: detectedMime,
      size_bytes: bytes.length,
    },
  }
}
