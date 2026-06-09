import { expect, test } from "@playwright/test"
import {
  buildPipelineTraceDraft,
  buildRetrievalDebugEventData,
  finalizeChatTurnTrace,
  projectAgenticToolLoopTraceForApp,
  summarizeEngineTraceForLangfuse,
  summarizeProductsForLangfuse,
} from "../src/lib/chat-runtime/debug-trace"
import {
  buildRecommendationEngineRuntimeForChat,
  buildRecommendationEngineTrace,
} from "../src/lib/recommendation-engine/chat"
import { summarizeAgentV2TraceForLangfuse } from "../src/lib/agent-v2/production/langfuse-observability"
import { createDefaultConversationState } from "../src/lib/chat-runtime/conversation-state"
import type { RetrievedChunk } from "../src/lib/chat-runtime/debug-trace"
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
import type { AgenticToolLoopTrace as RuntimeAgenticToolLoopTrace } from "../src/lib/agent/orchestrator/agentic-tool-loop-types"
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
    density: "medium",
    concerns: ["frizz"],
    products_used: null,
    wash_frequency: "weekly_3_4x",
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

function createRuntimeAgenticToolLoopTrace(): RuntimeAgenticToolLoopTrace {
  return {
    engine_variant: "tool_loop",
    answer_composition_mode: "composer_context",
    answer_context: {
      capsule_ids: ["global.natural_consultant", "category.shampoo.recommend"],
      instructions: ["RAW_CAPSULE_INSTRUCTION_SHOULD_NOT_PERSIST"],
      examples: ["RAW_CAPSULE_EXAMPLE_SHOULD_NOT_PERSIST"],
    },
    advisor_guidance: {
      loaded_guidance_ids: ["topic:shampoo", "overlay:fine_hair"],
      direct_answer_frame: "RAW_GUIDANCE_FRAME_SHOULD_NOT_PERSIST",
      key_advice_points: ["RAW_GUIDANCE_POINT_SHOULD_NOT_PERSIST"],
      profile_interpretation: [],
      category_implications: [],
      category_sections: [],
      avoid: [],
      proactive_next_step_options: [],
    },
    consultation_brief: {
      charter: ["RAW_CHARTER_TEXT_SHOULD_NOT_PERSIST"],
      routine_staging: ["RAW_ROUTINE_STAGING_SHOULD_NOT_PERSIST"],
      product_vs_education: ["RAW_PRODUCT_EDUCATION_SHOULD_NOT_PERSIST"],
      profile_overlays: [
        {
          id: "overlay:fine_hair",
          kind: "overlay",
          title: "Feines Haar",
          content: "RAW_PROFILE_OVERLAY_CONTENT_SHOULD_NOT_PERSIST",
        },
      ],
      candidate_guidance: [
        {
          id: "topic:shampoo",
          kind: "topic",
          title: "Shampoo",
          content: "RAW_TOPIC_CONTENT_SHOULD_NOT_PERSIST",
        },
      ],
    },
    model_steps: [
      {
        type: "tool_calls",
        calls: [
          {
            id: "call-load-guidance",
            name: "load_advisor_guidance",
            input: {
              category: "shampoo",
              message: "RAW_USER_PROFILE_BLOB_SHOULD_NOT_PERSIST",
            },
          },
          {
            id: "call-products",
            name: "select_products",
            input: {
              category: "shampoo",
              hairProfile: { secret: "RAW_PROFILE_SECRET_SHOULD_NOT_PERSIST" },
            },
          },
        ],
      },
      {
        type: "message",
        content: "RAW_MODEL_MESSAGE_SHOULD_NOT_PERSIST",
      },
    ],
    tool_calls: [
      {
        id: "call-load-guidance",
        name: "load_advisor_guidance",
        input: { message: "RAW_GUIDANCE_INPUT_SHOULD_NOT_PERSIST" },
        output: {
          projection: {
            loaded_guidance_ids: ["topic:conditioner"],
          },
          raw: "RAW_GUIDANCE_OUTPUT_SHOULD_NOT_PERSIST",
        },
      },
      {
        id: "call-load-guidance-fallback",
        name: "load_advisor_guidance",
        input: { message: "RAW_GUIDANCE_INPUT_SHOULD_NOT_PERSIST" },
        output: { raw: "RAW_GUIDANCE_OUTPUT_SHOULD_NOT_PERSIST" },
      },
      {
        id: "call-products",
        name: "select_products",
        input: { hairProfile: { secret: "RAW_PROFILE_SECRET_SHOULD_NOT_PERSIST" } },
        output: {
          projection: {
            category: "conditioner",
            decision: "needs_more_info",
            product_response_policy: "needs_more_info",
            products: [],
            missing_info: [{ key: "care_signal" }],
          },
          raw: "RAW_PRODUCT_OUTPUT_BLOB_SHOULD_NOT_PERSIST",
        },
      },
      {
        id: "call-products-second",
        name: "select_products",
        input: { category: "shampoo" },
        output: {
          projection: {
            category: "shampoo",
            decision: "recommended",
            product_response_policy: "recommend",
            products: [{ product_id: "shampoo-1" }, { product_id: "shampoo-2" }],
            missing_info: [],
          },
          raw: "RAW_PRODUCT_OUTPUT_BLOB_SHOULD_NOT_PERSIST",
        },
      },
      {
        id: "call-routine",
        name: "build_or_fix_routine",
        input: { message: "RAW_ROUTINE_INPUT_SHOULD_NOT_PERSIST" },
        output: {
          objective: "fix_routine",
          steps: [{ label: "Ansatz klaeren" }],
          missing_info: [{ key: "wash_frequency" }],
          raw: "RAW_ROUTINE_OUTPUT_BLOB_SHOULD_NOT_PERSIST",
        },
      },
      {
        id: "call-routine-second",
        name: "build_or_fix_routine",
        input: { message: "RAW_ROUTINE_INPUT_SHOULD_NOT_PERSIST" },
        output: {
          projection: {
            objective: "build_routine",
            steps: [{ label: "Mild waschen" }, { label: "Conditioner" }],
            missing_info: [],
          },
          raw: "RAW_ROUTINE_OUTPUT_BLOB_SHOULD_NOT_PERSIST",
        },
      },
    ],
    blocked_tool_calls: [
      {
        id: "blocked-terminal",
        name: "submit_final_answer",
        reason: "terminal_with_other_tool_calls",
      },
    ],
    guardrails: ["terminal_repair"],
    repair_attempts: [
      {
        reason: "missing_terminal_answer",
        instruction_label: "terminal_protocol_repair",
      },
    ],
    failure_stage: "repair_failed",
    visible_failure: true,
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

function createRetrievedChunk(overrides: Partial<RetrievedChunk> = {}): RetrievedChunk {
  return {
    id: "chunk-1",
    source_type: "book",
    source_name: "Routine Kapitel",
    chunk_index: 0,
    content: "OWC ist eine Wash-Day-Technik zum Schutz der Laengen vor der Waesche.",
    metadata: { topic: "owc" },
    token_count: 20,
    created_at: "2026-04-10T00:00:00.000Z",
    similarity: 0.81,
    weighted_similarity: 0.88,
    retrieval_path: "hybrid",
    dense_score: 0.79,
    lexical_score: 12,
    fused_score: 0.45,
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
  test("builds a draft with retrieval and matching details", () => {
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
      retrieval_debug: {
        subqueries: ["OWC", "Frizz in Wellen"],
        source_types: ["book", "community_qa"],
        metadata_filter: { thickness: "fine" },
        candidate_count_before_rerank: 8,
        reranked_count: 5,
        fallback_used: false,
      },
      retrieval_count: 5,
      retrieved_chunks: [createRetrievedChunk()],
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

    expect(draft.retrieval.subqueries).toEqual(["OWC", "Frizz in Wellen"])
    expect(draft.retrieval.chunks[0].content_preview).toContain("Wash-Day-Technik")
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

  test("finalizes the trace and exposes a compact retrieval debug payload", () => {
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
      retrieval_debug: {
        subqueries: ["CWC", "OWC"],
        source_types: ["book"],
        metadata_filter: null,
        candidate_count_before_rerank: 4,
        reranked_count: 4,
        fallback_used: false,
      },
      retrieval_count: 3,
      retrieved_chunks: [createRetrievedChunk()],
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
      sources: [
        {
          index: 1,
          source_type: "book",
          label: "Fachbuch",
          source_name: "Routine Kapitel",
          snippet: "OWC ist eine Wash-Day-Technik...",
        },
      ],
      product_count: 0,
      status: "completed",
      stream_read_ms: 120,
      total_ms: 240,
    })

    const debugEvent = buildRetrievalDebugEventData(draft)

    expect(trace.status).toBe("completed")
    expect(trace.trace_version).toBe(2)
    expect(trace.latencies_ms.total_ms).toBe(240)
    expect(trace.response.sources).toHaveLength(1)
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
    expect(trace.decision_context.engine_trace?.legacy_plan_comparison).toEqual(
      expect.objectContaining({
        projectedPlan: expect.objectContaining({
          steps: expect.any(Array),
        }),
        differences: expect.any(Array),
      }),
    )
    expect(debugEvent).toMatchObject({
      request_id: "req-2",
      engine_variant: null,
      retrieval_mode: "hybrid",
      response_composer_path: "legacy_synthesizer",
      clarification_questions: ["Wie oft waeschst du aktuell?"],
      final_context_count: 1,
    })
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
      retrieval_debug: {
        subqueries: [],
        source_types: [],
        metadata_filter: null,
        candidate_count_before_rerank: 0,
        reranked_count: 0,
        fallback_used: false,
      },
      retrieval_count: 0,
      retrieved_chunks: [],
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
      sources: [],
      product_count: 0,
      status: "completed",
      total_ms: 180,
    })
    const debugEvent = buildRetrievalDebugEventData(draft)

    expect(draft.response_composition).toEqual(agentResponseComposition)
    expect(trace.response_composition).toEqual(agentResponseComposition)
    expect(debugEvent).toMatchObject({
      response_composer_path: "agent_final_render",
    })
  })

  test("projects runtime tool-loop traces into sanitized app trace summaries", () => {
    const appTrace = projectAgenticToolLoopTraceForApp({
      runtimeTrace: createRuntimeAgenticToolLoopTrace(),
      selectedProducts: {
        category: "shampoo",
        decision: "recommended",
        product_response_policy: "recommend",
        policy_reason: "profile_match",
        profile_basis: ["feines Haar"],
        category_guidance: "mild reinigen",
        products: [
          {
            rank: 1,
            product_id: "product-1",
            name: "Mild Shampoo",
            brand: "HC",
            price_eur: 12,
            currency: "EUR",
            fit_reason: "passt zu feinem Haar",
            caveat: null,
            supported_claims: [],
            unsupported_requested_signals: [],
          },
        ],
        comparison_facts: null,
        missing_info: [],
        unsupported_requested_signals: [],
      },
      routinePlan: {
        objective: "build_routine",
        steps: [
          {
            id: "wash",
            label: "Mild waschen",
            necessity: "core",
            action: "keep",
            category: "shampoo",
            frequency: "nach Bedarf",
            reasons: ["Basis"],
            caveats: [],
            fillable: true,
          },
          {
            id: "condition",
            label: "Conditioner",
            necessity: "core",
            action: "add",
            category: "conditioner",
            frequency: "nach jeder Waesche",
            reasons: ["Laengen schuetzen"],
            caveats: [],
            fillable: true,
          },
        ],
        missing_info: [],
        confidence: 0.8,
      },
      latencyMs: 410,
    })

    expect(appTrace).toMatchObject({
      engine_variant: "tool_loop",
      answer_composition_mode: "composer_context",
      loaded_guidance_ids: ["topic:shampoo", "overlay:fine_hair"],
      answer_context_capsule_ids: ["global.natural_consultant", "category.shampoo.recommend"],
      repair_attempts: [
        {
          reason: "missing_terminal_answer",
          instruction_label: "terminal_protocol_repair",
        },
      ],
      failure_stage: "repair_failed",
      visible_failure: true,
      latency_ms: 410,
    })
    expect(appTrace.model_steps).toEqual([
      {
        step_index: 1,
        type: "tool_calls",
        finish_reason: null,
        tool_call_names: ["load_advisor_guidance", "select_products"],
      },
      {
        step_index: 2,
        type: "message",
        finish_reason: null,
        tool_call_names: [],
      },
    ])
    expect(appTrace.tool_calls).toEqual([
      expect.objectContaining({
        id: "call-load-guidance",
        name: "load_advisor_guidance",
        status: "executed",
        output_summary: "guidance_ids=topic:conditioner",
      }),
      expect.objectContaining({
        id: "call-load-guidance-fallback",
        name: "load_advisor_guidance",
        status: "executed",
        output_summary: "guidance_ids=topic:shampoo, overlay:fine_hair",
      }),
      expect.objectContaining({
        id: "call-products",
        name: "select_products",
        status: "executed",
        output_summary:
          "category=conditioner; decision=needs_more_info; policy=needs_more_info; products=0; missing_info=1",
      }),
      expect.objectContaining({
        id: "call-products-second",
        name: "select_products",
        status: "executed",
        output_summary:
          "category=shampoo; decision=recommended; policy=recommend; products=2; missing_info=0",
      }),
      expect.objectContaining({
        id: "call-routine",
        name: "build_or_fix_routine",
        status: "executed",
        output_summary: "objective=fix_routine; steps=1; labels=Ansatz klaeren; missing_info=1",
      }),
      expect.objectContaining({
        id: "call-routine-second",
        name: "build_or_fix_routine",
        status: "executed",
        output_summary:
          "objective=build_routine; steps=2; labels=Mild waschen, Conditioner; missing_info=0",
      }),
    ])
    expect(appTrace.consultation_brief_summary).toEqual({
      charter_count: 1,
      routine_staging_count: 1,
      product_vs_education_count: 1,
      profile_overlay_ids: ["overlay:fine_hair"],
      candidate_guidance_ids: ["topic:shampoo"],
    })
    expect(appTrace.blocked_tool_calls).toEqual([
      {
        id: "blocked-terminal",
        name: "submit_final_answer",
        reason: "terminal_with_other_tool_calls",
      },
    ])
    expect(JSON.stringify(appTrace)).not.toContain("RAW_")
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
      retrieval_debug: {
        subqueries: [],
        source_types: [],
        metadata_filter: null,
        candidate_count_before_rerank: 0,
        reranked_count: 0,
        fallback_used: false,
      },
      retrieval_count: 0,
      retrieved_chunks: [],
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
      sources: [],
      product_count: 1,
      status: "completed",
      total_ms: 360,
    })
    const debugEvent = buildRetrievalDebugEventData(draft)

    expect(trace.engine_variant).toBe("tool_loop")
    expect(trace.agentic_tool_loop).toEqual(agenticTrace)
    expect(trace.conversation_state.updated_by_engine).toBe("tool_loop")
    expect(debugEvent).toMatchObject({
      engine_variant: "tool_loop",
      tool_loop_model_step_count: 2,
      tool_loop_total_llm_calls: 2,
      tool_loop_tool_calls: ["select_products", "submit_final_answer"],
      tool_loop_blocked_reasons: ["not_exposed_in_v1"],
      loaded_guidance_ids: ["topic:shampoo"],
      repair_count: 0,
      failure_stage: null,
      visible_failure: false,
      agentic_tool_loop: {
        model_step_count: 2,
        tool_call_count: 2,
        blocked_tool_call_count: 1,
      },
    })
    expect(JSON.stringify(debugEvent)).not.toContain("System prompt snapshot")
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
