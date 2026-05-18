import assert from "node:assert/strict"
import test from "node:test"

import { buildAgentV2ResponsesTools } from "../src/lib/agent-v2/tools/tool-definitions"
import { runAgentV2ResponsesTurn } from "../src/lib/agent-v2/runtime/responses-agent"

test("AgentV2 exposes only the V0 advisor toolset", () => {
  const tools = buildAgentV2ResponsesTools({ safetyMode: "normal" })
  const names = tools.map((tool) => tool.name).sort()

  assert.deepEqual(names, [
    "build_or_fix_routine",
    "load_advisor_guidance",
    "select_products",
    "submit_final_answer",
  ])

  for (const tool of tools) {
    assert.equal(tool.type, "function")
    assert.equal(tool.strict, true)
    assert.ok(tool.parameters)
  }
})

test("AgentV2 restricted safety toolset omits product selection", () => {
  const names = buildAgentV2ResponsesTools({ safetyMode: "restricted" })
    .map((tool) => tool.name)
    .sort()

  assert.deepEqual(names, ["build_or_fix_routine", "load_advisor_guidance", "submit_final_answer"])
})

test("AgentV2 strict tool schemas avoid open records and root unions", () => {
  const tools = buildAgentV2ResponsesTools({ safetyMode: "normal" })

  for (const tool of tools) {
    const serialized = JSON.stringify(tool.parameters)
    assert.equal(tool.parameters.type, "object", `${tool.name} root schema must be an object`)
    assert.equal(
      Object.hasOwn(tool.parameters, "oneOf") || Object.hasOwn(tool.parameters, "anyOf"),
      false,
      `${tool.name} root schema must not be a union`,
    )
    assert.equal(serialized.includes("propertyNames"), false, `${tool.name} has record-like keys`)
    assert.equal(
      serialized.includes('"additionalProperties":{}'),
      false,
      `${tool.name} has open values`,
    )
    assert.equal(serialized.includes('"default":'), false, `${tool.name} has schema defaults`)
    assert.equal(serialized.includes("oneOf"), false, `${tool.name} has oneOf`)
    assertStrictObjectNodes(tool.name, tool.parameters)
  }

  assertRequiredToolFields(tools, "select_products", [
    "category",
    "reason",
    "user_request",
    "product_request_kind",
    "requested_product_count",
    "count_policy",
    "evidence_quote",
  ])
  assertRequiredToolFields(tools, "build_or_fix_routine", [
    "objective",
    "requested_layer",
    "requested_category",
    "reason",
    "routine_intent",
    "mutation_kind",
    "evidence_quote",
  ])
})

function assertRequiredToolFields(
  tools: ReturnType<typeof buildAgentV2ResponsesTools>,
  toolName: string,
  expectedFields: string[],
) {
  const tool = tools.find((candidate) => candidate.name === toolName)
  assert.ok(tool, `missing tool ${toolName}`)
  const required = asStringArray(tool.parameters.required)

  for (const field of expectedFields) {
    assert.ok(required.includes(field), `${toolName} is missing required field ${field}`)
  }
}

function assertStrictObjectNodes(toolName: string, value: unknown, path = "$") {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertStrictObjectNodes(toolName, entry, `${path}[${index}]`))
    return
  }
  if (!value || typeof value !== "object") return

  const node = value as Record<string, unknown>
  if (node.type === "object") {
    assert.equal(
      node.additionalProperties,
      false,
      `${toolName} ${path} must set additionalProperties false`,
    )
    const propertyNames = Object.keys(asRecord(node.properties) ?? {})
    assert.deepEqual(
      asStringArray(node.required).sort(),
      propertyNames.sort(),
      `${toolName} ${path} must require every object field`,
    )
  }

  for (const [key, child] of Object.entries(node)) {
    assertStrictObjectNodes(toolName, child, `${path}.${key}`)
  }
}

test("AgentV2 does not build a normal toolset for hard short circuit safety", () => {
  assert.throws(
    () => buildAgentV2ResponsesTools({ safetyMode: "hard_short_circuit" }),
    /Hard short circuit bypasses the AgentV2 tool loop/,
  )
})

function rawFunctionCall(call_id: string, name: string, args: string) {
  return { type: "function_call", id: `fc_${call_id}`, call_id, name, arguments: args }
}

function functionCall(call_id: string, name: string, args: Record<string, unknown>) {
  return rawFunctionCall(call_id, name, JSON.stringify(args))
}

function selectProductsArguments(overrides: Record<string, unknown> = {}) {
  return {
    category: "conditioner",
    reason: "User asked for product recommendations.",
    user_request: "Welche Spülung passt?",
    constraints: [],
    product_request_kind: "specific_products",
    requested_product_count: null,
    count_policy: "default",
    evidence_quote: "Welche Spülung passt",
    ...overrides,
  }
}

function terminalCall(call_id: string, args: Record<string, unknown>) {
  return functionCall(call_id, "submit_final_answer", args)
}

function terminalGeneralAdviceArguments() {
  return {
    answer_mode: "general_advice",
    interpreted_intent: "User asks for category advice.",
    request_interpretation: requestInterpretation(),
    confidence: 0.9,
    extracted_constraints: emptyExtractedConstraints(),
    missing_information: [],
    safety_flags: [],
    tool_grounding: {
      used_guidance_package_ids: ["base.general_advice.v1"],
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
      return_path: [],
    },
    session_memory_writes: [],
    payload: {
      user_facing_answer_de: "Eine Maske ist optional und haengt vom Pflegebedarf ab.",
      category_or_topic: "mask",
      key_points_de: ["Eine Maske hilft vor allem bei zusaetzlichem Pflegebedarf."],
      next_step_offer_de: "Ich kann dir danach eine passende Maske empfehlen.",
    },
  }
}

function emptyExtractedConstraints() {
  return {
    hair_concerns: [],
    goals: [],
    product_categories: [],
    budget_eur: null,
    avoid_ingredients: [],
    allergies: [],
    preferences: [],
    routine_layer: null,
    raw_constraints: [],
  }
}

function requestInterpretation(
  overrides: Partial<{
    primary_intent:
      | "product_recommendation"
      | "category_education"
      | "routine_build"
      | "routine_mutation"
      | "routine_explanation"
      | "routine_exit"
      | "general_advice"
      | "clarification"
      | "safety_boundary"
      | "smalltalk"
      | "unknown"
    product_request_kind:
      | "none"
      | "specific_products"
      | "category_education"
      | "compare_products"
      | "product_detail"
      | "routine_product_deep_dive"
    routine_intent:
      | "none"
      | "create"
      | "modify"
      | "remove_step"
      | "replace_product"
      | "explain"
      | "summarize"
      | "exit"
    category:
      | "none"
      | "unknown"
      | "shampoo"
      | "conditioner"
      | "mask"
      | "leave_in"
      | "oil"
      | "bondbuilder"
      | "deep_cleansing_shampoo"
      | "dry_shampoo"
      | "peeling"
      | "styling"
      | "treatment"
    requested_product_count: number | null
    count_policy: "none" | "exact" | "default" | "cap"
    evidence_quote: string
    confidence: number
  }> = {},
) {
  return {
    primary_intent: "category_education",
    product_request_kind: "category_education",
    routine_intent: "none",
    category: "mask",
    requested_product_count: null,
    count_policy: "none",
    evidence_quote: "eine Maske",
    confidence: 0.9,
    ...overrides,
  }
}

