import assert from "node:assert/strict"
import test from "node:test"

import { runAgentV2ProductionPipeline } from "../src/lib/agent-v2/production/chat-pipeline"
import { buildProductLookupTurnOutcome } from "../src/lib/agent-v2/production/product-lookup-turn-outcome"
import { createDefaultConversationState } from "../src/lib/chat-runtime/conversation-state"
import type { AgentV2ResponsesTurnResult } from "../src/lib/agent-v2/runtime/responses-agent"
import type { ConversationState, HairProfile, Message } from "../src/lib/types"
import {
  createDefaultAgentV2ConversationState,
  type AgentV2ConversationStateTransition,
  type AgentV2ConversationStateV2,
} from "../src/lib/agent-v2/production/persisted-session-state"

const verifyConversationOwnership = async ({
  conversationId,
  userId,
}: {
  conversationId: string
  userId: string
}) => {
  assert.equal(typeof conversationId, "string")
  assert.equal(typeof userId, "string")
  return true
}

function createCompleteHairProfile(overrides: Partial<HairProfile> = {}): HairProfile {
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
    heat_styling: "rarely",
    styling_tools: [],
    goals: ["curl_definition"],
    cuticle_condition: "rough",
    protein_moisture_balance: "stretches_bounces",
    scalp_type: "balanced",
    scalp_condition: null,
    chemical_treatment: ["natural"],
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
    created_at: "2026-04-29T00:00:00.000Z",
    updated_at: "2026-04-29T00:00:00.000Z",
    ...overrides,
  }
}

function createMessage(index: number): Message {
  return {
    id: `message-${index}`,
    conversation_id: "conversation-1",
    role: index % 2 === 0 ? "assistant" : "user",
    content: `Message ${index}`,
    product_recommendations: null,
    rag_context: null,
    token_usage: null,
    langfuse_trace_id: null,
    langfuse_trace_url: null,
    user_feedback_score: null,
    user_feedback_at: null,
    created_at: `2026-05-29T10:${String(index).padStart(2, "0")}:00.000Z`,
  }
}

async function readStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let output = ""

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    output += decoder.decode(value, { stream: true })
  }

  return output + decoder.decode()
}

function createAgentV2Result(): AgentV2ResponsesTurnResult {
  return {
    accepted_session_memory_writes: [],
    final_answer: {
      answer_mode: "product_recommendation",
      interpreted_intent: "User wants a shampoo recommendation.",
      request_interpretation: {
        primary_intent: "product_recommendation",
        product_request_kind: "specific_products",
        routine_intent: "none",
        care_category: "shampoo",
        requested_product_count: 1,
        count_policy: "exact",
        evidence_quote: "Welches Shampoo passt?",
        specific_product_candidate: false,
        confidence: 0.95,
      },
      confidence: 0.92,
      extracted_constraints: {
        hair_concerns: ["frizz"],
        goals: [],
        product_categories: ["shampoo"],
        budget_eur: null,
        avoid_ingredients: [],
        allergies: [],
        preferences: [],
        routine_layer: null,
        raw_constraints: ["Welches Shampoo passt?"],
      },
      missing_information: [],
      safety_flags: [],
      tool_grounding: {
        used_guidance_package_ids: ["base.advisor_rules.v1", "category.shampoo.v1"],
        used_product_tool: true,
        used_routine_tool: false,
        product_ids: ["primary"],
        routine_step_ids: [],
        hard_rule_ids: [],
      },
      routine_context: {
        active: false,
        routine_layer: null,
        step_id: null,
        category: "shampoo",
        return_path: [],
      },
      pending_followup_action: null,
      session_memory_writes: [],
      payload: {
        user_facing_answer_de: "Nimm zuerst Produkt primary.",
        recommendations: [
          {
            product_id: "primary",
            reason_de: "Passt zu deinem Profil.",
            usage_de: null,
            caveat_de: null,
          },
        ],
        comparison_notes_de: [],
        usage_notes_de: [],
        next_step_offer_de: null,
      },
    },
    trace: {
      engine: "agent_v2",
      model: "gpt-5.4-mini",
      endpoint: "responses",
      reasoning_effort: "medium",
      safety_mode: "normal",
      answer_mode: "product_recommendation",
      named_product_context: null,
      response_ids: ["response-1"],
      model_steps: [
        {
          response_id: "response-1",
          tool_call_count: 1,
          terminal_answer_count: 0,
          output_types: ["function_call"],
          latency_ms: 7,
        },
      ],
      tool_calls: [
        {
          call_id: "select-1",
          name: "select_products",
          arguments: { category: "shampoo" },
          latency_ms: 1,
        },
      ],
      blocked_tool_calls: [],
      loaded_guidance_package_ids: ["base.advisor_rules.v1", "category.shampoo.v1"],
      validation_errors: [],
      validation_warnings: [],
      request_interpretation: null,
      request_interpretation_summary: null,
      bounded_repair_kind: null,
      repair_attempts: [],
      routine_thread_context_active: false,
      routine_thread_context: null,
      final_product_ids: ["primary"],
      routine_layer: null,
      session_memory_writes: [],
      dropped_session_memory_writes: [],
      injected_session_memory: [],
      langfuse: {
        enabled: true,
        trace_id: null,
        trace_url: null,
      },
      failure_stage: null,
    },
  }
}

function summarizeLookupResult(result: unknown): { status: string; productId: string | null } {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return { status: "invalid", productId: null }
  }

  const record = result as Record<string, unknown>
  const product =
    record.product && typeof record.product === "object" && !Array.isArray(record.product)
      ? (record.product as Record<string, unknown>)
      : null

  return {
    status: typeof record.status === "string" ? record.status : "invalid",
    productId: typeof product?.id === "string" ? product.id : null,
  }
}

function createFakeSpecReadinessClient(params: { verifiedSpecProductIds: readonly string[] }) {
  return {
    from(table: string) {
      const query = {
        filters: [] as Array<{ column: string; value: unknown }>,
        select() {
          return this
        },
        eq(column: string, value: unknown) {
          this.filters.push({ column, value })
          return this
        },
        limit() {
          return this
        },
        async then(resolve: (value: { data: unknown[]; error: null }) => unknown) {
          if (table.startsWith("product_")) {
            const productId = this.filters.find((filter) => filter.column === "product_id")?.value
            const hasSpecs =
              typeof productId === "string" && params.verifiedSpecProductIds.includes(productId)
            return resolve({
              data: hasSpecs ? [{ product_id: productId }] : [],
              error: null,
            })
          }
          return resolve({ data: [], error: null })
        },
      }

      return query
    },
  }
}

test("AgentV2 product lookup outcome does not add variant card after grounded alternatives answer", async () => {
  const agentResult = createAgentV2Result()
  const baseAnswer = agentResult.final_answer as Extract<
    AgentV2ResponsesTurnResult["final_answer"],
    { answer_mode: "product_recommendation" }
  >
  const finalAnswer: Extract<
    AgentV2ResponsesTurnResult["final_answer"],
    { answer_mode: "product_recommendation" }
  > = {
    ...baseAnswer,
    request_interpretation: {
      ...baseAnswer.request_interpretation,
      care_category: "conditioner",
      requested_product_count: 3,
      evidence_quote: "was wären sonst Alternativen",
    },
    extracted_constraints: {
      ...baseAnswer.extracted_constraints,
      product_categories: ["conditioner"],
      raw_constraints: ["was wären sonst Alternativen"],
    },
    tool_grounding: {
      ...baseAnswer.tool_grounding,
      product_ids: ["alt-1", "alt-2", "alt-3"],
    },
    routine_context: {
      ...baseAnswer.routine_context,
      category: "conditioner",
    },
    payload: {
      user_facing_answer_de:
        "Zu Schwarzkopf GLISS Conditioner Liquid Silk passen diese Alternativen für dein feines, welliges Haar gut.",
      recommendations: [
        {
          product_id: "alt-1",
          reason_de: "Leichte Alternative mit mehr Glätte.",
          usage_de: null,
          caveat_de: null,
        },
        {
          product_id: "alt-2",
          reason_de: "Etwas intensiver, aber noch passend für die Längen.",
          usage_de: null,
          caveat_de: null,
        },
        {
          product_id: "alt-3",
          reason_de: "Ähnliche Richtung, wenn du mehr Pflege suchst.",
          usage_de: null,
          caveat_de: null,
        },
      ],
      comparison_notes_de: [],
      usage_notes_de: ["Starte sparsam in Längen und Spitzen."],
      next_step_offer_de: null,
    },
  }

  const outcome = await buildProductLookupTurnOutcome({
    productIntakeEnabled: true,
    safetyMode: "normal",
    activeResolvedProductContext: null,
    namedProductContext: null,
    executions: [
      {
        input: {
          category: "conditioner",
          brand_text: "Schwarzkopf GLISS",
          product_name_text: "Conditioner Liquid Silk",
        },
        result: {
          status: "needs_variant_selection",
          category: "conditioner",
          product: null,
          candidates: [
            {
              productId: "baseline-variant",
              product: {
                id: "baseline-variant",
                name: "Schwarzkopf GLISS Liquid Silk Spülung",
                cleanName: "Liquid Silk Spülung",
                categoryKey: "conditioner",
                isActive: true,
                lifecycleStatus: "active",
                isChaarlieRecommended: false,
              },
              confidence: "review",
              reason: "fuzzy_candidates_review",
              reasonCodes: ["fuzzy_candidates_review"],
            },
          ],
          missing_fields: [],
          intake_offer: null,
        },
      },
    ],
    trace: agentResult.trace,
    finalAnswer,
    latestUserMessage: "okay, was wären sonst Alternativen?",
    loadProductLookupCatalogs: async () => ({
      catalog: { products: [], identifiers: [] },
      brandCatalog: {
        brands: [],
        productLines: [],
        brandAliases: [],
      },
    }),
    requestId: "request-grounded-alternatives",
  })

  assert.equal(outcome.productLookupClarification, null)
  assert.equal(
    outcome.answer.payload.user_facing_answer_de,
    finalAnswer.payload.user_facing_answer_de,
  )
})

test("AgentV2 production pipeline surfaces product intake offer from lookup result", async () => {
  const hairProfile = createCompleteHairProfile()
  const agentResult = createAgentV2Result()
  agentResult.final_answer = {
    ...agentResult.final_answer,
    answer_mode: "general_advice",
    interpreted_intent: "User asks about their own named product.",
    request_interpretation: {
      primary_intent: "general_advice",
      product_request_kind: "product_detail",
      routine_intent: "none",
      care_category: "shampoo",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "Pantene Pro-V Volume Pur Shampoo",
      specific_product_candidate: true,
      confidence: 0.88,
    },
    tool_grounding: {
      used_guidance_package_ids: ["base.advisor_rules.v1"],
      used_product_tool: false,
      used_routine_tool: false,
      product_ids: [],
      routine_step_ids: [],
      hard_rule_ids: [],
    },
    payload: {
      user_facing_answer_de:
        "Danke dir. Dieses konkrete Shampoo kenne ich noch nicht sicher in unserer Produktdatenbank. Du kannst es kurz hinzufügen, dann prüfen wir es sauber.",
      category_or_topic: "shampoo",
      key_points_de: [],
      next_step_offer_de: null,
    },
  }

  const result = await runAgentV2ProductionPipeline(
    {
      message: "Ich nutze Pantene Pro-V Volume Pur Shampoo. Passt das zu mir?",
      conversationId: "conversation-1",
      userId: "user-1",
      requestId: "request-lookup",
      productIntakeEnabled: true,
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: hairProfile,
        routine_inventory: [],
        relevant_memory: [],
        derived_signals: [],
        suggested_overlays: [],
        missing_profile: [],
      }),
      loadUserMemoryContext: async () => ({
        enabled: true,
        entries: [],
        promptContext: null,
        dislikedProductNames: [],
      }),
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      client: {
        responses: {
          create: async () => ({ output: [] }),
        },
      },
      createProductIntakeRepository: () =>
        ({
          loadCatalog: async () => ({ products: [], identifiers: [] }),
          loadBrandResolutionCatalog: async () => ({
            brands: [{ id: "brand-pantene", canonical_name: "Pantene" }],
            productLines: [
              { id: "line-pro-v", brand_id: "brand-pantene", canonical_name: "Pro-V" },
            ],
            brandAliases: [
              {
                brand_id: "brand-pantene",
                product_line_id: "line-pro-v",
                alias: "Pantene Pro-V",
              },
            ],
          }),
        }) as never,
      runAgentV2ResponsesTurn: async (params) => {
        await params.tools.lookup_product_candidate({
          category: "shampoo",
          brand_text: "Pantene Pro-V",
          product_name_text: "Volume Pur Shampoo",
          reason: "User asks whether their own named product suits them.",
          evidence_quote: "Pantene Pro-V Volume Pur Shampoo",
        })
        return agentResult
      },
    },
  )

  assert.deepEqual(result.productIntakeOffer, {
    id: "product-intake-request-lookup",
    source: "chat",
    reason: "product_lookup_not_found",
    category: "shampoo",
    extracted_identity: {
      brand_text: "Pantene Pro-V",
      product_name_text: "Volume Pur Shampoo",
    },
  })
  const nextState = result.conversationStateTransition.next_state as AgentV2ConversationStateV2
  assert.deepEqual(nextState.agent_v2.active_product_contexts, [
    {
      status: "pending_review",
      product_id: null,
      submission_id: null,
      category: "shampoo",
      brand_text: "Pantene Pro-V",
      product_name_text: "Volume Pur Shampoo",
      display_name: "Pantene Pro-V Volume Pur Shampoo",
      original_user_message: "Ich nutze Pantene Pro-V Volume Pur Shampoo. Passt das zu mir?",
      source: "product_intake_submission",
      updated_at: nextState.agent_v2.active_product_contexts[0]?.updated_at,
    },
  ])
  assert.equal(
    await readStream(result.stream),
    agentResult.final_answer.payload.user_facing_answer_de,
  )
})

test("AgentV2 production pipeline falls back to deterministic lookup when model skips own-product lookup", async () => {
  const hairProfile = createCompleteHairProfile()
  const agentResult = createAgentV2Result()
  agentResult.final_answer = {
    ...agentResult.final_answer,
    answer_mode: "clarification",
    interpreted_intent: "Generic fallback after model skipped required product lookup.",
    request_interpretation: {
      primary_intent: "clarification",
      product_request_kind: "none",
      routine_intent: "none",
      care_category: "unknown",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "unclear",
      specific_product_candidate: false,
      confidence: 0,
    },
    payload: {
      user_facing_answer_de:
        "Ich bin mir gerade nicht sicher, was du genau möchtest. Formulier es bitte einmal konkreter.",
      question_de: "Was genau möchtest du zu deiner Haarpflege wissen?",
      missing_keys: [],
    },
  }

  const result = await runAgentV2ProductionPipeline(
    {
      message: "Was hältst du von meinem Jean & Lean Conditioner?",
      conversationId: "conversation-1",
      userId: "user-1",
      requestId: "request-deterministic-lookup-fallback",
      productIntakeEnabled: true,
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: hairProfile,
        routine_inventory: [],
        relevant_memory: [],
        derived_signals: [],
        suggested_overlays: [],
        missing_profile: [],
      }),
      loadUserMemoryContext: async () => ({
        enabled: true,
        entries: [],
        promptContext: null,
        dislikedProductNames: [],
      }),
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      createProductIntakeRepository: () =>
        ({
          findProductSubmission: async (submissionId: string) =>
            submissionId === "submission-pending-product"
              ? {
                  id: submissionId,
                  brand_text: "Codex Smoke",
                  product_name_text: "153558 Mango Conditioner",
                  category: "conditioner",
                  status: "pending_review",
                  updated_at: "1970-01-01T00:00:00.000Z",
                }
              : null,
          loadCatalog: async () => ({ products: [], identifiers: [] }),
          loadBrandResolutionCatalog: async () => ({
            brands: [],
            productLines: [],
            brandAliases: [],
          }),
        }) as never,
      runAgentV2ResponsesTurn: async () => agentResult,
    },
  )

  const responseText = await readStream(result.stream)
  assert.match(responseText, /Jean & Lean Conditioner/)
  assert.doesNotMatch(responseText, /Formulier es bitte einmal konkreter/)
  assert.equal(result.productIntakeOffer?.category, "conditioner")
  assert.deepEqual(result.productIntakeOffer?.extracted_identity, {
    brand_text: "Jean & Lean",
    product_name_text: "Conditioner",
  })
  assert.equal(result.visibleFailure, false)
})

