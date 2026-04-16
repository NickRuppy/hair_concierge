/* ── Re-export shared vocabulary (single source of truth) ── */

import type {
  HairTexture,
  HairThickness,
  HairDensity,
  WashFrequency,
  HeatStyling,
  Concern,
  Goal,
  StylingTool,
  CuticleCondition,
  ProteinMoistureBalance,
  ScalpType,
  ScalpCondition,
  ChemicalTreatment,
  DesiredVolume,
  PostWashAction,
  RoutinePreference,
  RoutineProduct,
  MechanicalStressFactor,
  TowelMaterial,
  TowelTechnique,
  DryingMethod,
  BrushType,
  NightProtection,
} from "@/lib/vocabulary"
import type {
  ProductLeaveInSpecs,
  LeaveInNeedBucket,
  LeaveInStylingContext,
  LeaveInConditionerRelationship,
  LeaveInWeight,
} from "@/lib/leave-in/constants"
import type { ProductMaskSpecs } from "@/lib/mask/constants"
import type {
  ProductConditionerSpecs,
  ConditionerWeight,
  ConditionerRepairLevel,
} from "@/lib/conditioner/constants"
import type { ProductBondbuilderSpecs } from "@/lib/bondbuilder/constants"
import type { ProductDeepCleansingShampooSpecs } from "@/lib/deep-cleansing-shampoo/constants"
import type { ProductDryShampooSpecs } from "@/lib/dry-shampoo/constants"
import type { OilNoRecommendationReason, OilSubtype, OilUseMode } from "@/lib/oil/constants"
import type { ProductPeelingSpecs } from "@/lib/peeling/constants"
import type {
  ProductBondApplicationMode,
  ProductBondRepairIntensity,
  ProductPeelingType,
  ProductScalpTypeFocus,
} from "@/lib/product-specs/constants"
import type {
  CareNeedAssessment as RecommendationEngineCareNeedAssessment,
  CategoryDecision as RecommendationEngineCategoryDecision,
  ConditionerCategoryDecision as RecommendationEngineConditionerCategoryDecision,
  DamageAssessment as RecommendationEngineDamageAssessment,
  DamageLevel,
  InterventionPlan as RecommendationEngineInterventionPlan,
  LeaveInCategoryDecision as RecommendationEngineLeaveInCategoryDecision,
  MaskCategoryDecision as RecommendationEngineMaskCategoryDecision,
  RecommendationRequestContext as RecommendationEngineRequestContext,
  ShampooCategoryDecision as RecommendationEngineShampooCategoryDecision,
} from "@/lib/recommendation-engine/types"
import type { ShampooBucket, ShampooBucketPair } from "@/lib/shampoo/constants"

export type {
  HairTexture,
  HairThickness,
  HairDensity,
  WashFrequency,
  HeatStyling,
  Concern,
  Goal,
  StylingTool,
  CuticleCondition,
  ProteinMoistureBalance,
  ScalpType,
  ScalpCondition,
  ChemicalTreatment,
  DesiredVolume,
  PostWashAction,
  RoutinePreference,
  RoutineProduct,
  ShampooBucket,
  ShampooBucketPair,
}

export {
  HAIR_TEXTURE_OPTIONS,
  HAIR_THICKNESS_OPTIONS,
  HAIR_DENSITY_OPTIONS,
  CONCERN_OPTIONS,
  GOAL_OPTIONS,
  WASH_FREQUENCY_OPTIONS,
  HEAT_STYLING_OPTIONS,
  STYLING_TOOL_OPTIONS,
  CONCERN_LABELS,
  GOAL_LABELS,
  STYLING_TOOL_LABELS,
  CUTICLE_CONDITION_LABELS,
  PROTEIN_MOISTURE_LABELS,
  HAIR_DENSITY_LABELS,
  SCALP_TYPE_LABELS,
  SCALP_CONDITION_LABELS,
  CHEMICAL_TREATMENT_LABELS,
  DESIRED_VOLUME_LABELS,
  DESIRED_VOLUME_OPTIONS,
  POST_WASH_ACTION_OPTIONS,
  ROUTINE_PREFERENCE_OPTIONS,
  ROUTINE_PRODUCT_OPTIONS,
} from "@/lib/vocabulary"

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  is_admin: boolean
  onboarding_completed: boolean
  onboarding_step: string
  has_seen_completion_popup: boolean
  locale: string
  subscription_tier_id: string | null
  message_count_this_month: number
  message_count_reset_at: string | null
  created_at: string
  updated_at: string
}