function terminalGeneralAdvice(
  call_id: string,
  interpretationOverrides: Parameters<typeof requestInterpretation>[0] = {},
) {
  return terminalCall(call_id, {
    ...terminalGeneralAdviceArguments(),
    request_interpretation: requestInterpretation(interpretationOverrides),
  })
}

function terminalRestrictedSafetyBoundary(call_id: string) {
  return terminalCall(call_id, {
    ...terminalGeneralAdviceArguments(),
    answer_mode: "safety_boundary",
    interpreted_intent: "User describes foreground scalp symptoms.",
    request_interpretation: requestInterpretation({
      primary_intent: "safety_boundary",
      product_request_kind: "none",
      category: "shampoo",
      count_policy: "none",
      evidence_quote: "Kopfhaut juckt und ist gerötet",
    }),
    safety_flags: ["restricted_scalp_symptoms"],
    tool_grounding: {
      ...terminalGeneralAdviceArguments().tool_grounding,
      used_guidance_package_ids: ["base.safety_boundaries.v1"],
      hard_rule_ids: [],
    },
    payload: {
      user_facing_answer_de:
        "Bei juckender und geroeteter Kopfhaut wuerde ich nicht direkt ein Produkt empfehlen. Halte die Pflege mild und reizarm; wenn Brennen, Naessen, offene Stellen oder staerkere Schmerzen dazukommen, lass es bitte aerztlich abklaeren.",
      boundary_reason_de:
        "Juckreiz zusammen mit Roetung klingt nach einem moeglich medizinischen Kopfhautthema.",
      next_step_de:
        "Nutze vorerst nur milde, reizarme Pflege und hole Hilfe, wenn es staerker wird oder nicht abklingt.",
    },
  })
}

function terminalGeneralAdviceInRoutine(call_id: string) {
  return terminalCall(call_id, {
    ...terminalGeneralAdviceArguments(),
    request_interpretation: requestInterpretation({
      primary_intent: "category_education",
      product_request_kind: "category_education",
      category: "conditioner",
      evidence_quote: "Maske oder Conditioner",
    }),
    routine_context: {
      active: true,
      routine_layer: "basics",
      step_id: null,
      category: "conditioner",
      return_path: ["routine"],
    },
    payload: {
      ...terminalGeneralAdviceArguments().payload,
      user_facing_answer_de:
        "In deiner vereinfachten Routine reicht Conditioner als Basis; eine Maske ist optional.",
      next_step_offer_de: "Danach koennen wir zur Routine zurueckgehen.",
    },
  })
}

function terminalProductRecommendation(call_id: string, product_ids: string[]) {
  return terminalCall(call_id, {
    ...terminalGeneralAdviceArguments(),
    answer_mode: "product_recommendation",
    request_interpretation: requestInterpretation({
      primary_intent: "product_recommendation",
      product_request_kind: "specific_products",
      category: "conditioner",
      requested_product_count: null,
      count_policy: "default",
      evidence_quote: "Welches Produkt passt",
    }),
    tool_grounding: {
      ...terminalGeneralAdviceArguments().tool_grounding,
      used_product_tool: true,
      product_ids,
    },
    payload: {
      user_facing_answer_de: "Ich wuerde dir dieses Produkt empfehlen.",
      recommendations: product_ids.map((product_id) => ({
        product_id,
        reason_de: "Passt zu deinem Profil.",
        usage_de: null,
        caveat_de: null,
      })),
      comparison_notes_de: [],
      usage_notes_de: [],
      next_step_offer_de: null,
    },
  })
}

function terminalNamedProductRecommendation(
  call_id: string,
  products: Array<{ product_id: string; name: string }>,
  interpretationOverrides: Parameters<typeof requestInterpretation>[0] = {},
) {
  return terminalCall(call_id, {
    ...terminalGeneralAdviceArguments(),
    answer_mode: "product_recommendation",
    interpreted_intent: "User asks for concrete product recommendations.",
    request_interpretation: requestInterpretation({
      primary_intent: "product_recommendation",
      product_request_kind: "specific_products",
      category: "conditioner",
      requested_product_count: null,
      count_policy: "default",
      ...interpretationOverrides,
    }),
    extracted_constraints: {
      ...emptyExtractedConstraints(),
      product_categories: ["conditioner"],
    },
    tool_grounding: {
      ...terminalGeneralAdviceArguments().tool_grounding,
      used_guidance_package_ids: ["base.product_recommendation.v1"],
      used_product_tool: true,
      product_ids: products.map((product) => product.product_id),
    },
    payload: {
      user_facing_answer_de: products
        .map((product) => `**${product.name}** passt gut zu deinem Profil.`)
        .join("\n"),
      recommendations: products.map((product) => ({
        product_id: product.product_id,
        reason_de: "Passt zu deinem Profil.",
        usage_de: null,
        caveat_de: null,
      })),
      comparison_notes_de: [],
      usage_notes_de: [],
      next_step_offer_de: null,
    },
  })
}

function terminalPartiallyRenderedProductRecommendation(
  call_id: string,
  products: Array<{ product_id: string; name: string }>,
) {
  return terminalCall(call_id, {
    ...terminalGeneralAdviceArguments(),
    answer_mode: "product_recommendation",
    interpreted_intent: "User asks for concrete product recommendations.",
    request_interpretation: requestInterpretation({
      primary_intent: "product_recommendation",
      product_request_kind: "specific_products",
      category: "conditioner",
      requested_product_count: products.length,
      count_policy: "exact",
      evidence_quote: "zwei passende Conditioner",
    }),
    extracted_constraints: {
      ...emptyExtractedConstraints(),
      product_categories: ["conditioner"],
    },
    tool_grounding: {
      ...terminalGeneralAdviceArguments().tool_grounding,
      used_guidance_package_ids: ["base.product_recommendation.v1"],
      used_product_tool: true,
      product_ids: products.map((product) => product.product_id),
    },
    payload: {
      user_facing_answer_de: `**${products[0]?.name ?? "Diese Option"}** passt gut zu deinem Profil.`,
      recommendations: products.map((product) => ({
        product_id: product.product_id,
        reason_de: "Passt zu deinem Profil.",
        usage_de: null,
        caveat_de: null,
      })),
      comparison_notes_de: [],
      usage_notes_de: [],
      next_step_offer_de: null,
    },
  })
}

