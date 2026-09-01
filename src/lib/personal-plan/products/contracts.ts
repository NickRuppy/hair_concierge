import { z } from "zod"

import type {
  InitialNeedPlanSnapshot,
  PlanCategoryDecision,
  PlanHeatToolRoute,
  PlanProfile,
  PlanPortfolioCoverageFact,
  PlanProductRole,
} from "@/lib/personal-plan/types"
import { PRODUCT_FREQUENCIES, type ProductFrequency } from "@/lib/vocabulary/frequencies"
import {
  allowsMultipleProductsForRole,
  getCategoryRolePolicy,
  roleAllowedForCategory,
} from "./authorities"
import type { Stage3AuthorityActionKind } from "./authority/contracts"

export const PERSONAL_PLAN_PRODUCT_CATEGORIES = [
  "shampoo",
  "conditioner",
  "leave_in",
  "heat_protectant",
  "oil",
  "mask",
  "scalp_care",
  "dry_shampoo",
  "bondbuilder",
  "deep_cleansing_shampoo",
] as const

export type PersonalPlanCategory = (typeof PERSONAL_PLAN_PRODUCT_CATEGORIES)[number]

export const STAGE3_HEAT_QUALIFYING_ROUTES = [
  "airflow_shaping",
  "direct_contact_heat",
] as const satisfies readonly Extract<
  PlanHeatToolRoute,
  "airflow_shaping" | "direct_contact_heat"
>[]
export type Stage3HeatQualifyingRoute = (typeof STAGE3_HEAT_QUALIFYING_ROUTES)[number]

export const PLAN_PRODUCT_ROLES = [
  "shampoo_everyday",
  "shampoo_dandruff",
  "conditioner_rinse_out",
  "post_wash_leave_in",
  "pre_heat_application",
  "intensive_conditioning_mask",
  "pre_wash_fibre_treatment",
  "leave_on_fibre_conditioning",
  "dry_finish",
  "residue_reset",
  "mineral_reset",
  "root_refresh_bridge",
  "pre_heat_protection",
  "specialized_bond_treatment",
  "scalp_comfort",
  "scalp_flake_oil_adjunct",
  "density_claim_tonic",
  "scalp_exfoliant",
] as const satisfies readonly PlanProductRole[]

export const STAGE3_PASS_VALUES = [
  "product_capture",
  "need_revision_review",
  "product_decisions",
  "ready_for_routine",
] as const
export type Stage3Pass = (typeof STAGE3_PASS_VALUES)[number]

export const STAGE3_DRAFT_STATUS_VALUES = ["active", "stale", "completed"] as const
export type Stage3DraftStatus = (typeof STAGE3_DRAFT_STATUS_VALUES)[number]

export const STAGE3_FIT_VERDICTS = ["ideal", "supportive", "mismatch", "unknown"] as const
export type Stage3FitVerdict = (typeof STAGE3_FIT_VERDICTS)[number]

/**
 * Why a role was left uncovered by a SERVER-derived `leave_uncovered` decision.
 *
 * - `refinement_required` — the role never reached the person: the Idealplan
 *   previewed no card for it (a deferred Stage-1 decision the synthetic
 *   refinement defaults materialized), so its product choice belongs to the
 *   refinement, not to a silent purchase.
 * - `no_product` — the role WAS previewed and the engine has no buyable
 *   recommendation for it either: a genuine product gap.
 * - `preview_unavailable` — the role was previewable AND the engine DOES have a
 *   buyable recommendation, but the Idealplan could not present it (missing
 *   packshot, fact-fingerprint churn, verdict gating), so the person never saw
 *   and never echoed it. Nothing may be bought for it, but the plan must not
 *   claim a product gap that does not exist.
 *
 * Only the server writes this: it is derived from the plan's own preview and
 * evaluation state, never from a client payload.
 */
export const STAGE3_DECISION_DEFERRAL_REASONS = [
  "refinement_required",
  "no_product",
  "preview_unavailable",
] as const
export type Stage3DecisionDeferralReason = (typeof STAGE3_DECISION_DEFERRAL_REASONS)[number]

export const STAGE3_CHOICE_STATES = [
  "owned_active",
  "owned_override",
  "planned_purchase",
  "pending_review",
  "inactive",
  "unassigned",
] as const
export type Stage3ChoiceState = (typeof STAGE3_CHOICE_STATES)[number]

export const personalPlanCategorySchema = z.enum(PERSONAL_PLAN_PRODUCT_CATEGORIES)
export const planProductRoleSchema = z.enum(PLAN_PRODUCT_ROLES)
export const productFrequencySchema = z.enum(PRODUCT_FREQUENCIES)

export type Stage3EntryContext = {
  schemaVersion: 1
  personalPlanId: string
  refinedVersionId: string
  orderedCategories: Stage3CategoryRequirement[]
  inventoryPrompts: Stage3InventoryPrompt[]
  /** Required on production entry; optional only for legacy fixture callers. */
  authoritySnapshot?: Stage3AuthoritySnapshotV1
}

export type Stage3AuthoritySnapshotV1 = {
  schemaVersion: 1
  refinedNeedVersionId: string
  refinedInputHash: string
  productLoadContext?: Stage3ProductLoadContextV1
  categoryDecisions: PlanCategoryDecision[]
  coverage: PlanPortfolioCoverageFact[]
  orderedCategories: PersonalPlanCategory[]
  inventoryOnlyCategories?: PersonalPlanCategory[]
  authorityVersions: Record<PersonalPlanCategory, string>
}

export type Stage3ProductLoadContextV1 = {
  schemaVersion: 1
  scalpOiliness: PlanProfile["scalp"]["oiliness"]
  deepCleansingScalpPause: boolean
  hasLowVolumeOrWeighedDown: boolean
  shampooFrequency: ProductFrequency | "does_not_wash" | null
  oilPurposes: Array<"prewash_lengths" | "damp_leave_on" | "dry_finish" | "scalp">
  ownedCategories?: PersonalPlanCategory[]
}

export type Stage3ProductLoadResolutionV1 = {
  schemaVersion: 1
  refinedNeedVersionId: string
  refinedInputHash: string
  capturedFrequencyFingerprint: string
  authorityVersions: Partial<
    Record<Extract<PersonalPlanCategory, "deep_cleansing_shampoo" | "scalp_care">, string>
  >
  requirements: Stage3CategoryRequirement[]
  decisions: PlanCategoryDecision[]
  coverage: PlanPortfolioCoverageFact[]
}

export type Stage3NeedMaterialDelta =
  | {
      kind: "category_added" | "category_removed"
      category: PersonalPlanCategory
      before: PlanCategoryDecision["needTier"] | null
      after: PlanCategoryDecision["needTier"] | null
    }
  | {
      kind: "category_order_changed"
      category: PersonalPlanCategory
      before: number | null
      after: number | null
    }
  | {
      kind: "need_tier_changed" | "roles_changed" | "frequency_changed" | "execution_changed"
      category: PersonalPlanCategory
      before: unknown
      after: unknown
    }

