import { expect, test } from "@playwright/test"
import {
  buildPipelineTraceDraft,
  finalizeChatTurnTrace,
  summarizeEngineTraceForLangfuse,
  summarizeProductsForLangfuse,
} from "../src/lib/chat-runtime/debug-trace"
import {
  buildRecommendationEngineRuntimeForChat,
  buildRecommendationEngineTrace,
} from "../src/lib/recommendation-engine/chat"
import { summarizeAgentV2TraceForLangfuse } from "../src/lib/agent-v2/production/langfuse-observability"
import { createDefaultConversationState } from "../src/lib/chat-runtime/conversation-state"
import type {
  AgenticToolLoopTrace,
  ChatPromptSnapshot,
  ClassificationResult,
  ConversationStateTransition,
  HairProfile,
  Product,
  RouterDecision,
  RoutinePlan,
} from "../src/lib/types"
import type { AgentV2Trace } from "../src/lib/agent-v2/contracts"

const legacyResponseComposition = {
  path: "legacy_synthesizer" as const,
  migration_mode: "legacy_only" as const,
  fallback_reason: null,
  rendering_path: null,
  plan_type: null,
  attachment_mode: null,
}

const agentResponseComposition = {
  path: "agent_final_render" as const,
  migration_mode: "legacy_only" as const,
  fallback_reason: null,
  rendering_path: null,
  plan_type: "agent_v1",
  attachment_mode: "text_only" as const,
}

function createProfile(overrides: Partial<HairProfile> = {}): HairProfile {
  return {
    id: "profile-1",
    user_id: "user-1",
    hair_texture: "wavy",
    thickness: "fine",
    hair_length: null,
    density: "medium",
    concerns: ["frizz"],
    products_used: null,
    shampoo_frequency: "weekly_3_4x",
    heat_styling: "never",
    styling_tools: [],
    goals: ["less_frizz"],
    cuticle_condition: "rough",
    protein_moisture_balance: "stretches_bounces",
    scalp_type: "balanced",
    scalp_condition: null,
    chemical_treatment: ["colored"],
    desired_volume: "balanced",
    routine_preference: "balanced",
    current_routine_products: ["shampoo", "conditioner"],
    towel_material: null,
    towel_technique: null,
    drying_method: "air_dry",
    brush_type: null,
    night_protection: [],
    uses_heat_protection: false,
    additional_notes: null,
    conversation_memory: null,
    created_at: "2026-04-10T00:00:00.000Z",
    updated_at: "2026-04-10T00:00:00.000Z",
    ...overrides,
  }
}

function createAgenticToolLoopTrace(): AgenticToolLoopTrace {
  return {
    engine_variant: "tool_loop",
    answer_composition_mode: "composer_context",
    loaded_guidance_ids: ["topic:shampoo"],
    answer_context_capsule_ids: ["global.natural_consultant"],
    consultation_brief_summary: {
      charter_count: 2,
      profile_overlay_ids: ["overlay:fine_hair"],
      candidate_guidance_ids: ["topic:shampoo"],
    },
    repair_attempts: [],
    failure_stage: null,
    visible_failure: false,
    model_steps: [
      {
        step_index: 1,
        type: "tool_calls",
        finish_reason: "tool_calls",
        tool_call_names: ["select_products"],
      },
      {
        step_index: 2,
        type: "tool_calls",
        finish_reason: "tool_calls",
        tool_call_names: ["submit_final_answer"],
      },
    ],
    tool_calls: [
      {
        id: "call-1",
        name: "select_products",
        status: "executed",
        latency_ms: 42,
        input_summary: "category=shampoo",
        output_summary: "1 product",
      },
      {
        id: "call-2",
        name: "submit_final_answer",
        status: "executed",
      },
    ],
    blocked_tool_calls: [
      {
        id: "call-blocked",
        name: "load_guidance",
        reason: "not_exposed_in_v1",
      },
    ],
    guardrails: ["blocked_unknown_tool"],
    latency_ms: 320,
    token_usage: {
      prompt_tokens: 120,
      completion_tokens: 64,
      total_tokens: 184,
    },
  }
}

function createClassification(overrides: Partial<ClassificationResult> = {}): ClassificationResult {
  return {
    intent: "routine_help",
    product_category: "routine",
    complexity: "multi_constraint",
    needs_clarification: false,
    retrieval_mode: "hybrid",
    normalized_filters: {
      problem: "Frizz in den Laengen",
      duration: null,
      products_tried: null,
      routine: "2-3x pro Woche waschen",
      special_circumstances: "coloriert",
    },
    router_confidence: 0.91,
    ...overrides,
  }
}