function terminalRoutineProductDeepDive(call_id: string, product_ids: string[]) {
  return terminalCall(call_id, {
    ...terminalGeneralAdviceArguments(),
    answer_mode: "routine_product_deep_dive",
    request_interpretation: requestInterpretation({
      primary_intent: "product_recommendation",
      product_request_kind: "routine_product_deep_dive",
      routine_intent: "none",
      category: "leave_in",
      requested_product_count: null,
      count_policy: "default",
      evidence_quote: "Leave-in",
    }),
    tool_grounding: {
      ...terminalGeneralAdviceArguments().tool_grounding,
      used_guidance_package_ids: ["base.product_recommendation.v1"],
      used_product_tool: true,
      product_ids,
    },
    routine_context: {
      active: true,
      routine_layer: "deep_dive",
      step_id: null,
      category: "leave_in",
      return_path: ["routine"],
    },
    payload: {
      user_facing_answer_de:
        "**Test Leave-in** passt gut als erster Zusatzhebel, weil es leicht ist und feines Haar nicht unnoetig beschwert.",
      step_id: null,
      category: "leave_in",
      recommendations: product_ids.map((product_id) => ({
        product_id,
        reason_de: "Passt als leichter erster Zusatzhebel in der Routine.",
        usage_de: "Nach dem Waschen sparsam in Laengen und Spitzen.",
        caveat_de: null,
      })),
      return_to_routine_offer_de: "Danach koennen wir schauen, wie du es in die Routine einbaust.",
    },
  })
}

function terminalRoutineProductDeepDiveWithStep(
  call_id: string,
  product_ids: string[],
  step_id: string,
) {
  const call = terminalRoutineProductDeepDive(call_id, product_ids)
  const args = JSON.parse(call.arguments)
  args.tool_grounding.routine_step_ids = [step_id]
  args.routine_context.step_id = step_id
  args.payload.step_id = step_id
  return rawFunctionCall(call.call_id, call.name, JSON.stringify(args))
}

function fakeResponsesClientWithOutputs(outputs: unknown[]) {
  let index = 0
  const requests: Record<string, unknown>[] = []
  return {
    requests,
    responses: {
      create: async (request: Record<string, unknown>) => {
        requests.push(request)
        const output = outputs[index++]
        return {
          id: `resp_${index}`,
          output: Array.isArray(output) ? output : [output],
        }
      },
    },
  }
}

function getInputItems(request: Record<string, unknown>): unknown[] {
  const input = request.input
  assert.ok(Array.isArray(input))
  return input
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string") ? value : []
}

function fakeResponsesClientThatThrowsIfCalled() {
  return {
    responses: {
      create: async () => {
        throw new Error("model should not be called")
      },
    },
  }
}

function fakeAgentV2Tools() {
  return {
    load_advisor_guidance: async () => ({
      loaded_package_ids: ["base.general_advice.v1"],
      hard_rules: [],
      markdown_brief: "Guidance.",
    }),
    select_products: async () => ({ valid_product_ids: [] }),
    build_or_fix_routine: async () => ({ visible_steps: [] }),
  }
}

function projectedProduct(product_id: string, name: string) {
  return {
    product_id,
    rank: 1,
    name,
    brand: null,
    price_eur: null,
    currency: null,
    fit_reason: "Test fit.",
    caveat: null,
    supported_claims: [],
    unsupported_requested_signals: [],
  }
}

test("AgentV2 runtime executes tool call then terminal answer", async () => {
  const client = fakeResponsesClientWithOutputs([
    functionCall("call_1", "load_advisor_guidance", {
      answer_mode_hint: "general_advice",
      categories: ["mask"],
      routine_layer: null,
      safety_mode: "normal",
    }),
    terminalGeneralAdvice("call_2"),
  ])
  const result = await runAgentV2ResponsesTurn({
    client,
    message: "Brauche ich wirklich eine Maske?",
    recentMessages: [],
    userContext: { hairProfile: null, routineInventory: [], sessionMemory: [] },
    tools: fakeAgentV2Tools(),
  })

  assert.equal(result.final_answer.answer_mode, "general_advice")
  assert.equal(result.trace.model_steps.length, 2)
  assert.deepEqual(
    result.trace.tool_calls.map((call) => call.name),
    ["load_advisor_guidance"],
  )
  assert.deepEqual(client.requests[0].include, ["reasoning.encrypted_content"])
  assert.equal(client.requests[0].parallel_tool_calls, false)
  const secondInput = getInputItems(client.requests[1])
  assert.ok(secondInput.some((item) => asRecord(item)?.type === "function_call"))
  assert.ok(
    secondInput.some(
      (item) =>
        asRecord(item)?.type === "function_call_output" && asRecord(item)?.call_id === "call_1",
    ),
  )
})

test("AgentV2 runtime sends loaded user profile context to the model", async () => {
  const client = fakeResponsesClientWithOutputs([terminalGeneralAdvice("call_1")])

  await runAgentV2ResponsesTurn({
    client,
    message: "Was passt zu meinem Profil?",
    recentMessages: [],
    userContext: {
      hairProfile: {
        hair_texture: "wavy",
        thickness: "fine",
        scalp_type: "oily",
      },
      routineInventory: [{ category: "shampoo", product_name: "Test Shampoo" }],
      derivedSignals: ["Haarstruktur: wellig", "Haardicke: fein"],
      relevantMemory: [{ kind: "preference", content: "Mag leichte Produkte." }],
      missingProfile: [],
      sessionMemory: [],
    },
    tools: fakeAgentV2Tools(),
  })

  const firstInput = getInputItems(client.requests[0])
  const contextItem = firstInput
    .map(asRecord)
    .find((item) => String(item?.content ?? "").includes("Loaded Compare Lab user context"))
  const content = String(contextItem?.content ?? "")
  assert.match(content, /hair_texture/)
  assert.match(content, /wavy/)
  assert.match(content, /Haardicke: fein/)
  assert.match(content, /Test Shampoo/)
})

test("AgentV2 runtime injects terminal payload field guidance", async () => {
  const client = fakeResponsesClientWithOutputs([terminalGeneralAdvice("call_1")])

  await runAgentV2ResponsesTurn({
    client,
    message: "Welches Produkt passt in meine Routine?",
    recentMessages: [],
    userContext: { hairProfile: null, routineInventory: [], sessionMemory: [] },
    tools: fakeAgentV2Tools(),
  })

  const firstInput = getInputItems(client.requests[0])
  const terminalContractItem = firstInput
    .map(asRecord)
    .find((item) => String(item?.content ?? "").includes("AgentV2 terminal payload fields"))
  const content = String(terminalContractItem?.content ?? "")
  assert.match(content, /product_recommendation/)
  assert.match(content, /routine_product_deep_dive/)
  assert.match(content, /general_advice/)
  assert.match(content, /concrete product ask inside an active routine/)
  assert.match(content, /complete final German answer/)
  assert.match(
    content,
    /Do not treat recommendations, visible_steps, usage_notes_de, or blocking_constraints/,
  )
})