test("AgentV2 production pipeline recovers found-exact lookup after product assessment repair failure", async () => {
  const hairProfile = createCompleteHairProfile()
  const agentResult = createAgentV2Result()
  agentResult.trace.failure_stage = "repair_failed"
  agentResult.trace.validation_errors = [
    {
      validator_id: "product_assessment_grounding",
      severity: "block",
      message: "Product assessment requires matching projection facts.",
    },
  ]
  agentResult.final_answer = {
    ...agentResult.final_answer,
    answer_mode: "general_advice",
    interpreted_intent: "Runtime fallback after product assessment repair failed.",
    request_interpretation: {
      primary_intent: "general_advice",
      product_request_kind: "product_detail",
      routine_intent: "none",
      care_category: "shampoo",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "Syoss Volume Shampoo",
      specific_product_candidate: true,
      confidence: 0,
    },
    tool_grounding: {
      used_guidance_package_ids: ["base.advisor_rules.v1", "category.shampoo.v1"],
      used_product_tool: false,
      used_routine_tool: false,
      product_ids: [],
      routine_step_ids: [],
      hard_rule_ids: [],
    },
    payload: {
      user_facing_answer_de:
        "Ich finde gerade keinen sicheren Produkttreffer in dieser Kategorie. Ich kann dir aber erklären, welche Produktart hier passen würde.",
      category_or_topic: "product_result",
      key_points_de: ["Kein sicherer Produkttreffer aus den verfügbaren Daten."],
      next_step_offer_de: null,
    },
  }

  const result = await runAgentV2ProductionPipeline(
    {
      message: "Okay passt das Syoss Intense Volume Shampoo zu mir?",
      conversationId: "conversation-found-exact-repair",
      userId: "user-1",
      requestId: "request-found-exact-repair",
      productIntakeEnabled: true,
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: hairProfile,
        routine_inventory: [
          {
            category: "shampoo",
            product_name: "Syoss Intense Volume Shampoo",
            brand_text: "Syoss",
            product_id: "syoss-private-volume",
            match_status: "matched",
            frequency_range: "weekly_3_4x",
          },
        ],
        relevant_memory: [],
        derived_signals: [],
        suggested_overlays: [],
        missing_profile: [],
      }),
      loadUserMemoryContext: async () => ({
        enabled: true,
        entries: [],
        promptContext: null,
        dislikedProductNames: [],
      }),
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      client: {
        responses: {
          create: async () => ({ output: [] }),
        },
      },
      createAdminClient: () =>
        createFakeSpecReadinessClient({
          verifiedSpecProductIds: ["syoss-private-volume"],
        }) as never,
      createProductIntakeRepository: () =>
        ({
          loadCatalog: async () => ({
            products: [
              {
                id: "syoss-private-volume",
                name: "Syoss Intense Volume Shampoo",
                cleanName: "Intense Volume Shampoo",
                brandId: "brand-syoss",
                categoryKey: "shampoo",
                isActive: true,
                lifecycleStatus: "active",
                isChaarlieRecommended: false,
              },
            ],
            identifiers: [],
          }),
          loadBrandResolutionCatalog: async () => ({
            brands: [{ id: "brand-syoss", canonical_name: "Syoss" }],
            productLines: [],
            brandAliases: [],
          }),
        }) as never,
      runAgentV2ResponsesTurn: async (params) => {
        await params.tools.lookup_product_candidate({
          category: "shampoo",
          brand_text: "Syoss",
          product_name_text: "Intense Volume Shampoo",
          reason: "User asks whether their owned named shampoo suits them.",
          evidence_quote: "Syoss Intense Volume Shampoo",
        })
        return agentResult
      },
    },
  )

  const responseText = await readStream(result.stream)
  assert.match(responseText, /Syoss Intense Volume Shampoo/)
  assert.doesNotMatch(responseText, /keinen sicheren Produkttreffer/)
  assert.equal(result.productIntakeOffer, null)
  const transition = result.conversationStateTransition as AgentV2ConversationStateTransition
  assert.equal(
    transition.next_state.agent_v2.active_product_contexts[0]?.product_id,
    "syoss-private-volume",
  )
})

test("AgentV2 production pipeline recovers found-exact lookup after generic repair fallback", async () => {
  const hairProfile = createCompleteHairProfile()
  const agentResult = createAgentV2Result()
  agentResult.trace.failure_stage = "repair_failed"
  agentResult.final_answer = {
    ...agentResult.final_answer,
    answer_mode: "clarification",
    interpreted_intent: "Generic fallback after failed product lookup repair.",
    request_interpretation: {
      primary_intent: "clarification",
      product_request_kind: "none",
      routine_intent: "none",
      care_category: "unknown",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "unclear",
      specific_product_candidate: false,
      confidence: 0,
    },
    payload: {
      user_facing_answer_de:
        "Ich bin mir gerade nicht sicher, was du genau möchtest. Formulier es bitte einmal konkreter.",
      question_de: "Was genau möchtest du zu deiner Haarpflege wissen?",
      missing_keys: [],
    },
  }

  const result = await runAgentV2ProductionPipeline(
    {
      message: "Okay passt das Syoss Volume Shampoo zu mir?",
      conversationId: "conversation-found-exact-generic-repair",
      userId: "user-1",
      requestId: "request-found-exact-generic-repair",
      productIntakeEnabled: true,
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: hairProfile,
        routine_inventory: [],
        relevant_memory: [],
        derived_signals: [],
        suggested_overlays: [],
        missing_profile: [],
      }),
      loadUserMemoryContext: async () => ({
        enabled: true,
        entries: [],
        promptContext: null,
        dislikedProductNames: [],
      }),
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      createProductIntakeRepository: () =>
        ({
          loadCatalog: async () => ({
            products: [
              {
                id: "syoss-volume-shampoo",
                name: "Syoss Volume Shampoo",
                brand: "Syoss",
                brandId: "brand-syoss",
                brand_id: "brand-syoss",
                category_key: "shampoo",
                categoryKey: "shampoo",
                cleanName: "Volume Shampoo",
                is_active: true,
                lifecycle_status: "active",
                is_chaarlie_recommended: true,
              },
            ],
            identifiers: [],
          }),
          loadBrandResolutionCatalog: async () => ({
            brands: [{ id: "brand-syoss", canonical_name: "Syoss", name: "Syoss" }],
            productLines: [],
            brandAliases: [],
          }),
        }) as never,
      runAgentV2ResponsesTurn: async (params) => {
        await params.tools.lookup_product_candidate({
          category: "shampoo",
          brand_text: "Syoss",
          product_name_text: "Volume Shampoo",
          reason: "User asks whether this concrete shampoo fits them.",
          evidence_quote: "Syoss Volume Shampoo",
        })
        return agentResult
      },
    },
  )

  const responseText = await readStream(result.stream)
  assert.doesNotMatch(responseText, /Formulier es bitte einmal konkreter/)
  assert.match(responseText, /Syoss Volume Shampoo/)
  assert.equal(result.productIntakeOffer, null)
  assert.equal(result.productLookupClarification, null)
})

test("AgentV2 production pipeline suppresses deterministic lookup fallback in restricted safety mode", async () => {
  const hairProfile = createCompleteHairProfile()
  const agentResult = createAgentV2Result()
  agentResult.final_answer = {
    ...agentResult.final_answer,
    answer_mode: "safety_boundary",
    interpreted_intent: "User foregrounds scalp symptoms while naming a product.",
    request_interpretation: {
      primary_intent: "safety_boundary",
      product_request_kind: "none",
      routine_intent: "none",
      care_category: "shampoo",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "meine Kopfhaut ist gerötet und juckt",
      specific_product_candidate: false,
      confidence: 0.88,
    },
    safety_flags: ["restricted_scalp_symptoms"],
    tool_grounding: {
      used_guidance_package_ids: ["base.advisor_rules.v1", "base.safety_boundaries.v1"],
      used_product_tool: false,
      used_routine_tool: false,
      product_ids: [],
      routine_step_ids: [],
      hard_rule_ids: [],
    },
    routine_context: {
      active: false,
      routine_layer: null,
      step_id: null,
      category: "shampoo",
      return_path: [],
    },
    payload: {
      user_facing_answer_de:
        "Bei geröteter und juckender Kopfhaut würde ich nicht mit einem Produkturteil starten. Bleib vorerst mild und reizarm; wenn es stärker wird oder nicht abklingt, lass es bitte abklären.",
      boundary_reason_de:
        "Rötung und Juckreiz können ein medizinisch relevantes Kopfhautthema sein.",
      next_step_de: "Nutze vorerst milde Pflege und beobachte, ob es sich beruhigt.",
    },
  }
  agentResult.trace = {
    ...agentResult.trace,
    safety_mode: "restricted",
    answer_mode: "safety_boundary",
    tool_calls: [],
    final_product_ids: [],
  }

  const result = await runAgentV2ProductionPipeline(
    {
      message: "Ich nutze Olaplex No. 3 und meine Kopfhaut ist gerötet und juckt.",
      conversationId: "conversation-1",
      userId: "user-1",
      requestId: "request-restricted-product-lookup",
      productIntakeEnabled: true,
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: hairProfile,
        routine_inventory: [],
        relevant_memory: [],
        derived_signals: [],
        suggested_overlays: [],
        missing_profile: [],
      }),
      loadUserMemoryContext: async () => ({
        enabled: true,
        entries: [],
        promptContext: null,
        dislikedProductNames: [],
      }),
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      createProductIntakeRepository: () =>
        ({
          findProductSubmission: async (submissionId: string) =>
            submissionId === "submission-pending-product"
              ? {
                  id: submissionId,
                  brand_text: "Codex Smoke",
                  product_name_text: "153558 Mango Conditioner",
                  category: "conditioner",
                  status: "pending_review",
                  updated_at: "1970-01-01T00:00:00.000Z",
                }
              : null,
          loadCatalog: async () => ({ products: [], identifiers: [] }),
          loadBrandResolutionCatalog: async () => ({
            brands: [],
            productLines: [],
            brandAliases: [],
          }),
        }) as never,
      runAgentV2ResponsesTurn: async (params) => {
        await params.tools.lookup_product_candidate({
          category: "shampoo",
          brand_text: "Syoss",
          product_name_text: "Intense Curls Shampoo",
          reason: "The model over-specified one variant from the user's partial wording.",
          evidence_quote: "Syoss Intense",
        })
        return agentResult
      },
    },
  )

  const responseText = await readStream(result.stream)
  assert.equal(result.answerMode, "safety_boundary")
  assert.equal(result.productIntakeOffer, null)
  assert.equal(result.productLookupClarification, null)
  assert.match(responseText, /nicht mit einem Produkturteil starten/)
  assert.doesNotMatch(responseText, /Olaplex No\. 3/)
  assert.doesNotMatch(responseText, /Datenbank/)
})

test("AgentV2 production pipeline recovers product intake offer from failed not-found lookup turn", async () => {
  const hairProfile = createCompleteHairProfile()
  const agentResult = createAgentV2Result()
  agentResult.trace.failure_stage = "repair_failed"
  agentResult.final_answer = {
    ...agentResult.final_answer,
    answer_mode: "clarification",
    interpreted_intent: "Visible fallback after failed product lookup repair.",
    request_interpretation: {
      primary_intent: "clarification",
      product_request_kind: "none",
      routine_intent: "none",
      care_category: "unknown",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "unclear",
      specific_product_candidate: false,
      confidence: 0,
    },
    payload: {
      user_facing_answer_de:
        "Ich konnte die Antwort gerade nicht sauber zusammensetzen. Versuch es bitte noch einmal mit derselben Frage.",
      question_de: "Was genau möchtest du zu deiner Haarpflege wissen?",
      missing_keys: [],
    },
  }

  const result = await runAgentV2ProductionPipeline(
    {
      message: "Was hältst du von meinem Jean & Lean Conditioner?",
      conversationId: "conversation-1",
      userId: "user-1",
      requestId: "request-visible-not-found-intake",
      productIntakeEnabled: true,
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: hairProfile,
        routine_inventory: [],
        relevant_memory: [],
        derived_signals: [],
        suggested_overlays: [],
        missing_profile: [],
      }),
      loadUserMemoryContext: async () => ({
        enabled: true,
        entries: [],
        promptContext: null,
        dislikedProductNames: [],
      }),
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      createProductIntakeRepository: () =>
        ({
          findProductSubmission: async (submissionId: string) =>
            submissionId === "submission-pending-product"
              ? {
                  id: submissionId,
                  brand_text: "Codex Smoke",
                  product_name_text: "153558 Mango Conditioner",
                  category: "conditioner",
                  status: "pending_review",
                  updated_at: "1970-01-01T00:00:00.000Z",
                }
              : null,
          loadCatalog: async () => ({ products: [], identifiers: [] }),
          loadBrandResolutionCatalog: async () => ({
            brands: [],
            productLines: [],
            brandAliases: [],
          }),
        }) as never,
      runAgentV2ResponsesTurn: async (params) => {
        await params.tools.lookup_product_candidate({
          category: "conditioner",
          brand_text: "Jean & Lean",
          product_name_text: "Conditioner",
          reason: "User asks for an opinion on this concrete conditioner.",
          evidence_quote: "Jean & Lean Conditioner",
        })
        return agentResult
      },
    },
  )

  assert.equal(result.visibleFailure, false)
  assert.deepEqual(result.productIntakeOffer, {
    id: "product-intake-request-visible-not-found-intake",
    source: "chat",
    reason: "product_lookup_not_found",
    category: "conditioner",
    extracted_identity: {
      brand_text: "Jean & Lean",
      product_name_text: "Conditioner",
    },
  })
  const responseText = await readStream(result.stream)
  assert.match(responseText, /Jean & Lean Conditioner/)
  assert.match(responseText, /noch nicht in unserer Datenbank/)
  assert.match(responseText, /unten kurz ein/)
  assert.doesNotMatch(responseText, /Antwort gerade nicht sauber zusammensetzen/)
})

test("AgentV2 production pipeline uses warm intake copy for visible lookup failure with intake offer", async () => {
  const hairProfile = createCompleteHairProfile()
  const agentResult = createAgentV2Result()
  agentResult.trace.failure_stage = "repair_failed"
  agentResult.final_answer = {
    ...agentResult.final_answer,
    answer_mode: "clarification",
    interpreted_intent: "Generic fallback after failed product lookup repair.",
    request_interpretation: {
      primary_intent: "clarification",
      product_request_kind: "none",
      routine_intent: "none",
      care_category: "unknown",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "unclear",
      specific_product_candidate: false,
      confidence: 0,
    },
    payload: {
      user_facing_answer_de:
        "Ich bin mir gerade nicht sicher, was du genau möchtest. Formulier es bitte einmal konkreter.",
      question_de: "Was genau möchtest du zu deiner Haarpflege wissen?",
      missing_keys: [],
    },
  }

  const result = await runAgentV2ProductionPipeline(
    {
      message: "Kannst du das Produkt prüfen?",
      conversationId: "conversation-1",
      userId: "user-1",
      requestId: "request-visible-intake-warm-copy",
      productIntakeEnabled: true,
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: hairProfile,
        routine_inventory: [],
        relevant_memory: [],
        derived_signals: [],
        suggested_overlays: [],
        missing_profile: [],
      }),
      loadUserMemoryContext: async () => ({
        enabled: true,
        entries: [],
        promptContext: null,
        dislikedProductNames: [],
      }),
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      createProductIntakeRepository: () =>
        ({
          loadCatalog: async () => ({ products: [], identifiers: [] }),
          loadBrandResolutionCatalog: async () => ({
            brands: [],
            productLines: [],
            brandAliases: [],
          }),
        }) as never,
      runAgentV2ResponsesTurn: async (params) => {
        await params.tools.lookup_product_candidate({
          category: "conditioner",
          brand_text: "Jean & Lean",
          product_name_text: "Conditioner",
          reason: "User asks for an opinion on this concrete conditioner.",
          evidence_quote: "Jean & Lean Conditioner",
        })
        return agentResult
      },
    },
  )

  assert.deepEqual(result.productIntakeOffer, {
    id: "product-intake-request-visible-intake-warm-copy",
    source: "chat",
    reason: "product_lookup_not_found",
    category: "conditioner",
    extracted_identity: {
      brand_text: "Jean & Lean",
      product_name_text: "Conditioner",
    },
  })
  const responseText = await readStream(result.stream)
  assert.equal(
    responseText,
    "Ich weiß, dass du **Jean & Lean Conditioner** meinst. Das konkrete Produkt haben wir noch nicht in unserer Datenbank. Wenn du magst, gib es kurz hier ein, dann prüfen wir es für dich.",
  )
})