function createRouterDecision(overrides: Partial<RouterDecision> = {}): RouterDecision {
  return {
    retrieval_mode: "hybrid",
    response_mode: "answer_direct" as const,
    clarification_reason: undefined,
    slot_completeness: 0.8,
    confidence: 0.91,
    policy_overrides: ["faq_shortcut"],
    ...overrides,
  }
}

function createProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "product-1",
    name: "Repair Conditioner",
    brand: "HC",
    description: null,
    short_description: "Leichter Conditioner",

    category: "conditioner",
    affiliate_link: null,
    image_url: null,
    price_eur: 19.9,
    currency: "EUR",
    tags: [],
    suitable_thicknesses: ["fine"],
    suitable_concerns: ["frizz"],
    shampoo_bucket_pairs: null,
    is_active: true,
    sort_order: 0,
    conditioner_specs: null,
    leave_in_specs: null,
    mask_specs: null,
    recommendation_meta: {
      category: "conditioner",
      score: 8.7,
      top_reasons: ["leicht genug fuer feines Haar", "passt zum Feuchtigkeitsfokus"],
      tradeoffs: [],
      usage_hint: "Nur in Laengen und Spitzen.",
      matched_profile: {
        thickness: "fine",
        density: "medium",
        protein_moisture_balance: "stretches_bounces",
        cuticle_condition: "rough",
        chemical_treatment: ["colored"],
      },
      matched_weight: "light",
      matched_repair_level: "medium",
      matched_balance_need: "moisture",
    },
    created_at: "2026-04-10T00:00:00.000Z",
    updated_at: "2026-04-10T00:00:00.000Z",
    ...overrides,
  }
}

function createRoutinePlan(): RoutinePlan {
  return {
    base_topic_id: "owc",
    primary_focuses: [{ kind: "topic", code: "owc", label: "Wash Protection" }],
    active_topics: [
      {
        id: "owc",
        label: "OWC",
        reason: "Mehrere Schadenssignale vorhanden.",
        priority: 10,
        instruction_only: false,
      },
    ],
    compare_cwc_owc: false,
    sections: [],
    decision_context: {
      shampoo: {
        category: "shampoo",
        relevant: true,
        action: "keep",
        planReasonCodes: ["baseline_shampoo_present"],
        currentInventory: null,
        targetProfile: {
          scalpRoute: "balanced",
          shampooBucket: "normal",
          secondaryBucket: null,
          cleansingIntensity: "regular",
        },
        notes: [],
      },
      conditioner: {
        category: "conditioner",
        relevant: true,
        action: "replace",
        planReasonCodes: ["conditioner_repair_upgrade"],
        currentInventory: null,
        targetProfile: {
          balance: "moisture",
          repairLevel: "medium",
          weight: "light",
          thickness: "fine",
          activeDamageDrivers: [],
        },
        notes: [],
      },
      leave_in: {
        category: "leave_in",
        relevant: true,
        action: "add",
        planReasonCodes: ["leave_in_definition_support"],
        currentInventory: null,
        targetProfile: {
          needBucket: "curl_definition",
          stylingContext: "air_dry",
          heatProtectionNeed: "none",
          stylingPrepNeed: "definition",
          conditionerRelationship: "booster_only",
          weight: "light",
          balanceDirection: "moisture",
          careBenefits: ["curl_definition", "detangle_smooth"],
          applicationStageNeed: null,
          hasSeparateHeatProtectant: false,
          thickness: "fine",
        },
        notes: [],
      },
      mask: {
        category: "mask",
        relevant: false,
        action: null,
        planReasonCodes: [],
        currentInventory: null,
        targetProfile: null,
        notes: [],
      },
    },
  }
}

function createPromptSnapshot(): ChatPromptSnapshot {
  return {
    kind: "legacy_synth_prompt",
    model: "gpt-4o",
    temperature: 0.7,
    prompt_ref: {
      name: "chaarlie-chat-system",
      version: 3,
      label: "staging",
      is_fallback: false,
    },
    system_prompt: "System prompt snapshot",
    messages: [
      { role: "system", content: "System prompt snapshot" },
      { role: "user", content: "Soll ich OWC testen?" },
    ],
  }
}

