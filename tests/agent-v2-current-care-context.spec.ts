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
      frequency: "daily",
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
  ]

  assert.equal(accepted.length, 5)
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
    frequency: "daily",
    code: null,
    evidenceQuote: "I use dry shampoo daily",
  })

  assert.deepEqual(parseCurrentCareFactToolInput(parsed), {
    kind: "routine_frequency",
    category: "dry_shampoo",
    frequency: "daily",
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

test("AgentV2 runtime rejects current-care facts with fabricated evidence quotes", async () => {
  const result = await runAgentV2ResponsesTurn({
    client: fakeResponsesClientWithOutputs([
      functionCall("call_1", "set_current_care_context", {
        kind: "routine_frequency",
        category: "dry_shampoo",
        frequency: "daily",
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
        { category: "conditioner", product_name: "Saved", frequency_range: "1_2x" },
      ],
      sessionMemory: [],
    },
    tools: {
      load_advisor_guidance: async () => ({ loaded_package_ids: [] }),
      select_products: async (input) => {
        downstreamContexts.push(input.effective_care_context)
        return { valid_product_ids: [], products: [] }
      },
      build_or_fix_routine: async (input) => {
        downstreamContexts.push(input.effective_care_context)
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
    pending_routine_action: null,
    session_memory_writes: [],
    payload: {
      user_facing_answer_de:
        "Alles klar, ich beruecksichtige diese aktuelle Angabe nur fuer diese Antwort.",
      category_or_topic: "Aktuelle Pflegeangaben",
      key_points_de: ["Ich werte die aktuelle Korrektur fuer diese Antwort."],
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
    build_or_fix_routine: async () => ({ routine_layer: "basics", visible_steps: [] }),
  }
}