export type Stage3InventoryAuthorityV1 = {
  schemaVersion: 1
  stage2RefinedNeedVersionId: string
  inventorySnapshotFingerprint: string
  status: "not_needed" | "pending" | "accepted" | "rejected"
  proposalFingerprint: string | null
  proposedInputHash: string | null
  proposedOutputSnapshot: InitialNeedPlanSnapshot | null
  materialDelta: Stage3NeedMaterialDelta[]
  resolvedFingerprint: string | null
}

export type Stage3InventoryDispositionV1 = {
  schemaVersion: 1
  dispositionKey: string
  capturedProductId: string
  category: PersonalPlanCategory
  planStatus: "not_used"
  reason: "category_not_in_final_plan" | "not_assigned_to_final_role"
  acknowledged: boolean
  authorityFingerprint: string
}

export type Stage3CategoryRequirement = {
  category: PersonalPlanCategory
  requiredRoles: PlanProductRole[]
  qualifyingRoutes?: Stage3HeatQualifyingRoute[]
  needSummary: string
  authorityVersion: string
}

export type Stage3InventoryPrompt = {
  category: PersonalPlanCategory
  allowsMultiple: boolean
  allowsExplicitNone: true
}

export type Stage3CatalogCandidate = {
  candidateId: string
  productId: string
  displayName: string
  category: PersonalPlanCategory
  brandName: string | null
  imageUrl?: string | null
  /** Ephemeral compact-card projection; never persisted in product identity. */
  thumbnailImageUrl?: string | null
  confidence: "exact" | "likely" | "category_mismatch"
  /** Present for the production assessment-search projection. */
  assessmentStatus?: "ready" | "pending_analysis"
  /** Bounded, non-diagnostic reasons for a temporary pending state. */
  assessmentReasonCodes?: Array<"missing_required_spec" | "missing_application_protocol">
}

export type Stage3CatalogSearchResult = {
  query: string
  category: PersonalPlanCategory
  candidates: Stage3CatalogCandidate[]
  totalCapped: boolean
}

export type Stage3CriterionResult = {
  criterionId: string
  label: string
  result: "pass" | "caution" | "fail" | "unknown"
  explanation: string
}

export type Stage3Recommendation = {
  recommendationId: string
  productId: string
  category: PersonalPlanCategory
  role: PlanProductRole | null
  displayName: string
  reason: string
  authorityRuleId: string
}

export type Stage3ProductIdentity =
  | {
      kind: "catalog_product"
      productId: string
      displayName: string
      category: PersonalPlanCategory
      imageUrl?: string | null
    }
  | {
      kind: "pending_submission"
      submissionId: string
      displayName: string
      category: PersonalPlanCategory
      reviewStatus: "pending_review" | "needs_more_info"
      imageUrl?: string | null
    }

export type Stage3CapturedProduct = {
  capturedProductId: string
  userProductId: string
  identity: Stage3ProductIdentity
  frequencyRange: ProductFrequency
  ownership: "owned"
  source: "catalog_search" | "intake_fallback" | "existing_inventory"
}

export type Stage3LegacyPrefillProductHint =
  | {
      kind: "catalog_frequency_required"
      usageId: string
      productId: string
      displayName: string
      category: PersonalPlanCategory
    }
  | {
      kind: "search_name"
      usageId: string
      category: PersonalPlanCategory
      productName: string
    }

export type Stage3LegacyPrefillHintsV1 = {
  schemaVersion: 1
  sourceFingerprint: string
  categories: Partial<Record<PersonalPlanCategory, Stage3LegacyPrefillProductHint[]>>
}

export type Stage3RoleAssignment = {
  capturedProductId: string
  category: PersonalPlanCategory
  roles: PlanProductRole[]
}

export type Stage3CapturedUncoveredRole = {
  category: PersonalPlanCategory
  role: PlanProductRole
  reason: "no_product_owned" | "not_ready_to_decide"
}

/** Identifier-only capture input. Server rehydrates display identity before persistence. */
export type Stage3CategoryCaptureCandidate =
  | {
      kind: "catalog"
      candidateId: string
      frequencyRange: ProductFrequency
      roles: PlanProductRole[]
    }
  | {
      kind: "pending"
      userProductId: string
      submissionId: string
      frequencyRange: ProductFrequency
      roles: PlanProductRole[]
    }

export type Stage3DecisionSubject = {
  decisionKey: string
  category: PersonalPlanCategory
  role: PlanProductRole
  capturedProductId: string | null
  subjectKind: "captured_product" | "uncovered_role" | "inventory_disposition"
}

export type Stage3ProductDecision = {
  decisionKey: string
  category: PersonalPlanCategory
  role: PlanProductRole | null
  capturedProductId: string | null
  verdict: Stage3FitVerdict
  choiceState: Stage3ChoiceState
  criterionResults: Stage3CriterionResult[]
  recommendation: Stage3Recommendation | null
  limitationAcknowledged: boolean
  /** The authority action that produced this decision, retained for replay. */
  resolutionAction?: Stage3AuthorityActionKind
  /** Server-derived reason for a `leave_uncovered` decision. Never client-set. */
  deferralReason?: Stage3DecisionDeferralReason
  authorityEvidence?: Stage3DecisionAuthorityEvidenceV1
}

export type Stage3DecisionAuthorityEvidenceV1 = {
  schemaVersion: 1
  subjectKey: string
  refinedNeedVersionId: string
  refinedInputHash: string
  authorityVersion: string
  productFactFingerprint: string | null
  recommendationFactFingerprint: string | null
  coverageRuleIds: string[]
}

export type Stage3ProductDraft = {
  schemaVersion: 1
  status: Stage3DraftStatus
  authorityVersions: Partial<Record<PersonalPlanCategory, string>>
  draftId: string
  userId: string
  personalPlanId: string
  refinedVersionId: string
  staleRefinedVersionId: string | null
  revision: number
  pass: Stage3Pass
  orderedCategories: PersonalPlanCategory[]
  categoryCursor: string | null
  products: Stage3CapturedProduct[]
  roleAssignments: Stage3RoleAssignment[]
  uncoveredRoles: Stage3CapturedUncoveredRole[]
  decisions: Stage3ProductDecision[]
  completedCaptureCategories: PersonalPlanCategory[]
  completedDecisionKeys: string[]
  createdAt: string
  updatedAt: string
  authoritySnapshot?: Stage3AuthoritySnapshotV1
  inventoryAuthority?: Stage3InventoryAuthorityV1
  inventoryDispositions?: Stage3InventoryDispositionV1[]
  /** Frozen legacy authority overlay. New capture transitions must not write this. */
  productLoadResolution?: Stage3ProductLoadResolutionV1
  /**
   * UI-only one-time migration hints for legacy inventory rows that were not safe
   * to capture automatically. Exact imports remain normal `existing_inventory`
   * products; this overlay must not create intake submissions by itself.
   */
  legacyPrefillHints?: Stage3LegacyPrefillHintsV1
}