test("AgentV2 runtime trace reflects resolved policy overrides", async () => {
  const client = fakeResponsesClientWithOutputs([terminalGeneralAdvice("call_1")])

  const result = await runAgentV2ResponsesTurn({
    client,
    message: "Was passt zu meinem Profil?",
    recentMessages: [],
    userContext: { hairProfile: null, routineInventory: [], sessionMemory: [] },
    tools: fakeAgentV2Tools(),
    policyOverrides: {
      model: "test-agent-v2-model",
      reasoning_effort: "medium",
    },
  })

  assert.equal(result.trace.model, "test-agent-v2-model")
  assert.equal(result.trace.reasoning_effort, "medium")
  assert.equal(client.requests[0].model, "test-agent-v2-model")
  assert.deepEqual(client.requests[0].reasoning, { effort: "medium" })
})

test("AgentV2 runtime injects active routine thread context into first model input", async () => {
  const client = fakeResponsesClientWithOutputs([terminalGeneralAdviceInRoutine("call_1")])

  const result = await runAgentV2ResponsesTurn({
    client,
    message: "Brauche ich dann eher Maske oder Conditioner?",
    recentMessages: [],
    userContext: { hairProfile: null, routineInventory: [], sessionMemory: [] },
    routineThreadContext: {
      active: true,
      current_layer: "basics",
      last_answer_mode: "routine",
      last_routine_categories: ["shampoo", "conditioner"],
      last_user_goal: "Routine vereinfachen",
      summary_de: "Vereinfachte Basisroutine mit Shampoo und Conditioner.",
    },
    currentRoutineLayer: "basics",
    tools: fakeAgentV2Tools(),
  })

  const firstInput = getInputItems(client.requests[0])
  const routineContextItem = firstInput
    .map(asRecord)
    .find((item) => String(item?.content ?? "").includes("Active AgentV2 routine thread context"))
  const content = String(routineContextItem?.content ?? "")
  assert.match(content, /Routine vereinfachen/)
  assert.match(content, /conditioner/)
  assert.equal(result.trace.routine_thread_context_active, true)
  assert.equal(result.trace.routine_thread_context?.current_layer, "basics")
})

test("AgentV2 runtime supports product recommendations inside an active routine thread", async () => {
  const client = fakeResponsesClientWithOutputs([
    functionCall("call_1", "load_advisor_guidance", {
      answer_mode_hint: "routine_product_deep_dive",
      categories: ["leave_in"],
      routine_layer: "deep_dive",
      safety_mode: "normal",
    }),
    functionCall("call_2", "select_products", {
      ...selectProductsArguments({
        category: "leave_in",
        reason: "User asked for a product inside the active routine.",
        user_request: "Okay, zeig mir dann ein passendes Produkt fuer den ersten Hebel.",
        product_request_kind: "routine_product_deep_dive",
        evidence_quote: "passendes Produkt",
      }),
    }),
    terminalRoutineProductDeepDive("call_3", ["prod_1"]),
  ])

  const result = await runAgentV2ResponsesTurn({
    client,
    message: "Okay, zeig mir dann ein passendes Produkt fuer den ersten Hebel.",
    recentMessages: [],
    userContext: { hairProfile: null, routineInventory: [], sessionMemory: [] },
    routineThreadContext: {
      active: true,
      current_layer: "basics",
      last_answer_mode: "routine",
      last_routine_categories: ["shampoo", "conditioner", "leave_in"],
      last_user_goal: "Routine verbessern",
      summary_de: "Basics stehen, der erste Zusatzhebel ist ein leichter Leave-in.",
    },
    currentRoutineLayer: "basics",
    tools: {
      ...fakeAgentV2Tools(),
      load_advisor_guidance: async () => ({
        loaded_package_ids: ["base.product_recommendation.v1"],
        hard_rules: [],
        markdown_brief: "Guidance.",
      }),
      select_products: async () => ({
        valid_product_ids: ["prod_1"],
        products: [
          {
            product_id: "prod_1",
            rank: 1,
            name: "Test Leave-in",
            supported_claims: [
              {
                field: "weight",
                value: "light",
                evidence: "product_spec",
                label: "leicht",
              },
            ],
          },
        ],
      }),
    },
  })

  assert.equal(result.final_answer.answer_mode, "routine_product_deep_dive")
  assert.deepEqual(
    result.trace.tool_calls.map((call) => call.name),
    ["load_advisor_guidance", "select_products"],
  )
  assert.equal(result.trace.validation_errors.length, 0)
  assert.equal(result.final_answer.routine_context.active, true)
  assert.equal(result.final_answer.routine_context.category, "leave_in")
})

test("AgentV2 runtime blocks select_products in restricted safety mode", async () => {
  let selectProductsCalled = false
  const client = fakeResponsesClientWithOutputs([
    functionCall("call_1", "select_products", {
      ...selectProductsArguments({
        category: "shampoo",
        reason: "User asked which shampoo to take despite scalp symptoms.",
        user_request: "Meine Kopfhaut juckt und ist gerötet, welches Shampoo soll ich nehmen?",
        evidence_quote: "welches Shampoo",
      }),
    }),
    terminalRestrictedSafetyBoundary("call_2"),
  ])

  const result = await runAgentV2ResponsesTurn({
    client,
    message: "Meine Kopfhaut juckt und ist gerötet, welches Shampoo soll ich nehmen?",
    recentMessages: [],
    userContext: { hairProfile: null, routineInventory: [], sessionMemory: [] },
    safetyMode: "restricted",
    tools: {
      ...fakeAgentV2Tools(),
      select_products: async () => {
        selectProductsCalled = true
        return { valid_product_ids: ["prod_1"] }
      },
    },
  })

  assert.equal(result.trace.safety_mode, "restricted")
  assert.equal(selectProductsCalled, false)
  assert.equal(
    result.trace.tool_calls.some((call) => call.name === "select_products"),
    false,
  )
  assert.equal(result.trace.blocked_tool_calls[0].name, "select_products")
  assert.equal(result.final_answer.answer_mode, "safety_boundary")
  assert.doesNotMatch(result.final_answer.payload.user_facing_answer_de, /empfehlen\.$/)
  assert.ok(
    getInputItems(client.requests[0]).some((item) =>
      String(asRecord(item)?.content ?? "").includes("Safety mode is restricted"),
    ),
  )
})

test("AgentV2 runtime repairs restricted product-first answers without asking for select_products", async () => {
  const client = fakeResponsesClientWithOutputs([
    terminalProductRecommendation("call_1", ["prod_1"]),
    terminalRestrictedSafetyBoundary("call_2"),
  ])

  const result = await runAgentV2ResponsesTurn({
    client,
    message: "Meine Kopfhaut juckt und ist gerötet. Welches Shampoo soll ich nehmen?",
    recentMessages: [],
    userContext: { hairProfile: null, routineInventory: [], sessionMemory: [] },
    safetyMode: "restricted",
    tools: fakeAgentV2Tools(),
  })

  assert.equal(result.final_answer.answer_mode, "safety_boundary")
  assert.equal(result.trace.bounded_repair_kind, "terminal_only")
  assert.ok(
    result.trace.repair_attempts[0].validation_errors.some(
      (error) => error.validator_id === "safety_no_product_first",
    ),
  )
  const repairInput = getInputItems(client.requests[1])
  assert.equal(
    repairInput.some((item) =>
      String(asRecord(item)?.content ?? "").includes("First call select_products"),
    ),
    false,
  )
})

