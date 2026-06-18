import type { BrandResolutionCatalogInput } from "@/lib/product-identity/brand-resolution"
import type { ProductIntakeCatalog } from "@/lib/product-intake/product-matching"
import type {
  ProductFrequency,
  ProductIntakeCategoryKey,
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

export type ProductIntakeSubmissionRow = {
  id: string
  user_id: string
  user_product_usage_id: string | null
  source: ProductSubmissionSource
  source_conversation_id: string | null
  intake_method: "manual" | "photo"
  category: ProductIntakeCategoryKey
  brand_text: string | null
  product_name_text: string | null
  frequency_range: ProductFrequency
  front_image_path: string | null
  barcode_image_path: string | null
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
    source: ProductSubmissionSource
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
    source: ProductSubmissionSource
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
  findProductSubmission: (id: string, userId: string) => Promise<ProductIntakeSubmissionRow | null>
  insertProductSubmission: (
    row: Partial<ProductIntakeSubmissionRow> & {
      user_id: string
      source: ProductSubmissionSource
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
