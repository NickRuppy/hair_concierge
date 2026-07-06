const PRODUCT_IMAGE_BUCKET = "product-images"
const PRODUCT_IMAGE_PUBLIC_URL_PREFIX =
  "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/"

const SOURCE_TYPES = ["brand", "retailer", "marketplace", "search_result", "unknown"] as const
const QUALITY_CONFIDENCE = ["high", "medium"] as const
const PROCESSING_METHODS = ["local", "third_party", "manual"] as const
const NO_IMAGE_REASONS = [
  "no_exact_match",
  "low_confidence",
  "source_unclear",
  "not_needed_for_v1",
  "other",
] as const

export type ProductIntakeImageFinalizationDecision =
  | {
      status: "approved_asset"
      storage_bucket: typeof PRODUCT_IMAGE_BUCKET
      storage_path: string
      public_url: string
      source_page_url: string
      source_image_url?: string | null
      source_type: (typeof SOURCE_TYPES)[number]
      quality_confidence: (typeof QUALITY_CONFIDENCE)[number]
      processing_method: (typeof PROCESSING_METHODS)[number]
      final_file: string
      asset_sha256: string
      user_approved: true
      reviewed_by?: string
      reviewed_at?: string
      notes?: string | null
    }
  | {
      status: "no_image_approved_for_now"
      reason: (typeof NO_IMAGE_REASONS)[number]
      notes: string
      reviewed_by: string
      reviewed_at: string
    }

export type ProductIntakeImageFinalizationResult =
  | {
      ok: true
      decision: ProductIntakeImageFinalizationDecision
      publicUrl: string | null
      status: ProductIntakeImageFinalizationDecision["status"]
    }
  | {
      ok: false
      reason: string
    }

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function isIsoDate(value: unknown): value is string {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value))
}

function isOneOf<const Values extends readonly string[]>(
  value: unknown,
  values: Values,
): value is Values[number] {
  return typeof value === "string" && (values as readonly string[]).includes(value)
}

function invalid(reason: string): ProductIntakeImageFinalizationResult {
  return { ok: false, reason }
}

export function validateProductIntakeImageFinalization(params: {
  value: unknown
  finalProductImageUrl: unknown
}): ProductIntakeImageFinalizationResult {
  if (!isRecord(params.value)) {
    return invalid("image-finalization.json must contain an object")
  }

  if (params.value.status === "approved_asset") {
    const publicUrl = params.value.public_url
    const storagePath = params.value.storage_path
    const imageUrl = params.finalProductImageUrl

    if (!isNonEmptyString(publicUrl)) return invalid("approved image public_url is required")
    if (!publicUrl.startsWith(PRODUCT_IMAGE_PUBLIC_URL_PREFIX)) {
      return invalid("approved image public_url must be a Chaarlie product-images URL")
    }
    if (publicUrl !== imageUrl) {
      return invalid("approved image public_url does not match final.product.image_url")
    }
    if (params.value.storage_bucket !== PRODUCT_IMAGE_BUCKET) {
      return invalid("approved image storage_bucket must be product-images")
    }
    if (!isNonEmptyString(storagePath)) return invalid("approved image storage_path is required")
    if (publicUrl !== `${PRODUCT_IMAGE_PUBLIC_URL_PREFIX}${storagePath}`) {
      return invalid("approved image storage_path does not match public_url")
    }
    if (!isNonEmptyString(params.value.source_page_url)) {
      return invalid("approved image source_page_url is required")
    }
    if (!isOneOf(params.value.source_type, SOURCE_TYPES)) {
      return invalid("approved image source_type is invalid")
    }
    if (!isOneOf(params.value.quality_confidence, QUALITY_CONFIDENCE)) {
      return invalid("approved image quality_confidence is invalid")
    }
    if (!isOneOf(params.value.processing_method, PROCESSING_METHODS)) {
      return invalid("approved image processing_method is invalid")
    }
    if (!isNonEmptyString(params.value.final_file)) {
      return invalid("approved image final_file is required")
    }
    if (
      !isNonEmptyString(params.value.asset_sha256) ||
      !/^[a-f0-9]{64}$/.test(params.value.asset_sha256)
    ) {
      return invalid("approved image asset_sha256 must be a lowercase SHA-256 hex digest")
    }
    if (params.value.user_approved !== true) {
      return invalid("approved image requires user_approved true")
    }
    if (
      (params.value.source_type === "search_result" || params.value.source_type === "unknown") &&
      !isNonEmptyString(params.value.notes)
    ) {
      return invalid("approved image notes are required for search_result or unknown sources")
    }

    return {
      ok: true,
      decision: params.value as ProductIntakeImageFinalizationDecision,
      publicUrl,
      status: "approved_asset",
    }
  }

  if (params.value.status === "no_image_approved_for_now") {
    if (!isOneOf(params.value.reason, NO_IMAGE_REASONS)) {
      return invalid("no-image decision reason is invalid")
    }
    if (!isNonEmptyString(params.value.notes))
      return invalid("no-image decision notes are required")
    if (!isNonEmptyString(params.value.reviewed_by)) {
      return invalid("no-image decision reviewed_by is required")
    }
    if (!isIsoDate(params.value.reviewed_at)) {
      return invalid("no-image decision reviewed_at must be an ISO timestamp")
    }
    if (isNonEmptyString(params.finalProductImageUrl)) {
      return invalid("no-image decision requires final.product.image_url to be empty")
    }

    return {
      ok: true,
      decision: params.value as ProductIntakeImageFinalizationDecision,
      publicUrl: null,
      status: "no_image_approved_for_now",
    }
  }

  return invalid("image finalization status must be approved_asset or no_image_approved_for_now")
}
