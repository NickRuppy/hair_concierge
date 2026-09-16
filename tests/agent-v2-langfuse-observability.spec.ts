import assert from "node:assert/strict"
import test from "node:test"

import {
  buildAgentV2GenerationMetadata,
  isAgentV2LangfuseObservationEnabled,
  observeAgentV2ToolCall,
  summarizeAgentV2ToolInput,
  summarizeAgentV2ToolOutput,
  summarizeAgentV2TraceForLangfuse,
} from "../src/lib/agent-v2/production/langfuse-observability"

test("AgentV2 generation metadata excludes hidden Supabase context", () => {
  const metadata = buildAgentV2GenerationMetadata({
    conversationId: "conversation-1",
    requestId: "request-1",
    safetyMode: "normal",
    engine: "agent_v2",
    endpoint: "responses",
    migrationMode: "agent_v2_care_balance",
  })

  assert.deepEqual(metadata, {
    conversation_id: "conversation-1",
    request_id: "request-1",
    engine: "agent_v2",
    endpoint: "responses",
    safety_mode: "normal",
    migration_mode: "agent_v2_care_balance",
  })
  assert.doesNotMatch(JSON.stringify(metadata), /hairProfile|routineInventory|sessionMemory/)
})

test("AgentV2 Langfuse summary contains path counts without raw context", () => {
  assert.deepEqual(
    summarizeAgentV2TraceForLangfuse({
      model_steps: [{ response_id: "resp_1" }, { response_id: "resp_2" }],
      tool_calls: [{ name: "select_products", latency_ms: 42 }],
      blocked_tool_calls: [],
      repair_attempts: [{ reason: "missing_select_products", validation_errors: [] }],
      loaded_guidance_package_ids: ["base.answer_contract.v1", "category.conditioner.v1"],
      response_ids: ["resp_1", "resp_2"],
      validation_errors: [],
      validation_warnings: [],
      answer_mode: "product_recommendation",
      safety_mode: "normal",
      failure_stage: null,
      routine_thread_context_active: false,
      final_product_ids: ["product-1"],
      langfuse: { enabled: true, trace_id: "trace-1", trace_url: null },
    }),
    {
      engine: "agent_v2",
      model_step_count: 2,
      tool_call_count: 1,
      blocked_tool_call_count: 0,
      repair_count: 1,
      loaded_guidance_ids: ["base.answer_contract.v1", "category.conditioner.v1"],
      response_ids: ["resp_1", "resp_2"],
      validation_error_count: 0,
      validation_warning_count: 0,
      answer_mode: "product_recommendation",
      safety_mode: "normal",
      failure_stage: null,
      routine_thread_context_active: false,
      final_product_ids: ["product-1"],
      turn_gate_status: null,
      turn_gate_boundary_kind: null,
      turn_gate_advisor_continuation_allowed: null,
      turn_gate_latency_ms: null,
      langfuse_enabled: true,
    },
  )
})

test("AgentV2 tool summaries avoid raw hidden context", () => {
  const inputSummary = summarizeAgentV2ToolInput("select_products", {
    category: "conditioner",
    product_request_kind: "specific_products",
    requested_product_count: 2,
    evidence_quote: "Welche Spuelung",
    hairProfile: { additional_notes: "secret" },
    routineInventory: [{ name: "Private Produktnotiz" }],
    sessionMemory: [{ text: "private memory" }],
    effective_care_context: { hidden: true },
  })
  const outputSummary = summarizeAgentV2ToolOutput("select_products", {
    valid_product_ids: ["product-1", "product-2"],
    products: [{ product_id: "product-1" }],
    raw: "RAW_PRODUCT_OUTPUT_BLOB_SHOULD_NOT_PERSIST",
  })

  assert.deepEqual(inputSummary, {
    name: "select_products",
    category: "conditioner",
    requested_category: null,
    product_request_kind: "specific_products",
    requested_product_count: 2,
    has_effective_care_context: true,
  })
  assert.deepEqual(outputSummary, {
    name: "select_products",
    valid_product_ids: ["product-1", "product-2"],
    product_count: 1,
    routine_step_count: null,
    loaded_guidance_ids: [],
  })
  assert.doesNotMatch(JSON.stringify({ inputSummary, outputSummary }), /secret|Private|RAW_PRODUCT/)
})

test("AgentV2 tool summaries expose guidance package ids from loaded guidance output", () => {
  const outputSummary = summarizeAgentV2ToolOutput("load_advisor_guidance", {
    packages: [
      { package_id: "base.answer_contract.v1", markdown_brief: "RAW_GUIDANCE_SHOULD_NOT_LEAK" },
      { package_id: "category.shampoo.v1", markdown_brief: "RAW_CATEGORY_SHOULD_NOT_LEAK" },
    ],
    hard_rules: [{ id: "rule-1", body: "raw rule" }],
  })

  assert.deepEqual(outputSummary, {
    name: "load_advisor_guidance",
    valid_product_ids: [],
    product_count: null,
    routine_step_count: null,
    loaded_guidance_ids: ["base.answer_contract.v1", "category.shampoo.v1"],
  })
  assert.doesNotMatch(JSON.stringify(outputSummary), /RAW_GUIDANCE|RAW_CATEGORY|raw rule/)
})

test("AgentV2 Langfuse observation kill-switch disables observed client path", () => {
  const original = process.env.AGENT_V2_LANGFUSE_OBSERVATION
  try {
    delete process.env.AGENT_V2_LANGFUSE_OBSERVATION
    assert.equal(isAgentV2LangfuseObservationEnabled(), true)

    process.env.AGENT_V2_LANGFUSE_OBSERVATION = "disabled"
    assert.equal(isAgentV2LangfuseObservationEnabled(), false)
  } finally {
    if (original === undefined) {
      delete process.env.AGENT_V2_LANGFUSE_OBSERVATION
    } else {
      process.env.AGENT_V2_LANGFUSE_OBSERVATION = original
    }
  }
})

test("AgentV2 Langfuse observation kill-switch bypasses tool observations", async () => {
  const original = process.env.AGENT_V2_LANGFUSE_OBSERVATION
  let ran = false
  try {
    process.env.AGENT_V2_LANGFUSE_OBSERVATION = "disabled"

    const result = await observeAgentV2ToolCall({
      name: "select_products",
      input: { category: "shampoo" },
      run: async () => {
        ran = true
        return "ok"
      },
    })

    assert.equal(result, "ok")
    assert.equal(ran, true)
  } finally {
    if (original === undefined) {
      delete process.env.AGENT_V2_LANGFUSE_OBSERVATION
    } else {
      process.env.AGENT_V2_LANGFUSE_OBSERVATION = original
    }
  }
})
