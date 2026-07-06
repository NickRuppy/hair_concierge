import assert from "node:assert/strict"
import test from "node:test"

import { runAgentV2ResponsesTurn } from "../src/lib/agent-v2/runtime/responses-agent"
import {
  CurrentCareFactInputSchema,
  CurrentCareFactToolParametersSchema,
  buildAgentV2ResponsesTools,
  parseCurrentCareFactToolInput,
} from "../src/lib/agent-v2/tools/tool-definitions"

test("AgentV2 exposes set_current_care_context with current-turn fact schema", () => {
  const tools = buildAgentV2ResponsesTools({ safetyMode: "normal" })
  const tool = tools.find((candidate) => candidate.name === "set_current_care_context")
  assert.ok(tool)

  const accepted = [
    CurrentCareFactInputSchema.parse({
      kind: "profile_override",
      field: "thickness",
      value: "fine",
      evidenceQuote: "Actually my hair is fine",
    }),
    CurrentCareFactInputSchema.parse({
      kind: "routine_frequency",
      category: "dry_shampoo",
      frequency: "daily_1x",
      evidenceQuote: "I use dry shampoo daily",
    }),
    CurrentCareFactInputSchema.parse({
      kind: "routine_presence",
      category: "conditioner",
      present: false,
      evidenceQuote: "I do not use conditioner",
    }),
    CurrentCareFactInputSchema.parse({
      kind: "profile_augment",
      field: "stylingTools",
      value: "flat_iron",
      evidenceQuote: "I use a flat iron twice a week",
    }),
    CurrentCareFactInputSchema.parse({
      kind: "profile_override",
      field: "heatStyling",
      value: "several_weekly",
      evidenceQuote: "I use a flat iron twice a week",
    }),
    CurrentCareFactInputSchema.parse({
      kind: "context_signal",
      code: "flat_fast",
      evidenceQuote: "my hair gets flat fast",
    }),
  ]

  assert.equal(accepted.length, 6)
})

test("AgentV2 model-facing current-care tool schema uses direct root fields", () => {
  const tool = buildAgentV2ResponsesTools({ safetyMode: "normal" }).find(
    (candidate) => candidate.name === "set_current_care_context",
  )
  assert.ok(tool)

  const required = tool.parameters.required
  assert.ok(Array.isArray(required))
  assert.equal(required.includes("fact"), false)
  for (const field of [
    "kind",
    "field",
    "value",
    "category",
    "present",
    "frequency",
    "code",
    "evidenceQuote",
  ]) {
    assert.ok(required.includes(field), `set_current_care_context requires ${field}`)
  }

  const parsed = CurrentCareFactToolParametersSchema.parse({
    kind: "routine_frequency",
    field: null,
    value: null,
    category: "dry_shampoo",
    present: null,
    frequency: "daily_1x",
    code: null,
    evidenceQuote: "I use dry shampoo daily",
  })

  assert.deepEqual(parseCurrentCareFactToolInput(parsed), {
    kind: "routine_frequency",
    category: "dry_shampoo",
    frequency: "daily_1x",
    evidenceQuote: "I use dry shampoo daily",
  })

  assert.throws(
    () =>
      parseCurrentCareFactToolInput({
        kind: "routine_frequency",
        field: null,
        value: null,
        category: "dry_shampoo",
        present: null,
        frequency: null,
        code: null,
        evidenceQuote: "I use dry shampoo daily",
      }),
    /Invalid current care fact tool input/,
  )
})

test("AgentV2 parses current-turn context signals from direct tool input", () => {
  const parsed = CurrentCareFactToolParametersSchema.parse({
    kind: "context_signal",
    field: null,
    value: null,
    category: null,
    present: null,
    frequency: null,
    code: "flat_fast",
    evidenceQuote: "my hair gets flat fast",
  })

  assert.deepEqual(parseCurrentCareFactToolInput(parsed), {
    kind: "context_signal",
    code: "flat_fast",
    evidenceQuote: "my hair gets flat fast",
  })
})

test("AgentV2 rejects invalid current-care profile values", () => {
  assert.throws(
    () =>
      parseCurrentCareFactToolInput({
        kind: "profile_override",
        field: "thickness",
        value: "thin",
        evidenceQuote: "Actually my hair is thin",
      }),
    /Invalid current care fact tool input/,
  )

  assert.throws(
    () =>
      parseCurrentCareFactToolInput({
        fact: {
          kind: "profile_augment",
          field: "stylingTools",
          value: "straightener",
          evidenceQuote: "I use a straightener",
        },
      }),
    /Invalid current care fact tool input/,
  )
})

