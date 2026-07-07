import type {
  HairProfile,
  Product,
  ProductIntakeMethod,
  ProductSubmissionStatus,
  ProductUsageMatchStatus,
  ProductUsageSource,
} from "@/lib/types"
import type { CareBalanceFrequencyTarget, CareBalanceRow } from "@/lib/recommendation-engine/types"
import type { RecommendationEngineRuntime } from "@/lib/recommendation-engine/runtime"
import type { ProductFrequencyInput } from "@/lib/vocabulary"

export type RoutineCardKind =
  | "verified_matches"
  | "verified_swap"
  | "verified_unnecessary"
  | "verified_more_freq"
  | "pending"
  | "suggestion"

export type RoutineCardTone = "green" | "yellow" | "neutral"

type NullableRelation<T> = T | T[] | null

export type RoutineArtifactBrandIdentity = {
  id: string
  canonical_name: string | null
}

export type RoutineArtifactProductLine = {
  id: string
  canonical_name: string | null
}

export type RoutineArtifactProduct = Partial<Product> &
  Pick<
    Product,
    | "id"
    | "name"
    | "brand"
    | "category"
    | "affiliate_link"
    | "image_url"
    | "price_eur"
    | "currency"
    | "is_active"
  > & {
    product_line_id?: string | null
    product_line_name?: string | null
    lifecycle_status?: Product["lifecycle_status"] | null
    is_chaarlie_recommended?: boolean | null
    brand_identity?: NullableRelation<RoutineArtifactBrandIdentity>
    product_line?: NullableRelation<RoutineArtifactProductLine>
  }

export type RoutineArtifactUsageRow = {
  id: string
  user_id: string
  category: string
  brand_text: string | null
  product_name: string | null
  frequency_range: ProductFrequencyInput | string | null
  product_id: string | null
  product_submission_id: string | null
  match_status: ProductUsageMatchStatus | null
  intake_method: ProductIntakeMethod | null
  source: ProductUsageSource | null
  front_image_path: string | null
  created_at: string
  updated_at: string
  product: RoutineArtifactProduct | RoutineArtifactProduct[] | null
}

export type RoutineArtifactPendingSubmission = {
  id: string
  status: ProductSubmissionStatus
  user_facing_resolution_reason: string | null
  user_facing_next_step: string | null
  user_facing_missing_fields: string[]
  front_image_path: string | null
  created_at: string
}

export type RoutineArtifactData = {
  userId: string
  hairProfile: HairProfile | null
  usageRows: RoutineArtifactUsageRow[]
  pendingSubmissionsById: Map<string, RoutineArtifactPendingSubmission>
  activeDismissedCategories: Set<string>
  runtime: RecommendationEngineRuntime
}

export type RoutineUiCard = {
  id: string
  kind: RoutineCardKind
  tone: RoutineCardTone
  category: string
  categoryLabel: string
  productName: string | null
  currentFrequency: CareBalanceRow["currentFrequency"] | null
  frequencyTarget: CareBalanceFrequencyTarget | null
  careBalanceRow: CareBalanceRow | null
  usageRow: RoutineArtifactUsageRow | null
  product: RoutineArtifactProduct | null
  pendingSubmission: RoutineArtifactPendingSubmission | null
  hasProductDrawer: boolean
  isLegacyTextOnly: boolean
  isTopProposal: boolean
}

export type RoutineUiShape = {
  hairProfile: HairProfile | null
  cards: RoutineUiCard[]
}
