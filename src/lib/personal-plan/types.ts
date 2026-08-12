import type {
  PersonalPlanQuizAnswers,
  PersonalPlanQuizGoal,
  PersonalPlanQuizSubmissionEnvelope,
} from "@/lib/personal-plan-quiz/types"
import type { ProductFrequency } from "@/lib/vocabulary/frequencies"

export const STAGE1_CATEGORY_ORDER = [
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

export type Stage1Category = (typeof STAGE1_CATEGORY_ORDER)[number]

export type PersonalPlanLegacyConcern =
  | "dry_dull_lengths"
  | "frizz_flyaways"
  | "low_shine"
  | "lost_shape"
  | "low_volume_or_weighed_down"
  | "breakage_or_split_ends"
  | "tangling"
  | "scalp_imbalance"

export type PersonalPlanV2QuizEnvelope = {
  kind: "personal_plan"
  version: 2
  answers: Omit<
    PersonalPlanQuizSubmissionEnvelope["answers"],
    "currentConcerns" | "concernRecurrence"
  > & {
    currentConcerns?: PersonalPlanLegacyConcern[]
  }
}

export type SupportedPersonalPlanQuizEnvelope =
  | PersonalPlanQuizSubmissionEnvelope
  | PersonalPlanV2QuizEnvelope

export type LegacyQuizStage1Source = {
  kind: "legacy_quiz"
  version: 1
  leadId: string
  answers: Pick<
    PersonalPlanQuizAnswers,
    | "texture"
    | "thickness"
    | "density"
    | "goals"
    | "currentConcerns"
    | "hairLength"
    | "hairSurface"
    | "elasticResponse"
    | "chemicalTreatments"
    | "scalpOiliness"
    | "scalpConcerns"
  >
}
export type SupportedStage1Source = SupportedPersonalPlanQuizEnvelope | LegacyQuizStage1Source

export type PlanMissingFactId =
  | "shampoo_frequency"
  | "current_product_load"
  | "heat_tool_use"
  | "dry_shampoo_bridge_preference"
  | "scalp_irritation_detail"

export type PlanKnowledgeGapId = PlanMissingFactId | "concern_recurrence"

export type PlanKnowledge<T> =
  | { state: "known"; value: T }
  | { state: "unknown"; reason: PlanKnowledgeGapId }

export type PlanHeatToolUseEvent = {
  id: string
  tool: "hair_dryer" | "dryer_brush" | "straightener" | "curling_iron" | "hot_air_styler" | "other"
  route: "ordinary_airflow" | "airflow_shaping" | "direct_contact_heat" | "unclassified"
  frequency: ProductFrequency
  sourceRuleIds: string[]
}

export type PlanMechanicalExposureSignal = "towel_rough_rubbing"
export type PlanCurrentProductLoad = {
  categories: Stage1Category[]
  oilPurposes: Array<"prewash_lengths" | "damp_leave_on" | "dry_finish" | "scalp">
}

export type PlanRoutineContext = {
  currentProductLoad: PlanKnowledge<PlanCurrentProductLoad>
  shampooFrequency: PlanKnowledge<ProductFrequency | "does_not_wash">
  heatToolUse: PlanKnowledge<PlanHeatToolUseEvent[]>
  mechanicalExposureSignals: PlanMechanicalExposureSignal[]
  dryShampooBridgePreference: PlanKnowledge<"accept" | "decline">
  scalpIrritationState: PlanKnowledge<
    "normal" | "mild_sensitive_or_itchy" | "burning_painful_or_inflamed"
  >
}

export const INITIAL_UNKNOWN_ROUTINE_CONTEXT: PlanRoutineContext = {
  currentProductLoad: { state: "unknown", reason: "current_product_load" },
  shampooFrequency: { state: "unknown", reason: "shampoo_frequency" },
  heatToolUse: { state: "unknown", reason: "heat_tool_use" },
  mechanicalExposureSignals: [],
  dryShampooBridgePreference: {
    state: "unknown",
    reason: "dry_shampoo_bridge_preference",
  },
  scalpIrritationState: { state: "unknown", reason: "scalp_irritation_detail" },
}

export type PlanHairTexture = NonNullable<PersonalPlanQuizAnswers["texture"]>
export type PlanHairThickness = NonNullable<PersonalPlanQuizAnswers["thickness"]>
export type PlanHairDensity = NonNullable<PersonalPlanQuizAnswers["density"]>
export type PlanHairLength = NonNullable<PersonalPlanQuizAnswers["hairLength"]>
export type PlanHairSurface = NonNullable<PersonalPlanQuizAnswers["hairSurface"]>
export type PlanElasticResponse = NonNullable<PersonalPlanQuizAnswers["elasticResponse"]>
export type PlanChemicalTreatment = NonNullable<
  PersonalPlanQuizAnswers["chemicalTreatments"]
>[number]
export type PlanScalpOiliness = NonNullable<PersonalPlanQuizAnswers["scalpOiliness"]>
export type PlanScalpConcern = NonNullable<PersonalPlanQuizAnswers["scalpConcerns"]>[number]
export type PlanCurrentConcern = NonNullable<PersonalPlanQuizAnswers["currentConcerns"]>[number]
export type PlanConcernRecurrence = NonNullable<PersonalPlanQuizAnswers["concernRecurrence"]>

export type PlanProfile = {
  source: {
    quizVersion: 1 | 2 | 3
    artifactId: string
    projection: "initial_quiz" | "refined_post_plan"
  }
  hair: {
    texture: PlanHairTexture
    thickness: PlanHairThickness
    density: PlanHairDensity
    length: PlanHairLength
    surface: PlanHairSurface
    elasticity: PlanElasticResponse
    chemicalTreatments: PlanChemicalTreatment[]
  }
  scalp: {
    oiliness: PlanScalpOiliness
    concerns: PlanScalpConcern[]
    irritationState: PlanRoutineContext["scalpIrritationState"]
  }
  goals: PersonalPlanQuizGoal[]
  concerns: PlanCurrentConcern[]
  concernRecurrence: PlanKnowledge<PlanConcernRecurrence>
  routine: PlanRoutineContext
}

export type PlanKnowledgeState = "known" | "partial" | "unknown"
export type PlanRepairPriority = "none" | "low" | "medium" | "high"
export type PlanDamageLevel = "none" | "low" | "moderate" | "high" | "severe"

export type PlanDamageAssessment = {
  knowledgeState: PlanKnowledgeState
  sourceFacts: string[]
  chemicalStress: 0 | 1 | 2 | 3 | 4
  structuralLevel: PlanDamageLevel
  heatLevel: PlanDamageLevel
  mechanicalLevel: PlanDamageLevel
  structuralSignals: string[]
  mechanicalSignals: string[]
  heatSignals: string[]
  heatEvents: PlanHeatToolUseEvent[]
  ordinaryAirflowExposure:
    | { state: "known"; events: PlanHeatToolUseEvent[] }
    | { state: "unknown"; events: [] }
  repairPriority: PlanRepairPriority
  missingInputs: PlanMissingFactId[]
}

export type PlanShampooCadenceAssessment = {
  knowledgeState: PlanKnowledgeState
  sourceFacts: string[]
  scalpRoute: "oily" | "balanced" | "dry"
  preferred: ProductFrequency
  minimum: ProductFrequency
  maximum: ProductFrequency
  current: PlanRoutineContext["shampooFrequency"]
}

export type PlanResetLoadAssessment = {
  knowledgeState: PlanKnowledgeState
  sourceFacts: string[]
  knownScore: number
  unknownSignals: Array<"dry_shampoo" | "leave_in" | "finishing_oil" | "shampoo_frequency">
  missingInputs: PlanMissingFactId[]
}

export type PlanScalpBuildupAssessment = {
  knowledgeState: PlanKnowledgeState
  state: "present" | "absent" | "unknown"
  sourceFacts: string[]
}

export type PlanHeatExposureAssessment = {
  knowledgeState: PlanKnowledgeState
  state: "present" | "absent" | "unknown"
  events: PlanHeatToolUseEvent[]
  sourceFacts: string[]
}

export type PlanHairLossBoundaryAssessment =
  | { state: "absent"; sourceFacts: [] }
  | {
      state: "present"
      sourceFacts: ["hair_loss_or_thinning"]
      redFlagDetail: "unassessed"
      cosmeticClaimBoundary: "limited_evidence_only"
    }

export type PlanNeedAssessment = {
  damage: PlanDamageAssessment
  shampooCadence: PlanShampooCadenceAssessment
  resetLoad: PlanResetLoadAssessment
  scalpBuildup: PlanScalpBuildupAssessment
  heatExposure: PlanHeatExposureAssessment
  hairLossBoundary: PlanHairLossBoundaryAssessment
}

export type PlanNeedTier = "basis" | "optional" | "not_needed"
export type PlanReasonSalience = "primary" | "secondary" | "detail"

export type PlanReasonFact = {
  id: string
  salience: PlanReasonSalience
  evidence: Array<{
    source: "quiz" | "post_plan_onboarding" | "assessment"
    key: string
  }>
  values: Record<string, string | number | boolean>
}

export type PlanProductRole =
  | "shampoo_everyday"
  | "shampoo_dandruff"
  | "conditioner_rinse_out"
  | "post_wash_leave_in"
  | "pre_heat_application"
  | "intensive_conditioning_mask"
  | "pre_wash_fibre_treatment"
  | "leave_on_fibre_conditioning"
  | "dry_finish"
  | "residue_reset"
  | "mineral_reset"
  | "root_refresh_bridge"
  | "pre_heat_protection"
  | "specialized_bond_treatment"
  | "scalp_comfort"
  | "scalp_flake_oil_adjunct"
  | "density_claim_tonic"
  | "scalp_exfoliant"

export type PlanCareWeight = "light" | "medium" | "rich"
export type PlanCareDirection = "moisture" | "balanced" | "protein"
export type PlanRepairSupportLevel = "low" | "medium" | "high"
export type PlanFunctionPriority = 1 | 2 | 3
export type PlanCoverageOwnership = "primary" | "supporting" | "required"

export type ConditionerFunctionalNeed =
  | "volume_support"
  | "frizz_smoothing"
  | "shine"
  | "detangling_slip"
  | "definition_support"
  | "color_protection"

export type LeaveInFunction =
  | "detangle"
  | "moisture_softness"
  | "smooth_anti_frizz"
  | "heat_protect"
  | "repair_support"
  | "curl_shape_support"
  | "shine_support"

export type MaskFunctionalNeed = "smoothing_frizz_control" | "detangling_slip" | "shine"
export type OilFunctionalBenefit = "shine" | "smoothing_frizz_control" | "slip_manageability"
export type PlanHeatToolRoute = PlanHeatToolUseEvent["route"]

export type PlanCategoryTarget =
  | {
      category: "shampoo"
      roles: Array<Extract<PlanProductRole, "shampoo_everyday" | "shampoo_dandruff">>
      scalpRoute: "oily" | "balanced" | "dry"
      everydayConstraint:
        | "standard"
        | "gentle_dry_scalp"
        | "irritation_compatible"
        | "gentle_dry_scalp_and_irritation_compatible"
      requiresTargetedDandruffCapability: boolean
    }
  | {
      category: "conditioner"
      roles: Array<Extract<PlanProductRole, "conditioner_rinse_out">>
      weight: PlanCareWeight
      careDirection: PlanCareDirection
      repairSupportLevel: PlanRepairSupportLevel
      functionalNeeds: Array<{
        need: ConditionerFunctionalNeed
        priority: PlanFunctionPriority
        ownership: PlanCoverageOwnership
      }>
    }
  | {
      category: "leave_in"
      roles: Array<Extract<PlanProductRole, "post_wash_leave_in" | "pre_heat_application">>
      weight: PlanCareWeight
      careDirection: PlanCareDirection
      repairSupportLevel: PlanRepairSupportLevel
      functions: Array<{
        function: LeaveInFunction
        priority: PlanFunctionPriority
        ownership: PlanCoverageOwnership
      }>
      conditionerReplacementEligible: boolean
    }
  | {
      category: "mask"
      roles: Array<Extract<PlanProductRole, "intensive_conditioning_mask">>
      needStrength: "standard" | "high" | null
      weight: PlanCareWeight
      careDirection: PlanCareDirection
      repairSupportLevel: PlanRepairSupportLevel
      functionalNeeds: Array<{
        need: MaskFunctionalNeed
        priority: PlanFunctionPriority
        ownership: PlanCoverageOwnership
      }>
    }
  | {
      category: "oil"
      roles: Array<
        Extract<
          PlanProductRole,
          "pre_wash_fibre_treatment" | "leave_on_fibre_conditioning" | "dry_finish"
        >
      >
      roleTargets: Array<{
        role: Extract<
          PlanProductRole,
          "pre_wash_fibre_treatment" | "leave_on_fibre_conditioning" | "dry_finish"
        >
        tier: Exclude<PlanNeedTier, "not_needed">
        weight: PlanCareWeight | null
        functionalBenefits: Array<{
          benefit: OilFunctionalBenefit
          priority: PlanFunctionPriority
          ownership: PlanCoverageOwnership
        }>
      }>
    }
  | {
      category: "deep_cleansing_shampoo"
      roles: Array<Extract<PlanProductRole, "residue_reset" | "mineral_reset">>
    }
  | {
      category: "dry_shampoo"
      roles: Array<Extract<PlanProductRole, "root_refresh_bridge">>
      cadenceAdjustment: "keep" | "decrease_frequency"
    }
  | {
      category: "heat_protectant"
      roles: Array<Extract<PlanProductRole, "pre_heat_protection">>
      qualifyingRoutes: Array<Extract<PlanHeatToolRoute, "airflow_shaping" | "direct_contact_heat">>
      carrierPolicy: "integrated_or_separate_verified_binary_capability"
    }
  | {
      category: "bondbuilder"
      roles: Array<Extract<PlanProductRole, "specialized_bond_treatment">>
      requiredFunction: "support_stressed_hair_resilience"
      mechanismTarget: "mechanism_neutral"
    }
  | {
      category: "scalp_care"
      roles: Array<
        Extract<
          PlanProductRole,
          "scalp_comfort" | "scalp_flake_oil_adjunct" | "density_claim_tonic" | "scalp_exfoliant"
        >
      >
      roleTargets: Array<{
        role: Extract<
          PlanProductRole,
          "scalp_comfort" | "scalp_flake_oil_adjunct" | "density_claim_tonic" | "scalp_exfoliant"
        >
        coverage: PlanCoverageOwnership
        evidenceLevel?: "limited_evidence"
      }>
    }

export type PlanFrequencyTarget =
  | {
      kind: "wet_wash_total"
      mode: "quiz_starting_target" | "retained_current" | "nearest_boundary"
      target: ProductFrequency
      allowedRange: { min: ProductFrequency; max: ProductFrequency }
      specialWashSubstitution: true
    }
  | {
      kind: "after_each_eligible_wash"
      roles: Array<Extract<PlanProductRole, "conditioner_rinse_out" | "post_wash_leave_in">>
      dependsOn: "wet_wash_total"
      placementState: "known_after_refined_wash_cadence" | "known"
    }
  | {
      kind: "event_based"
      role: Extract<PlanProductRole, "pre_heat_protection" | "pre_heat_application">
      eventRoutes: Array<Extract<PlanHeatToolRoute, "airflow_shaping" | "direct_contact_heat">>
      occurrence: "before_every_qualifying_event"
    }
  | {
      kind: "every_nth_wash"
      roles: Array<Extract<PlanProductRole, "residue_reset" | "mineral_reset">>
      every: 3 | 4
      substitutesRegularShampoo: true
    }
  | {
      kind: "unscheduled_as_needed"
      roles: Array<
        Extract<
          PlanProductRole,
          | "residue_reset"
          | "root_refresh_bridge"
          | "intensive_conditioning_mask"
          | "scalp_comfort"
          | "scalp_exfoliant"
        >
      >
      boundary:
        | "bei_bedarf"
        | "between_washes_max_twice_before_next_wash"
        | "optional_intensive_care_template"
        | "according_to_product_protocol"
    }
  | {
      kind: "mask_regular_interval"
      role: "intensive_conditioning_mask"
      needStrength: "standard" | "high"
      baseInterval: "weekly_1x" | "biweekly_1x" | "every_3_weeks"
      placementState: "blocked_until_wash_frequency_known" | "placed_on_eligible_wash"
    }
  | {
      kind: "role_based_wash_linked"
      roleFrequencies: Array<{
        role: Extract<
          PlanProductRole,
          "pre_wash_fibre_treatment" | "leave_on_fibre_conditioning" | "dry_finish"
        >
        tier: Exclude<PlanNeedTier, "not_needed">
        cadence:
          | "before_every_compatible_wash"
          | "after_every_compatible_wash"
          | "finish_after_every_compatible_wash"
          | "optional_allocation_deferred_to_day_type"
      }>
    }
  | { kind: "product_protocol_course"; role: "specialized_bond_treatment" }
  | {
      kind: "role_keyed_product_protocol"
      roleFrequencies: Array<{
        role: Extract<
          PlanProductRole,
          "scalp_comfort" | "scalp_flake_oil_adjunct" | "density_claim_tonic" | "scalp_exfoliant"
        >
        cadence:
          | "as_needed_according_to_product"
          | "regular_according_to_product"
          | "occasional_according_to_product"
      }>
    }

export type PlanCategoryDecision = {
  category: Stage1Category
  resolution: "resolved" | "partially_resolved" | "deferred_until_post_plan_onboarding"
  needTier: PlanNeedTier | null
  roles: PlanProductRole[]
  target: PlanCategoryTarget | null
  frequency: PlanFrequencyTarget | null
  reasons: PlanReasonFact[]
  executionState: "available" | "paused"
  executionPauseReason: PlanReasonFact | null
  deferredFacts: PlanMissingFactId[]
}

export type PlanPortfolioCoverageFact = {
  job:
    | "wet_wash_cleansing"
    | "dry_shampoo_bridge"
    | "scalp_flake_or_comfort"
    | "scalp_root_reset"
    | "repair_support"
    | "damp_smoothing"
    | "heat_protection"
    | "rinse_out_conditioning"
  ruleId: string
  primaryCategories: Stage1Category[]
  supportingCategories: Stage1Category[]
  outcome: "owned" | "shared" | "deferred_allocation" | "duplicate_purchase_suppressed"
}

export type InitialProductPreview =
  | {
      category: Stage1Category
      state: "selected"
      productId: string
      productName: string
      imageUrl: string
      previewRole: PlanProductRole | null
      verdict: "ideal"
      selectionRuleIds: string[]
      selectionVersion: string
    }
  | {
      category: Stage1Category
      state: "absent"
      reason: "deferred_fit" | "no_ideal_match" | "catalog_data_gap" | "image_missing"
      selectionRuleIds: string[]
      selectionVersion: string
    }

export type InitialNeedPlanSnapshot = {
  schemaVersion: 1
  snapshotKind: "initial_need"
  computationVersion: string
  inputHash: string
  createdAt: string
  sourceQuiz: SupportedStage1Source
  profile: PlanProfile
  assessments: PlanNeedAssessment
  decisions: PlanCategoryDecision[]
  coverage: PlanPortfolioCoverageFact[]
  productPreviews: InitialProductPreview[]
  renderedOrder: Stage1Category[]
  deferredFacts: PlanMissingFactId[]
}

export function canonicalizeInitialSnapshotPayload(snapshot: InitialNeedPlanSnapshot) {
  return { ...snapshot, createdAt: undefined }
}