test("AgentV2 production pipeline preserves inferred routine product identity in visible lookup failure copy", async () => {
  const hairProfile = createCompleteHairProfile()
  const agentResult = createAgentV2Result()
  agentResult.trace.failure_stage = "repair_failed"
  agentResult.final_answer = {
    ...agentResult.final_answer,
    answer_mode: "clarification",
    interpreted_intent: "Generic fallback after failed product lookup repair.",
    request_interpretation: {
      primary_intent: "clarification",
      product_request_kind: "none",
      routine_intent: "none",
      care_category: "unknown",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "unclear",
      specific_product_candidate: false,
      confidence: 0,
    },
    payload: {
      user_facing_answer_de:
        "Ich bin mir gerade nicht sicher, was du genau möchtest. Formulier es bitte einmal konkreter.",
      question_de: "Was genau möchtest du zu deiner Haarpflege wissen?",
      missing_keys: [],
    },
  }

  const result = await runAgentV2ProductionPipeline(
    {
      message: "und passt das zu mir?",
      conversationId: "conversation-1",
      userId: "user-1",
      requestId: "request-inferred-routine-product-intake",
      productIntakeEnabled: true,
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [
        {
          ...createMessage(0),
          role: "assistant",
          content:
            "Ja, ich sehe **Renewing Argan Oil of Morocco Shampoo** als dein aktuelles Shampoo in deiner Routine.",
        },
      ],
      getUserContext: async () => ({
        profile: hairProfile,
        routine_inventory: [
          {
            category: "shampoo",
            product_name: "Renewing Argan Oil of Morocco Shampoo",
            brand_text: "Renewing Argan Oil of Morocco",
            product_id: null,
            match_status: "matched",
            frequency_range: "weekly_3_4x",
          },
        ],
        relevant_memory: [],
        derived_signals: [],
        suggested_overlays: [],
        missing_profile: [],
      }),
      loadUserMemoryContext: async () => ({
        enabled: true,
        entries: [],
        promptContext: null,
        dislikedProductNames: [],
      }),
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      createProductIntakeRepository: () =>
        ({
          loadCatalog: async () => ({ products: [], identifiers: [] }),
          loadBrandResolutionCatalog: async () => ({
            brands: [],
            productLines: [],
            brandAliases: [],
          }),
        }) as never,
      runAgentV2ResponsesTurn: async (params) => {
        await params.tools.lookup_product_candidate({
          category: "shampoo",
          brand_text: "Renewing Argan Oil of Morocco",
          product_name_text: "Shampoo",
          reason: "The latest follow-up asks whether the current routine shampoo fits the user.",
          evidence_quote: "Renewing Argan Oil of Morocco Shampoo",
        })
        return agentResult
      },
    },
  )

  const responseText = await readStream(result.stream)
  assert.equal(
    responseText,
    "Ich weiß, dass du **Renewing Argan Oil of Morocco Shampoo** meinst. Das konkrete Produkt haben wir noch nicht in unserer Datenbank. Wenn du magst, gib es kurz hier ein, dann prüfen wir es für dich.",
  )
})

test("AgentV2 production pipeline promotes matched routine product follow-ups to resolved product context", async () => {
  const hairProfile = createCompleteHairProfile()
  const agentResult = createAgentV2Result()
  agentResult.final_answer = {
    ...agentResult.final_answer,
    answer_mode: "general_advice",
    interpreted_intent: "Answered product fit from resolved routine product context.",
    request_interpretation: {
      ...agentResult.final_answer.request_interpretation,
      primary_intent: "general_advice",
      product_request_kind: "product_detail",
      care_category: "conditioner",
      specific_product_candidate: true,
      evidence_quote: "passt der zu mir",
    },
    payload: {
      user_facing_answer_de:
        "Ich beziehe mich auf John Frieda Frizz Ease Wunder-Reparatur Conditioner.",
      category_or_topic: "conditioner",
      key_points_de: ["Produkt ist aus der Routine aufgelöst."],
      next_step_offer_de: null,
    },
  }

  const result = await runAgentV2ProductionPipeline(
    {
      message: "Okay und passt der zu mir?",
      conversationId: "conversation-1",
      userId: "user-1",
      requestId: "request-matched-routine-product-context",
      productIntakeEnabled: true,
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [
        {
          ...createMessage(0),
          role: "assistant",
          content:
            "Ja, ich sehe **Conditioner Frizz Ease Wunder-Reparatur** als dein aktuelles Conditioner in deiner Routine.",
        },
      ],
      getUserContext: async () => ({
        profile: hairProfile,
        routine_inventory: [
          {
            category: "conditioner",
            product_name: "Conditioner Frizz Ease Wunder-Reparatur",
            brand_text: "John Frieda",
            product_id: "john-frieda-frizz-ease-conditioner",
            match_status: "matched",
            frequency_range: "weekly_2x",
          },
        ],
        relevant_memory: [],
        derived_signals: [],
        suggested_overlays: [],
        missing_profile: [],
      }),
      loadUserMemoryContext: async () => ({
        enabled: true,
        entries: [],
        promptContext: null,
        dislikedProductNames: [],
      }),
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      createProductIntakeRepository: () =>
        ({
          loadCatalog: async () => ({ products: [], identifiers: [] }),
          loadBrandResolutionCatalog: async () => ({
            brands: [],
            productLines: [],
            brandAliases: [],
          }),
        }) as never,
      runAgentV2ResponsesTurn: async (params) => {
        assert.equal(
          params.activeResolvedProductContext?.product_id,
          "john-frieda-frizz-ease-conditioner",
        )
        assert.equal(params.activeResolvedProductContext?.category, "conditioner")
        assert.equal(
          params.activeResolvedProductContext?.name,
          "John Frieda Conditioner Frizz Ease Wunder-Reparatur",
        )
        return agentResult
      },
    },
  )

  assert.equal(result.productIntakeOffer, null)
})

test("AgentV2 production pipeline still attaches intake when concrete not-found metadata is under-specified", async () => {
  const hairProfile = createCompleteHairProfile()
  const agentResult = createAgentV2Result()
  agentResult.trace.failure_stage = "repair_failed"
  agentResult.final_answer = {
    ...agentResult.final_answer,
    answer_mode: "general_advice",
    interpreted_intent:
      "User asked about a concrete product, but the repaired answer metadata lost the specific-product flag.",
    request_interpretation: {
      primary_intent: "general_advice",
      product_request_kind: "none",
      routine_intent: "none",
      care_category: "conditioner",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "Codex Smoke Mango Conditioner",
      specific_product_candidate: false,
      confidence: 0,
    },
    payload: {
      user_facing_answer_de:
        "Ich habe Codex Smoke Mango Conditioner noch nicht in unserer Datenbank. Wenn du magst, füge es kurz hinzu, dann prüfen wir es konkret für dich.",
      category_or_topic: "conditioner",
      key_points_de: ["Codex Smoke Mango Conditioner ist noch nicht in unserer Datenbank."],
      next_step_offer_de: "Du kannst das Produkt hinzufügen, damit wir es konkret prüfen können.",
    },
  }

  const result = await runAgentV2ProductionPipeline(
    {
      message: "Was hältst du von meinem Codex Smoke Mango Conditioner?",
      conversationId: "conversation-1",
      userId: "user-1",
      requestId: "request-concrete-not-found-under-specified",
      productIntakeEnabled: true,
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: hairProfile,
        routine_inventory: [],
        relevant_memory: [],
        derived_signals: [],
        suggested_overlays: [],
        missing_profile: [],
      }),
      loadUserMemoryContext: async () => ({
        enabled: true,
        entries: [],
        promptContext: null,
        dislikedProductNames: [],
      }),
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      createProductIntakeRepository: () =>
        ({
          loadCatalog: async () => ({ products: [], identifiers: [] }),
          loadBrandResolutionCatalog: async () => ({
            brands: [{ id: "brand-codex-smoke", canonical_name: "Codex Smoke" }],
            productLines: [],
            brandAliases: [],
          }),
        }) as never,
      runAgentV2ResponsesTurn: async (params) => {
        await params.tools.lookup_product_candidate({
          category: "conditioner",
          brand_text: "Codex Smoke",
          product_name_text: "Mango Conditioner",
          reason: "User asks for an opinion on this concrete conditioner.",
          evidence_quote: "Codex Smoke Mango Conditioner",
        })
        return agentResult
      },
    },
  )

  assert.deepEqual(result.productIntakeOffer, {
    id: "product-intake-request-concrete-not-found-under-specified",
    source: "chat",
    reason: "product_lookup_not_found",
    category: "conditioner",
    extracted_identity: {
      brand_text: "Codex Smoke",
      product_name_text: "Mango Conditioner",
    },
  })
  assert.equal(
    await readStream(result.stream),
    "Ich habe **Codex Smoke Mango Conditioner** noch nicht in unserer Datenbank. Gib es bitte unten kurz ein, dann kann ich es genauer für dich prüfen.",
  )
})

test("AgentV2 production pipeline attaches intake when concrete not-found lookup has unsplit brand identity", async () => {
  const hairProfile = createCompleteHairProfile()
  const agentResult = createAgentV2Result()
  agentResult.final_answer = {
    ...agentResult.final_answer,
    answer_mode: "general_advice",
    interpreted_intent:
      "User asked about a concrete product; the answer safely deferred, but metadata stayed generic.",
    request_interpretation: {
      primary_intent: "general_advice",
      product_request_kind: "none",
      routine_intent: "none",
      care_category: "conditioner",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "Jean & Lean Conditioner Mystery Rose",
      specific_product_candidate: false,
      confidence: 0,
    },
    payload: {
      user_facing_answer_de:
        "Ich habe Jean & Lean Conditioner Mystery Rose noch nicht in unserer Datenbank. Wenn du magst, füge es kurz hinzu, dann prüfen wir es konkret für dich.",
      category_or_topic: "conditioner",
      key_points_de: ["Jean & Lean Conditioner Mystery Rose ist noch nicht in unserer Datenbank."],
      next_step_offer_de: null,
    },
  }

  const result = await runAgentV2ProductionPipeline(
    {
      message: "Was hältst du von meinem Jean & Lean Conditioner Mystery Rose?",
      conversationId: "conversation-concrete-not-found-unsplit",
      userId: "user-1",
      requestId: "request-concrete-not-found-unsplit",
      productIntakeEnabled: true,
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: hairProfile,
        routine_inventory: [],
        relevant_memory: [],
        derived_signals: [],
        suggested_overlays: [],
        missing_profile: [],
      }),
      loadUserMemoryContext: async () => ({
        enabled: true,
        entries: [],
        promptContext: null,
        dislikedProductNames: [],
      }),
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      createProductIntakeRepository: () =>
        ({
          loadCatalog: async () => ({ products: [], identifiers: [] }),
          loadBrandResolutionCatalog: async () => ({
            brands: [],
            productLines: [],
            brandAliases: [],
          }),
        }) as never,
      runAgentV2ResponsesTurn: async (params) => {
        await params.tools.lookup_product_candidate({
          category: "conditioner",
          brand_text: null,
          product_name_text: "Jean & Lean Conditioner Mystery Rose",
          reason: "User asks for an opinion on this concrete conditioner.",
          evidence_quote: "Jean & Lean Conditioner Mystery Rose",
        })
        return agentResult
      },
    },
  )

  assert.equal(result.productIntakeOffer?.reason, "product_lookup_not_found")
  assert.equal(result.productIntakeOffer?.category, "conditioner")
  assert.deepEqual(result.productIntakeOffer?.extracted_identity, {
    product_name_text: "Jean & Lean Conditioner Mystery Rose",
  })
  assert.equal(
    await readStream(result.stream),
    "Ich habe **Jean & Lean Conditioner Mystery Rose** noch nicht in unserer Datenbank. Gib es bitte unten kurz ein, dann kann ich es genauer für dich prüfen.",
  )
})

test("AgentV2 production pipeline introduces intake card before coarse fallback guidance", async () => {
  const hairProfile = createCompleteHairProfile()
  const agentResult = createAgentV2Result()
  agentResult.final_answer = {
    ...agentResult.final_answer,
    answer_mode: "constraint_blocked",
    interpreted_intent:
      "User asked whether a concrete conditioner suits them; product lookup could not verify the exact product.",
    request_interpretation: {
      primary_intent: "product_recommendation",
      product_request_kind: "product_detail",
      routine_intent: "none",
      care_category: "conditioner",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "Schwarzkopf GLISS Conditioner Liquid Silk",
      specific_product_candidate: true,
      confidence: 0.83,
    },
    payload: {
      user_facing_answer_de:
        "Ich kann Schwarzkopf GLISS Conditioner Liquid Silk noch nicht sicher zuordnen, deshalb bewerte ich ihn nicht ins Blaue hinein.\n\nDein Haarprofil ist klar genug für eine grobe Einordnung: feines, welliges, gefärbtes Haar mit Frizz profitiert meist eher von einem leichten Conditioner als von etwas sehr Schwerem. Für diese konkrete Variante fehlt mir aber die verifizierte Zuordnung.",
      blocking_constraints: ["product_not_verified"],
      safe_alternative_de:
        "Allgemein passt für dein Profil eher ein leichter Conditioner als ein sehr schwerer.",
    },
  }

  const result = await runAgentV2ProductionPipeline(
    {
      message: "passt dieses produkt zu mir: Schwarzkopf GLISS Conditioner Liquid Silk?",
      conversationId: "conversation-intake-before-coarse-guidance",
      userId: "user-1",
      requestId: "request-intake-before-coarse-guidance",
      productIntakeEnabled: true,
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: hairProfile,
        routine_inventory: [],
        relevant_memory: [],
        derived_signals: [],
        suggested_overlays: [],
        missing_profile: [],
      }),
      loadUserMemoryContext: async () => ({
        enabled: true,
        entries: [],
        promptContext: null,
        dislikedProductNames: [],
      }),
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      createProductIntakeRepository: () =>
        ({
          loadCatalog: async () => ({ products: [], identifiers: [] }),
          loadBrandResolutionCatalog: async () => ({
            brands: [{ id: "brand-schwarzkopf-gliss", canonical_name: "Schwarzkopf GLISS" }],
            productLines: [],
            brandAliases: [],
          }),
        }) as never,
      runAgentV2ResponsesTurn: async (params) => {
        await params.tools.lookup_product_candidate({
          category: "conditioner",
          brand_text: "Schwarzkopf GLISS",
          product_name_text: "Conditioner Liquid Silk",
          reason: "User asks whether this concrete conditioner suits them.",
          evidence_quote: "Schwarzkopf GLISS Conditioner Liquid Silk",
        })
        return agentResult
      },
    },
  )

  assert.equal(result.productIntakeOffer?.reason, "product_lookup_not_found")
  assert.equal(
    await readStream(result.stream),
    "Ich habe **Schwarzkopf GLISS Conditioner Liquid Silk** noch nicht in unserer Datenbank. Gib es bitte unten kurz ein, dann kann ich es genauer für dich prüfen.\n\nWas ich dir schon grob sagen kann: Dein Haarprofil ist klar genug für eine grobe Einordnung: feines, welliges, gefärbtes Haar mit Frizz profitiert meist eher von einem leichten Conditioner als von etwas sehr Schwerem. Für diese konkrete Variante fehlt mir aber die verifizierte Zuordnung.",
  )
})