export interface HairProfile {
  id: string
  user_id: string
  hair_texture: HairTexture | null
  thickness: HairThickness | null
  density: HairDensity | null
  concerns: Concern[]
  products_used: string | null
  wash_frequency: WashFrequency | null
  heat_styling: HeatStyling | null
  styling_tools: StylingTool[]
  goals: Goal[]
  cuticle_condition: CuticleCondition | null
  protein_moisture_balance: ProteinMoistureBalance | null
  scalp_type: ScalpType | null
  scalp_condition: ScalpCondition | null
  chemical_treatment: ChemicalTreatment[]
  desired_volume: DesiredVolume | null
  post_wash_actions: PostWashAction[]
  routine_preference: RoutinePreference | null
  current_routine_products: RoutineProduct[]
  mechanical_stress_factors: MechanicalStressFactor[]
  towel_material: TowelMaterial | null
  towel_technique: TowelTechnique | null
  drying_method: DryingMethod[]
  brush_type: BrushType | null
  night_protection: NightProtection[]
  uses_heat_protection: boolean
  additional_notes: string | null
  conversation_memory: string | null
  created_at: string
  updated_at: string
}

export type UserMemoryKind =
  | "preference"
  | "routine"
  | "product_experience"
  | "hair_history"
  | "progress"
  | "sensitivity"
  | "medical_context"
  | "legacy_summary"
  | "other"

export type UserMemorySource = "chat" | "manual" | "legacy"
export type UserMemoryStatus = "active" | "archived"

export interface UserMemorySettings {
  user_id: string
  memory_enabled: boolean
  created_at: string
  updated_at: string
}

export interface UserMemoryEntry {
  id: string
  user_id: string
  kind: UserMemoryKind
  content: string
  normalized_key: string
  source: UserMemorySource
  source_conversation_id: string | null
  evidence: string | null
  confidence: number | null
  metadata: Record<string, unknown>
  status: UserMemoryStatus
  superseded_by: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  name: string
  brand: string | null
  description: string | null
  short_description: string | null

  category: string | null
  affiliate_link: string | null
  image_url: string | null
  price_eur: number | null
  currency: string
  tags: string[]
  suitable_thicknesses: string[]
  suitable_concerns: string[]
  shampoo_bucket_pairs?: ShampooBucketPair[] | null
  is_active: boolean
  sort_order: number
  conditioner_specs?: ProductConditionerSpecs | null
  leave_in_specs?: ProductLeaveInSpecs | null
  mask_specs?: ProductMaskSpecs | null
  bondbuilder_specs?: ProductBondbuilderSpecs | null
  deep_cleansing_shampoo_specs?: ProductDeepCleansingShampooSpecs | null
  dry_shampoo_specs?: ProductDryShampooSpecs | null
  peeling_specs?: ProductPeelingSpecs | null
  recommendation_meta?: RecommendationMetadata | null
  created_at: string
  updated_at: string
}

export interface BaseRecommendationMetadata {
  category:
    | "shampoo"
    | "conditioner"
    | "leave_in"
    | "mask"
    | "oil"
    | "bondbuilder"
    | "deep_cleansing_shampoo"
    | "dry_shampoo"
    | "peeling"
  score: number
  top_reasons: string[]
  tradeoffs: string[]
  usage_hint: string
}

export interface ShampooMatchedProfile {
  thickness: HairThickness | null
  scalp_type: ScalpType | null
  scalp_condition: ScalpCondition | null
}

export type ShampooProfileField = "thickness" | "scalp_type" | "scalp_condition"

export interface ShampooRecommendationMetadata extends BaseRecommendationMetadata {
  category: "shampoo"
  matched_profile: ShampooMatchedProfile
  matched_bucket: ShampooBucket | null
  matched_concern_code: string | null
}