test("AgentV2 runtime validates products selected earlier in the same compare run", async () => {
  const client = fakeResponsesClientWithOutputs([
    functionCall("call_1", "select_products", {
      ...selectProductsArguments({
        category: "leave_in",
        reason: "Refresh current product context.",
        user_request: "Und wie nutze ich das?",
        product_request_kind: "routine_product_deep_dive",
        evidence_quote: "Leave-in",
      }),
    }),
    terminalRoutineProductDeepDive("call_2", ["prod_prior"]),
  ])

  const result = await runAgentV2ResponsesTurn({
    client,
    message: "Und wie nutze ich das?",
    recentMessages: [],
    userContext: { hairProfile: null, routineInventory: [], sessionMemory: [] },
    priorSelectedProductProjections: [
      {
        valid_product_ids: ["prod_prior"],
        products: [projectedProduct("prod_prior", "Test Leave-in")],
      },
    ],
    routineThreadContext: {
      active: true,
      current_layer: "deep_dive",
      last_answer_mode: "routine_product_deep_dive",
      last_routine_categories: ["leave_in"],
      last_user_goal: "Mehr Glanz",
      summary_de: "Ein Leave-in wurde empfohlen.",
    },
    currentRoutineLayer: "deep_dive",
    tools: {
      ...fakeAgentV2Tools(),
      select_products: async () => ({
        valid_product_ids: ["prod_current"],
        products: [{ product_id: "prod_current", name: "Current Leave-in" }],
      }),
    },
  })

  assert.equal(result.final_answer.answer_mode, "routine_product_deep_dive")
  assert.equal(result.trace.validation_errors.length, 0)
  assert.equal(result.trace.failure_stage, null)
})

test("AgentV2 runtime repairs concrete category-fit asks that hide selected products", async () => {
  const products = [
    { product_id: "prod_1", name: "Test Conditioner" },
    { product_id: "prod_2", name: "Second Conditioner" },
    { product_id: "prod_3", name: "Third Conditioner" },
  ]
  const client = fakeResponsesClientWithOutputs([
    functionCall("call_1", "select_products", {
      ...selectProductsArguments({
        category: "conditioner",
        reason: "User asked which conditioner fits.",
        user_request: "Welche Spülung passt zu coloriertem, strapaziertem Haar?",
        evidence_quote: "Welche Spülung passt",
      }),
    }),
    terminalGeneralAdvice("call_2", {
      primary_intent: "product_recommendation",
      product_request_kind: "specific_products",
      category: "conditioner",
      evidence_quote: "Welche Spülung passt",
    }),
    terminalNamedProductRecommendation("call_3", products, {
      evidence_quote: "Welche Spülung passt",
    }),
  ])

  const result = await runAgentV2ResponsesTurn({
    client,
    message: "Welche Spülung passt zu coloriertem, strapaziertem Haar?",
    recentMessages: [],
    userContext: { hairProfile: null, routineInventory: [], sessionMemory: [] },
    tools: {
      ...fakeAgentV2Tools(),
      select_products: async () => ({
        valid_product_ids: products.map((product) => product.product_id),
        products,
      }),
    },
  })

  assert.equal(result.final_answer.answer_mode, "product_recommendation")
  assert.equal(result.final_answer.payload.recommendations.length, 3)
  assert.equal(result.trace.validation_errors.length, 0)
  assert.equal(result.trace.repair_attempts.length, 1)
  assert.equal(
    result.trace.repair_attempts[0].validation_errors[0].validator_id,
    "request_interpretation_answer_mode",
  )
})

test("AgentV2 runtime repairs product recommendations to respect an explicit count", async () => {
  const products = [
    { product_id: "prod_1", name: "Test Conditioner" },
    { product_id: "prod_2", name: "Second Conditioner" },
    { product_id: "prod_3", name: "Third Conditioner" },
  ]
  const client = fakeResponsesClientWithOutputs([
    functionCall("call_1", "select_products", {
      ...selectProductsArguments({
        category: "conditioner",
        reason: "User asked for two conditioners.",
        user_request: "Vergleich mir bitte zwei passende Conditioner für feines Haar.",
        product_request_kind: "compare_products",
        requested_product_count: 2,
        count_policy: "exact",
        evidence_quote: "zwei passende Conditioner",
      }),
    }),
    terminalNamedProductRecommendation("call_2", products, {
      product_request_kind: "compare_products",
      requested_product_count: 2,
      count_policy: "exact",
      evidence_quote: "zwei passende Conditioner",
    }),
    terminalNamedProductRecommendation("call_3", products.slice(0, 2), {
      product_request_kind: "compare_products",
      requested_product_count: 2,
      count_policy: "exact",
      evidence_quote: "zwei passende Conditioner",
    }),
  ])

  const result = await runAgentV2ResponsesTurn({
    client,
    message: "Vergleich mir bitte zwei passende Conditioner für feines Haar.",
    recentMessages: [],
    userContext: { hairProfile: null, routineInventory: [], sessionMemory: [] },
    tools: {
      ...fakeAgentV2Tools(),
      select_products: async () => ({
        valid_product_ids: products.map((product) => product.product_id),
        products,
      }),
    },
  })

  assert.equal(result.final_answer.answer_mode, "product_recommendation")
  assert.equal(result.final_answer.payload.recommendations.length, 2)
  assert.equal(result.trace.validation_errors.length, 0)
  assert.equal(result.trace.repair_attempts.length, 1)
  assert.equal(
    result.trace.repair_attempts[0].validation_errors[0].validator_id,
    "requested_product_count",
  )
})

test("AgentV2 runtime repairs incomplete visible payload prose as terminal-only", async () => {
  const products = [
    { product_id: "prod_1", name: "Test Conditioner" },
    { product_id: "prod_2", name: "Second Conditioner" },
  ]
  const client = fakeResponsesClientWithOutputs([
    functionCall("call_1", "select_products", {
      ...selectProductsArguments({
        category: "conditioner",
        reason: "User asked for two conditioners.",
        user_request: "Vergleich mir bitte zwei passende Conditioner für feines Haar.",
        product_request_kind: "specific_products",
        requested_product_count: 2,
        count_policy: "exact",
        evidence_quote: "zwei passende Conditioner",
      }),
    }),
    terminalPartiallyRenderedProductRecommendation("call_2", products),
    terminalNamedProductRecommendation("call_3", products, {
      requested_product_count: 2,
      count_policy: "exact",
      evidence_quote: "zwei passende Conditioner",
    }),
  ])

  const result = await runAgentV2ResponsesTurn({
    client,
    message: "Vergleich mir bitte zwei passende Conditioner für feines Haar.",
    recentMessages: [],
    userContext: { hairProfile: null, routineInventory: [], sessionMemory: [] },
    tools: {
      ...fakeAgentV2Tools(),
      select_products: async () => ({
        valid_product_ids: products.map((product) => product.product_id),
        products,
      }),
    },
  })

  assert.equal(result.final_answer.answer_mode, "product_recommendation")
  assert.equal(result.trace.bounded_repair_kind, "terminal_only")
  assert.equal(result.trace.repair_attempts.length, 1)
  assert.equal(
    result.trace.repair_attempts[0].validation_errors[0].validator_id,
    "visible_payload_not_rendered",
  )
  assert.equal(result.trace.tool_calls.filter((call) => call.name === "select_products").length, 1)
})