test("AgentV2 production pipeline drops duplicate intake deferral from coarse fallback guidance", async () => {
  const hairProfile = createCompleteHairProfile()
  const agentResult = createAgentV2Result()
  agentResult.final_answer = {
    ...agentResult.final_answer,
    answer_mode: "constraint_blocked",
    interpreted_intent:
      "User asked whether a concrete shampoo suits them; product lookup could not verify the exact product.",
    request_interpretation: {
      primary_intent: "product_recommendation",
      product_request_kind: "product_detail",
      routine_intent: "none",
      care_category: "shampoo",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "L'ORÉAL PARIS ELVITAL Shampoo Glycolic Gloss",
      specific_product_candidate: true,
      confidence: 0.83,
    },
    payload: {
      user_facing_answer_de:
        "Ich habe L'ORÉAL PARIS ELVITAL Shampoo noch nicht in unserer Datenbank. Wenn du magst, füge es kurz hinzu, dann prüfen wir es konkret für dich.",
      blocking_constraints: ["product_not_verified"],
      safe_alternative_de: null,
    },
  }

  const result = await runAgentV2ProductionPipeline(
    {
      message: "passt das L'ORÉAL PARIS ELVITAL Shampoo Glycolic Gloss zu mir?",
      conversationId: "conversation-intake-duplicate-deferral",
      userId: "user-1",
      requestId: "request-intake-duplicate-deferral",
      productIntakeEnabled: true,
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: hairProfile,
        routine_inventory: [],
        relevant_memory: [],
        derived_signals: [],
        suggested_overlays: [],
        missing_profile: [],
      }),
      loadUserMemoryContext: async () => ({
        enabled: true,
        entries: [],
        promptContext: null,
        dislikedProductNames: [],
      }),
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      createProductIntakeRepository: () =>
        ({
          loadCatalog: async () => ({ products: [], identifiers: [] }),
          loadBrandResolutionCatalog: async () => ({
            brands: [{ id: "brand-loreal-elvital", canonical_name: "L'ORÉAL PARIS ELVITAL" }],
            productLines: [],
            brandAliases: [],
          }),
        }) as never,
      runAgentV2ResponsesTurn: async (params) => {
        await params.tools.lookup_product_candidate({
          category: "shampoo",
          brand_text: "L'ORÉAL PARIS ELVITAL",
          product_name_text: "Shampoo Glycolic Gloss",
          reason: "User asks whether this concrete shampoo suits them.",
          evidence_quote: "L'ORÉAL PARIS ELVITAL Shampoo Glycolic Gloss",
        })
        return agentResult
      },
    },
  )

  assert.equal(result.productIntakeOffer?.reason, "product_lookup_not_found")
  assert.equal(
    await readStream(result.stream),
    "Ich habe **L'ORÉAL PARIS ELVITAL Shampoo Glycolic Gloss** noch nicht in unserer Datenbank. Gib es bitte unten kurz ein, dann kann ich es genauer für dich prüfen.",
  )
})

test("AgentV2 production pipeline attaches intake when not-found product words are reordered in the user message", async () => {
  const hairProfile = createCompleteHairProfile()
  const agentResult = createAgentV2Result()
  agentResult.final_answer = {
    ...agentResult.final_answer,
    answer_mode: "constraint_blocked",
    interpreted_intent:
      "User asked about a concrete conditioner, but the lookup could not verify the exact product.",
    request_interpretation: {
      primary_intent: "product_recommendation",
      product_request_kind: "product_detail",
      routine_intent: "none",
      care_category: "conditioner",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "Jean & Lean Conditioner Mystery Rose",
      specific_product_candidate: true,
      confidence: 0.78,
    },
    payload: {
      user_facing_answer_de:
        "Ich habe Jean & Lean Conditioner noch nicht in unserer Datenbank. Wenn du magst, füge es kurz hinzu, dann prüfen wir es konkret für dich.",
      blocking_constraints: ["product_not_verified"],
      safe_alternative_de: "Du kannst das Produkt hinzufügen, damit wir es konkret prüfen können.",
    },
  }

  const result = await runAgentV2ProductionPipeline(
    {
      message: "Was hältst du von meinem Jean & Lean Conditioner Mystery Rose?",
      conversationId: "conversation-not-found-token-order",
      userId: "user-1",
      requestId: "request-not-found-token-order",
      productIntakeEnabled: true,
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: hairProfile,
        routine_inventory: [],
        relevant_memory: [],
        derived_signals: [],
        suggested_overlays: [],
        missing_profile: [],
      }),
      loadUserMemoryContext: async () => ({
        enabled: true,
        entries: [],
        promptContext: null,
        dislikedProductNames: [],
      }),
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      createProductIntakeRepository: () =>
        ({
          loadCatalog: async () => ({ products: [], identifiers: [] }),
          loadBrandResolutionCatalog: async () => ({
            brands: [],
            productLines: [],
            brandAliases: [],
          }),
        }) as never,
      runAgentV2ResponsesTurn: async (params) => {
        await params.tools.lookup_product_candidate({
          category: "conditioner",
          brand_text: "Jean & Lean",
          product_name_text: "Mystery Rose Conditioner",
          reason: "User asks for an opinion on this concrete conditioner.",
          evidence_quote: "Jean & Lean Conditioner Mystery Rose",
        })
        return agentResult
      },
    },
  )

  assert.deepEqual(result.productIntakeOffer?.extracted_identity, {
    brand_text: "Jean & Lean",
    product_name_text: "Mystery Rose Conditioner",
  })
  assert.equal(result.productIntakeOffer?.category, "conditioner")
})

test("AgentV2 production pipeline does not offer intake again for already pending product submissions", async () => {
  const hairProfile = createCompleteHairProfile()
  const agentResult = createAgentV2Result()
  agentResult.trace = {
    ...agentResult.trace,
    failure_stage: "repair_failed",
  }

  const result = await runAgentV2ProductionPipeline(
    {
      message: "Passt es zu mir?",
      conversationId: "conversation-pending-product",
      userId: "user-1",
      requestId: "request-pending-product",
      productIntakeEnabled: true,
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: hairProfile,
        routine_inventory: [
          {
            category: "conditioner",
            product_name: "153558 Mango Conditioner",
            frequency_range: "weekly_1x",
            brand_text: "Codex Smoke",
            product_id: null,
            product_submission_id: "submission-pending-product",
            match_status: "pending_review",
          },
        ],
        relevant_memory: [],
        derived_signals: [],
        suggested_overlays: [],
        missing_profile: [],
      }),
      loadUserMemoryContext: async () => ({
        enabled: true,
        entries: [],
        promptContext: null,
        dislikedProductNames: [],
      }),
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      createProductIntakeRepository: () =>
        ({
          findProductSubmission: async (submissionId: string) =>
            submissionId === "submission-pending-product"
              ? {
                  id: submissionId,
                  brand_text: "Codex Smoke",
                  product_name_text: "153558 Mango Conditioner",
                  category: "conditioner",
                  status: "pending_review",
                  updated_at: "1970-01-01T00:00:00.000Z",
                }
              : null,
          loadCatalog: async () => ({ products: [], identifiers: [] }),
          loadBrandResolutionCatalog: async () => ({
            brands: [],
            productLines: [],
            brandAliases: [],
          }),
        }) as never,
      runAgentV2ResponsesTurn: async (params) => {
        await params.tools.lookup_product_candidate({
          category: "conditioner",
          brand_text: "Codex Smoke",
          product_name_text: "153558 Mango Conditioner",
          reason: "User asks a follow-up about a product they already submitted.",
          evidence_quote: "Codex Smoke 153558 Mango Conditioner",
        })
        return agentResult
      },
    },
  )

  assert.equal(result.visibleFailure, false)
  assert.equal(result.productIntakeOffer, null)
  assert.equal(result.productLookupClarification, null)
  const responseText = await readStream(result.stream)
  assert.match(responseText, /noch in Prüfung/)
  assert.doesNotMatch(responseText, /gib es kurz hier ein/)
})

test("AgentV2 production pipeline blocks repeat intake for pending submissions on normal not-found turns", async () => {
  const hairProfile = createCompleteHairProfile()
  const agentResult = createAgentV2Result()
  agentResult.final_answer = {
    ...agentResult.final_answer,
    answer_mode: "general_advice",
    interpreted_intent:
      "User asks whether an already submitted product suits them, but the model still cannot verify it.",
    request_interpretation: {
      primary_intent: "product_recommendation",
      product_request_kind: "product_detail",
      routine_intent: "none",
      care_category: "conditioner",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "Codex Smoke 153558 Mango Conditioner",
      specific_product_candidate: true,
      confidence: 0.82,
    },
    tool_grounding: {
      ...agentResult.final_answer.tool_grounding,
      used_product_tool: false,
      product_ids: [],
    },
    payload: {
      user_facing_answer_de:
        "Dieses konkrete Produkt haben wir noch nicht in unserer Datenbank. Wenn du magst, gib es kurz hier ein, dann prüfen wir es für dich.",
      category_or_topic: "conditioner",
      key_points_de: [],
      next_step_offer_de: null,
    },
  }

  const result = await runAgentV2ProductionPipeline(
    {
      message: "Passt es zu mir?",
      conversationId: "conversation-pending-product-normal",
      userId: "user-1",
      requestId: "request-pending-product-normal",
      productIntakeEnabled: true,
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: hairProfile,
        routine_inventory: [
          {
            category: "conditioner",
            product_name: "153558 Mango Conditioner",
            frequency_range: "weekly_1x",
            brand_text: "Codex Smoke",
            product_id: null,
            product_submission_id: "submission-pending-product-normal",
            match_status: "pending_review",
          },
        ],
        relevant_memory: [],
        derived_signals: [],
        suggested_overlays: [],
        missing_profile: [],
      }),
      loadUserMemoryContext: async () => ({
        enabled: true,
        entries: [],
        promptContext: null,
        dislikedProductNames: [],
      }),
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      createProductIntakeRepository: () =>
        ({
          findProductSubmission: async (submissionId: string) =>
            submissionId === "submission-pending-product-normal"
              ? {
                  id: submissionId,
                  brand_text: "Codex Smoke",
                  product_name_text: "153558 Mango Conditioner",
                  category: "conditioner",
                  status: "pending_review",
                  updated_at: "1970-01-01T00:00:00.000Z",
                }
              : null,
          loadCatalog: async () => ({ products: [], identifiers: [] }),
          loadBrandResolutionCatalog: async () => ({
            brands: [],
            productLines: [],
            brandAliases: [],
          }),
        }) as never,
      runAgentV2ResponsesTurn: async (params) => {
        await params.tools.lookup_product_candidate({
          category: "conditioner",
          brand_text: "Codex Smoke",
          product_name_text: "153558 Mango Conditioner",
          reason: "User asks a follow-up about a product they already submitted.",
          evidence_quote: "Codex Smoke 153558 Mango Conditioner",
        })
        return agentResult
      },
    },
  )

  assert.equal(result.visibleFailure, false)
  assert.equal(result.productIntakeOffer, null)
  assert.equal(result.productLookupClarification, null)
  const responseText = await readStream(result.stream)
  assert.match(responseText, /noch in Prüfung/)
  assert.doesNotMatch(responseText, /gib es kurz hier ein/)
})

test("AgentV2 production pipeline blocks category follow-ups for a single pending submitted product", async () => {
  const hairProfile = createCompleteHairProfile()
  const agentResult = createAgentV2Result()
  agentResult.final_answer = {
    ...agentResult.final_answer,
    answer_mode: "general_advice",
    interpreted_intent:
      "User asks a category-level frequency follow-up after submitting a product.",
    request_interpretation: {
      primary_intent: "general_advice",
      product_request_kind: "none",
      routine_intent: "none",
      care_category: "conditioner",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "wie oft sollte ich den Conditioner benutzen",
      specific_product_candidate: false,
      confidence: 0.74,
    },
    payload: {
      user_facing_answer_de: "Am besten bei jedem Waschen, also etwa 3-4x pro Woche.",
      category_or_topic: "conditioner",
      key_points_de: ["Conditioner nach jeder Wäsche nutzen."],
      next_step_offer_de: null,
    },
  }

  const result = await runAgentV2ProductionPipeline(
    {
      message: "Und wie oft sollte ich den Conditioner benutzen?",
      conversationId: "conversation-pending-product-category-followup",
      userId: "user-1",
      requestId: "request-pending-product-category-followup",
      productIntakeEnabled: true,
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: hairProfile,
        routine_inventory: [
          {
            category: "conditioner",
            product_name: "Mystery Rose Conditioner",
            frequency_range: "weekly_1x",
            brand_text: "Jean & Lean",
            product_id: null,
            product_submission_id: "submission-pending-category-followup",
            match_status: "pending_review",
          },
        ],
        relevant_memory: [],
        derived_signals: [],
        suggested_overlays: [],
        missing_profile: [],
      }),
      loadUserMemoryContext: async () => ({
        enabled: true,
        entries: [],
        promptContext: null,
        dislikedProductNames: [],
      }),
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      createProductIntakeRepository: () =>
        ({
          findProductSubmission: async (submissionId: string) =>
            submissionId === "submission-pending-category-followup"
              ? {
                  id: submissionId,
                  brand_text: "Jean & Lean",
                  product_name_text: "Mystery Rose Conditioner",
                  category: "conditioner",
                  status: "pending_review",
                  updated_at: "1970-01-01T00:00:00.000Z",
                }
              : null,
          loadCatalog: async () => ({ products: [], identifiers: [] }),
          loadBrandResolutionCatalog: async () => ({
            brands: [],
            productLines: [],
            brandAliases: [],
          }),
        }) as never,
      runAgentV2ResponsesTurn: async () => agentResult,
    },
  )

  assert.equal(result.productIntakeOffer, null)
  assert.equal(result.productLookupClarification, null)
  const responseText = await readStream(result.stream)
  assert.match(responseText, /Jean & Lean Mystery Rose Conditioner/)
  assert.match(responseText, /noch in Prüfung/)
  assert.doesNotMatch(responseText, /bei jedem Waschen/)
})

test("AgentV2 production pipeline blocks category follow-ups from persisted pending product context", async () => {
  const hairProfile = createCompleteHairProfile()
  const agentResult = createAgentV2Result()
  agentResult.final_answer = {
    ...agentResult.final_answer,
    answer_mode: "general_advice",
    interpreted_intent:
      "User asks a category-level frequency follow-up after submitting a product.",
    request_interpretation: {
      primary_intent: "general_advice",
      product_request_kind: "none",
      routine_intent: "none",
      care_category: "conditioner",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "wie oft sollte ich den Conditioner benutzen",
      specific_product_candidate: false,
      confidence: 0.74,
    },
    payload: {
      user_facing_answer_de: "Am besten bei jedem Waschen, also etwa 3-4x pro Woche.",
      category_or_topic: "conditioner",
      key_points_de: ["Conditioner nach jeder Wäsche nutzen."],
      next_step_offer_de: null,
    },
  }

  const persistedState: AgentV2ConversationStateV2 = {
    ...createDefaultAgentV2ConversationState(),
    agent_v2: {
      ...createDefaultAgentV2ConversationState().agent_v2,
      active_product_contexts: [
        {
          status: "pending_review",
          product_id: null,
          submission_id: "submission-persisted-pending",
          category: "conditioner",
          brand_text: "Jean & Lean",
          product_name_text: "Mystery Rose",
          display_name: "Jean & Lean Mystery Rose",
          original_user_message: "Ich habe Jean & Lean Mystery Rose eingereicht.",
          source: "product_intake_submission",
          updated_at: "1970-01-01T00:00:00.000Z",
        },
      ],
      active_resolved_product_context: null,
    },
  }

  const result = await runAgentV2ProductionPipeline(
    {
      message: "Und wie oft sollte ich den Conditioner benutzen?",
      conversationId: "conversation-persisted-pending-product-category-followup",
      userId: "user-1",
      requestId: "request-persisted-pending-product-category-followup",
      productIntakeEnabled: false,
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: hairProfile,
        routine_inventory: [],
        relevant_memory: [],
        derived_signals: [],
        suggested_overlays: [],
        missing_profile: [],
      }),
      loadUserMemoryContext: async () => ({
        enabled: true,
        entries: [],
        promptContext: null,
        dislikedProductNames: [],
      }),
      loadConversationState: async (): Promise<AgentV2ConversationStateV2> => persistedState,
      createProductIntakeRepository: () =>
        ({
          loadCatalog: async () => ({ products: [], identifiers: [] }),
          loadBrandResolutionCatalog: async () => ({
            brands: [],
            productLines: [],
            brandAliases: [],
          }),
        }) as never,
      runAgentV2ResponsesTurn: async () => agentResult,
    },
  )

  assert.equal(result.productIntakeOffer, null)
  assert.equal(result.productLookupClarification, null)
  const responseText = await readStream(result.stream)
  assert.match(responseText, /Jean & Lean Mystery Rose/)
  assert.match(responseText, /noch in Prüfung/)
  assert.doesNotMatch(responseText, /bei jedem Waschen/)
})

