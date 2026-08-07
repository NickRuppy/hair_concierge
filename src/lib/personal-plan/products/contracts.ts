import { z } from "zod"

import { PRODUCT_FREQUENCIES, type ProductFrequency } from "@/lib/vocabulary/frequencies"
import { allowsMultipleProductsForRole } from "./authorities"

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

export const SHAMPOO_ROLES = ["shampoo_primary", "shampoo_alternating"] as const
export type ShampooRole = (typeof SHAMPOO_ROLES)[number]

export const OIL_PURPOSES = ["prewash_lengths", "damp_leave_on", "dry_finish", "scalp"] as const
export type OilPurpose = (typeof OIL_PURPOSES)[number]

export const SCALP_CARE_ROLES = ["scalp_care_soothing", "scalp_care_flake_control"] as const
export type ScalpCareRole = (typeof SCALP_CARE_ROLES)[number]

export const HEAT_PROTECTION_ROLES = [
  "heat_protection_hot_tools",
  "heat_protection_blow_dry",
] as const
export type HeatProtectionRole = (typeof HEAT_PROTECTION_ROLES)[number]

export const CATEGORY_PRIMARY_ROLES = ["category_primary"] as const
export type CategoryPrimaryRole = (typeof CATEGORY_PRIMARY_ROLES)[number]

export const CATEGORY_COVERAGE_ROLES = ["category_coverage"] as const
export type CategoryCoverageRole = (typeof CATEGORY_COVERAGE_ROLES)[number]

export const STAGE3_SEMANTIC_ROLES = [
  ...SHAMPOO_ROLES,
  ...OIL_PURPOSES,
  ...SCALP_CARE_ROLES,
  ...HEAT_PROTECTION_ROLES,
  ...CATEGORY_PRIMARY_ROLES,
  ...CATEGORY_COVERAGE_ROLES,
] as const
export type Stage3SemanticRole = (typeof STAGE3_SEMANTIC_ROLES)[number]

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
export const stage3SemanticRoleSchema = z.enum(STAGE3_SEMANTIC_ROLES)
export const productFrequencySchema = z.enum(PRODUCT_FREQUENCIES)

export type Stage3EntryContext = {
  schemaVersion: 1
  personalPlanId: string
  refinedVersionId: string
  orderedCategories: Stage3CategoryRequirement[]
  inventoryPrompts: Stage3InventoryPrompt[]
}

export type Stage3CategoryRequirement = {
  category: PersonalPlanCategory
  requiredRoles: Stage3SemanticRole[]
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
  confidence: "exact" | "likely" | "category_mismatch"
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
  category: PersonalPlanCategory
  role: Stage3SemanticRole | null
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
    }
  | {
      kind: "pending_submission"
      submissionId: string
      usageId: string | null
      displayName: string
      category: PersonalPlanCategory
      reviewStatus: "pending_review" | "needs_more_info"
    }

export type Stage3CapturedProduct = {
  capturedProductId: string
  identity: Stage3ProductIdentity
  frequencyRange: ProductFrequency
  ownership: "owned"
  source: "catalog_search" | "intake_fallback" | "existing_inventory"
}

export type Stage3RoleAssignment = {
  capturedProductId: string
  category: PersonalPlanCategory
  roles: Stage3SemanticRole[]
}

export type Stage3CapturedUncoveredRole = {
  category: PersonalPlanCategory
  role: Stage3SemanticRole
  reason: "no_product_owned" | "not_ready_to_decide"
}

export type Stage3DecisionSubject = {
  decisionKey: string
  category: PersonalPlanCategory
  role: Stage3SemanticRole
  capturedProductId: string | null
  subjectKind: "captured_product" | "uncovered_role"
}

export type Stage3ProductDecision = {
  decisionKey: string
  category: PersonalPlanCategory
  role: Stage3SemanticRole | null
  capturedProductId: string | null
  verdict: Stage3FitVerdict
  choiceState: Stage3ChoiceState
  criterionResults: Stage3CriterionResult[]
  recommendation: Stage3Recommendation | null
  limitationAcknowledged: boolean
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
}

export type Stage3CategoryProgress = {
  category: PersonalPlanCategory
  capturedCount: number
  completedCapture: boolean
  completedDecisions: boolean
  uncoveredRoles: Stage3SemanticRole[]
}

export type Stage3BlockingReason = {
  code:
    | "capture_incomplete"
    | "role_uncovered"
    | "decision_incomplete"
    | "draft_invalid"
    | "stale_refined_version"
  category: PersonalPlanCategory | null
  role: Stage3SemanticRole | null
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
  role: Stage3SemanticRole | null
  verdict: Stage3FitVerdict
  choiceState: Stage3ChoiceState
  capturedProductId: string | null
  executable: boolean
  gapPreserved: boolean
}

export type Stage3OwnedProduct = {
  capturedProductId: string
  productId: string
  displayName: string
  category: PersonalPlanCategory
  role: Stage3SemanticRole | null
  frequencyRange: ProductFrequency
  choiceState: "owned_active" | "owned_override"
  sourceDecisionKey: string
}

