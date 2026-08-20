import type { BrandResolutionCatalogInput } from "@/lib/product-identity/brand-resolution"
import type { ProductIntakeCatalog } from "@/lib/product-intake/product-matching"
import type {
  ProductFrequency,
  ProductIntakeCategoryKey,
  ProductIntakeSubmissionSource,
  ProductSubmissionSource,
  ProductUsageMatchStatus,
} from "@/lib/types"

export type JsonRecord = Record<string, unknown>

export type ProductIntakeUsageRow = {
  id: string
  user_id: string
  category: ProductIntakeCategoryKey
  product_name: string | null
  frequency_range: ProductFrequency | null
  brand_text: string | null
  product_id: string | null
  product_submission_id: string | null
  match_status: ProductUsageMatchStatus
  intake_method: "manual" | "photo" | null
  source: "onboarding" | "chat" | "profile" | "script" | null
  front_image_path: string | null
  created_at?: string
  updated_at?: string
}

export type ProductIntakeUserProductRow = {
  id: string
  user_id: string
  category: ProductIntakeCategoryKey
  catalog_product_id: string | null
  brand_text: string | null
  product_name_text: string | null
  identity_status: "matched" | "pending_review" | "needs_more_info" | "text_only"
  ownership_status: "owned" | "archived"
  created_at?: string
  updated_at?: string
}

export type ProductIntakeSubmissionRow = {
  id: string
  user_id: string
  user_product_usage_id: string | null
  user_product_id: string | null
  personal_plan_request_fingerprint?: string | null
  // "scan" is additive to ProductIntakeSubmissionSource (types.ts) rather than folded
  // into that shared type: scan's source only ever reaches product_submissions.source
  // (widened by migration 20260820100000), never user_product_usage.source, which the
  // DB CHECK still restricts to onboarding/chat/profile/script. See submissions.ts's
  // usageSourceForDb for the write-side mapping this keeps safe.
  source: ProductIntakeSubmissionSource | "scan"
  source_conversation_id: string | null
  intake_method: "manual" | "photo"
  category: ProductIntakeCategoryKey
  brand_text: string | null
  product_name_text: string | null
  frequency_range: ProductFrequency
  front_image_path: string | null
  barcode_image_path: string | null
  // Populated only for scan-sourced submissions (migration 20260820100100); both null
  // for onboarding/chat/personal_plan. Value is stored NORMALIZED (normalizeIdentifierValue).
  // Optional (like the other DB-nullable trailing fields below) so existing fixtures/rows
  // built before this column existed don't need updating.
  scanned_identifier_type?: "ean" | "gtin" | "barcode" | null
  scanned_identifier_value?: string | null
  front_image_validation_status:
    | "valid_product_front"
    | "uncertain"
    | "not_a_product_photo"
    | "unsafe_or_inappropriate"
    | null
  front_image_validation_metadata: JsonRecord
  barcode_image_validation_status:
    | "valid_barcode"
    | "uncertain"
    | "not_a_product_photo"
    | "unsafe_or_inappropriate"
    | null
  barcode_image_validation_metadata: JsonRecord
  previous_product_id: string | null
  previous_product_snapshot: JsonRecord
  status:
    | "pending_review"
    | "researching"
    | "ready_for_review"
    | "needs_more_info"
    | "matched_existing"
    | "approved"
    | "rejected"
    | "cancelled_by_user"
  researched_payload: JsonRecord
  intake_history: JsonRecord[]
  approved_product_id: string | null
  reviewed_at?: string | null
  reviewed_by?: string | null
  review_notes?: string | null
  user_facing_resolution_reason?: string | null
  user_facing_next_step?: string | null
  user_facing_missing_fields?: unknown[]
  notification_sent_at?: string | null
  cleanup_after?: string | null
  photos_deleted_at?: string | null
  created_at?: string
  updated_at?: string
}

export type ProductIntakeCatalogEligibilityMode = "general_recommendation" | "intake_dedupe"

export type ProductIntakeCatalogLoadOptions = {
  eligibilityMode?: ProductIntakeCatalogEligibilityMode
}