test("AgentV2 rejects current-care direct tool input with branch leakage", () => {
  assert.throws(
    () =>
      parseCurrentCareFactToolInput({
        kind: "routine_frequency",
        field: "thickness",
        value: "fine",
        category: "dry_shampoo",
        present: true,
        frequency: "daily_1x",
        code: "flat_fast",
        evidenceQuote: "I use dry shampoo daily",
      }),
    /Invalid current care fact tool input/,
  )

  assert.throws(
    () =>
      parseCurrentCareFactToolInput({
        kind: "profile_override",
        field: "thickness",
        value: "fine",
        category: "conditioner",
        present: null,
        frequency: null,
        code: null,
        evidenceQuote: "Actually my hair is fine",
      }),
    /Invalid current care fact tool input/,
  )

  assert.throws(
    () =>
      parseCurrentCareFactToolInput({
        kind: "context_signal",
        field: "thickness",
        value: "fine",
        category: null,
        present: null,
        frequency: null,
        code: "flat_fast",
        evidenceQuote: "my hair gets flat fast",
      }),
    /Invalid current care fact tool input/,
  )

  assert.throws(
    () =>
      parseCurrentCareFactToolInput({
        fact: {
          kind: "routine_frequency",
          category: "dry_shampoo",
          frequency: "daily_1x",
          evidenceQuote: "I use dry shampoo daily",
        },
        kind: "profile_override",
        field: "thickness",
        value: "fine",
        category: null,
        present: null,
        frequency: null,
        code: null,
        evidenceQuote: "Actually my hair is fine",
      }),
    /Invalid current care fact tool input/,
  )
})

test("AgentV2 runtime rejects current-care facts with fabricated evidence quotes", async () => {
  const result = await runAgentV2ResponsesTurn({
    client: fakeResponsesClientWithOutputs([
      functionCall("call_1", "set_current_care_context", {
        kind: "routine_frequency",
        category: "dry_shampoo",
        frequency: "daily_1x",
        evidenceQuote: "not in the latest user turn",
      }),
      terminalGeneralAdvice("call_2", {
        evidence_quote: "I use dry shampoo daily",
      }),
    ]),
    message: "I use dry shampoo daily. What does that change?",
    recentMessages: [],
    userContext: { hairProfile: null, routineInventory: [], sessionMemory: [] },
    tools: fakeAgentV2Tools(),
  })

  assert.equal(result.trace.blocked_tool_calls[0]?.name, "set_current_care_context")
  assert.equal(result.trace.blocked_tool_calls[0]?.reason, "evidence_quote_not_grounded")
  assert.equal(
    result.trace.tool_calls.some((call) => call.name === "set_current_care_context"),
    false,
  )
})

test("AgentV2 runtime accepts grounded current-turn context signals", async () => {
  const result = await runAgentV2ResponsesTurn({
    client: fakeResponsesClientWithOutputs([
      functionCall("call_1", "set_current_care_context", {
        kind: "context_signal",
        code: "flat_fast",
        evidenceQuote: "my hair gets flat fast",
      }),
      terminalGeneralAdvice("call_2", {
        evidence_quote: "my hair gets flat fast",
      }),
    ]),
    message: "my hair gets flat fast. What should I change?",
    recentMessages: [],
    userContext: { hairProfile: null, routineInventory: [], sessionMemory: [] },
    tools: fakeAgentV2Tools(),
  })

  assert.equal(result.trace.blocked_tool_calls.length, 0)
  assert.equal(
    result.trace.tool_calls.some((call) => call.name === "set_current_care_context"),
    true,
  )
})