export interface ConditionerMatchedProfile {
  thickness: HairThickness | null
  density: HairDensity | null
  protein_moisture_balance: ProteinMoistureBalance | null
  cuticle_condition: CuticleCondition | null
  chemical_treatment: ChemicalTreatment[]
}

export type ConditionerProfileField = "thickness" | "protein_moisture_balance"
export type ConditionerBalanceNeed = "moisture" | "balanced" | "protein"

export interface ConditionerRecommendationMetadata extends BaseRecommendationMetadata {
  category: "conditioner"
  matched_profile: ConditionerMatchedProfile
  matched_weight: ConditionerWeight | null
  matched_repair_level: ConditionerRepairLevel | null
  matched_balance_need: ConditionerBalanceNeed | null
}

export interface LeaveInMatchedProfile {
  hair_texture: HairTexture | null
  thickness: HairThickness | null
  density: HairDensity | null
  cuticle_condition: CuticleCondition | null
  chemical_treatment: ChemicalTreatment[]
}

export type LeaveInProfileField =
  | "hair_texture"
  | "thickness"
  | "density"
  | "care_signal"
  | "styling_signal"

export interface LeaveInRecommendationMetadata extends BaseRecommendationMetadata {
  category: "leave_in"
  matched_profile: LeaveInMatchedProfile
  need_bucket: LeaveInNeedBucket | null
  styling_context: LeaveInStylingContext | null
  conditioner_relationship: LeaveInConditionerRelationship | null
  matched_weight: LeaveInWeight | null
}

export interface OilMatchedProfile {
  thickness: HairThickness | null
}

export type OilProfileField = "thickness" | "oil_purpose"

export interface OilRecommendationMetadata extends BaseRecommendationMetadata {
  category: "oil"
  matched_profile: OilMatchedProfile
  matched_subtype: OilSubtype | null
  use_mode: OilUseMode | null
  adjunct_scalp_support: boolean
}

export type MaskType = "protein" | "moisture" | "performance"
export type MaskNeedStrength = 1 | 2 | 3
export type MaskSignal =
  | "chemical_treatment"
  | "heat_styling"
  | "protein_moisture_balance"
  | "mechanical_stress"

export interface MaskRecommendationMetadata extends BaseRecommendationMetadata {
  category: "mask"
  mask_type: MaskType
  need_strength: MaskNeedStrength
}

export interface BondbuilderRecommendationMetadata extends BaseRecommendationMetadata {
  category: "bondbuilder"
  matched_intensity: ProductBondRepairIntensity | null
  application_mode: ProductBondApplicationMode | null
}

export interface DeepCleansingShampooRecommendationMetadata extends BaseRecommendationMetadata {
  category: "deep_cleansing_shampoo"
  scalp_type_focus: ProductScalpTypeFocus | null
  reset_need_level: DamageLevel
}

export interface DryShampooRecommendationMetadata extends BaseRecommendationMetadata {
  category: "dry_shampoo"
  scalp_type_focus: Exclude<ProductScalpTypeFocus, "dry"> | null
}

export interface PeelingRecommendationMetadata extends BaseRecommendationMetadata {
  category: "peeling"
  scalp_type_focus: ProductScalpTypeFocus | null
  peeling_type: ProductPeelingType | null
}

export type RecommendationMetadata =
  | ShampooRecommendationMetadata
  | ConditionerRecommendationMetadata
  | LeaveInRecommendationMetadata
  | OilRecommendationMetadata
  | MaskRecommendationMetadata
  | BondbuilderRecommendationMetadata
  | DeepCleansingShampooRecommendationMetadata
  | DryShampooRecommendationMetadata
  | PeelingRecommendationMetadata

export interface ShampooDecision {
  category: "shampoo"
  eligible: boolean
  missing_profile_fields: ShampooProfileField[]
  matched_profile: ShampooMatchedProfile
  matched_bucket: ShampooBucket | null
  /** Secondary bucket for dandruff rotation (scalp-type-based gentle shampoo) */
  secondary_bucket: ShampooBucket | null
  matched_concern_code: string | null
  retrieval_filter: {
    thickness: HairThickness | null
    concern: string | null
  }
  candidate_count: number
  no_catalog_match: boolean
}