export type Stage3PlannedPurchase = {
  plannedPurchaseId: string
  category: PersonalPlanCategory
  role: Stage3SemanticRole | null
  recommendationId: string
  displayName: string
  reason: string
  authorityRuleId: string
}

export type Stage3PendingProduct = {
  capturedProductId: string
  submissionId: string
  category: PersonalPlanCategory
  role: Stage3SemanticRole | null
  displayName: string
  reviewStatus: "pending_review" | "needs_more_info"
}

export type Stage3UncoveredRole = {
  category: PersonalPlanCategory
  role: Stage3SemanticRole | null
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
  schemaVersion: 1
  portfolioVersionId: string
  personalPlanId: string
  refinedVersionId: string
  sourceDraftRevision: number
  categoryResolutions: Stage3CategoryResolution[]
  ownedProducts: Stage3OwnedProduct[]
  plannedPurchases: Stage3PlannedPurchase[]
  pendingProducts: Stage3PendingProduct[]
  uncoveredRoles: Stage3UncoveredRole[]
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
  category: personalPlanCategorySchema,
  role: stage3SemanticRoleSchema.nullable(),
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
    }),
    z.object({
      kind: z.literal("pending_submission"),
      submissionId: idSchema,
      usageId: idSchema.nullable(),
      displayName: z.string().min(1),
      category: personalPlanCategorySchema,
      reviewStatus: z.enum(["pending_review", "needs_more_info"]),
    }),
  ],
)

export const stage3CapturedProductSchema: z.ZodType<Stage3CapturedProduct> = z.object({
  capturedProductId: idSchema,
  identity: stage3ProductIdentitySchema,
  frequencyRange: productFrequencySchema,
  ownership: z.literal("owned"),
  source: z.enum(["catalog_search", "intake_fallback", "existing_inventory"]),
})

function roleAllowedForCategory(category: PersonalPlanCategory, role: Stage3SemanticRole): boolean {
  if (role === "category_primary") {
    return category !== "oil" && category !== "scalp_care" && category !== "conditioner"
  }
  if (role === "category_coverage") return category === "conditioner"
  if ((OIL_PURPOSES as readonly string[]).includes(role)) return category === "oil"
  if (role.startsWith("scalp_care_")) return category === "scalp_care"
  if (role.startsWith("heat_protection_")) return category === "heat_protectant"
  if (role.startsWith("shampoo_")) return category === "shampoo"
  return false
}

export const stage3RoleAssignmentSchema: z.ZodType<Stage3RoleAssignment> = z
  .object({
    capturedProductId: idSchema,
    category: personalPlanCategorySchema,
    roles: z.array(stage3SemanticRoleSchema).min(1),
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
    role: stage3SemanticRoleSchema,
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
    role: stage3SemanticRoleSchema.nullable(),
    capturedProductId: idSchema.nullable(),
    verdict: z.enum(STAGE3_FIT_VERDICTS),
    choiceState: z.enum(STAGE3_CHOICE_STATES),
    criterionResults: z.array(stage3CriterionResultSchema),
    recommendation: stage3RecommendationSchema.nullable(),
    limitationAcknowledged: z.boolean(),
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

export const stage3CategoryRequirementSchema: z.ZodType<Stage3CategoryRequirement> = z.object({
  category: personalPlanCategorySchema,
  requiredRoles: z.array(stage3SemanticRoleSchema),
  needSummary: z.string().min(1),
  authorityVersion: idSchema,
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
})

export function isExecutableChoice(
  choiceState: Stage3ChoiceState,
): choiceState is "owned_active" | "owned_override" {
  return choiceState === "owned_active" || choiceState === "owned_override"
}

export function stage3DecisionKey(
  category: PersonalPlanCategory,
  role: Stage3SemanticRole,
  capturedProductId: string | null,
): string {
  return `decision:${category}:${role}:${capturedProductId ?? "gap"}`
}

export function deriveStage3DecisionSubjects(draft: Stage3ProductDraft): Stage3DecisionSubject[] {
  const productsById = new Map(draft.products.map((product) => [product.capturedProductId, product]))
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

  return subjects
}

export function validateStage3Draft(draft: Stage3ProductDraft): string[] {
  const issues: string[] = []
  const parsed = stage3ProductDraftSchema.safeParse(draft)
  if (!parsed.success) {
    issues.push(...parsed.error.issues.map((issue) => issue.message))
  }

  const orderedCategories = new Set(draft.orderedCategories)
  const fallbackCategory = draft.orderedCategories.length === 1 ? draft.orderedCategories[0] : null
  const productsById = new Map(draft.products.map((product) => [product.capturedProductId, product]))

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
      if (subject.subjectKind === "uncovered_role" && decision.choiceState !== "unassigned") {
        issues.push(`uncovered decision ${decision.decisionKey} must remain unassigned`)
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
    if (product?.identity.kind === "pending_submission" && decision.choiceState !== "pending_review") {
      issues.push(`pending product ${product.capturedProductId} must remain pending_review`)
    }
    if (decision.choiceState === "pending_review" && product?.identity.kind !== "pending_submission") {
      issues.push(`pending_review decision ${decision.decisionKey} requires a pending submission`)
    }
  }

  return issues
}