test("AgentV2 returns compact current-care tool output to the model", async () => {
  const client = fakeResponsesClientWithOutputs([
    functionCall("call_1", "set_current_care_context", {
      kind: "profile_override",
      field: "thickness",
      value: "fine",
      evidenceQuote: "Actually my hair is fine",
    }),
    terminalGeneralAdvice("call_2", {
      evidence_quote: "Actually my hair is fine",
    }),
  ])

  await runAgentV2ResponsesTurn({
    client,
    message: "Actually my hair is fine. What does that change?",
    recentMessages: [],
    userContext: {
      hairProfile: { thickness: "coarse" },
      routineInventory: [],
      sessionMemory: [],
    },
    tools: fakeAgentV2Tools(),
  })

  const secondInput = client.requests[1]?.input
  assert.ok(Array.isArray(secondInput))
  const toolOutput = secondInput.find(
    (item) =>
      item &&
      typeof item === "object" &&
      (item as { type?: unknown; call_id?: unknown }).type === "function_call_output" &&
      (item as { call_id?: unknown }).call_id === "call_1",
  ) as { output?: string } | undefined
  assert.ok(toolOutput)
  const output = JSON.parse(toolOutput.output ?? "{}") as Record<string, unknown>
  assert.equal(output.accepted, true)
  assert.equal(output.effective_care_context, undefined)
  assert.equal(output.normalized, undefined)
  assert.deepEqual(output.fact, {
    kind: "profile_override",
    field: "thickness",
    evidence_quote: "Actually my hair is fine",
  })
  assert.equal(output.current_turn_fact_count, 1)
  assert.equal(output.conflict_count, 1)
})

test("AgentV2 runtime applies current-turn facts to the same effective context for product and routine tools", async () => {
  const downstreamContexts: unknown[] = []

  const result = await runAgentV2ResponsesTurn({
    client: fakeResponsesClientWithOutputs([
      functionCall("call_1", "set_current_care_context", {
        kind: "profile_override",
        field: "thickness",
        value: "fine",
        evidenceQuote: "Actually my hair is fine",
      }),
      functionCall("call_2", "set_current_care_context", {
        kind: "routine_presence",
        category: "conditioner",
        present: false,
        evidenceQuote: "I do not use conditioner",
      }),
      functionCall("call_3", "select_products", {
        category: "conditioner",
        reason: "User asks for a conditioner.",
        user_request: "Which conditioner fits?",
        constraints: [],
        product_request_kind: "specific_products",
        requested_product_count: null,
        count_policy: "default",
        evidence_quote: "conditioner",
      }),
      functionCall("call_4", "build_or_fix_routine", {
        objective: "fix_routine",
        requested_layer: "basics",
        requested_category: "conditioner",
        reason: "User asks to rebalance routine.",
        routine_intent: "modify",
        mutation_kind: "add_step",
        evidence_quote: "routine",
      }),
      terminalGeneralAdvice("call_5", {
        evidence_quote: "Actually my hair is fine",
      }),
    ]),
    message:
      "Actually my hair is fine, I do not use conditioner, and I want a conditioner for my routine.",
    recentMessages: [],
    userContext: {
      hairProfile: { thickness: "coarse" },
      routineInventory: [
        { category: "conditioner", product_name: "Saved", frequency_range: "weekly_1x" },
      ],
      sessionMemory: [],
    },
    tools: {
      load_advisor_guidance: async () => ({ loaded_package_ids: [] }),
      select_products: async (_input, executionContext?: { effectiveCareContext?: unknown }) => {
        downstreamContexts.push(executionContext?.effectiveCareContext)
        return { valid_product_ids: [], products: [] }
      },
      load_product_facts: async (
        _input,
        executionContext?: { effectiveCareContext?: unknown },
      ) => {
        downstreamContexts.push(executionContext?.effectiveCareContext)
        return { valid_product_ids: [], products: [] }
      },
      lookup_product_candidate: async () => ({ status: "insufficient_identity" }),
      build_or_fix_routine: async (
        _input,
        executionContext?: { effectiveCareContext?: unknown },
      ) => {
        downstreamContexts.push(executionContext?.effectiveCareContext)
        return { routine_layer: "basics", visible_steps: [] }
      },
    },
  })

  assert.equal(
    result.trace.tool_calls.filter((call) => call.name === "set_current_care_context").length,
    2,
  )
  assert.equal(downstreamContexts.length, 2)
  assert.deepEqual(downstreamContexts[0], downstreamContexts[1])

  const context = downstreamContexts[0] as {
    normalized: {
      thickness: string | null
      routineInventory: { conditioner: { present: boolean } | null }
    }
    currentTurnFacts: unknown[]
    conflicts: Array<{ fieldPath: string; savedValue: unknown; currentTurnValue: unknown }>
  }
  assert.equal(context.normalized.thickness, "fine")
  assert.equal(context.normalized.routineInventory.conditioner, null)
  assert.equal(context.currentTurnFacts.length, 2)
  assert.ok(
    context.conflicts.some(
      (conflict) =>
        conflict.fieldPath === "profile.thickness" &&
        conflict.savedValue === "coarse" &&
        conflict.currentTurnValue === "fine",
    ),
  )
  assert.ok(
    context.conflicts.some(
      (conflict) =>
        conflict.fieldPath === "routine.conditioner.present" &&
        conflict.savedValue === true &&
        conflict.currentTurnValue === false,
    ),
  )
})