test("AgentV2 production pipeline preserves safety boundary copy without attaching intake", async () => {
  const hairProfile = createCompleteHairProfile()
  const agentResult = createAgentV2Result()
  agentResult.trace.failure_stage = "repair_failed"
  agentResult.final_answer = {
    ...agentResult.final_answer,
    answer_mode: "safety_boundary",
    interpreted_intent:
      "The user mentioned a product, but the answer itself must stay inside the safety boundary.",
    request_interpretation: {
      primary_intent: "safety_boundary",
      product_request_kind: "product_detail",
      routine_intent: "none",
      care_category: "conditioner",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "starker Haarausfall",
      specific_product_candidate: true,
      confidence: 0.86,
    },
    payload: {
      user_facing_answer_de:
        "Bei starkem Haarausfall solltest du ärztlich abklären lassen, was dahintersteckt.",
      boundary_reason_de: "Starker Haarausfall ist medizinisch abklärungsbedürftig.",
      next_step_de: "Bitte sprich mit einer Dermatologin oder einem Arzt.",
    },
  }

  const result = await runAgentV2ProductionPipeline(
    {
      message: "Ich nutze Jean & Lean Conditioner und habe starken Haarausfall.",
      conversationId: "conversation-1",
      userId: "user-1",
      requestId: "request-visible-intake-preserves-safety",
      productIntakeEnabled: true,
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: hairProfile,
        routine_inventory: [],
        relevant_memory: [],
        derived_signals: [],
        suggested_overlays: [],
        missing_profile: [],
      }),
      loadUserMemoryContext: async () => ({
        enabled: true,
        entries: [],
        promptContext: null,
        dislikedProductNames: [],
      }),
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      createProductIntakeRepository: () =>
        ({
          loadCatalog: async () => ({ products: [], identifiers: [] }),
          loadBrandResolutionCatalog: async () => ({
            brands: [],
            productLines: [],
            brandAliases: [],
          }),
        }) as never,
      runAgentV2ResponsesTurn: async (params) => {
        await params.tools.lookup_product_candidate({
          category: "conditioner",
          brand_text: "Jean & Lean",
          product_name_text: "Conditioner",
          reason: "User mentions a concrete conditioner while asking a safety-boundary question.",
          evidence_quote: "Jean & Lean Conditioner",
        })
        return agentResult
      },
    },
  )

  assert.equal(result.visibleFailure, true)
  assert.equal(result.productIntakeOffer, null)
  const responseText = await readStream(result.stream)
  assert.equal(
    responseText,
    "Bei starkem Haarausfall solltest du ärztlich abklären lassen, was dahintersteckt.",
  )
  assert.doesNotMatch(responseText, /Das konkrete Produkt/)
})

test("AgentV2 production pipeline resolves exact deterministic lookup fallback into active product context", async () => {
  const hairProfile = createCompleteHairProfile()
  const agentResult = createAgentV2Result()
  agentResult.final_answer = {
    ...agentResult.final_answer,
    answer_mode: "clarification",
    interpreted_intent: "Generic fallback after model skipped required product lookup.",
    request_interpretation: {
      primary_intent: "clarification",
      product_request_kind: "none",
      routine_intent: "none",
      care_category: "unknown",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "unclear",
      specific_product_candidate: false,
      confidence: 0,
    },
    payload: {
      user_facing_answer_de:
        "Ich bin mir gerade nicht sicher, was du genau möchtest. Formulier es bitte einmal konkreter.",
      question_de: "Was genau möchtest du zu deiner Haarpflege wissen?",
      missing_keys: [],
    },
  }

  const result = await runAgentV2ProductionPipeline(
    {
      message: "Was hältst du von meinem Syoss Intense Curls Shampoo?",
      conversationId: "conversation-1",
      userId: "user-1",
      requestId: "request-deterministic-exact-fallback",
      productIntakeEnabled: true,
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: hairProfile,
        routine_inventory: [],
        relevant_memory: [],
        derived_signals: [],
        suggested_overlays: [],
        missing_profile: [],
      }),
      loadUserMemoryContext: async () => ({
        enabled: true,
        entries: [],
        promptContext: null,
        dislikedProductNames: [],
      }),
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      createProductIntakeRepository: () =>
        ({
          loadCatalog: async () => ({
            products: [
              {
                id: "syoss-intense-curls-shampoo",
                name: "Intense Curls Shampoo",
                cleanName: "Intense Curls Shampoo",
                brandId: "brand-syoss",
                categoryKey: "shampoo",
                isActive: true,
                lifecycleStatus: "active",
                isChaarlieRecommended: true,
              },
            ],
            identifiers: [],
          }),
          loadBrandResolutionCatalog: async () => ({
            brands: [{ id: "brand-syoss", canonical_name: "Syoss" }],
            productLines: [],
            brandAliases: [],
          }),
        }) as never,
      runAgentV2ResponsesTurn: async () => agentResult,
    },
  )

  const responseText = await readStream(result.stream)
  assert.match(responseText, /Syoss Intense Curls Shampoo/)
  assert.doesNotMatch(responseText, /nicht eindeutig/)
  assert.doesNotMatch(responseText, /Formulier es bitte einmal konkreter/)
  assert.equal(result.productIntakeOffer, null)
  assert.equal(result.productLookupClarification, null)
  const nextState = result.conversationStateTransition.next_state as AgentV2ConversationStateV2
  assert.deepEqual(nextState.agent_v2.active_resolved_product_context, {
    source: "lookup_exact",
    product_id: "syoss-intense-curls-shampoo",
    name: "Syoss Intense Curls Shampoo",
    category: "shampoo",
    original_user_message: "Was hältst du von meinem Syoss Intense Curls Shampoo?",
  })
})

test("AgentV2 production pipeline clears active resolved product when user names another unresolved product", async () => {
  const hairProfile = createCompleteHairProfile()
  const conversationState = createDefaultAgentV2ConversationState()
  conversationState.agent_v2.active_resolved_product_context = {
    source: "product_lookup_selection",
    product_id: "syoss-intense-curls-shampoo",
    name: "Syoss Intense Curls Shampoo",
    category: "shampoo",
    original_user_message: "Ich nutze Syoss Intense Volume Shampoo. Passt das zu mir?",
  }
  const agentResult = createAgentV2Result()
  agentResult.final_answer = {
    ...agentResult.final_answer,
    answer_mode: "clarification",
    interpreted_intent: "Generic fallback after model skipped required product lookup.",
    request_interpretation: {
      primary_intent: "clarification",
      product_request_kind: "none",
      routine_intent: "none",
      care_category: "unknown",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "unclear",
      specific_product_candidate: false,
      confidence: 0,
    },
    payload: {
      user_facing_answer_de:
        "Ich bin mir gerade nicht sicher, was du genau möchtest. Formulier es bitte einmal konkreter.",
      question_de: "Was genau möchtest du zu deiner Haarpflege wissen?",
      missing_keys: [],
    },
  }

  const result = await runAgentV2ProductionPipeline(
    {
      message: "Was hältst du von meinem Jean & Lean Conditioner?",
      conversationId: "conversation-1",
      userId: "user-1",
      requestId: "request-new-unresolved-product",
      productIntakeEnabled: true,
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: hairProfile,
        routine_inventory: [],
        relevant_memory: [],
        derived_signals: [],
        suggested_overlays: [],
        missing_profile: [],
      }),
      loadUserMemoryContext: async () => ({
        enabled: true,
        entries: [],
        promptContext: null,
        dislikedProductNames: [],
      }),
      loadConversationState: async (): Promise<AgentV2ConversationStateV2> => conversationState,
      createProductIntakeRepository: () =>
        ({
          loadCatalog: async () => ({ products: [], identifiers: [] }),
          loadBrandResolutionCatalog: async () => ({
            brands: [],
            productLines: [],
            brandAliases: [],
          }),
        }) as never,
      runAgentV2ResponsesTurn: async () => agentResult,
    },
  )

  assert.equal(result.productIntakeOffer?.category, "conditioner")
  const nextState = result.conversationStateTransition.next_state as AgentV2ConversationStateV2
  assert.equal(nextState.agent_v2.active_resolved_product_context, null)
})

test("AgentV2 production pipeline surfaces lookup clarification from variant-selection lookup", async () => {
  const hairProfile = createCompleteHairProfile()
  const agentResult = createAgentV2Result()
  agentResult.trace.failure_stage = "repair_failed"
  agentResult.final_answer = {
    ...agentResult.final_answer,
    answer_mode: "clarification",
    interpreted_intent: "User asks whether their own named shampoo suits them.",
    request_interpretation: {
      primary_intent: "clarification",
      product_request_kind: "product_detail",
      routine_intent: "none",
      care_category: "shampoo",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "Syoss Intense Volume Shampoo",
      specific_product_candidate: true,
      confidence: 0.78,
    },
    payload: {
      user_facing_answer_de:
        "Ich finde Syoss Intense Volume Shampoo nicht eindeutig, aber ich habe eine mögliche Variante gefunden.",
      question_de: "Ist es diese Variante?",
      missing_keys: [],
    },
  }

  const result = await runAgentV2ProductionPipeline(
    {
      message: "Ich nutze Syoss Intense Volume Shampoo. Passt das zu mir?",
      conversationId: "conversation-clarification",
      userId: "user-1",
      requestId: "request-clarification",
      productIntakeEnabled: true,
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: hairProfile,
        routine_inventory: [],
        relevant_memory: [],
        derived_signals: [],
        suggested_overlays: [],
        missing_profile: [],
      }),
      loadUserMemoryContext: async () => ({
        enabled: true,
        entries: [],
        promptContext: null,
        dislikedProductNames: [],
      }),
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      client: {
        responses: {
          create: async () => ({ output: [] }),
        },
      },
      createProductIntakeRepository: () =>
        ({
          loadCatalog: async () => ({
            products: [
              {
                id: "syoss-intense-curls-shampoo",
                name: "Intense Curls Shampoo",
                brandId: "brand-syoss",
                categoryKey: "shampoo",
                isActive: true,
                lifecycleStatus: "active",
                isChaarlieRecommended: true,
              },
            ],
            identifiers: [],
          }),
          loadBrandResolutionCatalog: async () => ({
            brands: [{ id: "brand-syoss", canonical_name: "Syoss" }],
            productLines: [],
            brandAliases: [],
          }),
        }) as never,
      runAgentV2ResponsesTurn: async (params) => {
        await params.tools.lookup_product_candidate({
          category: "shampoo",
          brand_text: "Syoss",
          product_name_text: "Intense Volume Shampoo",
          reason: "User asks whether their own named product suits them.",
          evidence_quote: "Syoss Intense Volume Shampoo",
        })
        return agentResult
      },
    },
  )

  assert.equal(result.productIntakeOffer, null)
  assert.equal(result.productLookupClarification?.kind, "variant_selection")
  assert.equal(result.productLookupClarification?.query.brand_text, "Syoss")
  assert.doesNotMatch(result.productLookupClarification?.copy.prompt_de ?? "", /Syoss Syoss/i)
  assert.equal(result.productLookupClarification?.copy.prompt_de, "Meinst du dieses Shampoo?")
  assert.equal(
    result.productLookupClarification?.candidates[0]?.product_id,
    "syoss-intense-curls-shampoo",
  )
  assert.equal(
    result.productLookupClarification?.none_action.product_intake_offer.extracted_identity
      ?.product_name_text,
    "Intense Volume Shampoo",
  )
})

test("AgentV2 production pipeline surfaces category-less lookup clarification candidates", async () => {
  const hairProfile = createCompleteHairProfile()
  const agentResult = createAgentV2Result()
  agentResult.trace.failure_stage = "repair_failed"
  agentResult.final_answer = {
    ...agentResult.final_answer,
    answer_mode: "clarification",
    interpreted_intent: "User asks about a named Syoss product but did not state category.",
    request_interpretation: {
      primary_intent: "clarification",
      product_request_kind: "product_detail",
      routine_intent: "none",
      care_category: "none",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "Syoss Intense",
      specific_product_candidate: true,
      confidence: 0.78,
    },
    payload: {
      user_facing_answer_de: "Ich finde mehrere mögliche Syoss-Intense-Produkte.",
      question_de: "Welches meinst du?",
      missing_keys: [],
    },
  }

  const result = await runAgentV2ProductionPipeline(
    {
      message: "Was hältst du von Syoss Intense?",
      conversationId: "conversation-categoryless-clarification",
      userId: "user-1",
      requestId: "request-categoryless-clarification",
      productIntakeEnabled: true,
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: hairProfile,
        routine_inventory: [],
        relevant_memory: [],
        derived_signals: [],
        suggested_overlays: [],
        missing_profile: [],
      }),
      loadUserMemoryContext: async () => ({
        enabled: true,
        entries: [],
        promptContext: null,
        dislikedProductNames: [],
      }),
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      client: {
        responses: {
          create: async () => ({ output: [] }),
        },
      },
      createProductIntakeRepository: () =>
        ({
          loadCatalog: async () => ({
            products: [
              {
                id: "syoss-intense-curls-shampoo",
                name: "Intense Curls Shampoo",
                brandId: "brand-syoss",
                categoryKey: "shampoo",
                isActive: true,
                lifecycleStatus: "active",
                isChaarlieRecommended: true,
              },
              {
                id: "syoss-intense-curls-conditioner",
                name: "Intense Curls Conditioner",
                brandId: "brand-syoss",
                categoryKey: "conditioner",
                isActive: true,
                lifecycleStatus: "active",
                isChaarlieRecommended: true,
              },
            ],
            identifiers: [],
          }),
          loadBrandResolutionCatalog: async () => ({
            brands: [{ id: "brand-syoss", canonical_name: "Syoss" }],
            productLines: [],
            brandAliases: [],
          }),
        }) as never,
      runAgentV2ResponsesTurn: async (params) => {
        await params.tools.lookup_product_candidate({
          category: null,
          brand_text: "Syoss",
          product_name_text: "Intense",
          reason: "User asks about a named product without a category.",
          evidence_quote: "Syoss Intense",
        })
        return agentResult
      },
    },
  )

  assert.equal(result.productIntakeOffer, null)
  assert.equal(result.productLookupClarification?.kind, "variant_selection")
  assert.equal(
    result.productLookupClarification?.copy.prompt_de,
    "Meinst du eines dieser Produkte?",
  )
  assert.equal(result.productLookupClarification?.candidates.length, 2)
  assert.deepEqual(
    result.productLookupClarification?.candidates.map((candidate) => candidate.product_id),
    ["syoss-intense-curls-conditioner", "syoss-intense-curls-shampoo"],
  )
  assert.equal(result.productLookupClarification?.query.category, null)
  assert.equal(result.productLookupClarification?.none_action.product_intake_offer.category, null)
  assert.deepEqual(
    result.productLookupClarification?.none_action.product_intake_offer.missing_fields,
    ["Kategorie"],
  )
})