function createConversationStateTransition(): ConversationStateTransition {
  const previousState = createDefaultConversationState()

  return {
    previous_state: previousState,
    next_state: {
      ...previousState,
      active_topic: "routine",
      last_assistant_action: "answered_routine",
    },
    reason: "routine_started",
    changed_fields: ["active_topic", "last_assistant_action"],
    classifier_override: null,
  }
}

test.describe("Chat debug trace", () => {
  test("builds a draft with matching details and no retrieval artifact", () => {
    const draft = buildPipelineTraceDraft({
      request_id: "req-1",
      started_at: "2026-04-10T10:00:00.000Z",
      user_message: "Soll ich OWC testen?",
      conversation_id: "conv-1",
      intent: "routine_help",
      product_category: "routine",
      conversation_history_count: 2,
      classification: createClassification(),
      router_decision: createRouterDecision(),
      conversation_state: createConversationStateTransition(),
      clarification_questions: [],
      hair_profile_snapshot: createProfile(),
      memory_context: "Nutzer mochte leichte Produkte.",
      should_plan_routine: true,
      routine_plan: createRoutinePlan(),
      matched_products: [createProduct()],
      classification_prompt_ref: {
        name: "chaarlie-intent-classifier",
        version: 2,
        label: "staging",
        is_fallback: false,
      },
      prompt: createPromptSnapshot(),
      response_composition: legacyResponseComposition,
      latencies_ms: {
        classification_ms: 20,
        hair_profile_load_ms: 5,
        memory_load_ms: 4,
        routine_planning_ms: 8,
        history_load_ms: 3,
        router_ms: 1,
        conversation_create_ms: 7,
        retrieval_ms: 42,
        product_matching_ms: 18,
        prompt_build_ms: 10,
        stream_setup_ms: 55,
      },
    })

    expect("retrieval" in draft).toBe(false)
    expect(draft.decision_context.matched_products[0].top_reasons).toContain(
      "leicht genug fuer feines Haar",
    )
    expect(draft.decision_context.matched_products[0]).toMatchObject({
      tradeoffs: [],
      usage_hint: "Nur in Laengen und Spitzen.",
      recommendation_meta: expect.objectContaining({
        category: "conditioner",
        matched_weight: "light",
      }),
    })
    expect(draft.response_composition).toEqual(legacyResponseComposition)
    expect(summarizeProductsForLangfuse(draft.decision_context.matched_products)).toEqual([
      expect.objectContaining({
        id: "product-1",
        category: "conditioner",
        top_reasons: ["leicht genug fuer feines Haar", "passt zum Feuchtigkeitsfokus"],
        has_usage_hint: true,
      }),
    ])
  })

  test("finalizes a source-free trace and exposes compact chat debug metadata", () => {
    const profile = createProfile()
    const engineTrace = buildRecommendationEngineTrace({
      runtime: buildRecommendationEngineRuntimeForChat({
        hairProfile: profile,
        routineItems: [],
        productCategory: "routine",
        shouldPlanRoutine: true,
        message: "Was ist besser, CWC oder OWC?",
      }),
    })

    const draft = buildPipelineTraceDraft({
      request_id: "req-2",
      started_at: "2026-04-10T10:00:00.000Z",
      user_message: "Was ist besser, CWC oder OWC?",
      conversation_id: "conv-2",
      intent: "routine_help",
      product_category: "routine",
      conversation_history_count: 0,
      classification: createClassification(),
      router_decision: createRouterDecision({ policy_overrides: ["missing_routine_frame"] }),
      conversation_state: createConversationStateTransition(),
      clarification_questions: ["Wie oft waeschst du aktuell?"],
      hair_profile_snapshot: profile,
      memory_context: null,
      should_plan_routine: true,
      routine_plan: createRoutinePlan(),
      engine_trace: engineTrace,
      matched_products: [],
      classification_prompt_ref: {
        name: "chaarlie-intent-classifier",
        version: 2,
        label: "staging",
        is_fallback: false,
      },
      prompt: createPromptSnapshot(),
      response_composition: legacyResponseComposition,
      latencies_ms: {
        classification_ms: 12,
        hair_profile_load_ms: 4,
        memory_load_ms: 3,
        routine_planning_ms: 7,
        history_load_ms: 2,
        router_ms: 1,
        conversation_create_ms: 0,
        retrieval_ms: 31,
        product_matching_ms: 0,
        prompt_build_ms: 9,
        stream_setup_ms: 44,
      },
    })

    const trace = finalizeChatTurnTrace(draft, {
      assistant_content: "OWC passt hier eher als gezielter Wash-Day-Schutz.",
      product_count: 0,
      status: "completed",
      stream_read_ms: 120,
      total_ms: 240,
    })

    expect(trace.status).toBe("completed")
    expect(trace.trace_version).toBe(3)
    expect(trace.latencies_ms.total_ms).toBe(240)
    expect("sources" in trace.response).toBe(false)
    expect("retrieval" in trace).toBe(false)
    expect(trace.response_composition).toEqual(legacyResponseComposition)
    expect(trace.conversation_state).toMatchObject({
      previous_state: expect.objectContaining({ active_topic: null }),
      next_state: expect.objectContaining({ active_topic: "routine" }),
      reason: "routine_started",
    })
    expect(trace.conversation_state_persistence).toEqual({
      status: "skipped",
      error: null,
    })
    expect(trace.decision_context.engine_trace?.categories).toMatchObject({
      shampoo: expect.objectContaining({ category: "shampoo" }),
      conditioner: expect.objectContaining({ category: "conditioner" }),
      mask: expect.objectContaining({ category: "mask" }),
      leave_in: expect.objectContaining({ category: "leave_in" }),
      oil: expect.objectContaining({ category: "oil" }),
      bondbuilder: expect.objectContaining({ category: "bondbuilder" }),
      deep_cleansing_shampoo: expect.objectContaining({ category: "deep_cleansing_shampoo" }),
      dry_shampoo: expect.objectContaining({ category: "dry_shampoo" }),
      peeling: expect.objectContaining({ category: "peeling" }),
    })
    expect(trace.decision_context.engine_trace?.care_balance.rows).toHaveLength(10)
    expect(trace.decision_context.engine_trace?.shampoo_cadence_assessment).toEqual(
      engineTrace.shampoo_cadence_assessment,
    )
    expect(trace.decision_context.engine_trace?.legacy_plan_comparison).toEqual(
      expect.objectContaining({
        projectedPlan: expect.objectContaining({
          steps: expect.any(Array),
        }),
        differences: expect.any(Array),
      }),
    )
    expect(summarizeEngineTraceForLangfuse(engineTrace)).toMatchObject({
      requested_category: "routine",
      damage: expect.objectContaining({
        confidence: expect.any(String),
        active_damage_driver_count: expect.any(Number),
      }),
      intervention: expect.objectContaining({
        deferred_step_count: expect.any(Number),
      }),
      care_balance: expect.objectContaining({
        rows: expect.any(Array),
        legacy_difference_count: expect.any(Number),
      }),
      relevant_categories: expect.any(Array),
    })
  })

  test("exposes response composition metadata in debug traces", () => {
    const draft = buildPipelineTraceDraft({
      request_id: "req-response-composition",
      started_at: "2026-04-10T10:00:00.000Z",
      user_message: "Okay, und was waere dann der erste Waschtag?",
      conversation_id: "conv-response-composition",
      intent: "routine_help",
      product_category: "routine",
      conversation_history_count: 4,
      classification: createClassification(),
      router_decision: createRouterDecision(),
      conversation_state: createConversationStateTransition(),
      clarification_questions: [],
      hair_profile_snapshot: createProfile(),
      memory_context: null,
      should_plan_routine: true,
      routine_plan: createRoutinePlan(),
      matched_products: [],
      classification_prompt_ref: {
        name: "bounded-agent-route-classification",
        version: 1,
        label: "staging",
        is_fallback: false,
      },
      prompt: createPromptSnapshot(),
      response_composition: agentResponseComposition,
      latencies_ms: {
        classification_ms: 10,
        hair_profile_load_ms: 4,
        memory_load_ms: 2,
        routine_planning_ms: 0,
        history_load_ms: 3,
        router_ms: 0,
        conversation_create_ms: 0,
        retrieval_ms: 0,
        product_matching_ms: 0,
        prompt_build_ms: 8,
        stream_setup_ms: 30,
      },
    })

    const trace = finalizeChatTurnTrace(draft, {
      assistant_content: "Dann halten wir den ersten Waschtag bewusst simpel.",
      product_count: 0,
      status: "completed",
      total_ms: 180,
    })
    expect(draft.response_composition).toEqual(agentResponseComposition)
    expect(trace.response_composition).toEqual(agentResponseComposition)
  })

  test("preserves compact tool-loop trace metadata without raw prompt context", () => {
    const agenticTrace = createAgenticToolLoopTrace()
    const draft = buildPipelineTraceDraft({
      request_id: "req-tool-loop",
      started_at: "2026-04-10T10:00:00.000Z",
      user_message: "welcges Shampoo sollte ich verwenden?",
      conversation_id: "conv-tool-loop",
      intent: "product_recommendation",
      product_category: "shampoo",
      conversation_history_count: 3,
      classification: createClassification({
        intent: "product_recommendation",
        product_category: "shampoo",
      }),
      router_decision: createRouterDecision({
        retrieval_mode: "agent_engine",
        response_mode: "answer_direct",
        policy_overrides: [],
      }),
      conversation_state: {
        ...createConversationStateTransition(),
        updated_by_engine: "tool_loop",
      },
      clarification_questions: [],
      hair_profile_snapshot: createProfile(),
      memory_context: null,
      should_plan_routine: false,
      matched_products: [createProduct({ category: "shampoo", name: "Mild Shampoo" })],
      classification_prompt_ref: {
        name: "agentic-tool-loop",
        version: 1,
        label: "staging",
        is_fallback: false,
      },
      prompt: createPromptSnapshot(),
      response_composition: legacyResponseComposition,
      agentic_tool_loop: agenticTrace,
      latencies_ms: {
        classification_ms: 0,
        hair_profile_load_ms: 3,
        memory_load_ms: 2,
        routine_planning_ms: 0,
        history_load_ms: 2,
        router_ms: 0,
        conversation_create_ms: 0,
        retrieval_ms: 0,
        product_matching_ms: 28,
        prompt_build_ms: 5,
        stream_setup_ms: 12,
      },
    })

    const trace = finalizeChatTurnTrace(draft, {
      assistant_content: "Nimm hier das mildere Shampoo.",
      product_count: 1,
      status: "completed",
      total_ms: 360,
    })
    expect(trace.engine_variant).toBe("tool_loop")
    expect(trace.agentic_tool_loop).toEqual(agenticTrace)
    expect(trace.conversation_state.updated_by_engine).toBe("tool_loop")
  })

  test("summarizes AgentV2 trace for Langfuse root output without raw context", () => {
    const agentV2Trace = {
      engine: "agent_v2",
      model: "gpt-5.4-mini",
      endpoint: "responses",
      reasoning_effort: "medium",
      safety_mode: "normal",
      answer_mode: "product_recommendation",
      named_product_context: null,
      response_ids: ["resp_1"],
      model_steps: [{ response_id: "resp_1", latency_ms: 12 }],
      tool_calls: [{ call_id: "call_1", name: "select_products", latency_ms: 5 }],
      blocked_tool_calls: [],
      loaded_guidance_package_ids: ["base.answer_contract.v1"],
      validation_errors: [],
      validation_warnings: [],
      request_interpretation: null,
      request_interpretation_summary: null,
      bounded_repair_kind: "missing_select_products",
      repair_attempts: [{ reason: "missing_select_products", validation_errors: [] }],
      routine_thread_context_active: false,
      routine_thread_context: null,
      final_product_ids: ["product-1"],
      routine_layer: null,
      session_memory_writes: [],
      dropped_session_memory_writes: [],
      injected_session_memory: [
        {
          type: "preference",
          text: "RAW_SESSION_MEMORY_SHOULD_NOT_LEAK",
          evidence_quote: "RAW_SESSION_MEMORY_SHOULD_NOT_LEAK",
          confidence: 0.8,
          ttl: "session",
          affects_recommendations: true,
          expires_at_turn: null,
        },
      ],
      langfuse: {
        enabled: true,
        trace_id: null,
        trace_url: null,
      },
      failure_stage: null,
    } satisfies AgentV2Trace

    const summary = summarizeAgentV2TraceForLangfuse(agentV2Trace)

    expect(summary).toMatchObject({
      engine: "agent_v2",
      model_step_count: 1,
      tool_call_count: 1,
      blocked_tool_call_count: 0,
      repair_count: 1,
      loaded_guidance_ids: ["base.answer_contract.v1"],
      response_ids: ["resp_1"],
      answer_mode: "product_recommendation",
      failure_stage: null,
    })
    expect(JSON.stringify(summary)).not.toContain("RAW_SESSION_MEMORY_SHOULD_NOT_LEAK")
  })
})
