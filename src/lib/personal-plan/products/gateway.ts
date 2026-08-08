import type {
  PersonalPlanCategory,
  ProposedProductPortfolio,
  Stage3CatalogSearchResult,
  Stage3CapturedUncoveredRole,
  Stage3CategoryRequirement,
  Stage3ProductDecision,
  Stage3ProductDraft,
  Stage3RoleAssignment,
} from "./contracts"

export type Stage3ProductsGatewayErrorCode =
  | "temporarily_unavailable"
  | "unsupported_snapshot_version"
  | "snapshot_too_large"
  | "compensation_pending"
  | "rolled_back"
  | "idempotency_key_reused"

export class Stage3ProductsGatewayError extends Error {
  constructor(
    public readonly code: Stage3ProductsGatewayErrorCode,
    message: string = code,
  ) {
    super(message)
    this.name = "Stage3ProductsGatewayError"
  }
}

export type Stage3ProductsMutation =
  | {
      type: "capture_catalog_candidate"
      candidateId: string
      frequencyRange: Stage3ProductDraft["products"][number]["frequencyRange"]
    }
  | {
      type: "capture_pending_submission"
      /** Required by production after the server creates the stable pending identity. */
      userProductId?: string
      submissionId: string
      displayName: string
      category: PersonalPlanCategory
      reviewStatus: "pending_review" | "needs_more_info"
      frequencyRange: Stage3ProductDraft["products"][number]["frequencyRange"]
    }
  | {
      type: "assign_roles"
      capturedProductId: string
      category: PersonalPlanCategory
      roles: Stage3RoleAssignment["roles"]
    }
  | { type: "mark_role_uncovered"; uncoveredRole: Stage3CapturedUncoveredRole }
  | { type: "complete_capture_category"; category: PersonalPlanCategory }
  | { type: "reopen_capture_category"; category: PersonalPlanCategory }
  | { type: "remove_captured_product"; capturedProductId: string }
  | { type: "record_decision"; decision: Stage3ProductDecision }

export type Stage3DraftResponse = {
  status: Stage3ProductDraft["status"]
  draft: Stage3ProductDraft
  /** Server-derived from the immutable refined need; never reconstructed from category policy. */
  requirements: Stage3CategoryRequirement[]
}

export type Stage3SearchResponse = {
  status: "ready"
  requestToken: number
  result: Stage3CatalogSearchResult
}

export type Stage3MutationResponse =
  | { status: "saved"; draft: Stage3ProductDraft }
  | { status: "conflict"; latestDraft: Stage3ProductDraft }

export type Stage3CompleteResponse =
  | {
      status: "ready_for_routine"
      draft: Stage3ProductDraft
      portfolio: ProposedProductPortfolio
      personalPlanId: string
      refinedVersionId: string
      productPortfolioVersionId: string
      routineProposalId: string
      next: { stage: 4; href: string }
    }
  | { status: "conflict"; latestDraft: Stage3ProductDraft }
  | { status: "not_ready"; draft: Stage3ProductDraft }

export type Stage3ProductsGateway = {
  loadOrCreate(input: {
    draftId: string
    userId: string
    personalPlanId: string
    refinedVersionId: string
    requirements: Stage3CategoryRequirement[]
  }): Promise<Stage3DraftResponse>
  search(input: {
    category: PersonalPlanCategory
    query: string
    requestToken: number
  }): Promise<Stage3SearchResponse>
  mutate(input: {
    draftId: string
    expectedRevision: number
    mutation: Stage3ProductsMutation
  }): Promise<Stage3MutationResponse>
  invalidateForRefinedVersion(input: {
    draftId: string
    refinedVersionId: string
  }): Promise<Stage3DraftResponse>
  complete(input: { draftId: string; expectedRevision: number }): Promise<Stage3CompleteResponse>
}

export type Stage3ManualIntakeInput = {
  intake_method: "manual"
  brand_text: string
  product_name_text: string
  frequency_range: Stage3ProductDraft["products"][number]["frequencyRange"]
}

export type Stage3PhotoIntakeInput = {
  intake_method: "photo"
  front_image_path: string
  front_image_validation_status?:
    | "valid_product_front"
    | "uncertain"
    | "not_a_product_photo"
    | "unsafe_or_inappropriate"
  front_image_validation_metadata?: Record<string, unknown>
  barcode_image_path?: string
  barcode_image_validation_status?:
    | "valid_barcode"
    | "uncertain"
    | "not_a_product_photo"
    | "unsafe_or_inappropriate"
  barcode_image_validation_metadata?: Record<string, unknown>
  brand_text?: string
  product_name_text?: string
  frequency_range: Stage3ProductDraft["products"][number]["frequencyRange"]
}

export type Stage3IntakeClientPort = {
  submit(input: {
    draftId: string
    expectedRevision: number
    idempotencyKey: string
    input: Stage3ManualIntakeInput | Stage3PhotoIntakeInput
  }): Promise<{ draft: Stage3ProductDraft }>
}