export interface ConditionerDecision {
  category: "conditioner"
  eligible: boolean
  missing_profile_fields: ConditionerProfileField[]
  matched_profile: ConditionerMatchedProfile
  matched_concern_code: string | null
  matched_weight: ConditionerWeight | null
  matched_repair_level: ConditionerRepairLevel | null
  matched_balance_need: ConditionerBalanceNeed | null
  candidate_count: number
  no_catalog_match: boolean
  used_density: boolean
}

export interface LeaveInDecision {
  category: "leave_in"
  eligible: boolean
  missing_profile_fields: LeaveInProfileField[]
  matched_profile: LeaveInMatchedProfile
  need_bucket: LeaveInNeedBucket | null
  styling_context: LeaveInStylingContext | null
  conditioner_relationship: LeaveInConditionerRelationship | null
  matched_weight: LeaveInWeight | null
  candidate_count: number
  no_catalog_match: boolean
}

export interface OilDecision {
  category: "oil"
  eligible: boolean
  missing_profile_fields: OilProfileField[]
  matched_profile: OilMatchedProfile
  matched_subtype: OilSubtype | null
  use_mode: OilUseMode | null
  adjunct_scalp_support: boolean
  candidate_count: number
  no_catalog_match: boolean
  no_recommendation: boolean
  no_recommendation_reason: OilNoRecommendationReason | null
}

export type CategoryDecision = ShampooDecision | ConditionerDecision | LeaveInDecision | OilDecision

export type ChatCategoryDecision = CategoryDecision | RecommendationEngineCategoryDecision

export interface RecommendationEngineTrace {
  request_context: RecommendationEngineRequestContext
  damage: RecommendationEngineDamageAssessment
  care_needs: RecommendationEngineCareNeedAssessment
  intervention_plan: RecommendationEngineInterventionPlan
  unsupported_routine_categories: string[]
}

export interface MaskDecision {
  needs_mask: boolean
  need_strength: 0 | MaskNeedStrength
  mask_type: MaskType | null
  active_signals: MaskSignal[]
  signal_weights?: Record<MaskSignal, number>
}

export type RoutineTopicId =
  | "routine_glatt"
  | "routine_locken"
  | "locken_wellen"
  | "tiefenreinigung"
  | "hair_oiling"
  | "bond_builder"
  | "brush_tools"
  | "lockenrefresh"
  | "cwc"
  | "owc"

export type RoutineFocusKind = "goal" | "concern" | "topic" | "pattern" | "scalp"
export type RoutineSlotAction = "keep" | "adjust" | "add" | "upgrade" | "avoid"
export type RoutinePlanPhase = "base_wash" | "maintenance" | "occasional"
export type RoutineSlotKind = "product_slot" | "instruction"
export type RoutineProductCategory = Exclude<ProductCategory, "routine" | null>

export interface RoutineFocus {
  kind: RoutineFocusKind
  code: string
  label: string
}

export interface RoutineContext {
  hair_texture: HairTexture | null
  thickness: HairThickness | null
  density: HairDensity | null
  wash_frequency: WashFrequency | null
  heat_styling: HeatStyling | null
  scalp_type: ScalpType | null
  scalp_condition: ScalpCondition | null
  cuticle_condition: CuticleCondition | null
  protein_moisture_balance: ProteinMoistureBalance | null
  concerns: Concern[]
  goals: Goal[]
  chemical_treatment: ChemicalTreatment[]
  post_wash_actions: PostWashAction[]
  mechanical_stress_factors: MechanicalStressFactor[]
  current_routine_products: RoutineProduct[]
  products_used: string | null
  explicit_topic_ids: RoutineTopicId[]
  primary_focuses: RoutineFocus[]
  organizer_complete: boolean
  cadence_complete: boolean
  inventory_complete: boolean
  has_between_wash_days: boolean
  has_buildup_signals: boolean
  has_scalp_clarify_signals: boolean
  has_hair_reset_signals: boolean
  has_hard_reset_signals: boolean
  has_sensitive_scalp_signals: boolean
  has_dryness_damage_signals: boolean
  has_damage_signals: boolean
  has_bond_builder_signals: boolean
  has_oil_weight_risk: boolean
  has_wash_protection_need: boolean
  uses_heat_protection: boolean
}

