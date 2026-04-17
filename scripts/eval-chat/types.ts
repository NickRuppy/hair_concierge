/**
 * Chat Evaluation Harness — Shared Types
 */

export interface HairProfileOverrides {
  hair_texture?: string | null
  thickness?: string | null
  density?: string | null
  concerns?: string[]
  protein_moisture_balance?: string | null
  cuticle_condition?: string | null
  scalp_type?: string | null
  scalp_condition?: string | null
  chemical_treatment?: string[]
  wash_frequency?: string | null
  heat_styling?: string | null
  drying_method?: string | null
  towel_technique?: string | null
  brush_type?: string | null
  night_protection?: string[] | null
  goals?: string[]
  onboarding_completed?: boolean
}

export interface RoutineInventorySeed {
  category: string
  product_name?: string | null
  frequency_range?: string | null
}

export interface MetadataAssertions {
  /** Exact match or one-of array (for LLM-routed fields) */
  intent?: string | string[]
  /** Exact match or one-of array */
  retrieval_mode?: string | string[]
  /** Exact match or one-of array for response mode */
  response_mode?: string | string[]
  /** All of these must be present in policy_overrides */
  policy_overrides_include?: string[]
  /** None of these may be present in policy_overrides */
  policy_overrides_exclude?: string[]
  needs_clarification?: boolean
  source_count_min?: number
  source_count_max?: number
  product_count_min?: number
  product_count_max?: number
  /** Partial match against category_decision object */
  category_decision?: Record<string, unknown>
}

export interface ContentHeuristics {
  /** Require German language (check for common German stopwords) */
  must_be_german?: boolean
  /** At least one citation marker [N] must be present */
  citations_present?: boolean
  /** Case-insensitive: at least one of these must appear */
  required_keywords?: string[]
  /** Case-insensitive: none of these may appear */
  forbidden_keywords?: string[]
  /** Response must be at least this long */
  min_length?: number
}

export interface JudgeSpec {
  /** Natural language description of expected behavior */
  expected_behavior: string
}

export interface EvalTurn {
  message: string
  metadata?: MetadataAssertions
  content?: ContentHeuristics
  judge?: JudgeSpec
}

export interface EvalScenario {
  id: string
  name: string
  description: string
  hair_profile: HairProfileOverrides
  routine_inventory?: RoutineInventorySeed[]
  turns: EvalTurn[]
}

// ── Results ──

export interface SSEResult {
  conversation_id: string | null
  assistant_message_id: string | null
  langfuse_trace_id: string | null
  langfuse_trace_url: string | null
  content: string
  done_data: Record<string, unknown> | null
  sources: unknown[]
  products: unknown[]
  error: string | null
  latency_ms: number
}

export interface AssertionResult {
  tier: "metadata" | "content" | "db" | "judge"
  name: string
  passed: boolean
  expected: string
  actual: string
}

export interface JudgeVerdict {
  verdict: "pass" | "fail"
  score: number
  reasoning: string
  issues: string[]
}

export interface QualityRubricResult {
  groundedness: number
  recommendation_relevance: number
  clarification_quality: number
  overclaim_risk: number
  overall_quality: number
  summary: string
  issues: string[]
}

export interface TurnResult {
  turn_index: number
  message: string
  sse_result: SSEResult
  assertions: AssertionResult[]
  judge_result: JudgeVerdict | null
  quality_rubric: QualityRubricResult | null
  all_passed: boolean
}

export interface ScenarioResult {
  id: string
  name: string
  passed: boolean
  turns: TurnResult[]
}

export interface LangfuseExperimentSummary {
  experiment_id: string
  run_name: string
  dataset_run_id?: string
  dataset_run_url?: string
}

export interface EvalReport {
  timestamp: string
  base_url: string
  duration_ms: number
  langfuse_experiment?: LangfuseExperimentSummary | null
  summary: {
    total_scenarios: number
    passed: number
    failed: number
    total_assertions: number
    assertion_failures: number
  }
  scenarios: ScenarioResult[]
}
