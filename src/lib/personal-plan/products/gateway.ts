import type {
  PersonalPlanCategory,
  AnyProposedProductPortfolio,
  Stage3CatalogSearchResult,
  Stage3CategoryCaptureCandidate,
  Stage3CapturedUncoveredRole,
  Stage3CategoryRequirement,
  Stage3AuthoritySnapshotV1,
  Stage3ProductDecision,
  Stage3ProductDraft,
  Stage3RoleAssignment,
} from "./contracts"
import type { Stage3AuthoritySemanticIntent } from "./authority/contracts"
import type { Stage3FitComparison } from "./fit-comparison"

export type Stage3ProductsGatewayErrorCode =
  | "temporarily_unavailable"
  | "invalid_request"
  | "unauthorized"
  | "personal_plan_not_available"
  | "stage_not_ready"
  | "stale_refined_source"
  | "stale_authority_snapshot"
  | "stage3_replacement_candidate_invalid"
  | "revision_conflict"
  | "rate_limited"
  | "completion_not_ready"
  | "unsupported_snapshot_version"
  | "snapshot_too_large"
  | "compensation_pending"
  | "rolled_back"
  | "idempotency_key_reused"

export class Stage3ProductsGatewayError extends Error {
  constructor(
    public readonly code: Stage3ProductsGatewayErrorCode,
    message: string = code,
    public readonly status?: number,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message)
    this.name = "Stage3ProductsGatewayError"
  }
}

export type Stage3ProductsMutation =
  | {
      /** Complete atomic category snapshot; server rehydrates every candidate. */
      type: "replace_capture_category"
      category: PersonalPlanCategory
      refinedNeedVersionId: string
      refinedInputHash: string
      categoryAuthorityVersion: string
      candidates: Stage3CategoryCaptureCandidate[]
      uncoveredRoles: Stage3CapturedUncoveredRole[]
    }
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
  | {
      type: "replace_category_role_assignments"
      category: PersonalPlanCategory
      /** Complete non-empty assignment set for this category; omitted products are cleared. */
      assignments: Stage3RoleAssignment[]
    }
  | {
      type: "finalize_capture_category"
      category: PersonalPlanCategory
      /** Complete assignment set for the category; omitted products are cleared. */
      assignments: Stage3RoleAssignment[]
      /** Complete uncovered-role set for the category; duplicate role entries are collapsed. */
      uncoveredRoles: Stage3CapturedUncoveredRole[]
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
  /** Bounded server-authored fit bundle, keyed by decision subject. */
  fitComparisons?: Stage3FitComparison[]
  /** Ephemeral compact-card projection; never serialized into the draft. */
  catalogThumbnails?: Record<string, string>
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
      portfolio: AnyProposedProductPortfolio
      personalPlanId: string
      refinedVersionId: string
      productPortfolioVersionId: string
      /** Null only when the first Routine was activated directly. */
      routineProposalId: string | null
      next: { stage: 4; href: string }
    }
  | { status: "conflict"; latestDraft: Stage3ProductDraft }
  /** Internal service result; the HTTP gateway converts this to completion_not_ready. */
  | { status: "not_ready"; draft: Stage3ProductDraft }

export type Stage3CompletionReceiptResponse = Extract<
  Stage3CompleteResponse,
  { status: "ready_for_routine" }
>

export type Stage3ProductsGateway = {
  loadOrCreate(input: {
    draftId: string
    userId: string
    personalPlanId: string
    refinedVersionId: string
    repairRoutineVersionId?: string
    requirements: Stage3CategoryRequirement[]
    authoritySnapshot?: Stage3AuthoritySnapshotV1
    /**
     * Stage-3 re-entry after a Stage-2 completion staled this version's draft:
     * discard the stale request and rebuild on the plan's CURRENT refined
     * version instead of dead-ending. Opt-in, because a caller that must plan
     * against exactly the version it names (direct acceptance) has to keep
     * failing closed.
     */
    rebuildOnStaleRefinedVersion?: boolean
  }): Promise<Stage3DraftResponse>
  search(input: {
    /** Owner-bound draft whose signed authority context drives assessment readiness. */
    draftId: string
    category: PersonalPlanCategory
    query: string
    requestToken: number
  }): Promise<Stage3SearchResponse>
  mutate(input: {
    draftId: string
    expectedRevision: number
    mutation: Stage3ProductsMutation
  }): Promise<Stage3MutationResponse>
  resolveDecision?(input: {
    draftId: string
    expectedRevision: number
    intent: Stage3AuthoritySemanticIntent
  }): Promise<Stage3MutationResponse>
  resolveDecisions?(input: {
    draftId: string
    expectedRevision: number
    intents: Stage3AuthoritySemanticIntent[]
  }): Promise<Stage3MutationResponse>
  resolveNeedRevision?(input: {
    draftId: string
    expectedRevision: number
    expectedProposalFingerprint: string
    action: "accept" | "reject"
  }): Promise<Stage3MutationResponse>
  acknowledgeInventoryDisposition?(input: {
    draftId: string
    expectedRevision: number
    dispositionKey: string
  }): Promise<Stage3MutationResponse>
  invalidateForRefinedVersion(input: {
    draftId: string
    refinedVersionId: string
  }): Promise<Stage3DraftResponse>
  loadCompletionReceipt?(input: { draftId: string }): Promise<Stage3CompletionReceiptResponse>
  complete(input: {
    draftId: string
    expectedRevision: number
    /**
     * Direct acceptance only: record the `unrefined_direct_accept` provenance
     * in the SAME transaction that activates the Routine, so a failed write
     * fails the accept instead of silently suppressing the refinement nudge.
     */
    markUnrefinedDirectAccept?: boolean
  }): Promise<Stage3CompleteResponse>
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