export interface RoutineTopicActivation {
  id: RoutineTopicId
  label: string
  reason: string
  priority: number
  instruction_only: boolean
}

export interface RoutineSlotAdvice {
  id: string
  kind: RoutineSlotKind
  phase: RoutinePlanPhase
  label: string
  action: RoutineSlotAction
  category: RoutineProductCategory | null
  cadence: string | null
  rationale: string[]
  caveats: string[]
  topic_ids: RoutineTopicId[]
  product_linkable: boolean
  product_query: string | null
  attachment_priority: number
  attached_products?: Product[]
}

export interface RoutinePlanSection {
  phase: RoutinePlanPhase
  title: string
  summary: string
  slots: RoutineSlotAdvice[]
}

export interface RoutineDecisionContext {
  shampoo: RecommendationEngineShampooCategoryDecision
  conditioner: RecommendationEngineConditionerCategoryDecision
  leave_in: RecommendationEngineLeaveInCategoryDecision
  mask: RecommendationEngineMaskCategoryDecision
}

export interface RoutinePlan {
  base_topic_id: RoutineTopicId | null
  primary_focuses: RoutineFocus[]
  active_topics: RoutineTopicActivation[]
  compare_cwc_owc: boolean
  sections: RoutinePlanSection[]
  decision_context: RoutineDecisionContext
}

export interface MessageRagContext {
  sources: CitationSource[]
  category_decision?: ChatCategoryDecision | null
  engine_trace?: RecommendationEngineTrace | null
  response_mode?: ResponseMode | null
}

export interface ChatPromptMessageSnapshot {
  role: "system" | "user" | "assistant"
  content: string
}

export interface LangfusePromptReference {
  name: string
  version: number | null
  label: string
  is_fallback: boolean
}

export interface ChatPromptSnapshot {
  model: string
  temperature: number
  prompt_ref: LangfusePromptReference
  system_prompt: string
  messages: ChatPromptMessageSnapshot[]
}

export interface ChatRetrievedChunkTrace {
  chunk_id: string
  source_type: string
  source_name: string | null
  retrieval_path?: "dense" | "lexical" | "hybrid"
  weighted_similarity: number
  similarity: number
  dense_score?: number
  lexical_score?: number
  fused_score?: number
  content_preview: string
}

export interface ChatMatchedProductTrace {
  id: string
  name: string
  brand: string | null
  category: string | null
  score: number | null
  top_reasons: string[]
}

export interface ChatTraceLatencyBreakdown {
  classification_ms: number
  hair_profile_load_ms: number
  routine_inventory_load_ms?: number
  memory_load_ms: number
  routine_planning_ms: number
  history_load_ms: number
  router_ms: number
  conversation_create_ms: number
  retrieval_ms: number
  product_matching_ms: number
  prompt_build_ms: number
  stream_setup_ms: number
  stream_read_ms?: number
  total_ms?: number
}

export interface ChatTurnTrace {
  trace_version: number
  request_id: string
  started_at: string
  completed_at: string
  status: "completed" | "failed"
  user_message: string
  conversation_id: string | null
  intent: IntentType
  product_category: ProductCategory
  conversation_history_count: number
  classification: ClassificationResult
  router_decision: RouterDecision
  clarification_questions: string[]
  hair_profile_snapshot: HairProfile | null
  memory_context: string | null
  retrieval: {
    requested_count: number
    source_types: string[] | null
    metadata_filter: Record<string, string> | null
    subqueries: string[]
    candidate_count_before_rerank: number
    reranked_count: number
    fallback_used: boolean
    final_context_count: number
    chunks: ChatRetrievedChunkTrace[]
  }
  decision_context: {
    should_plan_routine: boolean
    routine_plan: RoutinePlan | null
    category_decision: ChatCategoryDecision | null
    engine_trace: RecommendationEngineTrace | null
    matched_products: ChatMatchedProductTrace[]
  }
  prompt_refs: {
    classification: LangfusePromptReference
    synthesis: LangfusePromptReference
  }
  prompt: ChatPromptSnapshot
  response: {
    assistant_content: string
    sources: CitationSource[]
    product_count: number
  }
  latencies_ms: ChatTraceLatencyBreakdown
  error: string | null
}