/** Minimal canonical draft shape required to validate persisted Stage 3 authority. */
export type Stage3AuthorityDraftInput = Pick<
  Stage3ProductDraft,
  | "refinedVersionId"
  | "orderedCategories"
  | "authorityVersions"
  | "authoritySnapshot"
  | "inventoryAuthority"
  | "inventoryDispositions"
  | "productLoadResolution"
  | "products"
  | "roleAssignments"
>

export type Stage3CategoryProgress = {
  category: PersonalPlanCategory
  capturedCount: number
  completedCapture: boolean
  completedDecisions: boolean
  uncoveredRoles: PlanProductRole[]
}

export type Stage3BlockingReason = {
  code:
    | "capture_incomplete"
    | "role_uncovered"
    | "decision_incomplete"
    | "draft_invalid"
    | "need_revision_pending"
    | "inventory_clarification_required"
    | "inventory_disposition_unacknowledged"
    | "stale_refined_version"
  category: PersonalPlanCategory | null
  role: PlanProductRole | null
  message: string
}

export type Stage3PathState = {
  pass: Stage3Pass
  orderedStepKeys: string[]
  completedStepKeys: string[]
  firstUnresolvedStepKey: string | null
  categorySummaries: Stage3CategoryProgress[]
  canCompleteCapture: boolean
  canCreatePortfolio: boolean
  blockingReasons: Stage3BlockingReason[]
}

export type Stage3CategoryResolution = {
  decisionKey: string
  category: PersonalPlanCategory
  role: PlanProductRole | null
  verdict: Stage3FitVerdict
  choiceState: Stage3ChoiceState
  capturedProductId: string | null
  executable: boolean
  gapPreserved: boolean
}

export type Stage3OwnedProduct = {
  capturedProductId: string
  userProductId: string
  productId: string
  displayName: string
  category: PersonalPlanCategory
  role: PlanProductRole | null
  // Stage 4 may turn an exact planned purchase into owned inventory before the
  // person has reported how often they use it. Recommended Routine cadence is
  // kept separately and must not be written back as observed usage.
  frequencyRange: ProductFrequency | null
  choiceState: "owned_active" | "owned_override"
  sourceDecisionKey: string
}

export type Stage3PlannedPurchase = {
  plannedPurchaseId: string
  /** Present only in schema-v3 snapshots; v1/v2 use category/role identity. */
  sourceDecisionKey?: string
  category: PersonalPlanCategory
  role: PlanProductRole | null
  recommendationId: string
  productId: string
  displayName: string
  reason: string
  authorityRuleId: string
}

export type Stage3RetainedOwnedProduct = {
  capturedProductId: string
  userProductId: string
  productId: string
  displayName: string
  category: PersonalPlanCategory
  role: PlanProductRole | null
  sourceDecisionKey: string
  planStatus: "not_used"
}

export type Stage3RetainedInventoryProduct =
  | {
      kind: "catalog_product"
      capturedProductId: string
      userProductId: string
      productId: string
      displayName: string
      category: PersonalPlanCategory
      role: null
      sourceDispositionKey: string
      planStatus: "not_used"
      reason: Stage3InventoryDispositionV1["reason"]
    }
  | {
      kind: "pending_submission"
      capturedProductId: string
      userProductId: string
      submissionId: string
      displayName: string
      category: PersonalPlanCategory
      role: null
      reviewStatus: "pending_review" | "needs_more_info"
      sourceDispositionKey: string
      planStatus: "not_used"
      reason: Stage3InventoryDispositionV1["reason"]
    }

export type Stage3PendingProduct = {
  capturedProductId: string
  userProductId: string
  submissionId: string
  category: PersonalPlanCategory
  role: PlanProductRole | null
  displayName: string
  reviewStatus: "pending_review" | "needs_more_info"
}

export type Stage3UncoveredRole = {
  category: PersonalPlanCategory
  role: PlanProductRole | null
  reason:
    | "planned_purchase_not_acquired"
    | "pending_review"
    | "inactive"
    | "unassigned"
    | "no_product_owned"
    | "not_ready_to_decide"
  linkedDecisionKey: string
  /**
   * Present only for a server-derived deferral (see
   * `STAGE3_DECISION_DEFERRAL_REASONS`). It is the read surface downstream
   * placeholder copy keys off; `reason` above stays the capture-level fact.
   */
  deferralReason?: Stage3DecisionDeferralReason
}

export type ProposedProductPortfolio = {
  schemaVersion: 1 | 2 | 3
  portfolioVersionId: string
  personalPlanId: string
  refinedVersionId: string
  sourceDraftRevision: number
  categoryResolutions: Stage3CategoryResolution[]
  ownedProducts: Stage3OwnedProduct[]
  plannedPurchases: Stage3PlannedPurchase[]
  pendingProducts: Stage3PendingProduct[]
  uncoveredRoles: Stage3UncoveredRole[]
  productLoadResolution?: Stage3ProductLoadResolutionV1
  /** Schema-v3 presentation data. Routine intentionally does not consume it. */
  retainedOwnedProducts?: Stage3RetainedOwnedProduct[]
  createdAt: string
}

export type ProposedProductPortfolioV4 = Omit<
  ProposedProductPortfolio,
  "schemaVersion" | "retainedOwnedProducts"
> & {
  schemaVersion: 4
  retainedOwnedProducts: Stage3RetainedOwnedProduct[]
  /** Schema-v4 presentation data. Routine intentionally does not consume it. */
  inventoryDispositions: Stage3InventoryDispositionV1[]
  retainedInventoryProducts: Stage3RetainedInventoryProduct[]
}

export type AnyProposedProductPortfolio = ProposedProductPortfolio | ProposedProductPortfolioV4

const idSchema = z.string().min(1)

export const stage3CriterionResultSchema: z.ZodType<Stage3CriterionResult> = z.object({
  criterionId: idSchema,
  label: z.string().min(1),
  result: z.enum(["pass", "caution", "fail", "unknown"]),
  explanation: z.string().min(1),
})

export const stage3RecommendationSchema: z.ZodType<Stage3Recommendation> = z.object({
  recommendationId: idSchema,
  productId: idSchema,
  category: personalPlanCategorySchema,
  role: planProductRoleSchema.nullable(),
  displayName: z.string().min(1),
  reason: z.string().min(1),
  authorityRuleId: idSchema,
})

