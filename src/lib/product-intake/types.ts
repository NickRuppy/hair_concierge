import type {
  ProductFrequency,
  ProductIntakeCategoryKey,
  ProductIntakeMethod,
  ProductSubmissionSource,
  ProductUsageMatchStatus,
} from "@/lib/types"
import type { ProductIntakeMatchResult } from "@/lib/product-intake/product-matching"

export type ProductIntakeSubmissionStatus = "matched" | "pending_review"

export type ProductIntakeSubmittedUsage = {
  id: string
  category: ProductIntakeCategoryKey
  product_id: string | null
  product_submission_id: string | null
  match_status: ProductUsageMatchStatus
  front_image_path: string | null
}

export type ProductIntakeSubmittedSubmission = {
  id: string
  status: "pending_review"
  category: ProductIntakeCategoryKey
}

export type ProductIntakeSubmissionResult = {
  status: ProductIntakeSubmissionStatus
  source: ProductSubmissionSource
  intake_method: ProductIntakeMethod
  category: ProductIntakeCategoryKey
  frequency_range: ProductFrequency
  usage: ProductIntakeSubmittedUsage
  submission: ProductIntakeSubmittedSubmission | null
  matched_product_id: string | null
  match: ProductIntakeMatchResult
}

export type ProductIntakeConflict = {
  code: "product_category_already_filled"
  message: string
  category: ProductIntakeCategoryKey
  existing_usage_id: string
}