export type ProductIntakeRepository = {
  loadCatalog: (params?: ProductIntakeCatalogLoadOptions) => Promise<ProductIntakeCatalog>
  loadBrandResolutionCatalog: () => Promise<BrandResolutionCatalogInput>
  findUserProductUsage: (
    userId: string,
    category: ProductIntakeCategoryKey,
  ) => Promise<ProductIntakeUsageRow | null>
  insertUserProductUsage: (
    row: Partial<ProductIntakeUsageRow> & {
      user_id: string
      category: ProductIntakeCategoryKey
      frequency_range: ProductFrequency
    },
  ) => Promise<ProductIntakeUsageRow>
  updateUserProductUsage: (
    id: string,
    patch: Partial<ProductIntakeUsageRow>,
  ) => Promise<ProductIntakeUsageRow>
  deleteUserProductUsage: (id: string) => Promise<void>
  replaceUsageWithMatchedProduct: (params: {
    userId: string
    category: ProductIntakeCategoryKey
    existingUsageId: string | null
    productId: string
    productName: string | null
    frequencyRange: ProductFrequency
    brandText: string | null
    intakeMethod: "manual" | "photo"
    // null covers scan submissions: user_product_usage.source's DB CHECK doesn't allow
    // "scan" (only product_submissions.source was widened), so callers map "scan" -> null
    // before reaching this repository call (see submissions.ts usageSourceForDb).
    source: ProductSubmissionSource | null
    now: string
  }) => Promise<ProductIntakeUsageRow>
  replaceUsageWithPendingSubmission: (params: {
    userId: string
    category: ProductIntakeCategoryKey
    existingUsageId: string | null
    submissionId: string
    productName: string | null
    frequencyRange: ProductFrequency
    brandText: string | null
    intakeMethod: "manual" | "photo"
    source: ProductSubmissionSource | null
    frontImagePath: string | null
    now: string
  }) => Promise<{
    usage: ProductIntakeUsageRow
    submission: ProductIntakeSubmissionRow
  }>
  cancelProductIntakeUsageForCategory: (params: {
    userId: string
    category: ProductIntakeCategoryKey
    now: string
  }) => Promise<{
    category: ProductIntakeCategoryKey
    usage_id: string | null
    submission_id: string | null
  }>
  createSubmissionForUserProduct: (params: {
    userId: string
    userProductId: string
    category: ProductIntakeCategoryKey
    frequencyRange: ProductFrequency
    intakeMethod: "manual" | "photo"
    brandText: string | null
    productNameText: string | null
    frontImagePath: string | null
    barcodeImagePath: string | null
    requestFingerprint: string
    now: string
  }) => Promise<{
    userProduct: ProductIntakeUserProductRow
    submission: ProductIntakeSubmissionRow
    replayed: boolean
  }>
  cancelSubmissionForUserProduct: (params: {
    userId: string
    userProductId: string
    submissionId: string
    now: string
  }) => Promise<{
    userProduct: ProductIntakeUserProductRow
    submission: ProductIntakeSubmissionRow
  }>
  findProductSubmission: (id: string, userId: string) => Promise<ProductIntakeSubmissionRow | null>
  insertProductSubmission: (
    row: Partial<ProductIntakeSubmissionRow> & {
      user_id: string
      source: ProductSubmissionSource | "scan"
      intake_method: "manual" | "photo"
      category: ProductIntakeCategoryKey
      frequency_range: ProductFrequency
    },
  ) => Promise<ProductIntakeSubmissionRow>
  updateProductSubmission: (
    id: string,
    patch: Partial<ProductIntakeSubmissionRow>,
  ) => Promise<ProductIntakeSubmissionRow>
  deleteProductSubmission: (id: string) => Promise<void>
  verifyUploadedImage: (params: {
    sourcePath: string
    userId: string
    kind: "front" | "barcode"
  }) => Promise<boolean>
  commitUploadedImage: (params: {
    sourcePath: string
    userId: string
    submissionId: string
    kind: "front" | "barcode"
  }) => Promise<string>
  removeCommittedImages: (paths: readonly string[]) => Promise<void>
  verifyConversationOwnership: (conversationId: string, userId: string) => Promise<boolean>
}