export const stage3ProductIdentitySchema: z.ZodType<Stage3ProductIdentity> = z.discriminatedUnion(
  "kind",
  [
    z.object({
      kind: z.literal("catalog_product"),
      productId: idSchema,
      displayName: z.string().min(1),
      category: personalPlanCategorySchema,
      imageUrl: z.string().url().nullable().optional(),
    }),
    z.object({
      kind: z.literal("pending_submission"),
      submissionId: idSchema,
      displayName: z.string().min(1),
      category: personalPlanCategorySchema,
      reviewStatus: z.enum(["pending_review", "needs_more_info"]),
      imageUrl: z.string().url().nullable().optional(),
    }),
  ],
)

export const stage3CapturedProductSchema: z.ZodType<Stage3CapturedProduct> = z.object({
  capturedProductId: idSchema,
  userProductId: idSchema,
  identity: stage3ProductIdentitySchema,
  frequencyRange: productFrequencySchema,
  ownership: z.literal("owned"),
  source: z.enum(["catalog_search", "intake_fallback", "existing_inventory"]),
})

const stage3LegacyPrefillProductHintSchema: z.ZodType<Stage3LegacyPrefillProductHint> =
  z.discriminatedUnion("kind", [
    z
      .object({
        kind: z.literal("catalog_frequency_required"),
        usageId: idSchema,
        productId: idSchema,
        displayName: z.string().min(1),
        category: personalPlanCategorySchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("search_name"),
        usageId: idSchema,
        category: personalPlanCategorySchema,
        productName: z.string().min(1),
      })
      .strict(),
  ])

const legacyPrefillHintCategoriesSchema = z
  .object({
    shampoo: z.array(stage3LegacyPrefillProductHintSchema).optional(),
    conditioner: z.array(stage3LegacyPrefillProductHintSchema).optional(),
    leave_in: z.array(stage3LegacyPrefillProductHintSchema).optional(),
    heat_protectant: z.array(stage3LegacyPrefillProductHintSchema).optional(),
    oil: z.array(stage3LegacyPrefillProductHintSchema).optional(),
    mask: z.array(stage3LegacyPrefillProductHintSchema).optional(),
    scalp_care: z.array(stage3LegacyPrefillProductHintSchema).optional(),
    dry_shampoo: z.array(stage3LegacyPrefillProductHintSchema).optional(),
    bondbuilder: z.array(stage3LegacyPrefillProductHintSchema).optional(),
    deep_cleansing_shampoo: z.array(stage3LegacyPrefillProductHintSchema).optional(),
  })
  .strict()
  .superRefine((categories, ctx) => {
    for (const [category, hints] of Object.entries(categories)) {
      for (const [index, hint] of (hints ?? []).entries()) {
        if (hint.category !== category) {
          ctx.addIssue({
            code: "custom",
            message: `legacy prefill hint category ${hint.category} does not match ${category}`,
            path: [category, index, "category"],
          })
        }
      }
    }
  }) as z.ZodType<Stage3LegacyPrefillHintsV1["categories"]>

export const stage3LegacyPrefillHintsSchema: z.ZodType<Stage3LegacyPrefillHintsV1> = z
  .object({
    schemaVersion: z.literal(1),
    sourceFingerprint: idSchema,
    categories: legacyPrefillHintCategoriesSchema,
  })
  .strict()

export const stage3RoleAssignmentSchema: z.ZodType<Stage3RoleAssignment> = z
  .object({
    capturedProductId: idSchema,
    category: personalPlanCategorySchema,
    roles: z.array(planProductRoleSchema).min(1),
  })
  .superRefine((assignment, ctx) => {
    for (const role of assignment.roles) {
      if (!roleAllowedForCategory(assignment.category, role)) {
        ctx.addIssue({
          code: "custom",
          message: `role ${role} is not allowed for category ${assignment.category}`,
          path: ["roles"],
        })
      }
    }
  })

export const stage3CapturedUncoveredRoleSchema: z.ZodType<Stage3CapturedUncoveredRole> = z
  .object({
    category: personalPlanCategorySchema,
    role: planProductRoleSchema,
    reason: z.enum(["no_product_owned", "not_ready_to_decide"]),
  })
  .superRefine((uncoveredRole, ctx) => {
    if (!roleAllowedForCategory(uncoveredRole.category, uncoveredRole.role)) {
      ctx.addIssue({
        code: "custom",
        message: `role ${uncoveredRole.role} is not allowed for category ${uncoveredRole.category}`,
        path: ["role"],
      })
    }
  })

export const stage3ProductDecisionSchema: z.ZodType<Stage3ProductDecision> = z
  .object({
    decisionKey: idSchema,
    category: personalPlanCategorySchema,
    role: planProductRoleSchema.nullable(),
    capturedProductId: idSchema.nullable(),
    verdict: z.enum(STAGE3_FIT_VERDICTS),
    choiceState: z.enum(STAGE3_CHOICE_STATES),
    criterionResults: z.array(stage3CriterionResultSchema),
    recommendation: stage3RecommendationSchema.nullable(),
    limitationAcknowledged: z.boolean(),
    resolutionAction: z
      .enum([
        "keep_owned",
        "acknowledge_override",
        "plan_recommendation",
        "select_replacement",
        "keep_pending",
        "leave_uncovered",
      ])
      .optional(),
    deferralReason: z.enum(STAGE3_DECISION_DEFERRAL_REASONS).optional(),
    authorityEvidence: z
      .object({
        schemaVersion: z.literal(1),
        subjectKey: idSchema,
        refinedNeedVersionId: idSchema,
        refinedInputHash: idSchema,
        authorityVersion: idSchema,
        productFactFingerprint: idSchema.nullable(),
        recommendationFactFingerprint: idSchema.nullable(),
        coverageRuleIds: z.array(idSchema),
      })
      .optional(),
  })
  .superRefine((decision, ctx) => {
    if (decision.role && !roleAllowedForCategory(decision.category, decision.role)) {
      ctx.addIssue({
        code: "custom",
        message: `role ${decision.role} is not allowed for category ${decision.category}`,
        path: ["role"],
      })
    }
    if (decision.choiceState === "owned_active") {
      if (decision.verdict === "unknown" || decision.verdict === "mismatch") {
        ctx.addIssue({
          code: "custom",
          message: "owned_active requires an ideal or supportive verdict",
          path: ["choiceState"],
        })
      }
      if (!decision.capturedProductId) {
        ctx.addIssue({
          code: "custom",
          message: "owned_active requires a captured product",
          path: ["capturedProductId"],
        })
      }
    }
    if (decision.choiceState === "owned_override") {
      if (!decision.capturedProductId) {
        ctx.addIssue({
          code: "custom",
          message: "owned_override requires a captured product",
          path: ["capturedProductId"],
        })
      }
      if (decision.verdict === "mismatch" && !decision.limitationAcknowledged) {
        ctx.addIssue({
          code: "custom",
          message: "owned_override on a mismatch requires visible limitation acknowledgement",
          path: ["limitationAcknowledged"],
        })
      }
      if (decision.verdict === "unknown") {
        ctx.addIssue({
          code: "custom",
          message: "unknown verdict cannot be overridden as owned",
          path: ["verdict"],
        })
      }
    }
    if (decision.choiceState === "planned_purchase" && !decision.recommendation) {
      ctx.addIssue({
        code: "custom",
        message: "planned_purchase requires a recommendation",
        path: ["recommendation"],
      })
    }
    if (decision.deferralReason && decision.choiceState !== "unassigned") {
      ctx.addIssue({
        code: "custom",
        message: "a deferral reason is only valid for an uncovered decision",
        path: ["deferralReason"],
      })
    }
    if (decision.choiceState === "pending_review" && decision.verdict !== "unknown") {
      ctx.addIssue({
        code: "custom",
        message: "pending_review requires unknown verdict",
        path: ["verdict"],
      })
    }
  })

