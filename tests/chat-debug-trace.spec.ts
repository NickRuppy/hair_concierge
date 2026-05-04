import { expect, test } from "@playwright/test"
import {
  buildPipelineTraceDraft,
  buildRetrievalDebugEventData,
  finalizeChatTurnTrace,
  summarizeEngineTraceForLangfuse,
  summarizeProductsForLangfuse,
} from "../src/lib/rag/debug-trace"
import {
  buildRecommendationEngineRuntimeForChat,
  buildRecommendationEngineTrace,
} from "../src/lib/recommendation-engine/chat"
import { createDefaultConversationState } from "../src/lib/rag/conversation-state"
import type { RetrievedChunk } from "../src/lib/rag/retriever"
import type {
  ChatPromptSnapshot,
  ClassificationResult,
  ConversationStateTransition,
  HairProfile,
  Product,
  RouterDecision,
  RoutinePlan,
} from "../src/lib/types"

const legacyResponseComposition = {
  path: "legacy_synthesizer" as const,
  migration_mode: "legacy_only" as const,
  fallback_reason: null,
  rendering_path: null,
  plan_type: null,
  attachment_mode: null,
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
    wash_frequency: "every_2_3_days",
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
      name: "hair-concierge-chat-system",
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
        name: "hair-concierge-intent-classifier",
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
        name: "hair-concierge-intent-classifier",
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
    expect(debugEvent).toMatchObject({
      request_id: "req-2",
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
      relevant_categories: expect.any(Array),
    })
  })
})