test("AgentV2 trace keeps executable tool arguments model-visible only", async () => {
  const result = await runAgentV2ResponsesTurn({
    client: fakeResponsesClientWithOutputs([
      functionCall("call_1", "set_current_care_context", {
        kind: "profile_override",
        field: "thickness",
        value: "fine",
        evidenceQuote: "Actually my hair is fine",
      }),
      functionCall("call_2", "select_products", {
        category: "conditioner",
        reason: "User asks for a conditioner.",
        user_request: "Which conditioner fits?",
        constraints: [],
        product_request_kind: "specific_products",
        requested_product_count: null,
        count_policy: "default",
        evidence_quote: "conditioner",
      }),
      functionCall("call_3", "build_or_fix_routine", {
        objective: "fix_routine",
        requested_layer: "basics",
        requested_category: "conditioner",
        reason: "User asks to rebalance routine.",
        routine_intent: "modify",
        mutation_kind: "add_step",
        evidence_quote: "routine",
      }),
      terminalGeneralAdvice("call_4", {
        evidence_quote: "Actually my hair is fine",
      }),
    ]),
    message: "Actually my hair is fine, I want a conditioner, and please update my routine.",
    recentMessages: [],
    userContext: { hairProfile: { thickness: "coarse" }, routineInventory: [], sessionMemory: [] },
    tools: fakeAgentV2Tools(),
  })

  const selectProductsCall = result.trace.tool_calls.find((call) => call.name === "select_products")
  const routineCall = result.trace.tool_calls.find((call) => call.name === "build_or_fix_routine")
  assert.ok(selectProductsCall)
  assert.ok(routineCall)
  assert.equal(selectProductsCall.arguments?.effective_care_context, undefined)
  assert.equal(routineCall.arguments?.effective_care_context, undefined)
})

function functionCall(call_id: string, name: string, args: Record<string, unknown>) {
  return {
    type: "function_call",
    id: `fc_${call_id}`,
    call_id,
    name,
    arguments: JSON.stringify(args),
  }
}

function terminalGeneralAdvice(call_id: string, overrides: { evidence_quote: string }) {
  return functionCall(call_id, "submit_final_answer", {
    answer_mode: "general_advice",
    interpreted_intent: "User asks for general care advice.",
    request_interpretation: {
      primary_intent: "general_advice",
      product_request_kind: "none",
      routine_intent: "none",
      care_category: "none",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: overrides.evidence_quote,
      specific_product_candidate: false,
      confidence: 0.9,
    },
    confidence: 0.9,
    extracted_constraints: {
      product_categories: [],
      concerns: [],
      goals: [],
      hard_constraints: [],
      raw_constraints: [overrides.evidence_quote],
    },
    missing_information: [],
    safety_flags: [],
    tool_grounding: {
      used_guidance_package_ids: [
        "base.advisor_rules.v1",
        "base.answer_contract.v1",
        "base.tone_and_format.v1",
      ],
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
      category: null,
      return_path: null,
    },
    pending_followup_action: null,
    session_memory_writes: [],
    payload: {
      user_facing_answer_de:
        "Alles klar, ich berücksichtige diese aktuelle Angabe nur für diese Antwort.",
      category_or_topic: "Aktuelle Pflegeangaben",
      key_points_de: ["Ich werte die aktuelle Korrektur für diese Antwort."],
      next_step_offer_de: null,
    },
  })
}

function fakeResponsesClientWithOutputs(outputs: unknown[]) {
  const requests: Record<string, unknown>[] = []
  let index = 0
  return {
    requests,
    responses: {
      create: async (request: Record<string, unknown>) => {
        requests.push(request)
        const output = outputs[index]
        index += 1
        return { id: `resp_${index}`, output: output ? [output] : [] }
      },
    },
  }
}

function fakeAgentV2Tools() {
  return {
    load_advisor_guidance: async () => ({ loaded_package_ids: [] }),
    select_products: async () => ({ valid_product_ids: [], products: [] }),
    load_product_facts: async () => ({ valid_product_ids: [], products: [] }),
    lookup_product_candidate: async () => ({ status: "insufficient_identity" }),
    build_or_fix_routine: async () => ({ routine_layer: "basics", visible_steps: [] }),
  }
}