export const stage3CategoryRequirementSchema: z.ZodType<Stage3CategoryRequirement> = z
  .object({
    category: personalPlanCategorySchema,
    requiredRoles: z.array(planProductRoleSchema),
    qualifyingRoutes: z.array(z.enum(STAGE3_HEAT_QUALIFYING_ROUTES)).min(1).optional(),
    needSummary: z.string().min(1),
    authorityVersion: idSchema,
  })
  .superRefine((requirement, context) => {
    const policy = getCategoryRolePolicy(requirement.category)
    if (requirement.authorityVersion !== policy.authorityVersion) {
      context.addIssue({
        code: "custom",
        message: `authority version does not match category ${requirement.category}`,
        path: ["authorityVersion"],
      })
    }
    if (new Set(requirement.requiredRoles).size !== requirement.requiredRoles.length) {
      context.addIssue({
        code: "custom",
        message: "required roles must be unique",
        path: ["requiredRoles"],
      })
    }
    const requiresHeatProtection = requirement.requiredRoles.includes("pre_heat_protection")
    if (
      requirement.category === "heat_protectant" &&
      requiresHeatProtection &&
      !requirement.qualifyingRoutes
    ) {
      context.addIssue({
        code: "custom",
        message: "heat protectant requires qualifying route metadata",
        path: ["qualifyingRoutes"],
      })
    }
    if (
      requirement.category === "heat_protectant" &&
      !requiresHeatProtection &&
      requirement.qualifyingRoutes
    ) {
      context.addIssue({
        code: "custom",
        message: "heat protectant without a required role cannot carry qualifying routes",
        path: ["qualifyingRoutes"],
      })
    }
    if (requirement.category !== "heat_protectant" && requirement.qualifyingRoutes) {
      context.addIssue({
        code: "custom",
        message: `qualifying routes are not allowed for category ${requirement.category}`,
        path: ["qualifyingRoutes"],
      })
    }
    if (
      requirement.qualifyingRoutes &&
      new Set(requirement.qualifyingRoutes).size !== requirement.qualifyingRoutes.length
    ) {
      context.addIssue({
        code: "custom",
        message: "qualifying routes must be unique",
        path: ["qualifyingRoutes"],
      })
    }
    for (const role of requirement.requiredRoles) {
      if (!roleAllowedForCategory(requirement.category, role)) {
        context.addIssue({
          code: "custom",
          message: `role ${role} is not allowed for category ${requirement.category}`,
          path: ["requiredRoles"],
        })
      }
    }
  })

const authorityVersionsSchema = z
  .object({
    shampoo: z.string().optional(),
    conditioner: z.string().optional(),
    leave_in: z.string().optional(),
    heat_protectant: z.string().optional(),
    oil: z.string().optional(),
    mask: z.string().optional(),
    scalp_care: z.string().optional(),
    dry_shampoo: z.string().optional(),
    bondbuilder: z.string().optional(),
    deep_cleansing_shampoo: z.string().optional(),
  })
  .strict()

const stage3ProductLoadContextSchema: z.ZodType<Stage3ProductLoadContextV1> = z
  .object({
    schemaVersion: z.literal(1),
    scalpOiliness: z.enum(["oily", "balanced", "dry"]),
    deepCleansingScalpPause: z.boolean(),
    hasLowVolumeOrWeighedDown: z.boolean(),
    shampooFrequency: z.union([productFrequencySchema, z.literal("does_not_wash")]).nullable(),
    oilPurposes: z.array(z.enum(["prewash_lengths", "damp_leave_on", "dry_finish", "scalp"])),
    ownedCategories: z.array(personalPlanCategorySchema).optional(),
  })
  .strict()

const stage3ProductLoadResolutionSchema: z.ZodType<Stage3ProductLoadResolutionV1> = z
  .object({
    schemaVersion: z.literal(1),
    refinedNeedVersionId: idSchema,
    refinedInputHash: idSchema,
    capturedFrequencyFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
    authorityVersions: z
      .object({
        deep_cleansing_shampoo: idSchema.optional(),
        scalp_care: idSchema.optional(),
      })
      .strict(),
    requirements: z.array(stage3CategoryRequirementSchema),
    decisions: z.array(z.record(z.string(), z.unknown())) as unknown as z.ZodType<
      PlanCategoryDecision[]
    >,
    coverage: z.array(z.record(z.string(), z.unknown())) as unknown as z.ZodType<
      PlanPortfolioCoverageFact[]
    >,
  })
  .strict()

const stage3InventoryAuthoritySchema: z.ZodType<Stage3InventoryAuthorityV1> = z
  .object({
    schemaVersion: z.literal(1),
    stage2RefinedNeedVersionId: idSchema,
    inventorySnapshotFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
    status: z.enum(["not_needed", "pending", "accepted", "rejected"]),
    proposalFingerprint: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .nullable(),
    proposedInputHash: idSchema.nullable(),
    proposedOutputSnapshot: z
      .record(z.string(), z.unknown())
      .nullable() as unknown as z.ZodType<InitialNeedPlanSnapshot | null>,
    materialDelta: z.array(z.record(z.string(), z.unknown())) as unknown as z.ZodType<
      Stage3NeedMaterialDelta[]
    >,
    resolvedFingerprint: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .nullable(),
  })
  .strict()