test("AgentV2 production pipeline deterministically clarifies category-less brand product turns when model skips lookup", async () => {
  const hairProfile = createCompleteHairProfile()
  const agentResult = createAgentV2Result()
  agentResult.final_answer = {
    ...agentResult.final_answer,
    answer_mode: "general_advice",
    interpreted_intent: "User asks about a named Syoss product but the model guessed one variant.",
    request_interpretation: {
      primary_intent: "general_advice",
      product_request_kind: "none",
      routine_intent: "none",
      care_category: "none",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "Syoss Intense",
      specific_product_candidate: false,
      confidence: 0.72,
    },
    payload: {
      user_facing_answer_de:
        "Syoss Intense Curls passt nur mittelgut zu dir, weil es für feines Haar schwer wirken kann.",
      category_or_topic: "shampoo",
      key_points_de: ["Syoss Intense Curls passt nur mittelgut."],
      next_step_offer_de: null,
    },
  }

  const result = await runAgentV2ProductionPipeline(
    {
      message: "Ich nutze Syoss Intense. Passt das zu mir?",
      conversationId: "conversation-categoryless-deterministic-clarification",
      userId: "user-1",
      requestId: "request-categoryless-deterministic-clarification",
      productIntakeEnabled: true,
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: hairProfile,
        routine_inventory: [],
        relevant_memory: [],
        derived_signals: [],
        suggested_overlays: [],
        missing_profile: [],
      }),
      loadUserMemoryContext: async () => ({
        enabled: true,
        entries: [],
        promptContext: null,
        dislikedProductNames: [],
      }),
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      client: {
        responses: {
          create: async () => ({ output: [] }),
        },
      },
      createProductIntakeRepository: () =>
        ({
          loadCatalog: async () => ({
            products: [
              {
                id: "syoss-intense-curls-shampoo",
                name: "Intense Curls Shampoo",
                brandId: "brand-syoss",
                categoryKey: "shampoo",
                isActive: true,
                lifecycleStatus: "active",
                isChaarlieRecommended: true,
              },
              {
                id: "syoss-intense-volume-shampoo",
                name: "Intense Volume Shampoo",
                brandId: "brand-syoss",
                categoryKey: "shampoo",
                isActive: true,
                lifecycleStatus: "active",
                isChaarlieRecommended: true,
              },
            ],
            identifiers: [],
          }),
          loadBrandResolutionCatalog: async () => ({
            brands: [{ id: "brand-syoss", canonical_name: "Syoss" }],
            productLines: [],
            brandAliases: [],
          }),
        }) as never,
      runAgentV2ResponsesTurn: async (params) => {
        await params.tools.lookup_product_candidate({
          category: "shampoo",
          brand_text: "Syoss",
          product_name_text: "Intense Curls Shampoo",
          reason: "The model over-specified one variant from the user's partial wording.",
          evidence_quote: "Syoss Intense",
        })
        return agentResult
      },
    },
  )

  assert.equal(result.productIntakeOffer, null)
  assert.equal(result.productLookupClarification?.kind, "variant_selection")
  assert.deepEqual(
    result.productLookupClarification?.candidates.map((candidate) => candidate.product_id),
    ["syoss-intense-curls-shampoo", "syoss-intense-volume-shampoo"],
  )
  assert.match(await readStream(result.stream), /Welche genaue Variante meinst du/)
})

test("AgentV2 production pipeline recovers lookup clarification from trace-only repair lookup", async () => {
  const hairProfile = createCompleteHairProfile()
  const agentResult = createAgentV2Result()
  agentResult.trace.failure_stage = "repair_failed"
  agentResult.trace.tool_calls = [
    {
      call_id: "lookup-trace-1",
      name: "lookup_product_candidate",
      arguments: {
        category: "shampoo",
        brand_text: "Syoss",
        product_name_text: "Intense Volume Shampoo",
        reason: "User asks whether their own named product suits them.",
        evidence_quote: "Syoss Intense Volume Shampoo",
      },
      output_summary: "product_lookup:needs_variant_selection",
      latency_ms: 12,
    },
  ]
  agentResult.final_answer = {
    ...agentResult.final_answer,
    answer_mode: "clarification",
    interpreted_intent: "User asks whether their own named shampoo suits them.",
    request_interpretation: {
      primary_intent: "clarification",
      product_request_kind: "product_detail",
      routine_intent: "none",
      care_category: "shampoo",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "Syoss Intense Volume Shampoo",
      specific_product_candidate: true,
      confidence: 0.78,
    },
    payload: {
      user_facing_answer_de:
        "Ich finde zu Syoss Intense Volume Shampoo mehrere mögliche Varianten und möchte nichts Falsches bewerten. Welche genaue Variante meinst du?",
      question_de: "Welche genaue Variante meinst du?",
      missing_keys: [],
    },
  }

  const result = await runAgentV2ProductionPipeline(
    {
      message: "Ich nutze Syoss Intense Volume Shampoo. Passt das zu mir?",
      conversationId: "conversation-trace-clarification",
      userId: "user-1",
      requestId: "request-trace-clarification",
      productIntakeEnabled: true,
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: hairProfile,
        routine_inventory: [],
        relevant_memory: [],
        derived_signals: [],
        suggested_overlays: [],
        missing_profile: [],
      }),
      loadUserMemoryContext: async () => ({
        enabled: true,
        entries: [],
        promptContext: null,
        dislikedProductNames: [],
      }),
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      client: {
        responses: {
          create: async () => ({ output: [] }),
        },
      },
      createProductIntakeRepository: () =>
        ({
          loadCatalog: async () => ({
            products: [
              {
                id: "syoss-intense-curls-shampoo",
                name: "Intense Curls Shampoo",
                brandId: "brand-syoss",
                categoryKey: "shampoo",
                isActive: true,
                lifecycleStatus: "active",
                isChaarlieRecommended: true,
              },
            ],
            identifiers: [],
          }),
          loadBrandResolutionCatalog: async () => ({
            brands: [{ id: "brand-syoss", canonical_name: "Syoss" }],
            productLines: [],
            brandAliases: [],
          }),
        }) as never,
      runAgentV2ResponsesTurn: async () => agentResult,
    },
  )

  assert.equal(result.productIntakeOffer, null)
  assert.equal(result.productLookupClarification?.kind, "variant_selection")
  assert.equal(result.productLookupClarification?.copy.prompt_de, "Meinst du dieses Shampoo?")
  assert.equal(
    result.productLookupClarification?.candidates[0]?.product_id,
    "syoss-intense-curls-shampoo",
  )
})

test("AgentV2 production pipeline uses concise category-mismatch clarification copy", async () => {
  const hairProfile = createCompleteHairProfile()
  const agentResult = createAgentV2Result()
  agentResult.final_answer = {
    ...agentResult.final_answer,
    answer_mode: "clarification",
    interpreted_intent: "User asks whether their own named shampoo suits them.",
    request_interpretation: {
      primary_intent: "clarification",
      product_request_kind: "product_detail",
      routine_intent: "none",
      care_category: "shampoo",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "Acme Hydra Glow Shampoo",
      specific_product_candidate: true,
      confidence: 0.78,
    },
    payload: {
      user_facing_answer_de:
        "Ich habe einen möglichen Treffer in einer anderen Kategorie gefunden. Bitte bestätige kurz, ob du dieses Produkt meinst.",
      question_de: "Meinst du dieses Produkt?",
      missing_keys: [],
    },
  }

  const result = await runAgentV2ProductionPipeline(
    {
      message: "Ich nutze Acme Hydra Glow Shampoo. Passt das zu mir?",
      conversationId: "conversation-category-mismatch",
      userId: "user-1",
      requestId: "request-category-mismatch",
      productIntakeEnabled: true,
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: hairProfile,
        routine_inventory: [],
        relevant_memory: [],
        derived_signals: [],
        suggested_overlays: [],
        missing_profile: [],
      }),
      loadUserMemoryContext: async () => ({
        enabled: true,
        entries: [],
        promptContext: null,
        dislikedProductNames: [],
      }),
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      client: {
        responses: {
          create: async () => ({ output: [] }),
        },
      },
      createProductIntakeRepository: () =>
        ({
          loadCatalog: async () => ({
            products: [
              {
                id: "acme-hydra-glow-conditioner",
                name: "Hydra Glow Conditioner",
                brandId: "brand-acme",
                categoryKey: "conditioner",
                isActive: true,
                lifecycleStatus: "active",
                isChaarlieRecommended: true,
              },
            ],
            identifiers: [],
          }),
          loadBrandResolutionCatalog: async () => ({
            brands: [{ id: "brand-acme", canonical_name: "Acme" }],
            productLines: [],
            brandAliases: [],
          }),
        }) as never,
      runAgentV2ResponsesTurn: async (params) => {
        await params.tools.lookup_product_candidate({
          category: "shampoo",
          brand_text: "Acme",
          product_name_text: "Hydra Glow Shampoo",
          reason: "User asks whether their own named shampoo suits them.",
          evidence_quote: "Acme Hydra Glow Shampoo",
        })
        return agentResult
      },
    },
  )

  assert.equal(result.productLookupClarification?.kind, "category_mismatch")
  assert.equal(
    result.productLookupClarification?.copy.prompt_de,
    "Wir haben es als Conditioner gefunden. Meinst du dieses Produkt?",
  )
  assert.equal(
    result.productLookupClarification?.candidates[0]?.product_id,
    "acme-hydra-glow-conditioner",
  )
})

test("AgentV2 production pipeline suppresses stale lookup cards on active product follow-ups", async () => {
  const hairProfile = createCompleteHairProfile()
  const agentResult = createAgentV2Result()
  agentResult.final_answer = {
    ...agentResult.final_answer,
    answer_mode: "general_advice",
    interpreted_intent: "User asks how often to use the active selected shampoo.",
    request_interpretation: {
      primary_intent: "general_advice",
      product_request_kind: "product_detail",
      routine_intent: "none",
      care_category: "shampoo",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "Syoss Intense Volume Shampoo",
      specific_product_candidate: true,
      confidence: 0.78,
    },
    payload: {
      user_facing_answer_de:
        "Für das ausgewählte Shampoo würde ich bei deinem Profil mit 2-4x pro Woche starten.",
      category_or_topic: "shampoo",
      key_points_de: [],
      next_step_offer_de: null,
    },
  }
  const conversationState = createDefaultAgentV2ConversationState()
  conversationState.agent_v2.active_resolved_product_context = {
    source: "product_lookup_selection",
    product_id: "syoss-intense-curls-shampoo",
    name: "Syoss Intense Curls",
    category: "shampoo",
    original_user_message: "Ich nutze Syoss Intense Volume Shampoo. Passt das zu mir?",
  }

  const result = await runAgentV2ProductionPipeline(
    {
      message: "und wie oft?",
      conversationId: "conversation-active-followup",
      userId: "user-1",
      requestId: "request-active-followup",
      productIntakeEnabled: true,
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [
        {
          ...createMessage(1),
          role: "user",
          content: "Ich nutze Syoss Intense Volume Shampoo. Passt das zu mir?",
        },
        {
          ...createMessage(2),
          role: "assistant",
          content: "Ich finde mehrere mögliche Varianten.",
        },
      ],
      getUserContext: async () => ({
        profile: hairProfile,
        routine_inventory: [],
        relevant_memory: [],
        derived_signals: [],
        suggested_overlays: [],
        missing_profile: [],
      }),
      loadUserMemoryContext: async () => ({
        enabled: true,
        entries: [],
        promptContext: null,
        dislikedProductNames: [],
      }),
      loadConversationState: async (): Promise<AgentV2ConversationStateV2> => conversationState,
      client: {
        responses: {
          create: async () => ({ output: [] }),
        },
      },
      createProductIntakeRepository: () =>
        ({
          loadCatalog: async () => ({
            products: [
              {
                id: "syoss-intense-curls-shampoo",
                name: "Intense Curls Shampoo",
                brandId: "brand-syoss",
                categoryKey: "shampoo",
                isActive: true,
                lifecycleStatus: "active",
                isChaarlieRecommended: true,
              },
            ],
            identifiers: [],
          }),
          loadBrandResolutionCatalog: async () => ({
            brands: [{ id: "brand-syoss", canonical_name: "Syoss" }],
            productLines: [],
            brandAliases: [],
          }),
        }) as never,
      runAgentV2ResponsesTurn: async (params) => {
        await params.tools.lookup_product_candidate({
          category: "shampoo",
          brand_text: "Syoss",
          product_name_text: "Intense Volume Shampoo",
          reason: "Stale lookup from prior unresolved product wording.",
          evidence_quote: "Syoss Intense Volume Shampoo",
        })
        return agentResult
      },
    },
  )

  assert.equal(result.productLookupClarification, null)
  assert.equal(result.productIntakeOffer, null)
  const nextState = result.conversationStateTransition.next_state as AgentV2ConversationStateV2
  assert.equal(
    nextState.agent_v2.active_resolved_product_context?.product_id,
    "syoss-intense-curls-shampoo",
  )
})

test("AgentV2 production pipeline renders intake when lookup category is inferred from answer target", async () => {
  const hairProfile = createCompleteHairProfile()
  const agentResult = createAgentV2Result()
  agentResult.final_answer = {
    ...agentResult.final_answer,
    answer_mode: "general_advice",
    interpreted_intent: "User asks about their own named shampoo without saying the category word.",
    request_interpretation: {
      primary_intent: "general_advice",
      product_request_kind: "product_detail",
      routine_intent: "none",
      care_category: "shampoo",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "Pantene Pro-V Volume Pur",
      specific_product_candidate: true,
      confidence: 0.88,
    },
    tool_grounding: {
      used_guidance_package_ids: ["base.advisor_rules.v1", "category.shampoo.v1"],
      used_product_tool: false,
      used_routine_tool: false,
      product_ids: [],
      routine_step_ids: [],
      hard_rule_ids: [],
    },
    payload: {
      user_facing_answer_de:
        "Dieses konkrete Produkt kenne ich noch nicht sicher in unserer Produktdatenbank. Du kannst es kurz hinzufügen, dann prüfen wir es sauber.",
      category_or_topic: "shampoo",
      key_points_de: [],
      next_step_offer_de: null,
    },
  }

  const result = await runAgentV2ProductionPipeline(
    {
      message: "Was hältst du von Pantene Pro-V Volume Pur?",
      conversationId: "conversation-1",
      userId: "user-1",
      requestId: "request-inferred-category-lookup",
      productIntakeEnabled: true,
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: hairProfile,
        routine_inventory: [],
        relevant_memory: [],
        derived_signals: [],
        suggested_overlays: [],
        missing_profile: [],
      }),
      loadUserMemoryContext: async () => ({
        enabled: true,
        entries: [],
        promptContext: null,
        dislikedProductNames: [],
      }),
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      client: {
        responses: {
          create: async () => ({ output: [] }),
        },
      },
      createProductIntakeRepository: () =>
        ({
          loadCatalog: async () => ({ products: [], identifiers: [] }),
          loadBrandResolutionCatalog: async () => ({
            brands: [{ id: "brand-pantene", canonical_name: "Pantene" }],
            productLines: [
              { id: "line-pro-v", brand_id: "brand-pantene", canonical_name: "Pro-V" },
            ],
            brandAliases: [
              {
                brand_id: "brand-pantene",
                product_line_id: "line-pro-v",
                alias: "Pantene Pro-V",
              },
            ],
          }),
        }) as never,
      runAgentV2ResponsesTurn: async (params) => {
        await params.tools.lookup_product_candidate({
          category: "shampoo",
          brand_text: "Pantene Pro-V",
          product_name_text: "Volume Pur",
          reason: "User asks about a concrete product and the model inferred shampoo.",
          evidence_quote: "Pantene Pro-V Volume Pur",
        })
        return agentResult
      },
    },
  )

  assert.deepEqual(result.productIntakeOffer, {
    id: "product-intake-request-inferred-category-lookup",
    source: "chat",
    reason: "product_lookup_not_found",
    category: "shampoo",
    extracted_identity: {
      brand_text: "Pantene Pro-V",
      product_name_text: "Volume Pur",
    },
  })
})