test("AgentV2 runtime blocks unknown tool calls", async () => {
  const result = await runAgentV2ResponsesTurn({
    client: fakeResponsesClientWithOutputs([
      functionCall("call_1", "unknown_tool", {}),
      terminalGeneralAdvice("call_2"),
    ]),
    message: "Brauche ich eine Maske?",
    recentMessages: [],
    userContext: { hairProfile: null, routineInventory: [], sessionMemory: [] },
    tools: fakeAgentV2Tools(),
  })

  assert.equal(result.trace.blocked_tool_calls[0].name, "unknown_tool")
  assert.equal(result.trace.blocked_tool_calls[0].reason, "tool_not_allowed")
})

test("AgentV2 runtime rejects duplicate terminal answers", async () => {
  const result = await runAgentV2ResponsesTurn({
    client: fakeResponsesClientWithOutputs([
      [terminalGeneralAdvice("call_1"), terminalGeneralAdvice("call_2")],
    ]),
    message: "Brauche ich eine Maske?",
    recentMessages: [],
    userContext: { hairProfile: null, routineInventory: [], sessionMemory: [] },
    tools: fakeAgentV2Tools(),
  })

  assert.equal(result.trace.failure_stage, "multiple_terminal_answers")
})

test("AgentV2 runtime returns safe fallback when no terminal answer is produced", async () => {
  const result = await runAgentV2ResponsesTurn({
    client: fakeResponsesClientWithOutputs([{ type: "message", content: [] }]),
    message: "Brauche ich eine Maske?",
    recentMessages: [],
    userContext: { hairProfile: null, routineInventory: [], sessionMemory: [] },
    tools: fakeAgentV2Tools(),
  })

  assert.equal(result.trace.failure_stage, "missing_terminal_answer")
  assert.equal(result.final_answer.answer_mode, "clarification")
})

test("AgentV2 runtime keeps restricted safety fallback when no terminal answer is produced", async () => {
  const result = await runAgentV2ResponsesTurn({
    client: fakeResponsesClientWithOutputs([{ type: "message", content: [] }]),
    message: "Meine Kopfhaut juckt und ist gerötet, welches Shampoo soll ich nehmen?",
    recentMessages: [],
    userContext: { hairProfile: null, routineInventory: [], sessionMemory: [] },
    safetyMode: "restricted",
    tools: fakeAgentV2Tools(),
  })

  assert.equal(result.trace.failure_stage, "missing_terminal_answer")
  assert.equal(result.final_answer.answer_mode, "safety_boundary")
  assert.deepEqual(result.final_answer.safety_flags, ["restricted_scalp_symptoms"])
  assert.match(result.final_answer.payload.user_facing_answer_de, /Kopfhaut/)
})

test("AgentV2 runtime preserves active routine context in malformed-output fallback", async () => {
  const result = await runAgentV2ResponsesTurn({
    client: fakeResponsesClientWithOutputs([{ type: "message", content: [] }]),
    message: "Und was ist mit dem ersten Zusatz?",
    recentMessages: [],
    userContext: { hairProfile: null, routineInventory: [], sessionMemory: [] },
    routineThreadContext: {
      active: true,
      current_layer: "basics",
      last_answer_mode: "routine",
      last_routine_categories: ["leave_in"],
      last_user_goal: "Routine vereinfachen",
      summary_de: "Ein erster Zusatz ist sichtbar.",
      visible_steps: [],
    },
    tools: fakeAgentV2Tools(),
  })

  assert.equal(result.trace.failure_stage, "missing_terminal_answer")
  assert.equal(result.final_answer.answer_mode, "clarification")
  assert.equal(result.final_answer.routine_context.active, true)
  assert.equal(result.final_answer.routine_context.routine_layer, "basics")
})

test("AgentV2 runtime repairs assistant text into exactly one terminal answer", async () => {
  const client = fakeResponsesClientWithOutputs([
    {
      type: "message",
      role: "assistant",
      content: [{ type: "output_text", text: "Nimm eher Conditioner als Basis." }],
    },
    terminalGeneralAdvice("call_1"),
  ])

  const result = await runAgentV2ResponsesTurn({
    client,
    message: "Brauche ich eine Maske?",
    recentMessages: [],
    userContext: { hairProfile: null, routineInventory: [], sessionMemory: [] },
    tools: fakeAgentV2Tools(),
  })

  assert.equal(client.requests.length, 2)
  assert.equal(result.final_answer.answer_mode, "general_advice")
  assert.equal(result.trace.failure_stage, null)
  assert.equal(result.trace.repair_attempts.length, 1)
  assert.equal(result.trace.repair_attempts[0].reason, "missing_terminal_answer")
  assert.notEqual(
    result.final_answer.payload.user_facing_answer_de,
    "Nimm eher Conditioner als Basis.",
  )
  const repairInput = getInputItems(client.requests[1])
  assert.ok(
    repairInput.some((item) =>
      String(asRecord(item)?.content ?? "").includes("Nimm eher Conditioner als Basis."),
    ),
  )
})

test("AgentV2 runtime falls back safely if missing-terminal repair also omits terminal tool", async () => {
  const client = fakeResponsesClientWithOutputs([
    {
      type: "message",
      role: "assistant",
      content: [{ type: "output_text", text: "Erste Rohantwort." }],
    },
    {
      type: "message",
      role: "assistant",
      content: [{ type: "output_text", text: "Zweite Rohantwort." }],
    },
  ])

  const result = await runAgentV2ResponsesTurn({
    client,
    message: "Fass mir das kurz zusammen.",
    recentMessages: [],
    userContext: { hairProfile: null, routineInventory: [], sessionMemory: [] },
    tools: fakeAgentV2Tools(),
  })

  assert.equal(client.requests.length, 2)
  assert.equal(result.trace.failure_stage, "missing_terminal_failed")
  assert.equal(result.final_answer.answer_mode, "clarification")
  assert.doesNotMatch(result.final_answer.payload.user_facing_answer_de, /Rohantwort/)
})

test("AgentV2 runtime traces malformed JSON tool arguments", async () => {
  const result = await runAgentV2ResponsesTurn({
    client: fakeResponsesClientWithOutputs([
      rawFunctionCall("call_1", "load_advisor_guidance", "{bad json"),
    ]),
    message: "Brauche ich eine Maske?",
    recentMessages: [],
    userContext: { hairProfile: null, routineInventory: [], sessionMemory: [] },
    tools: fakeAgentV2Tools(),
  })

  assert.equal(result.trace.blocked_tool_calls[0].reason, "invalid_json")
})