export interface ConversationTurnTrace {
  id: string
  conversation_id: string | null
  user_id: string
  user_message_id: string | null
  assistant_message_id: string | null
  langfuse_trace_id: string | null
  langfuse_trace_url: string | null
  status: "completed" | "failed"
  trace: ChatTurnTrace
  created_at: string
  updated_at: string
}

export interface Conversation {
  id: string
  user_id: string
  title: string | null
  is_active: boolean
  message_count: number
  memory_extracted_at_count: number
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  conversation_id: string
  role: "user" | "assistant" | "system"
  content: string | null
  product_recommendations: Product[] | null
  rag_context: MessageRagContext | null
  token_usage: Record<string, number> | null
  langfuse_trace_id: string | null
  langfuse_trace_url: string | null
  user_feedback_score: -1 | 1 | null
  user_feedback_at: string | null
  created_at: string
}

export interface DailyQuote {
  id: string
  quote_text: string
  author: string | null
  display_date: string | null
  is_active: boolean
  created_at: string
}

export interface Article {
  id: string
  title: string
  slug: string
  excerpt: string | null
  body: string | null
  cover_image_url: string | null
  category: string | null
  tags: string[]
  is_published: boolean
  published_at: string | null
  author_name: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface ContentChunk {
  id: string
  source_type: string
  source_name: string | null
  chunk_index: number | null
  content: string
  token_count: number | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface CitationSource {
  index: number // 1-based, matches [1] markers
  source_type: string // "book", "product_list", etc.
  label: string // German: "Fachbuch", "Produktmatrix"
  source_name: string | null
  snippet: string // First ~200 chars of chunk content
}

export type IntentType =
  | "product_recommendation"
  | "hair_care_advice"
  | "diagnosis"
  | "routine_help"
  | "ingredient_question"
  | "general_chat"
  | "followup"

export type ProductCategory =
  | "shampoo"
  | "conditioner"
  | "mask"
  | "oil"
  | "leave_in"
  | "bondbuilder"
  | "deep_cleansing_shampoo"
  | "dry_shampoo"
  | "peeling"
  | "routine"
  | null

export type RetrievalMode = "faq" | "hybrid" | "hybrid_plus_graph" | "product_sql_plus_hybrid"

export type ResponseMode = "clarify_only" | "recommend_and_refine" | "answer_direct"

export interface ClassificationResult {
  intent: IntentType
  product_category: ProductCategory
  /** Query complexity level */
  complexity: "simple" | "multi_constraint" | "multi_hop"
  /** LLM suggestion: whether clarification is needed (policy may override) */
  needs_clarification: boolean
  /** LLM suggestion: retrieval path (policy may override) */
  retrieval_mode: RetrievalMode
  /** Normalized filter values extracted from query */
  normalized_filters: Record<string, string | string[] | null>
  /** Router confidence score (0-1) */
  router_confidence: number
}

export interface RouterDecision {
  retrieval_mode: RetrievalMode
  response_mode: ResponseMode
  clarification_reason?: string
  slot_completeness: number // 0–1
  confidence: number
  policy_overrides: string[] // e.g. ["low_confidence", "missing_slots"]
}

export interface ChatSSEEvent {
  type:
    | "conversation_id"
    | "content_delta"
    | "product_recommendations"
    | "sources"
    | "confidence"
    | "retrieval_debug"
    | "done"
    | "error"
  data: unknown
}

/** Enriched citation source with optional hybrid retrieval metadata */
export interface EnrichedCitationSource extends CitationSource {
  confidence?: number
  retrieval_path?: "dense" | "lexical" | "hybrid"
}