test("AgentV2 production pipeline does not render intake for background product mentions", async () => {
  const hairProfile = createCompleteHairProfile()
  const agentResult = createAgentV2Result()
  agentResult.final_answer = {
    ...agentResult.final_answer,
    answer_mode: "general_advice",
    interpreted_intent: "User asks about washing frequency with current product as context.",
    request_interpretation: {
      primary_intent: "general_advice",
      product_request_kind: "none",
      routine_intent: "none",
      care_category: "shampoo",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "Wie oft sollte ich meine Haare waschen",
      specific_product_candidate: true,
      confidence: 0.88,
    },
    tool_grounding: {
      used_guidance_package_ids: [
        "base.advisor_rules.v1",
        "base.general_advice.v1",
        "category.shampoo.v1",
      ],
      used_product_tool: false,
      used_routine_tool: false,
      product_ids: [],
      routine_step_ids: [],
      hard_rule_ids: [],
    },
    payload: {
      user_facing_answer_de:
        "Für die Waschfrequenz zählt vor allem deine Kopfhaut. Starte nach Bedarf und beobachte, wie schnell der Ansatz nachfettet.",
      category_or_topic: "shampoo",
      key_points_de: ["Die Waschfrequenz hängt eher von Kopfhaut und Alltag ab."],
      next_step_offer_de: null,
    },
  }

  const result = await runAgentV2ProductionPipeline(
    {
      message:
        "Ich benutze Pantene Pro-V Volume Pur Shampoo. Wie oft sollte ich meine Haare waschen?",
      conversationId: "conversation-1",
      userId: "user-1",
      requestId: "request-background-product",
      productIntakeEnabled: true,
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: hairProfile,
        routine_inventory: [],
        relevant_memory: [],
        derived_signals: [],
        suggested_overlays: [],
        missing_profile: [],
      }),
      loadUserMemoryContext: async () => ({
        enabled: true,
        entries: [],
        promptContext: null,
        dislikedProductNames: [],
      }),
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      client: {
        responses: {
          create: async () => ({ output: [] }),
        },
      },
      createProductIntakeRepository: () =>
        ({
          loadCatalog: async () => ({ products: [], identifiers: [] }),
          loadBrandResolutionCatalog: async () => ({
            brands: [],
            productLines: [],
            brandAliases: [],
          }),
        }) as never,
      runAgentV2ResponsesTurn: async () => agentResult,
    },
  )

  assert.equal(result.productIntakeOffer, null)
  assert.equal(
    await readStream(result.stream),
    agentResult.final_answer.payload.user_facing_answer_de,
  )
})

test("AgentV2 production pipeline does not render intake from over-eager lookup for background product mention", async () => {
  const hairProfile = createCompleteHairProfile()
  const agentResult = createAgentV2Result()
  agentResult.final_answer = {
    ...agentResult.final_answer,
    answer_mode: "general_advice",
    interpreted_intent: "User asks about washing frequency with current product as context.",
    request_interpretation: {
      primary_intent: "general_advice",
      product_request_kind: "none",
      routine_intent: "none",
      care_category: "shampoo",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "Wie oft sollte ich meine Haare waschen",
      specific_product_candidate: true,
      confidence: 0.88,
    },
    tool_grounding: {
      used_guidance_package_ids: [
        "base.advisor_rules.v1",
        "base.general_advice.v1",
        "category.shampoo.v1",
      ],
      used_product_tool: false,
      used_routine_tool: false,
      product_ids: [],
      routine_step_ids: [],
      hard_rule_ids: [],
    },
    payload: {
      user_facing_answer_de:
        "Für die Waschfrequenz zählt vor allem deine Kopfhaut. Starte nach Bedarf und beobachte, wie schnell der Ansatz nachfettet.",
      category_or_topic: "shampoo",
      key_points_de: ["Die Waschfrequenz hängt eher von Kopfhaut und Alltag ab."],
      next_step_offer_de: null,
    },
  }

  const result = await runAgentV2ProductionPipeline(
    {
      message:
        "Ich benutze Pantene Pro-V Volume Pur Shampoo. Wie oft sollte ich meine Haare waschen?",
      conversationId: "conversation-1",
      userId: "user-1",
      requestId: "request-background-overeager-lookup",
      productIntakeEnabled: true,
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: hairProfile,
        routine_inventory: [],
        relevant_memory: [],
        derived_signals: [],
        suggested_overlays: [],
        missing_profile: [],
      }),
      loadUserMemoryContext: async () => ({
        enabled: true,
        entries: [],
        promptContext: null,
        dislikedProductNames: [],
      }),
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      client: {
        responses: {
          create: async () => ({ output: [] }),
        },
      },
      createProductIntakeRepository: () =>
        ({
          loadCatalog: async () => ({ products: [], identifiers: [] }),
          loadBrandResolutionCatalog: async () => ({
            brands: [{ id: "brand-pantene", canonical_name: "Pantene" }],
            productLines: [
              { id: "line-pro-v", brand_id: "brand-pantene", canonical_name: "Pro-V" },
            ],
            brandAliases: [
              {
                brand_id: "brand-pantene",
                product_line_id: "line-pro-v",
                alias: "Pantene Pro-V",
              },
            ],
          }),
        }) as never,
      runAgentV2ResponsesTurn: async (params) => {
        await params.tools.lookup_product_candidate({
          category: "shampoo",
          brand_text: "Pantene Pro-V",
          product_name_text: "Volume Pur Shampoo",
          reason: "Over-eager lookup for a background product mention.",
          evidence_quote: "Pantene Pro-V Volume Pur Shampoo",
        })
        return agentResult
      },
    },
  )

  assert.equal(result.productIntakeOffer, null)
  assert.equal(
    await readStream(result.stream),
    agentResult.final_answer.payload.user_facing_answer_de,
  )
})

test("AgentV2 production pipeline does not render intake from background lookup on other-category recommendation", async () => {
  const hairProfile = createCompleteHairProfile()
  const agentResult = createAgentV2Result()
  agentResult.final_answer = {
    ...agentResult.final_answer,
    answer_mode: "product_recommendation",
    interpreted_intent:
      "User mentions their current shampoo as context and asks for a conditioner recommendation.",
    request_interpretation: {
      primary_intent: "product_recommendation",
      product_request_kind: "specific_products",
      routine_intent: "none",
      care_category: "conditioner",
      requested_product_count: 1,
      count_policy: "exact",
      evidence_quote: "welchen Conditioner empfiehlst du dazu",
      specific_product_candidate: true,
      confidence: 0.88,
    },
    extracted_constraints: {
      ...agentResult.final_answer.extracted_constraints,
      product_categories: ["conditioner"],
      raw_constraints: ["welchen Conditioner empfiehlst du dazu"],
    },
    tool_grounding: {
      used_guidance_package_ids: ["base.advisor_rules.v1", "category.conditioner.v1"],
      used_product_tool: true,
      used_routine_tool: false,
      product_ids: ["primary"],
      routine_step_ids: [],
      hard_rule_ids: [],
    },
    routine_context: {
      active: false,
      routine_layer: null,
      step_id: null,
      category: "conditioner",
      return_path: [],
    },
    payload: {
      user_facing_answer_de:
        "Als Conditioner würde ich dir ein leichtes Produkt empfehlen, das deine Längen weich macht, ohne sie zu beschweren.",
      recommendations: [
        {
          product_id: "primary",
          reason_de: "Passt zu deinem Profil.",
          usage_de: null,
          caveat_de: null,
        },
      ],
      comparison_notes_de: [],
      usage_notes_de: [],
      next_step_offer_de: null,
    },
  }

  const result = await runAgentV2ProductionPipeline(
    {
      message:
        "Ich benutze Pantene Pro-V Volume Pur Shampoo, welchen Conditioner empfiehlst du dazu?",
      conversationId: "conversation-1",
      userId: "user-1",
      requestId: "request-background-lookup-other-category",
      productIntakeEnabled: true,
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: hairProfile,
        routine_inventory: [],
        relevant_memory: [],
        derived_signals: [],
        suggested_overlays: [],
        missing_profile: [],
      }),
      loadUserMemoryContext: async () => ({
        enabled: true,
        entries: [],
        promptContext: null,
        dislikedProductNames: [],
      }),
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      client: {
        responses: {
          create: async () => ({ output: [] }),
        },
      },
      createProductIntakeRepository: () =>
        ({
          loadCatalog: async () => ({ products: [], identifiers: [] }),
          loadBrandResolutionCatalog: async () => ({
            brands: [{ id: "brand-pantene", canonical_name: "Pantene" }],
            productLines: [
              { id: "line-pro-v", brand_id: "brand-pantene", canonical_name: "Pro-V" },
            ],
            brandAliases: [
              {
                brand_id: "brand-pantene",
                product_line_id: "line-pro-v",
                alias: "Pantene Pro-V",
              },
            ],
          }),
        }) as never,
      runAgentV2ResponsesTurn: async (params) => {
        await params.tools.lookup_product_candidate({
          category: "shampoo",
          brand_text: "Pantene Pro-V",
          product_name_text: "Volume Pur Shampoo",
          reason: "Over-eager lookup for a background product mention.",
          evidence_quote: "Pantene Pro-V Volume Pur Shampoo",
        })
        return agentResult
      },
    },
  )

  assert.equal(result.productIntakeOffer, null)
  assert.equal(
    await readStream(result.stream),
    agentResult.final_answer.payload.user_facing_answer_de,
  )
})

test("AgentV2 production pipeline does not render intake from an over-eager lookup when final answer has no specific product candidate", async () => {
  const hairProfile = createCompleteHairProfile()
  const agentResult = createAgentV2Result()
  agentResult.final_answer = {
    ...agentResult.final_answer,
    answer_mode: "general_advice",
    interpreted_intent: "User asks a broad category question, not to assess a concrete product.",
    request_interpretation: {
      primary_intent: "general_advice",
      product_request_kind: "none",
      routine_intent: "none",
      care_category: "shampoo",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "Welche Shampoos passen zu mir?",
      specific_product_candidate: false,
      confidence: 0.88,
    },
    tool_grounding: {
      used_guidance_package_ids: ["base.advisor_rules.v1", "base.general_advice.v1"],
      used_product_tool: false,
      used_routine_tool: false,
      product_ids: [],
      routine_step_ids: [],
      hard_rule_ids: [],
    },
    payload: {
      user_facing_answer_de:
        "Bei deinem Haar sollte ein Shampoo mild reinigen und den Ansatz nicht beschweren.",
      category_or_topic: "shampoo",
      key_points_de: ["Milde Reinigung ist hier wichtiger als ein stark klärender Effekt."],
      next_step_offer_de: null,
    },
  }

  const result = await runAgentV2ProductionPipeline(
    {
      message: "Welche Shampoos passen zu mir?",
      conversationId: "conversation-1",
      userId: "user-1",
      requestId: "request-overeager-lookup",
      productIntakeEnabled: true,
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: hairProfile,
        routine_inventory: [],
        relevant_memory: [],
        derived_signals: [],
        suggested_overlays: [],
        missing_profile: [],
      }),
      loadUserMemoryContext: async () => ({
        enabled: true,
        entries: [],
        promptContext: null,
        dislikedProductNames: [],
      }),
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      client: {
        responses: {
          create: async () => ({ output: [] }),
        },
      },
      createProductIntakeRepository: () =>
        ({
          loadCatalog: async () => ({ products: [], identifiers: [] }),
          loadBrandResolutionCatalog: async () => ({
            brands: [{ id: "brand-acme", canonical_name: "Acme" }],
            productLines: [],
            brandAliases: [],
          }),
        }) as never,
      runAgentV2ResponsesTurn: async (params) => {
        await params.tools.lookup_product_candidate({
          category: "shampoo",
          brand_text: "Acme",
          product_name_text: "Ghost Shampoo",
          reason: "Over-eager tool call unrelated to the final broad answer.",
          evidence_quote: "Acme Ghost Shampoo",
        })
        return agentResult
      },
    },
  )

  assert.equal(result.productIntakeOffer, null)
  assert.equal(
    await readStream(result.stream),
    agentResult.final_answer.payload.user_facing_answer_de,
  )
})

test("AgentV2 production pipeline does not render intake from a wrong branded lookup", async () => {
  const hairProfile = createCompleteHairProfile()
  const agentResult = createAgentV2Result()
  agentResult.final_answer = {
    ...agentResult.final_answer,
    answer_mode: "constraint_blocked",
    interpreted_intent: "User asks for Chaarlie's opinion on their own conditioner.",
    request_interpretation: {
      primary_intent: "product_recommendation",
      product_request_kind: "product_detail",
      routine_intent: "none",
      care_category: "conditioner",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "miracles conditioner",
      specific_product_candidate: true,
      confidence: 0.9,
    },
    tool_grounding: {
      used_guidance_package_ids: ["base.advisor_rules.v1", "category.conditioner.v1"],
      used_product_tool: false,
      used_routine_tool: false,
      product_ids: [],
      routine_step_ids: [],
      hard_rule_ids: [],
    },
    payload: {
      user_facing_answer_de:
        "Diesen konkreten Jean & Lean Miracles Conditioner kann ich noch nicht zuverlässig bewerten, weil er nicht eindeutig in meinen Produktdaten ist.",
      blocking_constraints: ["product_not_verified"],
      safe_alternative_de: "Du kannst ihn hinzufügen, damit ich ihn später konkret einordnen kann.",
    },
  }

  const result = await runAgentV2ProductionPipeline(
    {
      message: "kannst du mir sagen, was du von meinem jean & lean miracles conditioner hältst",
      conversationId: "conversation-1",
      userId: "user-1",
      requestId: "request-wrong-generic-intake",
      productIntakeEnabled: true,
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: hairProfile,
        routine_inventory: [],
        relevant_memory: [],
        derived_signals: [],
        suggested_overlays: [],
        missing_profile: [],
      }),
      loadUserMemoryContext: async () => ({
        enabled: true,
        entries: [],
        promptContext: null,
        dislikedProductNames: [],
      }),
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      client: {
        responses: {
          create: async () => ({ output: [] }),
        },
      },
      createProductIntakeRepository: () =>
        ({
          loadCatalog: async () => ({ products: [], identifiers: [] }),
          loadBrandResolutionCatalog: async () => ({
            brands: [{ id: "brand-pantene", canonical_name: "Pantene" }],
            productLines: [],
            brandAliases: [],
          }),
        }) as never,
      runAgentV2ResponsesTurn: async (params) => {
        await params.tools.lookup_product_candidate({
          category: "conditioner",
          brand_text: "Pantene",
          product_name_text: "Miracles Conditioner",
          reason: "Wrong generic candidate.",
          evidence_quote: "miracles conditioner",
        })
        return agentResult
      },
    },
  )

  assert.equal(result.productIntakeOffer, null)
})

test("AgentV2 production pipeline does not render intake from a wrong category lookup with matching brand text", async () => {
  const hairProfile = createCompleteHairProfile()
  const agentResult = createAgentV2Result()
  agentResult.final_answer = {
    ...agentResult.final_answer,
    answer_mode: "constraint_blocked",
    interpreted_intent: "User asks for Chaarlie's opinion on their own conditioner.",
    request_interpretation: {
      primary_intent: "product_recommendation",
      product_request_kind: "product_detail",
      routine_intent: "none",
      care_category: "conditioner",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "Acme Hydra Glow Conditioner",
      specific_product_candidate: true,
      confidence: 0.9,
    },
    tool_grounding: {
      used_guidance_package_ids: ["base.advisor_rules.v1", "category.conditioner.v1"],
      used_product_tool: false,
      used_routine_tool: false,
      product_ids: [],
      routine_step_ids: [],
      hard_rule_ids: [],
    },
    payload: {
      user_facing_answer_de:
        "Diesen konkreten Acme Hydra Glow Conditioner kann ich noch nicht zuverlässig bewerten, weil er nicht eindeutig in meinen Produktdaten ist.",
      blocking_constraints: ["product_not_verified"],
      safe_alternative_de: "Du kannst ihn hinzufügen, damit ich ihn später konkret einordnen kann.",
    },
  }

  const result = await runAgentV2ProductionPipeline(
    {
      message: "Was hältst du von meinem Acme Hydra Glow Conditioner?",
      conversationId: "conversation-1",
      userId: "user-1",
      requestId: "request-wrong-category-intake",
      productIntakeEnabled: true,
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: hairProfile,
        routine_inventory: [],
        relevant_memory: [],
        derived_signals: [],
        suggested_overlays: [],
        missing_profile: [],
      }),
      loadUserMemoryContext: async () => ({
        enabled: true,
        entries: [],
        promptContext: null,
        dislikedProductNames: [],
      }),
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      client: {
        responses: {
          create: async () => ({ output: [] }),
        },
      },
      createProductIntakeRepository: () =>
        ({
          loadCatalog: async () => ({ products: [], identifiers: [] }),
          loadBrandResolutionCatalog: async () => ({
            brands: [{ id: "brand-acme", canonical_name: "Acme" }],
            productLines: [],
            brandAliases: [],
          }),
        }) as never,
      runAgentV2ResponsesTurn: async (params) => {
        await params.tools.lookup_product_candidate({
          category: "shampoo",
          brand_text: "Acme",
          product_name_text: "Hydra Glow",
          reason: "Wrong category candidate with overlapping brand and line text.",
          evidence_quote: "Acme Hydra Glow",
        })
        return agentResult
      },
    },
  )

  assert.equal(result.productIntakeOffer, null)
})