test("AgentV2 runtime rejects executable tool calls with missing semantic fields", async () => {
  let selectProductsCalled = false
  const result = await runAgentV2ResponsesTurn({
    client: fakeResponsesClientWithOutputs([
      functionCall("call_1", "select_products", { category: "conditioner" }),
      terminalGeneralAdvice("call_2"),
    ]),
    message: "Brauche ich eine Maske?",
    recentMessages: [],
    userContext: { hairProfile: null, routineInventory: [], sessionMemory: [] },
    tools: {
      ...fakeAgentV2Tools(),
      select_products: async () => {
        selectProductsCalled = true
        return { valid_product_ids: [] }
      },
    },
  })

  assert.equal(selectProductsCalled, false)
  assert.equal(result.trace.blocked_tool_calls[0].name, "select_products")
  assert.equal(result.trace.blocked_tool_calls[0].reason, "invalid_schema")
})

test("AgentV2 runtime rejects malformed guidance tool schemas before adapter execution", async () => {
  let guidanceCalled = false
  const result = await runAgentV2ResponsesTurn({
    client: fakeResponsesClientWithOutputs([
      functionCall("call_1", "load_advisor_guidance", { categories: ["mask"] }),
      terminalGeneralAdvice("call_2"),
    ]),
    message: "Brauche ich eine Maske?",
    recentMessages: [],
    userContext: { hairProfile: null, routineInventory: [], sessionMemory: [] },
    tools: {
      ...fakeAgentV2Tools(),
      load_advisor_guidance: async () => {
        guidanceCalled = true
        return { loaded_package_ids: [] }
      },
    },
  })

  assert.equal(guidanceCalled, false)
  assert.equal(result.trace.blocked_tool_calls[0].name, "load_advisor_guidance")
  assert.equal(result.trace.blocked_tool_calls[0].reason, "invalid_schema")
})

test("AgentV2 runtime ignores reasoning items while preserving them in trace", async () => {
  const result = await runAgentV2ResponsesTurn({
    client: fakeResponsesClientWithOutputs([
      [{ type: "reasoning", id: "rs_1", summary: [] }, terminalGeneralAdvice("call_1")],
    ]),
    message: "Brauche ich eine Maske?",
    recentMessages: [],
    userContext: { hairProfile: null, routineInventory: [], sessionMemory: [] },
    tools: fakeAgentV2Tools(),
  })

  assert.equal(result.final_answer.answer_mode, "general_advice")
  const firstStep = result.trace.model_steps[0] as {
    non_function_items: Array<{ type?: string }>
  }
  assert.equal(firstStep.non_function_items[0].type, "reasoning")
})

test("AgentV2 runtime can carry accepted session memory into the next turn context", async () => {
  const first = await runAgentV2ResponsesTurn({
    client: fakeResponsesClientWithOutputs([
      terminalCall("call_1", {
        ...terminalGeneralAdviceArguments(),
        request_interpretation: requestInterpretation({
          primary_intent: "general_advice",
          product_request_kind: "none",
          category: "none",
          count_policy: "none",
          evidence_quote: "Bitte nichts Schweres.",
        }),
        session_memory_writes: [
          {
            type: "preference",
            text: "User prefers lightweight products in this session.",
            evidence_quote: "Bitte nichts Schweres.",
            confidence: 0.9,
            ttl: "session",
            affects_recommendations: true,
            expires_at_turn: null,
          },
        ],
      }),
    ]),
    message: "Bitte nichts Schweres.",
    recentMessages: [],
    userContext: { hairProfile: null, routineInventory: [], sessionMemory: [] },
    tools: fakeAgentV2Tools(),
  })

  const second = await runAgentV2ResponsesTurn({
    client: fakeResponsesClientWithOutputs([terminalGeneralAdvice("call_2")]),
    message: "Und was heisst das fuer Conditioner?",
    recentMessages: [],
    userContext: {
      hairProfile: null,
      routineInventory: [],
      sessionMemory: first.accepted_session_memory_writes,
    },
    tools: fakeAgentV2Tools(),
  })

  assert.equal(second.trace.injected_session_memory.length, 1)
})

test("AgentV2 runtime drops invalid session memory without using repair turn", async () => {
  const client = fakeResponsesClientWithOutputs([
    terminalCall("call_1", {
      ...terminalGeneralAdviceArguments(),
      session_memory_writes: [
        {
          type: "preference",
          text: "User has a durable hair texture.",
          evidence_quote: "nicht gesagt",
          confidence: 0.8,
          ttl: "session",
          affects_recommendations: true,
          expires_at_turn: null,
        },
      ],
    }),
  ])

  const result = await runAgentV2ResponsesTurn({
    client,
    message: "Brauche ich eine Maske?",
    recentMessages: [],
    userContext: { hairProfile: null, routineInventory: [], sessionMemory: [] },
    tools: fakeAgentV2Tools(),
  })

  assert.equal(client.requests.length, 1)
  assert.equal(result.final_answer.answer_mode, "general_advice")
  assert.equal(result.accepted_session_memory_writes.length, 0)
  assert.equal(result.trace.session_memory_writes.length, 0)
  assert.equal(result.trace.dropped_session_memory_writes.length, 1)
  assert.equal(result.trace.repair_attempts.length, 0)
})

test("AgentV2 runtime stores local trace even when Langfuse is unavailable", async () => {
  const result = await runAgentV2ResponsesTurn({
    client: fakeResponsesClientWithOutputs([terminalGeneralAdvice("call_1")]),
    message: "Brauche ich eine Maske?",
    recentMessages: [],
    userContext: { hairProfile: null, routineInventory: [], sessionMemory: [] },
    tools: fakeAgentV2Tools(),
    langfuseMode: "disabled",
  })

  assert.equal(result.trace.engine, "agent_v2")
  assert.equal(result.trace.langfuse.enabled, false)
})

test("AgentV2 runtime rejects hard rule IDs that were not loaded", async () => {
  const result = await runAgentV2ResponsesTurn({
    client: fakeResponsesClientWithOutputs([
      terminalCall("call_1", {
        ...terminalGeneralAdviceArguments(),
        tool_grounding: {
          ...terminalGeneralAdviceArguments().tool_grounding,
          hard_rule_ids: ["missing.rule"],
        },
      }),
      terminalGeneralAdvice("call_2"),
    ]),
    message: "Brauche ich eine Maske?",
    recentMessages: [],
    userContext: { hairProfile: null, routineInventory: [], sessionMemory: [] },
    tools: fakeAgentV2Tools(),
  })

  assert.equal(result.trace.validation_errors.length, 0)
  assert.equal(
    result.trace.repair_attempts[0].validation_errors[0].validator_id,
    "known_hard_rule_ids",
  )
})

