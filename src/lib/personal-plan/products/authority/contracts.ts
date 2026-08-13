import type {
  InitialNeedPlanSnapshot,
  PlanCategoryDecision,
  PlanHairThickness,
  PlanPortfolioCoverageFact,
  PlanProductRole,
} from "@/lib/personal-plan/types"

import type {
  PersonalPlanCategory,
  Stage3CriterionResult,
  Stage3FitVerdict,
  Stage3ProductIdentity,
  Stage3Recommendation,
} from "../contracts"

export const STAGE3_AUTHORITY_ACTION_KINDS = [
  "keep_owned",
  "acknowledge_override",
  "plan_recommendation",
  "select_replacement",
  "keep_pending",
  "leave_uncovered",
] as const

export const STAGE3_AUTHORITY_DECISION_BATCH_LIMIT = 25

export type Stage3AuthorityActionKind = (typeof STAGE3_AUTHORITY_ACTION_KINDS)[number]

export type Stage3AuthoritySemanticIntent = {
  type: "resolve_decision"
  subjectKey: string
  action: Stage3AuthorityActionKind
  selectedCandidateId?: string
  selectedCandidateFactFingerprint?: string
}

export type Stage3AuthorityProtocolFact = {
  role: PlanProductRole
  status: "verified_complete" | "verified_incomplete" | "missing"
  fingerprint: string | null
}

export type Stage3AuthorityCommonProductFacts = {
  productId: string
  displayName: string
  presentationImageUrl?: string | null
  category: PersonalPlanCategory
  isActive: boolean
  lifecycleStatus: string | null
  recommendable: boolean
  suitableThicknesses: string[] | null
  knownReaction: boolean | null
  protocols: Stage3AuthorityProtocolFact[]
  factFingerprint: string
  catalogSortOrder?: number | null
  /** Commerce/presentation fields never participate in fit authority. */
  priceEur?: number | null
  priceCheckedAt?: string | null
  purchaseLinkStatus?: "available" | "unavailable" | null
  netContentValue?: number | null
  netContentUnit?: "ml" | "g" | null
}

export type Stage3ShampooFacts = Stage3AuthorityCommonProductFacts & {
  category: "shampoo"
  spec: {
    thickness: string | null
    shampooBucket: string | null
    scalpRoute: string | null
    cleansingIntensity: string | null
    targetFit: "matched" | "known_mismatch" | "unknown"
  }
}

export type Stage3ConditionerFacts = Stage3AuthorityCommonProductFacts & {
  category: "conditioner"
  spec: {
    thickness: string | null
    proteinMoistureBalance: string | null
    weight: string | null
    repairSupportLevel: string | null
    balanceDirection: string | null
    targetFit: "matched" | "known_mismatch" | "unknown"
  }
}

export type Stage3LeaveInFacts = Stage3AuthorityCommonProductFacts & {
  category: "leave_in"
  spec: {
    format: string | null
    weight: string | null
    careDirection: string | null
    repairSupportLevel: string | null
    roles: string[] | null
    providesHeatProtection: boolean | null
    careBenefits: string[] | null
    applicationStages: string[] | null
  }
}

export type Stage3HeatProtectantFacts = Stage3AuthorityCommonProductFacts & {
  category: "heat_protectant"
  spec: {
    format: string | null
    providesHeatProtection: boolean | null
  }
}

export type Stage3OilFacts = Stage3AuthorityCommonProductFacts & {
  category: "oil"
  spec: {
    roleSupport: Partial<Record<PlanProductRole, boolean | null>>
    weight: string | null
    targetThicknessEligible: boolean | null
    providesHeatProtection: boolean | null
  }
}

export type Stage3MaskFacts = Stage3AuthorityCommonProductFacts & {
  category: "mask"
  spec: {
    weight: string | null
    careDirection: string | null
    repairSupportLevel: string | null
    functionalBenefits: string[] | null
  }
}