test("AgentV2 production pipeline scopes lookup to public products and user-owned matched products", async () => {
  const hairProfile = createCompleteHairProfile()
  const agentResult = createAgentV2Result()
  const lookupResults: Array<{ status: string; productId: string | null }> = []
  const loadCatalogModes: unknown[] = []

  const result = await runAgentV2ProductionPipeline(
    {
      message: "Passt mein Testmarke Owned Conditioner zu mir?",
      conversationId: "conversation-1",
      userId: "user-1",
      requestId: "owned-lookup",
      productIntakeEnabled: true,
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: hairProfile,
        routine_inventory: [
          {
            category: "conditioner",
            product_name: "Owned Conditioner",
            frequency_range: "weekly_1x",
            product_id: "owned-conditioner",
            match_status: "matched",
          },
        ],
        relevant_memory: [],
        derived_signals: [],
        suggested_overlays: [],
        missing_profile: [],
      }),
      loadUserMemoryContext: async () => ({
        enabled: true,
        entries: [],
        promptContext: null,
        dislikedProductNames: [],
      }),
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      client: {
        responses: {
          create: async () => ({ output: [] }),
        },
      },
      createAdminClient: () =>
        createFakeSpecReadinessClient({
          verifiedSpecProductIds: ["owned-conditioner"],
        }) as never,
      createProductIntakeRepository: () =>
        ({
          loadCatalog: async (params: unknown) => {
            loadCatalogModes.push(params)
            return {
              products: [
                {
                  id: "public-conditioner",
                  name: "Public Conditioner",
                  brand_id: "brand-test",
                  category_key: "conditioner",
                  is_active: true,
                  lifecycle_status: "active",
                  is_chaarlie_recommended: true,
                },
                {
                  id: "owned-conditioner",
                  name: "Owned Conditioner",
                  brand_id: "brand-test",
                  category_key: "conditioner",
                  is_active: true,
                  lifecycle_status: "active",
                  is_chaarlie_recommended: false,
                },
                {
                  id: "hidden-conditioner",
                  name: "Hidden Conditioner",
                  brand_id: "brand-test",
                  category_key: "conditioner",
                  is_active: true,
                  lifecycle_status: "active",
                  is_chaarlie_recommended: false,
                },
              ],
              identifiers: [
                {
                  product_id: "hidden-conditioner",
                  identifier_type: "retailer_sku",
                  identifier_value: "hidden-sku",
                  normalized_identifier_value: "hidden-sku",
                },
              ],
            }
          },
          loadBrandResolutionCatalog: async () => ({
            brands: [{ id: "brand-test", canonical_name: "Testmarke" }],
            productLines: [],
            brandAliases: [],
          }),
        }) as never,
      runAgentV2ResponsesTurn: async (params) => {
        const ownedResult = await params.tools.lookup_product_candidate({
          category: "conditioner",
          brand_text: "Testmarke",
          product_name_text: "Owned Conditioner",
          reason: "The user asks whether their owned product suits them.",
          evidence_quote: "Testmarke Owned Conditioner",
        })
        const hiddenResult = await params.tools.lookup_product_candidate({
          category: "conditioner",
          brand_text: "Testmarke",
          product_name_text: "Hidden Conditioner",
          reason: "The user asks about a non-owned non-recommended product.",
          evidence_quote: "Testmarke Hidden Conditioner",
        })
        lookupResults.push(summarizeLookupResult(ownedResult), summarizeLookupResult(hiddenResult))
        return agentResult
      },
    },
  )

  assert.deepEqual(loadCatalogModes, [{ eligibilityMode: "intake_dedupe" }])
  assert.deepEqual(lookupResults, [
    { status: "found_exact", productId: "owned-conditioner" },
    { status: "not_found", productId: null },
  ])
  assert.equal(result.productIntakeOffer, null)
})

test("AgentV2 production pipeline defaults product intake lookup off", async () => {
  const hairProfile = createCompleteHairProfile()
  const agentResult = createAgentV2Result()
  let observedProductIntakeEnabled: boolean | undefined

  const result = await runAgentV2ProductionPipeline(
    {
      message: "Ich nutze Pantene Pro-V Volume Pur Shampoo. Passt das zu mir?",
      conversationId: "conversation-1",
      userId: "user-1",
      requestId: "request-default-disabled-lookup",
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: hairProfile,
        routine_inventory: [],
        relevant_memory: [],
        derived_signals: [],
        suggested_overlays: [],
        missing_profile: [],
      }),
      loadUserMemoryContext: async () => ({
        enabled: true,
        entries: [],
        promptContext: null,
        dislikedProductNames: [],
      }),
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      client: {
        responses: {
          create: async () => ({ output: [] }),
        },
      },
      runAgentV2ResponsesTurn: async (params) => {
        observedProductIntakeEnabled = params.productIntakeEnabled
        return agentResult
      },
    },
  )

  assert.equal(observedProductIntakeEnabled, false)
  assert.equal(result.productIntakeOffer, null)
})

test("AgentV2 production pipeline disables product intake lookup when feature flag is off", async () => {
  const hairProfile = createCompleteHairProfile()
  const agentResult = createAgentV2Result()
  let observedProductIntakeEnabled: boolean | undefined

  const result = await runAgentV2ProductionPipeline(
    {
      message: "Ich nutze Pantene Pro-V Volume Pur Shampoo. Passt das zu mir?",
      conversationId: "conversation-1",
      userId: "user-1",
      requestId: "request-disabled-lookup",
      productIntakeEnabled: false,
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: hairProfile,
        routine_inventory: [],
        relevant_memory: [],
        derived_signals: [],
        suggested_overlays: [],
        missing_profile: [],
      }),
      loadUserMemoryContext: async () => ({
        enabled: true,
        entries: [],
        promptContext: null,
        dislikedProductNames: [],
      }),
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      client: {
        responses: {
          create: async () => ({ output: [] }),
        },
      },
      runAgentV2ResponsesTurn: async (params) => {
        observedProductIntakeEnabled = params.productIntakeEnabled
        return agentResult
      },
    },
  )

  assert.equal(observedProductIntakeEnabled, false)
  assert.equal(result.productIntakeOffer, null)
})

test("AgentV2 production pipeline exposes intake only for not-found supported product lookups", async () => {
  const hairProfile = createCompleteHairProfile()
  const cases = [
    {
      label: "not_found",
      input: {
        category: "shampoo",
        brand_text: "Unbekannte Testmarke",
        product_name_text: "Hydra Glow Shampoo",
        reason: "User asks whether their own product suits them.",
        evidence_quote: "Unbekannte Testmarke Hydra Glow Shampoo",
      },
      expectIntake: true,
    },
    {
      label: "insufficient_identity",
      input: {
        category: "shampoo",
        brand_text: "Unbekannte Testmarke",
        product_name_text: "",
        reason: "User asks about an underspecified product.",
        evidence_quote: "mein Shampoo",
      },
      expectIntake: false,
    },
    {
      label: "partial_unclear_category",
      expectedStatus: "insufficient_identity",
      input: {
        category: null,
        brand_text: "Garnier",
        product_name_text: "Hair Food",
        reason: "User asks about a partial concrete product without clear use category.",
        evidence_quote: "Was hältst du von Garnier Hair Food?",
      },
      expectIntake: false,
    },
    {
      label: "needs_variant_selection",
      input: {
        category: "shampoo",
        brand_text: "Unbekannte Testmarke",
        product_name_text: "Hydra Glow Shampoo",
        reason: "User asks about a product with multiple possible catalog matches.",
        evidence_quote: "Unbekannte Testmarke Hydra Glow Shampoo",
      },
      catalog: {
        products: [
          {
            id: "hydra-glow-a",
            name: "Hydra Glow Shampoo",
            brandId: "brand-unknown",
            categoryKey: "shampoo",
            isActive: true,
            lifecycleStatus: "active",
            isChaarlieRecommended: true,
          },
          {
            id: "hydra-glow-b",
            name: "Hydra Glow Shampoo",
            brandId: "brand-unknown",
            categoryKey: "shampoo",
            isActive: true,
            lifecycleStatus: "active",
            isChaarlieRecommended: true,
          },
        ],
        identifiers: [],
      },
      brandCatalog: {
        brands: [{ id: "brand-unknown", canonical_name: "Unbekannte Testmarke" }],
        productLines: [],
        brandAliases: [],
      },
      expectIntake: false,
    },
    {
      label: "unsupported_category",
      input: {
        category: "hairspray",
        brand_text: "Unbekannte Testmarke",
        product_name_text: "Hydra Glow Haarspray",
        reason: "User asks about an unsupported product category.",
        evidence_quote: "Unbekannte Testmarke Hydra Glow Haarspray",
      },
      expectIntake: false,
    },
  ] as const

  for (const testCase of cases) {
    let observedStatus: string | null = null
    const result = await runAgentV2ProductionPipeline(
      {
        message: "Ich benutze ein Produkt. Passt das zu mir?",
        conversationId: `conversation-${testCase.label}`,
        userId: "user-1",
        requestId: `request-${testCase.label}`,
        productIntakeEnabled: true,
      },
      {
        verifyConversationOwnership,
        loadConversationHistory: async () => [],
        getUserContext: async () => ({
          profile: hairProfile,
          routine_inventory: [],
          relevant_memory: [],
          derived_signals: [],
          suggested_overlays: [],
          missing_profile: [],
        }),
        loadUserMemoryContext: async () => ({
          enabled: true,
          entries: [],
          promptContext: null,
          dislikedProductNames: [],
        }),
        loadConversationState: async (): Promise<ConversationState> =>
          createDefaultConversationState(),
        client: {
          responses: {
            create: async () => ({ output: [] }),
          },
        },
        createProductIntakeRepository: () =>
          ({
            loadCatalog: async () =>
              "catalog" in testCase ? testCase.catalog : { products: [], identifiers: [] },
            loadBrandResolutionCatalog: async () =>
              "brandCatalog" in testCase
                ? testCase.brandCatalog
                : {
                    brands: [],
                    productLines: [],
                    brandAliases: [],
                  },
          }) as never,
        runAgentV2ResponsesTurn: async (params) => {
          const lookupResult = await params.tools.lookup_product_candidate(testCase.input)
          observedStatus =
            lookupResult && typeof lookupResult === "object" && "status" in lookupResult
              ? String(lookupResult.status)
              : null
          if (testCase.expectIntake) {
            const agentResult = createAgentV2Result()
            agentResult.final_answer = {
              ...agentResult.final_answer,
              answer_mode: "general_advice",
              interpreted_intent: "User asks about their own named product.",
              request_interpretation: {
                primary_intent: "general_advice",
                product_request_kind: "product_detail",
                routine_intent: "none",
                care_category: "shampoo",
                requested_product_count: null,
                count_policy: "none",
                evidence_quote: "Unbekannte Testmarke Hydra Glow Shampoo",
                specific_product_candidate: true,
                confidence: 0.88,
              },
              tool_grounding: {
                used_guidance_package_ids: ["base.advisor_rules.v1"],
                used_product_tool: false,
                used_routine_tool: false,
                product_ids: [],
                routine_step_ids: [],
                hard_rule_ids: [],
              },
              payload: {
                user_facing_answer_de:
                  "Dieses konkrete Shampoo ist noch nicht in unserer Produktdatenbank.",
                category_or_topic: "shampoo",
                key_points_de: [],
                next_step_offer_de: null,
              },
            }
            return agentResult
          }
          return createAgentV2Result()
        },
      },
    )

    assert.equal(
      observedStatus,
      "expectedStatus" in testCase ? testCase.expectedStatus : testCase.label,
    )
    assert.equal(Boolean(result.productIntakeOffer), testCase.expectIntake)
  }
})

test("AgentV2 production pipeline does not render intake for broad brand-family asks without lookup", async () => {
  const hairProfile = createCompleteHairProfile()
  const agentResult = createAgentV2Result()
  let lookupCalled = false

  const result = await runAgentV2ProductionPipeline(
    {
      message: "Welche Pantene Produkte empfiehlst du?",
      conversationId: "conversation-broad-brand",
      userId: "user-1",
      requestId: "request-broad-brand",
      productIntakeEnabled: true,
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: hairProfile,
        routine_inventory: [],
        relevant_memory: [],
        derived_signals: [],
        suggested_overlays: [],
        missing_profile: [],
      }),
      loadUserMemoryContext: async () => ({
        enabled: true,
        entries: [],
        promptContext: null,
        dislikedProductNames: [],
      }),
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      client: {
        responses: {
          create: async () => ({ output: [] }),
        },
      },
      createProductIntakeRepository: () =>
        ({
          loadCatalog: async () => ({ products: [], identifiers: [] }),
          loadBrandResolutionCatalog: async () => ({
            brands: [{ id: "brand-pantene", canonical_name: "Pantene" }],
            productLines: [],
            brandAliases: [],
          }),
        }) as never,
      runAgentV2ResponsesTurn: async (params) => {
        const originalLookup = params.tools.lookup_product_candidate
        params.tools.lookup_product_candidate = async (input) => {
          lookupCalled = true
          return originalLookup(input)
        }
        return agentResult
      },
    },
  )

  assert.equal(lookupCalled, false)
  assert.equal(result.productIntakeOffer, null)
})

test("AgentV2 production pipeline memoizes product lookup catalogs per turn", async () => {
  const hairProfile = createCompleteHairProfile()
  const agentResult = createAgentV2Result()
  let loadCatalogCalls = 0
  let loadBrandCatalogCalls = 0

  await runAgentV2ProductionPipeline(
    {
      message: "Ich nutze Pantene Pro-V Volume Pur Shampoo. Passt das zu mir?",
      conversationId: "conversation-1",
      userId: "user-1",
      requestId: "request-lookup-cache",
      productIntakeEnabled: true,
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: hairProfile,
        routine_inventory: [],
        relevant_memory: [],
        derived_signals: [],
        suggested_overlays: [],
        missing_profile: [],
      }),
      loadUserMemoryContext: async () => ({
        enabled: true,
        entries: [],
        promptContext: null,
        dislikedProductNames: [],
      }),
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      client: {
        responses: {
          create: async () => ({ output: [] }),
        },
      },
      createProductIntakeRepository: () =>
        ({
          loadCatalog: async () => {
            loadCatalogCalls += 1
            return { products: [], identifiers: [] }
          },
          loadBrandResolutionCatalog: async () => {
            loadBrandCatalogCalls += 1
            return {
              brands: [{ id: "brand-pantene", canonical_name: "Pantene" }],
              productLines: [],
              brandAliases: [],
            }
          },
        }) as never,
      runAgentV2ResponsesTurn: async (params) => {
        await params.tools.lookup_product_candidate({
          category: "shampoo",
          brand_text: "Pantene",
          product_name_text: "Volume Pur Shampoo",
          reason: "First check.",
          evidence_quote: "Pantene Pro-V Volume Pur Shampoo",
        })
        await params.tools.lookup_product_candidate({
          category: "shampoo",
          brand_text: "Pantene",
          product_name_text: "Volume Pur Shampoo",
          reason: "Second check.",
          evidence_quote: "Pantene Pro-V Volume Pur Shampoo",
        })
        return agentResult
      },
    },
  )

  assert.equal(loadCatalogCalls, 1)
  assert.equal(loadBrandCatalogCalls, 1)
})