test("AgentV2 runtime attempts exactly one repair after validation failure", async () => {
  const client = fakeResponsesClientWithOutputs([
    terminalProductRecommendation("call_1", ["missing_product"]),
    terminalGeneralAdvice("call_2", {
      primary_intent: "general_advice",
      product_request_kind: "none",
      category: "none",
      count_policy: "none",
      evidence_quote: "Welches Produkt passt",
    }),
  ])
  const result = await runAgentV2ResponsesTurn({
    client,
    message: "Welches Produkt passt?",
    recentMessages: [],
    userContext: { hairProfile: null, routineInventory: [], sessionMemory: [] },
    tools: fakeAgentV2Tools(),
  })

  assert.equal(result.trace.repair_attempts.length, 1)
  assert.equal(result.trace.validation_errors.length, 0)
  assert.ok(
    result.trace.repair_attempts[0].validation_errors.some(
      (error) => error.validator_id === "product_tool_required",
    ),
  )
  const repairInput = getInputItems(client.requests[1])
  assert.ok(
    repairInput.some(
      (item) =>
        asRecord(item)?.type === "function_call_output" &&
        asRecord(item)?.call_id === "call_1" &&
        String(asRecord(item)?.output ?? "").includes("terminal_answer_validation_failed") &&
        String(asRecord(item)?.output ?? "").includes("known_product_ids"),
    ),
  )
  assert.ok(
    repairInput.some((item) => String(asRecord(item)?.content ?? "").includes("known_product_ids")),
  )
})

test("AgentV2 runtime returns safe fallback after repair failure", async () => {
  const result = await runAgentV2ResponsesTurn({
    client: fakeResponsesClientWithOutputs([
      terminalProductRecommendation("call_1", ["missing_product"]),
      terminalProductRecommendation("call_2", ["missing_product"]),
    ]),
    message: "Welches Produkt passt?",
    recentMessages: [],
    userContext: { hairProfile: null, routineInventory: [], sessionMemory: [] },
    tools: fakeAgentV2Tools(),
  })

  assert.equal(result.trace.failure_stage, "repair_failed")
  assert.equal(result.final_answer.answer_mode, "general_advice")
  assert.match(result.final_answer.payload.user_facing_answer_de, /keinen sicheren Produkttreffer/)
  assert.doesNotMatch(
    result.final_answer.payload.user_facing_answer_de,
    /known_product_ids|repair_failed|tool/i,
  )
})

test("AgentV2 runtime uses composition fallback when visible payload repair fails", async () => {
  const products = [
    { product_id: "prod_1", name: "Test Conditioner" },
    { product_id: "prod_2", name: "Second Conditioner" },
  ]
  const result = await runAgentV2ResponsesTurn({
    client: fakeResponsesClientWithOutputs([
      functionCall("call_1", "select_products", {
        ...selectProductsArguments({
          requested_product_count: 2,
          count_policy: "exact",
          evidence_quote: "zwei passende Conditioner",
        }),
      }),
      terminalPartiallyRenderedProductRecommendation("call_2", products),
      terminalPartiallyRenderedProductRecommendation("call_3", products),
    ]),
    message: "Vergleich mir bitte zwei passende Conditioner für feines Haar.",
    recentMessages: [],
    userContext: { hairProfile: null, routineInventory: [], sessionMemory: [] },
    tools: {
      ...fakeAgentV2Tools(),
      select_products: async () => ({
        valid_product_ids: products.map((product) => product.product_id),
        products,
      }),
    },
  })

  assert.equal(result.trace.failure_stage, "repair_failed")
  assert.equal(result.final_answer.answer_mode, "clarification")
  assert.match(result.final_answer.payload.user_facing_answer_de, /nicht sauber zusammensetzen/)
  assert.doesNotMatch(
    result.final_answer.payload.user_facing_answer_de,
    /visible_payload_not_rendered|repair_failed|tool/i,
  )
})

test("AgentV2 runtime uses routine ambiguity fallback when routine step repair fails", async () => {
  const result = await runAgentV2ResponsesTurn({
    client: fakeResponsesClientWithOutputs([
      terminalRoutineProductDeepDiveWithStep("call_1", ["prod_1"], "unknown_step"),
      terminalRoutineProductDeepDiveWithStep("call_2", ["prod_1"], "unknown_step"),
    ]),
    message: "Welches Produkt passt fuer den ersten Zusatz?",
    recentMessages: [],
    userContext: { hairProfile: null, routineInventory: [], sessionMemory: [] },
    priorSelectedProductProjections: [
      {
        valid_product_ids: ["prod_1"],
        products: [projectedProduct("prod_1", "Test Leave-in")],
      },
    ],
    routineThreadContext: {
      active: true,
      current_layer: "basics",
      last_answer_mode: "routine",
      last_routine_categories: ["leave_in"],
      last_user_goal: "Routine vereinfachen",
      summary_de: "Ein erster Zusatz ist sichtbar.",
      visible_steps: [],
    },
    tools: fakeAgentV2Tools(),
  })

  assert.equal(result.trace.failure_stage, "repair_failed")
  assert.equal(result.final_answer.answer_mode, "clarification")
  assert.equal(result.final_answer.routine_context.active, true)
  assert.match(result.final_answer.payload.user_facing_answer_de, /Meinst du mit dem Zusatz/)
  assert.doesNotMatch(
    result.final_answer.payload.user_facing_answer_de,
    /known_routine_step_ids|repair_failed|tool/i,
  )
})

test("AgentV2 runtime enforces model step and executable tool budgets", async () => {
  const result = await runAgentV2ResponsesTurn({
    client: fakeResponsesClientWithOutputs(
      Array.from({ length: 8 }, (_, index) =>
        functionCall(`call_${index + 1}`, "load_advisor_guidance", {
          answer_mode_hint: "general_advice",
          categories: ["mask"],
          routine_layer: null,
          safety_mode: "normal",
        }),
      ),
    ),
    message: "Brauche ich eine Maske?",
    recentMessages: [],
    userContext: { hairProfile: null, routineInventory: [], sessionMemory: [] },
    tools: fakeAgentV2Tools(),
    policyOverrides: { max_model_steps: 2, max_executable_tool_calls: 1 },
  })

  assert.ok(
    result.trace.failure_stage === "max_model_steps" ||
      result.trace.failure_stage === "max_executable_tool_calls",
  )
})

test("AgentV2 hard short circuit bypasses model and product tools", async () => {
  const result = await runAgentV2ResponsesTurn({
    client: fakeResponsesClientThatThrowsIfCalled(),
    message: "Meine Kopfhaut blutet und Haare fallen in Buescheln aus.",
    recentMessages: [],
    userContext: { hairProfile: null, routineInventory: [], sessionMemory: [] },
    tools: {
      load_advisor_guidance: async () => {
        throw new Error("guidance should not be called")
      },
      select_products: async () => {
        throw new Error("products should not be called")
      },
      build_or_fix_routine: async () => {
        throw new Error("routine should not be called")
      },
    },
    safetyMode: "hard_short_circuit",
  })

  assert.equal(result.final_answer.answer_mode, "safety_boundary")
  assert.equal(result.trace.safety_mode, "hard_short_circuit")
  assert.equal(result.trace.model_steps.length, 0)
  assert.equal(result.trace.tool_calls.length, 0)
})