export type Stage3ScalpCareFacts = Stage3AuthorityCommonProductFacts & {
  category: "scalp_care"
  spec: {
    primaryRole: string | null
    presentationFormat: string | null
    rinseMode: string | null
  }
}

export type Stage3DryShampooFacts = Stage3AuthorityCommonProductFacts & {
  category: "dry_shampoo"
  spec: {
    primaryEffect: string | null
    hairColorFit: string | null
    scalpSensitivityFit: string | null
    format: string | null
  }
}

export type Stage3BondbuilderFacts = Stage3AuthorityCommonProductFacts & {
  category: "bondbuilder"
  spec: {
    applicationMode: string | null
    treatmentMode: string | null
    productFormat: string | null
    usageProtocol: string | null
    relationship: "standalone" | "add_on" | null
  }
}

export type Stage3DeepCleansingFacts = Stage3AuthorityCommonProductFacts & {
  category: "deep_cleansing_shampoo"
  spec: {
    supportedResetRoles: PlanProductRole[] | null
    scalpTypeFocus: string | null
    colorTreatedSuitability: string | null
  }
}

export type Stage3CategoryProductFacts =
  | Stage3ShampooFacts
  | Stage3ConditionerFacts
  | Stage3LeaveInFacts
  | Stage3HeatProtectantFacts
  | Stage3OilFacts
  | Stage3MaskFacts
  | Stage3ScalpCareFacts
  | Stage3DryShampooFacts
  | Stage3BondbuilderFacts
  | Stage3DeepCleansingFacts

export type Stage3AuthorityInput<C extends PersonalPlanCategory = PersonalPlanCategory> = {
  category: C
  authorityVersion: string
  refinedVersionId: string
  refinedInputHash: string
  subjectKey: string
  role: PlanProductRole
  capturedProductId: string | null
  subjectIdentity: Stage3ProductIdentity | null
  categoryDecision: PlanCategoryDecision & { category: C }
  coverage: PlanPortfolioCoverageFact[]
  productFacts: Extract<Stage3CategoryProductFacts, { category: C }> | null
  recommendationCandidates: Array<Extract<Stage3CategoryProductFacts, { category: C }>>
  heatCarrierCoverage: {
    carrierCategory: Extract<PersonalPlanCategory, "leave_in" | "oil" | "heat_protectant"> | null
    verifiedRoutes: string[]
  }
}

export type Stage3EvaluationContext = Readonly<{
  currentRefinedVersionId: string
  refinedNeedSnapshot: InitialNeedPlanSnapshot
  hairThickness: PlanHairThickness
}>

export type Stage3KnownAuthorityEvaluation = {
  status: "known"
  category: PersonalPlanCategory
  subjectKey: string
  verdict: Stage3FitVerdict
  criteria: Stage3CriterionResult[]
  allowedActions: Stage3AuthorityActionKind[]
  recommendation: Stage3Recommendation | null
  productFactFingerprint: string | null
  recommendationFactFingerprint: string | null
  coverageRuleIds: string[]
}

export type Stage3AuthorityEvaluation =
  | Stage3KnownAuthorityEvaluation
  | {
      status: "pending"
      category: PersonalPlanCategory
      subjectKey: string
      reason: "product_intake_pending"
      allowedActions: Extract<Stage3AuthorityActionKind, "keep_pending" | "leave_uncovered">[]
      coverageRuleIds: string[]
    }
  | {
      status: "unknown"
      category: PersonalPlanCategory
      subjectKey: string
      missingFacts: string[]
      criteria: Stage3CriterionResult[]
      allowedActions: Extract<Stage3AuthorityActionKind, "leave_uncovered">[]
      coverageRuleIds: string[]
    }
  | {
      status: "unsupported"
      category: PersonalPlanCategory
      subjectKey: string
      reason: string
      allowedActions: []
      coverageRuleIds: string[]
    }

export type Stage3CategoryAuthorityAdapter<C extends PersonalPlanCategory> = (
  input: Stage3AuthorityInput<C>,
) => Stage3AuthorityEvaluation
