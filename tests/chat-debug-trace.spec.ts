import { expect, test } from "@playwright/test"
import {
  buildPipelineTraceDraft,
  buildRetrievalDebugEventData,
  finalizeChatTurnTrace,
} from "../src/lib/rag/debug-trace"
import type { RetrievedChunk } from "../src/lib/rag/retriever"
import type {
  ChatPromptSnapshot,
  ClassificationResult,
  HairProfile,
  Product,
  RouterDecision,
  RoutinePlan,
} from "../src/lib/types"

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
    scalp_condition: "none",
    chemical_treatment: ["colored"],
    desired_volume: "balanced",
    post_wash_actions: ["air_dry"],
    routine_preference: "balanced",
    current_routine_products: ["shampoo", "conditioner"],
    mechanical_stress_factors: [],
    towel_material: null,
    towel_technique: null,
    drying_method: [],
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
        eligible: true,
        missing_profile_fields: [],
        matched_profile: {
          thickness: "fine",
          scalp_type: "balanced",
          scalp_condition: "none",
        },
        matched_bucket: "normal",
        secondary_bucket: null,
        matched_concern_code: null,
        retrieval_filter: {
          thickness: "fine",
          concern: null,
        },
        candidate_count: 0,
        no_catalog_match: false,
      },
      conditioner: {
        category: "conditioner",
        eligible: true,
        missing_profile_fields: [],
        matched_profile: {
          thickness: "fine",
          density: "medium",
          protein_moisture_balance: "stretches_bounces",
          cuticle_condition: "rough",
          chemical_treatment: ["colored"],
        },
        matched_concern_code: null,
        matched_balance_need: "moisture",
        matched_weight: "light",
        matched_repair_level: "medium",
        candidate_count: 0,
        no_catalog_match: false,
        used_density: true,
      },
      leave_in: {
        category: "leave_in",
        eligible: true,
        missing_profile_fields: [],
        matched_profile: {
          hair_texture: "wavy",
          thickness: "fine",
          density: "medium",
          cuticle_condition: "rough",
          chemical_treatment: ["colored"],
        },
        need_bucket: "curl_definition",
        styling_context: "air_dry",
        conditioner_relationship: "booster_only",
        matched_weight: "light",
        candidate_count: 0,
        no_catalog_match: false,
      },
      mask: {
        needs_mask: false,
        mask_type: null,
        need_strength: 0,
        active_signals: [],
      },
    },
  }
}

function createPromptSnapshot(): ChatPromptSnapshot {
  return {
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
  })

  test("finalizes the trace and exposes a compact retrieval debug payload", () => {
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
      clarification_questions: ["Wie oft waeschst du aktuell?"],
      hair_profile_snapshot: createProfile(),
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
      matched_products: [],
      classification_prompt_ref: {
        name: "hair-concierge-intent-classifier",
        version: 2,
        label: "staging",
        is_fallback: false,
      },
      prompt: createPromptSnapshot(),
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
    expect(trace.latencies_ms.total_ms).toBe(240)
    expect(trace.response.sources).toHaveLength(1)
    expect(debugEvent).toMatchObject({
      request_id: "req-2",
      retrieval_mode: "hybrid",
      clarification_questions: ["Wie oft waeschst du aktuell?"],
      final_context_count: 1,
    })
  })
})
