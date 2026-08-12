import { z } from "zod"

import type {
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
  "product_decisions",
  "ready_for_routine",
] as const
export type Stage3Pass = (typeof STAGE3_PASS_VALUES)[number]

export const STAGE3_DRAFT_STATUS_VALUES = ["active", "stale", "completed"] as const
export type Stage3DraftStatus = (typeof STAGE3_DRAFT_STATUS_VALUES)[number]

export const STAGE3_FIT_VERDICTS = ["ideal", "supportive", "mismatch", "unknown"] as const
export type Stage3FitVerdict = (typeof STAGE3_FIT_VERDICTS)[number]

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
  subjectKind: "captured_product" | "uncovered_role"
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
  productLoadResolution?: Stage3ProductLoadResolutionV1
}

/** Minimal canonical draft shape required to validate persisted Stage 3 authority. */
export type Stage3AuthorityDraftInput = Pick<
  Stage3ProductDraft,
  | "refinedVersionId"
  | "orderedCategories"
  | "authorityVersions"
  | "authoritySnapshot"
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
  category: PersonalPlanCategory
  role: PlanProductRole | null
  recommendationId: string
  productId: string
  displayName: string
  reason: string
  authorityRuleId: string
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
}

export type ProposedProductPortfolio = {
  schemaVersion: 1 | 2
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
  createdAt: string
}

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
    if (requirement.category === "heat_protectant" && !requirement.qualifyingRoutes) {
      context.addIssue({
        code: "custom",
        message: "heat protectant requires qualifying route metadata",
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
  productLoadResolution: stage3ProductLoadResolutionSchema.optional(),
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

export function deriveStage3DecisionSubjects(draft: Stage3ProductDraft): Stage3DecisionSubject[] {
  const productsById = new Map(
    draft.products.map((product) => [product.capturedProductId, product]),
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

  for (const product of draft.products) {
    if (!orderedCategories.has(product.identity.category)) {
      const expected = fallbackCategory ?? "ordered categories"
      issues.push(
        `identity category ${product.identity.category} does not match ordered category ${expected}`,
      )
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
    if (
      product?.identity.kind === "pending_submission" &&
      decision.choiceState !== "pending_review" &&
      decision.choiceState !== "unassigned"
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