const stage3InventoryDispositionSchema: z.ZodType<Stage3InventoryDispositionV1> = z
  .object({
    schemaVersion: z.literal(1),
    dispositionKey: idSchema,
    capturedProductId: idSchema,
    category: personalPlanCategorySchema,
    planStatus: z.literal("not_used"),
    reason: z.enum(["category_not_in_final_plan", "not_assigned_to_final_role"]),
    acknowledged: z.boolean(),
    authorityFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict()

const stage3CategoryResolutionSchema: z.ZodType<Stage3CategoryResolution> = z
  .object({
    decisionKey: idSchema,
    category: personalPlanCategorySchema,
    role: planProductRoleSchema.nullable(),
    verdict: z.enum(STAGE3_FIT_VERDICTS),
    choiceState: z.enum(STAGE3_CHOICE_STATES),
    capturedProductId: idSchema.nullable(),
    executable: z.boolean(),
    gapPreserved: z.boolean(),
  })
  .strict()

const stage3OwnedProductSchema: z.ZodType<Stage3OwnedProduct> = z
  .object({
    capturedProductId: idSchema,
    userProductId: idSchema,
    productId: idSchema,
    displayName: idSchema,
    category: personalPlanCategorySchema,
    role: planProductRoleSchema.nullable(),
    frequencyRange: productFrequencySchema.nullable(),
    choiceState: z.enum(["owned_active", "owned_override"]),
    sourceDecisionKey: idSchema,
  })
  .strict()

const stage3PlannedPurchaseSchema = z
  .object({
    plannedPurchaseId: idSchema,
    category: personalPlanCategorySchema,
    role: planProductRoleSchema.nullable(),
    recommendationId: idSchema,
    productId: idSchema,
    displayName: idSchema,
    reason: idSchema,
    authorityRuleId: idSchema,
  })
  .strict()

const stage3PendingProductSchema: z.ZodType<Stage3PendingProduct> = z
  .object({
    capturedProductId: idSchema,
    userProductId: idSchema,
    submissionId: idSchema,
    category: personalPlanCategorySchema,
    role: planProductRoleSchema.nullable(),
    displayName: idSchema,
    reviewStatus: z.enum(["pending_review", "needs_more_info"]),
  })
  .strict()

const stage3RetainedInventoryProductSchema: z.ZodType<Stage3RetainedInventoryProduct> =
  z.discriminatedUnion("kind", [
    z
      .object({
        kind: z.literal("catalog_product"),
        capturedProductId: idSchema,
        userProductId: idSchema,
        productId: idSchema,
        displayName: idSchema,
        category: personalPlanCategorySchema,
        role: z.null(),
        sourceDispositionKey: idSchema,
        planStatus: z.literal("not_used"),
        reason: z.enum(["category_not_in_final_plan", "not_assigned_to_final_role"]),
      })
      .strict(),
    z
      .object({
        kind: z.literal("pending_submission"),
        capturedProductId: idSchema,
        userProductId: idSchema,
        submissionId: idSchema,
        displayName: idSchema,
        category: personalPlanCategorySchema,
        role: z.null(),
        reviewStatus: z.enum(["pending_review", "needs_more_info"]),
        sourceDispositionKey: idSchema,
        planStatus: z.literal("not_used"),
        reason: z.enum(["category_not_in_final_plan", "not_assigned_to_final_role"]),
      })
      .strict(),
  ])

const stage3UncoveredRoleSchema: z.ZodType<Stage3UncoveredRole> = z
  .object({
    category: personalPlanCategorySchema,
    role: planProductRoleSchema.nullable(),
    reason: z.enum([
      "planned_purchase_not_acquired",
      "pending_review",
      "inactive",
      "unassigned",
      "no_product_owned",
      "not_ready_to_decide",
    ]),
    linkedDecisionKey: idSchema,
    deferralReason: z.enum(STAGE3_DECISION_DEFERRAL_REASONS).optional(),
  })
  .strict()

const portfolioBaseSchema = {
  portfolioVersionId: idSchema,
  personalPlanId: idSchema,
  refinedVersionId: idSchema,
  sourceDraftRevision: z.number().int().nonnegative(),
  categoryResolutions: z.array(stage3CategoryResolutionSchema),
  ownedProducts: z.array(stage3OwnedProductSchema),
  pendingProducts: z.array(stage3PendingProductSchema),
  uncoveredRoles: z.array(stage3UncoveredRoleSchema),
  createdAt: idSchema,
}

/** Strict historical snapshot parser. Writers retain their existing v1/v2 derivation. */
export const proposedProductPortfolioSchema: z.ZodType<AnyProposedProductPortfolio> = z.union([
  z
    .object({
      schemaVersion: z.literal(1),
      ...portfolioBaseSchema,
      plannedPurchases: z.array(stage3PlannedPurchaseSchema),
    })
    .strict(),
  z
    .object({
      schemaVersion: z.literal(2),
      ...portfolioBaseSchema,
      plannedPurchases: z.array(stage3PlannedPurchaseSchema),
      productLoadResolution: stage3ProductLoadResolutionSchema,
    })
    .strict(),
  z
    .object({
      schemaVersion: z.literal(3),
      ...portfolioBaseSchema,
      plannedPurchases: z.array(
        stage3PlannedPurchaseSchema.extend({ sourceDecisionKey: idSchema }),
      ),
      retainedOwnedProducts: z.array(
        z
          .object({
            capturedProductId: idSchema,
            userProductId: idSchema,
            productId: idSchema,
            displayName: idSchema,
            category: personalPlanCategorySchema,
            role: planProductRoleSchema.nullable(),
            sourceDecisionKey: idSchema,
            planStatus: z.literal("not_used"),
          })
          .strict(),
      ),
      productLoadResolution: stage3ProductLoadResolutionSchema.optional(),
    })
    .strict(),
  z
    .object({
      schemaVersion: z.literal(4),
      ...portfolioBaseSchema,
      plannedPurchases: z.array(
        stage3PlannedPurchaseSchema.extend({ sourceDecisionKey: idSchema }),
      ),
      retainedOwnedProducts: z.array(
        z
          .object({
            capturedProductId: idSchema,
            userProductId: idSchema,
            productId: idSchema,
            displayName: idSchema,
            category: personalPlanCategorySchema,
            role: planProductRoleSchema.nullable(),
            sourceDecisionKey: idSchema,
            planStatus: z.literal("not_used"),
          })
          .strict(),
      ),
      inventoryDispositions: z.array(stage3InventoryDispositionSchema),
      retainedInventoryProducts: z.array(stage3RetainedInventoryProductSchema),
      productLoadResolution: stage3ProductLoadResolutionSchema.optional(),
    })
    .strict(),
])

export function parseProposedProductPortfolio(value: unknown): ProposedProductPortfolio
export function parseProposedProductPortfolio(
  value: unknown,
  options: { includeV4: true },
): AnyProposedProductPortfolio
export function parseProposedProductPortfolio(
  value: unknown,
  options?: { includeV4: true },
): ProposedProductPortfolio | AnyProposedProductPortfolio {
  if (options?.includeV4) return proposedProductPortfolioSchema.parse(value)
  return proposedProductPortfolioSchema.parse(value) as ProposedProductPortfolio
}

export const stage3ProductDraftSchema: z.ZodType<Stage3ProductDraft> = z.object({
  schemaVersion: z.literal(1),
  status: z.enum(STAGE3_DRAFT_STATUS_VALUES),
  authorityVersions: authorityVersionsSchema,
  draftId: idSchema,
  userId: idSchema,
  personalPlanId: idSchema,
  refinedVersionId: idSchema,
  staleRefinedVersionId: idSchema.nullable(),
  revision: z.number().int().nonnegative(),
  pass: z.enum(STAGE3_PASS_VALUES),
  orderedCategories: z.array(personalPlanCategorySchema).min(1),
  categoryCursor: z.string().nullable(),
  products: z.array(stage3CapturedProductSchema),
  roleAssignments: z.array(stage3RoleAssignmentSchema),
  uncoveredRoles: z.array(stage3CapturedUncoveredRoleSchema),
  decisions: z.array(stage3ProductDecisionSchema),
  completedCaptureCategories: z.array(personalPlanCategorySchema),
  completedDecisionKeys: z.array(idSchema),
  createdAt: idSchema,
  updatedAt: idSchema,
  authoritySnapshot: z
    .object({
      schemaVersion: z.literal(1),
      refinedNeedVersionId: idSchema,
      refinedInputHash: idSchema,
      productLoadContext: stage3ProductLoadContextSchema.optional(),
      // The refined snapshot is immutable server output. These fields retain
      // its complete JSON values; their linkage and authority versions are
      // checked again by requireCurrentAuthoritySnapshot before evaluation.
      categoryDecisions: z.array(z.record(z.string(), z.unknown())),
      coverage: z.array(z.record(z.string(), z.unknown())),
      orderedCategories: z.array(personalPlanCategorySchema),
      inventoryOnlyCategories: z.array(personalPlanCategorySchema).optional().default([]),
      authorityVersions: z.record(personalPlanCategorySchema, idSchema),
    })
    .strict()
    .optional() as z.ZodType<Stage3AuthoritySnapshotV1 | undefined>,
  inventoryAuthority: stage3InventoryAuthoritySchema.optional(),
  inventoryDispositions: z.array(stage3InventoryDispositionSchema).optional(),
  productLoadResolution: stage3ProductLoadResolutionSchema.optional(),
  legacyPrefillHints: stage3LegacyPrefillHintsSchema.optional(),
})

export function isExecutableChoice(
  choiceState: Stage3ChoiceState,
): choiceState is "owned_active" | "owned_override" {
  return choiceState === "owned_active" || choiceState === "owned_override"
}

export function stage3DecisionKey(
  category: PersonalPlanCategory,
  role: PlanProductRole,
  capturedProductId: string | null,
): string {
  return `decision:${category}:${role}:${capturedProductId ?? "gap"}`
}

export function stage3InventoryDispositionKey(
  category: PersonalPlanCategory,
  capturedProductId: string,
): string {
  return `inventory:${category}:${capturedProductId}`
}

export function isStage3InventoryClarificationProduct(
  draft: Pick<Stage3ProductDraft, "status" | "authoritySnapshot" | "roleAssignments">,
  product: Stage3CapturedProduct,
): boolean {
  if (
    draft.status !== "active" ||
    product.identity.category !== "heat_protectant" ||
    !draft.authoritySnapshot?.inventoryOnlyCategories?.includes("heat_protectant") ||
    draft.roleAssignments.some(
      (assignment) => assignment.capturedProductId === product.capturedProductId,
    )
  ) {
    return false
  }

  const heatDecision = draft.authoritySnapshot.categoryDecisions.find(
    (decision) => decision.category === "heat_protectant",
  )
  return (
    heatDecision?.resolution === "deferred_until_post_plan_onboarding" &&
    heatDecision.deferredFacts.includes("heat_tool_use")
  )
}

export function deriveStage3DecisionSubjects(draft: Stage3ProductDraft): Stage3DecisionSubject[] {
  const productsById = new Map(
    draft.products.map((product) => [product.capturedProductId, product]),
  )
  const assignedProductIds = new Set(
    draft.roleAssignments.map((assignment) => assignment.capturedProductId),
  )
  const subjects: Stage3DecisionSubject[] = []

  for (const assignment of draft.roleAssignments) {
    const product = productsById.get(assignment.capturedProductId)
    if (!product) continue
    for (const role of assignment.roles) {
      subjects.push({
        decisionKey: stage3DecisionKey(assignment.category, role, assignment.capturedProductId),
        category: assignment.category,
        role,
        capturedProductId: assignment.capturedProductId,
        subjectKind: "captured_product",
      })
    }
  }

  for (const uncoveredRole of draft.uncoveredRoles) {
    subjects.push({
      decisionKey: stage3DecisionKey(uncoveredRole.category, uncoveredRole.role, null),
      category: uncoveredRole.category,
      role: uncoveredRole.role,
      capturedProductId: null,
      subjectKind: "uncovered_role",
    })
  }

  for (const disposition of draft.inventoryDispositions ?? []) {
    const product = productsById.get(disposition.capturedProductId)
    if (!product || assignedProductIds.has(disposition.capturedProductId)) continue
    subjects.push({
      decisionKey: disposition.dispositionKey,
      category: disposition.category,
      role: getCategoryRolePolicy(disposition.category).allowedRoles[0],
      capturedProductId: disposition.capturedProductId,
      subjectKind: "inventory_disposition",
    })
  }

  const categoryOrder = new Map(draft.orderedCategories.map((category, index) => [category, index]))
  const productOrder = new Map(
    draft.products.map((product, index) => [product.capturedProductId, index]),
  )
  const categoryIndex = (category: PersonalPlanCategory) =>
    categoryOrder.get(category) ??
    draft.orderedCategories.length + PERSONAL_PLAN_PRODUCT_CATEGORIES.indexOf(category)

  return subjects.toSorted((left, right) => {
    const categoryDifference = categoryIndex(left.category) - categoryIndex(right.category)
    if (categoryDifference !== 0) return categoryDifference

    if (
      left.subjectKind === "inventory_disposition" ||
      right.subjectKind === "inventory_disposition"
    ) {
      if (left.subjectKind !== right.subjectKind) {
        return left.subjectKind === "inventory_disposition" ? 1 : -1
      }
    }

    const allowedRoles = getCategoryRolePolicy(left.category).allowedRoles
    const roleDifference =
      allowedRoles.indexOf(left.role as never) - allowedRoles.indexOf(right.role as never)
    if (roleDifference !== 0) return roleDifference

    const productDifference =
      (left.capturedProductId === null
        ? draft.products.length
        : (productOrder.get(left.capturedProductId) ?? draft.products.length)) -
      (right.capturedProductId === null
        ? draft.products.length
        : (productOrder.get(right.capturedProductId) ?? draft.products.length))
    if (productDifference !== 0) return productDifference

    return left.decisionKey.localeCompare(right.decisionKey)
  })
}

export function validateStage3Draft(draft: Stage3ProductDraft): string[] {
  const issues: string[] = []
  const parsed = stage3ProductDraftSchema.safeParse(draft)
  if (!parsed.success) {
    issues.push(...parsed.error.issues.map((issue) => issue.message))
  }

  const orderedCategories = new Set(draft.orderedCategories)
  const fallbackCategory = draft.orderedCategories.length === 1 ? draft.orderedCategories[0] : null
  const productsById = new Map(
    draft.products.map((product) => [product.capturedProductId, product]),
  )
  const assignedProductIds = new Set(
    draft.roleAssignments.map((assignment) => assignment.capturedProductId),
  )

  for (const product of draft.products) {
    if (!orderedCategories.has(product.identity.category)) {
      const expected = fallbackCategory ?? "ordered categories"
      issues.push(
        `identity category ${product.identity.category} does not match ordered category ${expected}`,
      )
    }
  }

  const dispositionsByProductId = new Map<string, Stage3InventoryDispositionV1>()
  for (const disposition of draft.inventoryDispositions ?? []) {
    const existing = dispositionsByProductId.get(disposition.capturedProductId)
    if (existing) {
      issues.push(
        `product ${disposition.capturedProductId} has more than one inventory disposition`,
      )
    }
    dispositionsByProductId.set(disposition.capturedProductId, disposition)
    const product = productsById.get(disposition.capturedProductId)
    if (!product) {
      issues.push(
        `inventory disposition references unknown product ${disposition.capturedProductId}`,
      )
      continue
    }
    if (product.identity.category !== disposition.category) {
      issues.push(
        `inventory disposition category ${disposition.category} does not match product category ${product.identity.category}`,
      )
    }
    if (
      disposition.dispositionKey !==
      stage3InventoryDispositionKey(disposition.category, disposition.capturedProductId)
    ) {
      issues.push(`inventory disposition ${disposition.dispositionKey} does not match its product`)
    }
    if (assignedProductIds.has(disposition.capturedProductId)) {
      issues.push(
        `assigned product ${disposition.capturedProductId} cannot also have an inventory-only disposition`,
      )
    }
  }

  if (
    (draft.pass === "product_decisions" || draft.pass === "ready_for_routine") &&
    (draft.inventoryAuthority || draft.inventoryDispositions)
  ) {
    for (const product of draft.products) {
      if (
        !assignedProductIds.has(product.capturedProductId) &&
        !dispositionsByProductId.has(product.capturedProductId) &&
        !isStage3InventoryClarificationProduct(draft, product)
      ) {
        issues.push(`captured product ${product.capturedProductId} has no Stage 3 result`)
      }
    }
  }

  const assignedRoles = new Map<string, string>()
  for (const assignment of draft.roleAssignments) {
    const product = productsById.get(assignment.capturedProductId)
    if (!product) {
      issues.push(`role assignment references unknown product ${assignment.capturedProductId}`)
      continue
    }
    if (product.identity.category !== assignment.category) {
      issues.push(
        `role assignment category ${assignment.category} does not match product category ${product.identity.category}`,
      )
    }
    for (const role of assignment.roles) {
      const key = `${assignment.category}:${role}`
      const existingProductId = assignedRoles.get(key)
      if (
        existingProductId &&
        existingProductId !== assignment.capturedProductId &&
        !allowsMultipleProductsForRole(assignment.category, role)
      ) {
        issues.push(`role ${role} already assigned`)
      }
      assignedRoles.set(key, assignment.capturedProductId)
    }
  }

  for (const uncoveredRole of draft.uncoveredRoles) {
    if (!orderedCategories.has(uncoveredRole.category)) {
      issues.push(`uncovered role category ${uncoveredRole.category} is not in this draft`)
    }
    const assignedProductId = assignedRoles.get(`${uncoveredRole.category}:${uncoveredRole.role}`)
    if (assignedProductId) {
      issues.push(`role ${uncoveredRole.role} cannot be both assigned and uncovered`)
    }
  }

  const subjectsByKey = new Map(
    deriveStage3DecisionSubjects(draft).map((subject) => [subject.decisionKey, subject]),
  )
  for (const decision of draft.decisions) {
    const subject = subjectsByKey.get(decision.decisionKey)
    if (!subject) {
      issues.push(`decision ${decision.decisionKey} is not a derived decision subject`)
    } else {
      if (
        subject.category !== decision.category ||
        subject.role !== decision.role ||
        subject.capturedProductId !== decision.capturedProductId
      ) {
        issues.push(`decision ${decision.decisionKey} does not match its derived subject`)
      }
      if (
        subject.subjectKind === "uncovered_role" &&
        decision.choiceState !== "unassigned" &&
        decision.choiceState !== "planned_purchase"
      ) {
        issues.push(`uncovered decision ${decision.decisionKey} must remain unassigned or planned`)
      }
    }

    const product = decision.capturedProductId
      ? productsById.get(decision.capturedProductId)
      : undefined
    if (decision.capturedProductId && !product) {
      issues.push(`decision references unknown product ${decision.capturedProductId}`)
      continue
    }
    if (product && product.identity.category !== decision.category) {
      issues.push(
        `decision category ${decision.category} does not match product category ${product.identity.category}`,
      )
    }
    const isPendingReplacementSelection =
      decision.choiceState === "planned_purchase" &&
      decision.resolutionAction === "select_replacement" &&
      decision.recommendation !== null &&
      Boolean(decision.authorityEvidence?.recommendationFactFingerprint)
    if (
      decision.resolutionAction === "select_replacement" &&
      (!decision.recommendation || !decision.authorityEvidence?.recommendationFactFingerprint)
    ) {
      issues.push(
        `replacement decision ${decision.decisionKey} requires recommendation fingerprint evidence`,
      )
    }
    if (
      product?.identity.kind === "pending_submission" &&
      decision.choiceState !== "pending_review" &&
      decision.choiceState !== "unassigned" &&
      !isPendingReplacementSelection
    ) {
      issues.push(
        `pending product ${product.capturedProductId} must remain pending_review or be left unassigned`,
      )
    }
    if (
      decision.choiceState === "pending_review" &&
      product?.identity.kind !== "pending_submission"
    ) {
      issues.push(`pending_review decision ${decision.decisionKey} requires a pending submission`)
    }
  }

  return issues
}
