import assert from "node:assert/strict"
import test from "node:test"

import { buildAgenticToolDefinitions } from "../src/lib/agent/orchestrator/tool-definitions"
import { AGENTIC_TOOL_LOOP_PROMPT } from "../src/lib/agent/orchestrator/prompt"
import { isGuidanceId } from "../src/lib/agent/contracts"
import { buildAgenticConsultationBrief } from "../src/lib/agent/orchestrator/agentic-consultation-brief"
import { extractCurrentTurnContextOverlay } from "../src/lib/agent/orchestrator/current-turn-context"
import type {
  AgenticTerminalAnswer,
  AgenticToolLoopModelClient,
  AgenticToolLoopModelStep,
  AgenticToolName,
} from "../src/lib/agent/orchestrator/agentic-tool-loop-types"
import { runAgenticToolTurn } from "../src/lib/agent/orchestrator/run-agentic-tool-turn"
import { projectRoutinePlan } from "../src/lib/agent/tools/build-or-fix-routine"
import { createDefaultConversationState } from "../src/lib/chat-runtime/conversation-state"
import type { UserContextProjection } from "../src/lib/agent/tools/get-user-context"
import type { SelectedProductsProjection } from "../src/lib/agent/tools/select-products"
import type { ConversationState } from "../src/lib/types"

const VISIBLE_FAILURE_ANSWER =
  "Entschuldige, ich konnte deine Frage gerade nicht eindeutig genug einordnen. Formulier sie bitte noch einmal etwas konkreter, dann helfe ich dir direkt weiter."

type FakeStep =
  | {
      type: "tool_calls"
      calls: Array<{ id?: string; name: string; input: Record<string, unknown> }>
    }
  | { type: "message"; content: string }
  | { type: "final"; answer: string; statePatch?: Record<string, unknown>; productIds?: unknown[] }

class FakeModelClient implements AgenticToolLoopModelClient {
  readonly requests: Parameters<AgenticToolLoopModelClient["runStep"]>[0][] = []
  readonly composeRequests: Parameters<
    NonNullable<AgenticToolLoopModelClient["composeFinalAnswer"]>
  >[0][] = []
  private index = 0

  constructor(
    private readonly steps: FakeStep[],
    private readonly composedAnswer?: string,
  ) {}

  async runStep(
    params: Parameters<AgenticToolLoopModelClient["runStep"]>[0],
  ): Promise<AgenticToolLoopModelStep> {
    this.requests.push(params)
    const step = this.steps[this.index++]
    if (!step) {
      throw new Error("Fake model step exhausted")
    }

    if (step.type === "message") {
      return {
        type: "message",
        content: step.content,
      }
    }

    if (step.type === "final") {
      return {
        type: "tool_calls",
        calls: [
          {
            id: `final-${this.index}`,
            name: "submit_final_answer",
            input: {
              answer: step.answer,
              product_ids: step.productIds ?? [],
              state_patch: createStatePatch(step.statePatch),
            },
          },
        ],
      }
    }

    return {
      type: "tool_calls",
      calls: step.calls.map((call, index) => ({
        id: call.id ?? `call-${this.index}-${index + 1}`,
        name: call.name,
        input: call.input,
      })),
    }
  }

  async composeFinalAnswer(
    params: Parameters<NonNullable<AgenticToolLoopModelClient["composeFinalAnswer"]>>[0],
  ): Promise<string> {
    this.composeRequests.push(params)
    return this.composedAnswer ?? params.draftAnswer
  }
}

function createStatePatch(
  overrides: Record<string, unknown> = {},
): AgenticTerminalAnswer["state_patch"] {
  return {
    active_topic: null,
    routine_layer: null,
    last_product_category: null,
    last_assistant_action: "answered",
    topic_relation: "unclear",
    reason: "Terminale Test-Aktualisierung.",
    ...overrides,
  } as AgenticTerminalAnswer["state_patch"]
}

function createUserContext(overrides: Partial<UserContextProjection> = {}): UserContextProjection {
  return {
    profile: null,
    routine_inventory: [],
    relevant_memory: [],
    derived_signals: ["Haardicke: fein", "Kopfhaut: schnell fettend"],
    suggested_overlays: [],
    missing_profile: [],
    ...overrides,
  }
}

function createShampooProjection(): SelectedProductsProjection {
  return {
    category: "shampoo",
    decision: "recommended",
    product_response_policy: "recommend",
    policy_reason: "Passende Shampoo-Auswahl.",
    profile_basis: ["Haardicke: fein", "Kopfhaut: schnell fettend"],
    category_guidance: "Shampoo vor allem auf der Kopfhaut verwenden.",
    products: [
      {
        rank: 1,
        product_id: "shampoo-1",
        name: "Test Shampoo",
        brand: "Testmarke",
        price_eur: 19,
        currency: "EUR",
        fit_reason: "Passt zur Kopfhaut.",
        caveat: null,
        supported_claims: [],
        unsupported_requested_signals: [],
      },
    ],
    comparison_facts: null,
    missing_info: [],
    unsupported_requested_signals: [],
  }
}

function createConditionerProjection(): SelectedProductsProjection {
  return {
    category: "conditioner",
    decision: "recommended",
    product_response_policy: "recommend",
    policy_reason: "Passende Conditioner-Auswahl.",
    profile_basis: ["Haardicke: fein", "Protein-/Feuchtigkeitsbalance: Proteinmangel"],
    category_guidance: "Conditioner ist der Pflegeanker nach jeder Waesche.",
    products: [
      {
        rank: 1,
        product_id: "conditioner-1",
        name: "Test Conditioner",
        brand: "Testmarke",
        price_eur: 9,
        currency: "EUR",
        fit_reason: "Passt zu Pflegebedarf und Gewicht.",
        caveat: null,
        supported_claims: [
          {
            field: "weight",
            value: "light",
            evidence: "product_spec",
            label: "leicht",
          },
        ],
        unsupported_requested_signals: [],
      },
    ],
    comparison_facts: {
      weight: ["Test Conditioner: leicht"],
    },
    missing_info: [],
    unsupported_requested_signals: [],
  }
}

function createLeaveInProjection(): SelectedProductsProjection {
  return {
    category: "leave_in",
    decision: "recommended",
    product_response_policy: "recommend",
    policy_reason: "Leave-in passt als Booster.",
    profile_basis: ["Haardicke: Fein", "Leave-in-Rolle im Profil: Nur als Booster"],
    category_guidance: "Leave-in ist ein Booster fuer Laengen und Spitzen.",
    products: [],
    comparison_facts: null,
    missing_info: [],
    unsupported_requested_signals: [],
  }
}

function createAdvisorGuidanceProjection() {
  return {
    loaded_guidance_ids: ["playbook:compare_or_decide", "topic:shampoo"],
    direct_answer_frame: "Compare the requested category with the better care lever.",
    key_advice_points: ["Use product guidance only when it changes the answer."],
    profile_interpretation: ["The current profile context is enough for a conceptual answer."],
    category_implications: ["Shampoo is not always the main lever for dry lengths."],
    avoid: ["Do not force a product recommendation when a category is weak."],
    proactive_next_step_options: ["Offer the stronger next step."],
  }
}

function createRoutineState(overrides: Partial<ConversationState> = {}): ConversationState {
  return {
    ...createDefaultConversationState(),
    active_topic: "routine",
    routine_layer: "basics",
    last_assistant_action: "answered_routine_basics",
    ...overrides,
  }
}

test("current-turn extractor detects explicit minimal routine and saved-routine conflict", () => {
  const overlay = extractCurrentTurnContextOverlay({
    message: "Ich habe nur Shampoo und Conditioner. Was sollte ich als naechstes ergaenzen?",
    savedProfile: {
      current_routine_products: ["shampoo", "conditioner", "mask", "oil"],
    },
  })

  assert.deepEqual(overlay.routine_products?.value, ["shampoo", "conditioner"])
  assert.equal(overlay.routine_products?.conflicts_with_saved, true)
  assert.deepEqual(overlay.routine_products?.saved_value, ["shampoo", "conditioner", "mask", "oil"])
  assert.match(overlay.routine_products?.evidence ?? "", /nur Shampoo und Conditioner/i)
})

test("current-turn extractor captures direct care signals without inventing reset", () => {
  const overlay = extractCurrentTurnContextOverlay({
    message:
      "Ich habe lockiges Haar, Frizz und verknotete Spitzen. Was waere der naechste sinnvollste Schritt?",
    savedProfile: null,
  })

  assert.ok(
    overlay.active_concerns.some(
      (signal) => signal.field === "hair_texture" && signal.value === "curly",
    ),
  )
  assert.ok(
    overlay.active_concerns.some(
      (signal) => signal.field === "concerns" && signal.value === "frizz",
    ),
  )
  assert.ok(
    overlay.active_concerns.some(
      (signal) => signal.field === "concerns" && signal.value === "tangling",
    ),
  )
  assert.deepEqual(overlay.safety_overlay_ids, [])
})

test("current-turn scalp context preserves dandruff and irritation together", () => {
  const overlay = extractCurrentTurnContextOverlay({
    message: "Meine Kopfhaut juckt und ich habe Schuppen.",
    recentMessages: [],
    savedProfile: null,
  })

  assert.ok(
    overlay.active_concerns.some(
      (signal) => signal.field === "scalp_condition" && signal.value === "irritated",
    ),
  )
  assert.ok(
    overlay.active_concerns.some(
      (signal) => signal.field === "scalp_condition" && signal.value === "dandruff",
    ),
  )
})

test("current-turn extractor does not treat category comparisons as routine inventory", () => {
  const overlay = extractCurrentTurnContextOverlay({
    message: "Ich habe trockene Spitzen. Maske oder Oel?",
    savedProfile: {
      current_routine_products: ["shampoo", "conditioner"],
    },
  })

  assert.equal(overlay.routine_products, null)
  assert.ok(
    overlay.active_concerns.some(
      (signal) => signal.field === "concerns" && signal.value === "dryness",
    ),
  )
})

test("current-turn extractor does not treat nur-wissen category phrasing as inventory", () => {
  const overlay = extractCurrentTurnContextOverlay({
    message: "Ich will nur wissen: Maske oder Oel?",
    savedProfile: {
      current_routine_products: ["shampoo", "conditioner"],
    },
  })

  assert.equal(overlay.routine_products, null)
})

test("current-turn extractor does not mark absent saved routine as a conflict", () => {
  const overlay = extractCurrentTurnContextOverlay({
    message: "Ich habe nur Shampoo und Conditioner.",
    savedProfile: null,
  })

  assert.deepEqual(overlay.routine_products?.value, ["shampoo", "conditioner"])
  assert.equal(overlay.routine_products?.conflicts_with_saved, false)
  assert.deepEqual(overlay.routine_products?.saved_value, [])
})

test("consultation brief distinguishes conceptual leave-in interest from product selection", async () => {
  const brief = await buildAgenticConsultationBrief({
    message: "ja ich habe gehoert leave in soll gut sein",
    recentMessages: [{ role: "assistant", content: "Wir passen deine Routine an." }],
    userContext: createUserContext({
      profile: {
        hair_texture: "straight",
        thickness: "fine",
        goals: ["shine"],
        current_routine_products: ["shampoo", "conditioner"],
      } as NonNullable<UserContextProjection["profile"]>,
      suggested_overlays: ["overlay:fine_hair"],
    }),
    conversationState: createRoutineState({ active_topic: "routine", routine_layer: "basics" }),
  })

  assert.equal(brief.charter.length > 0, true)
  assert.equal(brief.product_vs_education.length > 0, true)
  assert.ok(brief.candidate_guidance.some((item) => item.id === "topic:leave_in"))
  assert.ok(brief.profile_overlays.some((item) => item.id === "overlay:fine_hair"))
  assert.ok(brief.candidate_guidance.every((item) => item.content.length <= 1200))
})

test("consultation brief includes routine staging for broad routine requests", async () => {
  const brief = await buildAgenticConsultationBrief({
    message: "ich moechte meine routine anpassen",
    recentMessages: [],
    userContext: createUserContext(),
    conversationState: null,
  })

  assert.ok(brief.routine_staging.some((line) => /shampoo/i.test(line)))
  assert.ok(brief.routine_staging.some((line) => /conditioner/i.test(line)))
  assert.ok(brief.routine_staging.some((line) => /highest-impact extra lever/i.test(line)))
  assert.ok(brief.routine_staging.some((line) => /goals or problems/i.test(line)))
  assert.ok(brief.candidate_guidance.some((item) => item.id === "playbook:build_or_fix_routine"))
})

test("consultation brief treats broad additional-products questions as routine basics context", async () => {
  const brief = await buildAgenticConsultationBrief({
    message: "andere produkte zusaetzlich zu shampoo?",
    recentMessages: [],
    userContext: createUserContext({
      profile: {
        hair_texture: "straight",
        thickness: "fine",
        current_routine_products: ["shampoo"],
      } as NonNullable<UserContextProjection["profile"]>,
    }),
    conversationState: null,
  })

  assert.ok(brief.candidate_guidance.some((item) => item.id === "playbook:build_or_fix_routine"))
  assert.ok(brief.routine_staging.some((line) => /conditioner/i.test(line)))
})

test("consultation brief treats broad what-else-to-add questions as routine basics context", async () => {
  const germanBrief = await buildAgenticConsultationBrief({
    message: "was sollte ich noch hinzufügen?",
    recentMessages: [],
    userContext: createUserContext({
      profile: {
        hair_texture: "straight",
        thickness: "fine",
        current_routine_products: ["shampoo"],
      } as NonNullable<UserContextProjection["profile"]>,
    }),
    conversationState: null,
  })
  const englishBrief = await buildAgenticConsultationBrief({
    message: "what else should I add?",
    recentMessages: [],
    userContext: createUserContext({
      profile: {
        hair_texture: "straight",
        thickness: "fine",
        current_routine_products: ["shampoo"],
      } as NonNullable<UserContextProjection["profile"]>,
    }),
    conversationState: null,
  })

  assert.ok(
    germanBrief.candidate_guidance.some((item) => item.id === "playbook:build_or_fix_routine"),
  )
  assert.ok(germanBrief.routine_staging.some((line) => /goals or problems/i.test(line)))
  assert.ok(
    englishBrief.candidate_guidance.some((item) => item.id === "playbook:build_or_fix_routine"),
  )
})

test("agentic tool-loop prompt routes broad additional-products questions to routine basics", () => {
  assert.match(AGENTIC_TOOL_LOOP_PROMPT, /zusaetzlich zu Shampoo/i)
  assert.match(AGENTIC_TOOL_LOOP_PROMPT, /hinzufuegen/i)
  assert.match(AGENTIC_TOOL_LOOP_PROMPT, /what else should I add/i)
  assert.match(AGENTIC_TOOL_LOOP_PROMPT, /build_or_fix_routine mit layer="basics"/i)
  assert.match(AGENTIC_TOOL_LOOP_PROMPT, /load_advisor_guidance.*konzeptuelle/i)
  assert.match(AGENTIC_TOOL_LOOP_PROMPT, /answer_context.*Beratungshilfe/i)
})

test("agentic tool-loop prompt requires structured helpful rendering", () => {
  assert.match(AGENTIC_TOOL_LOOP_PROMPT, /kurze Einordnung/i)
  assert.match(AGENTIC_TOOL_LOOP_PROMPT, /klar struktur/i)
  assert.match(AGENTIC_TOOL_LOOP_PROMPT, /genau einen.*naechsten Schritt/i)
  assert.match(AGENTIC_TOOL_LOOP_PROMPT, /Fallback.*nie/i)
  assert.match(AGENTIC_TOOL_LOOP_PROMPT, /Nach einem select_products-Tool/i)
  assert.match(AGENTIC_TOOL_LOOP_PROMPT, /nicht.*zusaetzlich.*load_advisor_guidance/i)
})

test("agentic prompt asks for multi-category guidance on category comparisons", () => {
  assert.match(AGENTIC_TOOL_LOOP_PROMPT, /categories\[\].*alle explizit genannten Kategorien/i)
  assert.match(AGENTIC_TOOL_LOOP_PROMPT, /advisor_guidance\.category_sections/i)
  assert.match(AGENTIC_TOOL_LOOP_PROMPT, /Maske oder Oel/i)
})

test("consultation brief includes shampoo candidate context for explicit shampoo asks", async () => {
  const brief = await buildAgenticConsultationBrief({
    message: "welches shampoo kannst du fuer mehr glanz empfehlen",
    recentMessages: [],
    userContext: createUserContext(),
    conversationState: null,
  })

  assert.ok(brief.candidate_guidance.some((item) => item.id === "topic:shampoo"))
  assert.ok(brief.product_vs_education.some((line) => /recommend with caveat/i.test(line)))
  assert.ok(brief.product_vs_education.some((line) => /Explicit product ask/i.test(line)))
})

test("consultation brief includes candidate guidance for oil, bondbuilder, and deep cleansing", async () => {
  const cases = [
    {
      message: "Soll ich Haaroel als Finish oder Pre-Wash nehmen?",
      expected: "topic:hair_oiling",
    },
    {
      message: "K18 oder OLAPLEX, welcher Bondbuilder passt?",
      expected: "topic:bond_builder",
    },
    {
      message: "Brauche ich ein Tiefenreinigungsshampoo gegen Build-up?",
      expected: "topic:deep_cleansing",
    },
  ] as const

  for (const { message, expected } of cases) {
    const brief = await buildAgenticConsultationBrief({
      message,
      recentMessages: [],
      userContext: createUserContext(),
      conversationState: null,
    })

    assert.ok(
      brief.candidate_guidance.some((item) => item.id === expected),
      message,
    )
  }
})

test(
  "consultation brief includes dry shampoo candidate guidance",
  { skip: !isGuidanceId("topic:dry_shampoo") && "topic:dry_shampoo is owned by guidance worker" },
  async () => {
    const brief = await buildAgenticConsultationBrief({
      message: "Ist Trockenshampoo sinnvoll zwischen Waeschen?",
      recentMessages: [],
      userContext: createUserContext(),
      conversationState: null,
    })

    assert.ok(brief.candidate_guidance.some((item) => item.id === "topic:dry_shampoo"))
  },
)

test(
  "consultation brief includes peeling candidate guidance",
  { skip: !isGuidanceId("topic:peeling") && "topic:peeling is owned by guidance worker" },
  async () => {
    const brief = await buildAgenticConsultationBrief({
      message: "Brauche ich ein Kopfhautpeeling bei Build-up?",
      recentMessages: [],
      userContext: createUserContext(),
      conversationState: null,
    })

    assert.ok(brief.candidate_guidance.some((item) => item.id === "topic:peeling"))
  },
)

test("consultation brief understands German category synonyms", async () => {
  const brief = await buildAgenticConsultationBrief({
    message: "brauche ich eher eine Spülung oder eine Haarkur?",
    recentMessages: [],
    userContext: createUserContext(),
    conversationState: null,
  })

  assert.ok(brief.candidate_guidance.some((item) => item.id === "topic:conditioner"))
  assert.ok(brief.candidate_guidance.some((item) => item.id === "topic:mask"))
})

test("consultation brief derives category guidance from active product state", async () => {
  const brief = await buildAgenticConsultationBrief({
    message: "ja bitte",
    recentMessages: [{ role: "assistant", content: "Leave-in kann als Booster passen." }],
    userContext: createUserContext(),
    conversationState: createRoutineState({
      active_topic: "leave_in",
      routine_layer: null,
      last_product_category: "leave_in",
    }),
  })

  assert.ok(brief.candidate_guidance.some((item) => item.id === "topic:leave_in"))
})

test("consultation brief derives category guidance from last product category", async () => {
  const brief = await buildAgenticConsultationBrief({
    message: "ja bitte",
    recentMessages: [{ role: "assistant", content: "Wir haben ueber den Conditioner gesprochen." }],
    userContext: createUserContext(),
    conversationState: createRoutineState({
      active_topic: "routine",
      routine_layer: "deep_dive",
      last_product_category: "conditioner",
    }),
  })

  assert.ok(brief.candidate_guidance.some((item) => item.id === "topic:conditioner"))
})

test("tool-loop sends consultation brief before the model chooses tools", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "final",
      answer:
        "Ja, Leave-in kann sinnvoll sein, aber ich wuerde es bei feinem Haar leicht und sparsam testen.",
      statePatch: {
        active_topic: "routine",
        routine_layer: "deep_dive",
        topic_relation: "same_topic",
      },
    },
  ])

  const result = await runAgenticToolTurn({
    message: "ja ich habe gehoert leave in soll gut sein",
    recentMessages: [{ role: "assistant", content: "Wir passen deine Routine an." }],
    modelClient,
    tools: {
      select_products: async () => createLeaveInProjection(),
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
    userContext: createUserContext({
      profile: {
        thickness: "fine",
        goals: ["shine"],
        current_routine_products: ["shampoo", "conditioner"],
      } as NonNullable<UserContextProjection["profile"]>,
      suggested_overlays: ["overlay:fine_hair"],
    }),
    conversationState: createRoutineState({ active_topic: "routine", routine_layer: "basics" }),
    answerCompositionMode: "inline_context",
  })

  const firstRequest = modelClient.requests[0]
  assert.ok(firstRequest)
  const serialized = JSON.stringify(firstRequest.messages)
  assert.match(serialized, /consultation_brief/)
  assert.match(serialized, /Educate before recommending products/i)
  assert.match(serialized, /topic:leave_in/)
  assert.match(serialized, /overlay:fine_hair/)
  assert.equal(result.tool_calls.length, 0)
  assert.match(JSON.stringify(result.trace.consultation_brief), /topic:leave_in/)
})

test("tool-loop accepts an explicit null consultation brief for baseline runs", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "final",
      answer: "Ja, ich kann das kurz einordnen.",
      statePatch: {
        active_topic: "routine",
        routine_layer: "deep_dive",
        topic_relation: "same_topic",
      },
    },
  ])

  const result = await runAgenticToolTurn({
    message: "ja ich habe gehoert leave in soll gut sein",
    recentMessages: [{ role: "assistant", content: "Wir passen deine Routine an." }],
    modelClient,
    tools: {
      select_products: async () => createLeaveInProjection(),
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
    userContext: createUserContext(),
    conversationState: createRoutineState({ active_topic: "routine", routine_layer: "basics" }),
    consultationBrief: null,
  })

  const firstRequest = modelClient.requests[0]
  assert.ok(firstRequest)
  const firstPayload = firstRequest.messages[0]?.content
  if (typeof firstPayload !== "string") {
    throw new Error("Expected first model payload to be a JSON string")
  }
  const parsedPayload = JSON.parse(firstPayload) as { consultation_brief?: unknown }
  assert.equal(parsedPayload.consultation_brief, null)
  assert.doesNotMatch(firstPayload, /topic:leave_in/)
  assert.equal(result.trace.consultation_brief, null)
})

test("tool-loop asks select_products for an active-routine typoed shampoo ask", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "tool_calls",
      calls: [{ name: "select_products", input: { category: "shampoo" } }],
    },
    {
      type: "final",
      answer: "Nimm als Shampoo zuerst das Test Shampoo.",
      statePatch: {
        active_topic: "routine",
        last_product_category: null,
        topic_relation: "same_topic",
      },
    },
  ])
  const toolInputs: Record<AgenticToolName, Record<string, unknown>[]> = {
    load_advisor_guidance: [],
    select_products: [],
    build_or_fix_routine: [],
    submit_final_answer: [],
  }
  const shampooProjection = createShampooProjection()

  const result = await runAgenticToolTurn({
    message: "ok und welcges shampoo insbesondere sollte ich verwenden",
    recentMessages: [{ role: "assistant", content: "Deine Basisroutine steht." }],
    modelClient,
    tools: {
      select_products: async (input) => {
        toolInputs.select_products.push(input)
        return shampooProjection
      },
      build_or_fix_routine: async (input) => {
        toolInputs.build_or_fix_routine.push(input)
        return { objective: null, steps: [], missing_info: [], confidence: 0 }
      },
    },
    userContext: createUserContext(),
    conversationState: createRoutineState(),
  })

  assert.equal(toolInputs.select_products.length, 1)
  assert.equal(toolInputs.select_products[0]?.category, "shampoo")
  assert.equal(result.final_answer, "Nimm als Shampoo zuerst das Test Shampoo.")
  assert.equal(result.selected_products?.products[0]?.name, "Test Shampoo")
  assert.equal(result.state_transition.next_state.active_topic, "shampoo")
  assert.equal(result.state_transition.next_state.last_product_category, "shampoo")
  assert.equal(result.state_transition.classifier_override, null)
  assert.equal(result.state_transition.updated_by_engine, "tool_loop")
})

test("tool-loop surfaces only terminal product IDs backed by selected products", async () => {
  const withProductsModel = new FakeModelClient([
    {
      type: "tool_calls",
      calls: [{ name: "select_products", input: { category: "shampoo" } }],
    },
    {
      type: "final",
      answer: "Diese drei Produkte wuerde ich zeigen.",
      productIds: [" shampoo-2 ", "conditioner-1", "", "shampoo-1", "shampoo-3", "shampoo-4"],
      statePatch: { active_topic: "shampoo", last_product_category: "shampoo" },
    },
  ])
  const shampooProjection = createShampooProjection()
  const [firstProduct] = shampooProjection.products
  assert.ok(firstProduct)

  const withProductsResult = await runAgenticToolTurn({
    message: "welche Produkte passen?",
    recentMessages: [],
    modelClient: withProductsModel,
    tools: {
      select_products: async () => ({
        ...shampooProjection,
        products: [
          firstProduct,
          {
            ...firstProduct,
            rank: 2,
            product_id: "shampoo-2",
            name: "Zweites Test Shampoo",
          },
          {
            ...firstProduct,
            rank: 3,
            product_id: "shampoo-3",
            name: "Drittes Test Shampoo",
          },
          {
            ...firstProduct,
            rank: 4,
            product_id: "shampoo-4",
            name: "Viertes Test Shampoo",
          },
        ],
      }),
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
    userContext: createUserContext(),
    conversationState: null,
  })

  assert.deepEqual(withProductsResult.surfaced_product_ids, ["shampoo-2", "shampoo-1", "shampoo-3"])

  const withoutProductsModel = new FakeModelClient([
    {
      type: "tool_calls",
      calls: [
        {
          name: "submit_final_answer",
          input: {
            answer: "Keine Produktkarten.",
            product_ids: ["shampoo-1"],
            state_patch: createStatePatch(),
          },
        },
      ],
    },
  ])

  const withoutProductsResult = await runAgenticToolTurn({
    message: "erklaer mir das kurz",
    recentMessages: [],
    modelClient: withoutProductsModel,
    tools: {
      select_products: async () => createShampooProjection(),
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
    userContext: createUserContext(),
    conversationState: null,
  })

  assert.deepEqual(withoutProductsResult.surfaced_product_ids, [])
})

test("tool-loop treats direct need-category wording as concrete product intent", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "tool_calls",
      calls: [{ name: "select_products", input: { category: "shampoo" } }],
    },
    {
      type: "final",
      answer: "Ich wuerde dir zuerst dieses Shampoo zeigen.",
      statePatch: {
        active_topic: "shampoo",
        last_product_category: "shampoo",
        topic_relation: "same_topic",
      },
      productIds: ["shampoo-1"],
    },
  ])
  let selectProductCalls = 0

  const result = await runAgenticToolTurn({
    message: "Ich brauche ein Shampoo",
    recentMessages: [],
    modelClient,
    tools: {
      select_products: async () => {
        selectProductCalls += 1
        return createShampooProjection()
      },
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
        priority_context: null,
      }),
    },
    userContext: createUserContext(),
    conversationState: null,
  })

  assert.equal(selectProductCalls, 1)
  assert.equal(result.selected_products?.category, "shampoo")
  assert.deepEqual(result.surfaced_product_ids, ["shampoo-1"])
  assert.ok(!result.trace.guardrails.includes("conceptual_category_curiosity"))
})

test("tool-loop blocks select_products for conceptual category curiosity", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "tool_calls",
      calls: [{ name: "select_products", input: { category: "leave_in" } }],
    },
    {
      type: "final",
      answer:
        "Ja, Leave-in kann sinnvoll sein: Es bleibt im Haar und gibt Laengen und Spitzen etwas mehr Pflege. Bei feinem Haar wuerde ich es leicht dosieren; wenn du willst, kann ich danach passende Optionen aussuchen.",
      statePatch: {
        active_topic: "routine",
        routine_layer: "deep_dive",
        topic_relation: "same_topic",
      },
    },
  ])
  let selectProductCalls = 0

  const result = await runAgenticToolTurn({
    message: "ja ich habe gehoert leave in soll gut sein",
    recentMessages: [{ role: "assistant", content: "Wir passen deine Routine an." }],
    modelClient,
    tools: {
      select_products: async () => {
        selectProductCalls += 1
        return createLeaveInProjection()
      },
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
        priority_context: null,
      }),
    },
    userContext: createUserContext({
      profile: {
        thickness: "fine",
        goals: ["shine"],
        current_routine_products: ["shampoo", "conditioner"],
      } as NonNullable<UserContextProjection["profile"]>,
    }),
    conversationState: createRoutineState({ active_topic: "routine", routine_layer: "basics" }),
  })

  assert.equal(selectProductCalls, 0)
  assert.equal(
    result.tool_calls.some((call) => call.name === "select_products"),
    false,
  )
  assert.equal(result.selected_products, null)
  assert.deepEqual(result.trace.blocked_tool_calls, [
    {
      id: "call-1-1",
      name: "select_products",
      reason: "conceptual_category_curiosity",
    },
  ])
  assert.ok(result.trace.guardrails.includes("conceptual_category_curiosity"))
  assert.equal(
    result.final_answer,
    "Ja, Leave-in kann sinnvoll sein: Es bleibt im Haar und gibt Laengen und Spitzen etwas mehr Pflege. Bei feinem Haar wuerde ich es leicht dosieren; wenn du willst, kann ich danach passende Optionen aussuchen.",
  )
})

test("tool-loop blocks select_products for conceptual category role questions", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "tool_calls",
      calls: [{ name: "select_products", input: { category: "leave_in" } }],
    },
    {
      type: "final",
      answer:
        "Leave-in kann in deiner Routine als leichter Booster Sinn ergeben, aber ich wuerde zuerst Rolle und Dosierung klaeren.",
      statePatch: {
        active_topic: "routine",
        routine_layer: "deep_dive",
        topic_relation: "same_topic",
      },
    },
  ])
  let selectProductCalls = 0

  const result = await runAgenticToolTurn({
    message: "welche Vorteile bringt Leave-in?",
    recentMessages: [{ role: "assistant", content: "Wir passen deine Routine an." }],
    modelClient,
    tools: {
      select_products: async () => {
        selectProductCalls += 1
        return createLeaveInProjection()
      },
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
        priority_context: null,
      }),
    },
    userContext: createUserContext(),
    conversationState: createRoutineState({ active_topic: "routine", routine_layer: "basics" }),
  })

  assert.equal(selectProductCalls, 0)
  assert.equal(result.selected_products, null)
  assert.deepEqual(result.trace.blocked_tool_calls, [
    {
      id: "call-1-1",
      name: "select_products",
      reason: "conceptual_category_curiosity",
    },
  ])
})

test("tool-loop blocks select_products for category-level comparisons with product-like wording", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "tool_calls",
      calls: [{ name: "select_products", input: { category: "mask" } }],
    },
    {
      type: "final",
      answer:
        "Ich wuerde zuerst die Rollen vergleichen: Maske ist Zusatzpflege, Oel eher Finish oder Pre-Wash.",
      statePatch: {
        active_topic: "mask",
        last_product_category: "mask",
        topic_relation: "same_topic",
      },
    },
  ])
  let selectProductCalls = 0

  const result = await runAgenticToolTurn({
    message: "Soll ich Maske oder Oel nehmen?",
    recentMessages: [],
    modelClient,
    tools: {
      select_products: async () => {
        selectProductCalls += 1
        return createLeaveInProjection()
      },
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
        priority_context: null,
      }),
    },
    userContext: createUserContext(),
    conversationState: null,
  })

  assert.equal(selectProductCalls, 0)
  assert.equal(result.selected_products, null)
  assert.deepEqual(result.trace.blocked_tool_calls, [
    {
      id: "call-1-1",
      name: "select_products",
      reason: "conceptual_category_curiosity",
    },
  ])
})

test("tool-loop blocks select_products for category option comparisons", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "tool_calls",
      calls: [{ name: "select_products", input: { category: "mask" } }],
    },
    {
      type: "final",
      answer: "Als Kategorie ist eine Maske eher Zusatzpflege, Oel eher Finish oder Pre-Wash.",
      statePatch: {
        active_topic: "mask",
        last_product_category: "mask",
        topic_relation: "same_topic",
      },
    },
  ])
  let selectProductCalls = 0

  const result = await runAgenticToolTurn({
    message: "Welche Option ist besser: Maske oder Oel?",
    recentMessages: [],
    modelClient,
    tools: {
      select_products: async () => {
        selectProductCalls += 1
        return createLeaveInProjection()
      },
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
        priority_context: null,
      }),
    },
    userContext: createUserContext(),
    conversationState: null,
  })

  assert.equal(selectProductCalls, 0)
  assert.equal(result.selected_products, null)
  assert.deepEqual(result.trace.blocked_tool_calls, [
    {
      id: "call-1-1",
      name: "select_products",
      reason: "conceptual_category_curiosity",
    },
  ])
})

test("tool-loop still allows concrete product asks with category-comparison wording", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "tool_calls",
      calls: [{ name: "select_products", input: { category: "mask" } }],
    },
    {
      type: "final",
      answer: "Diese Maske wuerde ich nehmen.",
      statePatch: {
        active_topic: "mask",
        last_product_category: "mask",
        topic_relation: "same_topic",
      },
    },
  ])
  let selectProductCalls = 0

  const result = await runAgenticToolTurn({
    message: "Welche Maske ist besser als Oel?",
    recentMessages: [],
    modelClient,
    tools: {
      select_products: async () => {
        selectProductCalls += 1
        return { ...createLeaveInProjection(), category: "mask" }
      },
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
        priority_context: null,
      }),
    },
    userContext: createUserContext(),
    conversationState: null,
  })

  assert.equal(selectProductCalls, 1)
  assert.equal(result.trace.blocked_tool_calls.length, 0)
  assert.equal(result.selected_products?.category, "mask")
})

test("tool-loop can load advisor guidance for conceptual category answers without selecting products", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "tool_calls",
      calls: [
        {
          name: "load_advisor_guidance",
          input: {
            intent: "usage",
            category: "leave_in",
            profileFocus: ["fine_hair"],
          },
        },
      ],
    },
    {
      type: "final",
      answer:
        "Leave-in ist bei dir ein optionaler Booster fuer Laengen und Spitzen. Ich wuerde es sparsam nach dem Waschen testen und danach entscheiden, ob du konkrete Optionen sehen moechtest.",
      statePatch: {
        active_topic: "leave_in",
        routine_layer: null,
        topic_relation: "same_topic",
      },
    },
  ])
  let advisorCalls = 0
  let selectProductCalls = 0

  const result = await runAgenticToolTurn({
    message: "wann wuerde ich leave-in verwenden?",
    recentMessages: [],
    modelClient,
    tools: {
      load_advisor_guidance: async (input) => {
        advisorCalls += 1
        assert.equal(input.intent, "usage")
        assert.equal(input.category, "leave_in")
        assert.deepEqual(input.profileFocus, ["fine_hair"])
        return {
          loaded_guidance_ids: ["playbook:usage_and_application", "topic:leave_in"],
          direct_answer_frame: "Explain when and how leave in fits into the routine.",
          key_advice_points: ["Use after washing, sparingly, in lengths and ends."],
          profile_interpretation: ["Fine hair needs light dosage."],
          category_implications: ["Leave-in is a lengths and finish step."],
          avoid: ["Do not frame it as mandatory."],
          proactive_next_step_options: ["Offer product picks as a next step."],
        }
      },
      select_products: async () => {
        selectProductCalls += 1
        return createLeaveInProjection()
      },
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
        priority_context: null,
      }),
    },
    userContext: createUserContext({ suggested_overlays: ["overlay:fine_hair"] }),
    answerCompositionMode: "inline_context",
  })

  assert.equal(advisorCalls, 1)
  assert.equal(selectProductCalls, 0)
  assert.equal(result.selected_products, null)
  assert.equal(result.advisor_guidance?.loaded_guidance_ids[1], "topic:leave_in")
  assert.deepEqual(
    result.tool_calls.map((call) => call.name),
    ["load_advisor_guidance"],
  )
  assert.deepEqual(
    result.trace.tool_calls.map((call) => call.name),
    ["load_advisor_guidance"],
  )
  assert.equal(
    result.final_answer,
    "Leave-in ist bei dir ein optionaler Booster fuer Laengen und Spitzen. Ich wuerde es sparsam nach dem Waschen testen und danach entscheiden, ob du konkrete Optionen sehen moechtest.",
  )
})

test("tool-loop injects answer context after advisor guidance", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "tool_calls",
      calls: [
        {
          name: "load_advisor_guidance",
          input: {
            intent: "compare_or_decide",
            categories: ["mask", "oil"],
            profileFocus: ["dry_lengths"],
          },
        },
      ],
    },
    {
      type: "final",
      answer: "In deinem Fall wuerde ich zuerst eine Maske pruefen.",
      statePatch: {
        active_topic: "mask",
        topic_relation: "same_topic",
      },
    },
  ])

  const result = await runAgenticToolTurn({
    message: "Soll ich eine Maske oder Oel nehmen?",
    recentMessages: [],
    modelClient,
    tools: {
      load_advisor_guidance: async () => ({
        loaded_guidance_ids: [
          "playbook:compare_or_decide",
          "playbook:category_comparison",
          "topic:mask",
          "topic:hair_oiling",
        ],
        direct_answer_frame: "Compare mask and oil.",
        key_advice_points: [],
        profile_interpretation: [],
        category_implications: [],
        avoid: [],
        proactive_next_step_options: [],
      }),
      select_products: async () => createLeaveInProjection(),
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
    userContext: createUserContext(),
    conversationState: null,
    answerCompositionMode: "inline_context",
  })

  assert.ok(result.trace.answer_context?.capsule_ids.includes("category.conceptual_topology"))
  assert.match(
    JSON.stringify(modelClient.requests.at(-1)?.messages),
    /in deinem Fall eher X zuerst/,
  )
})

test("tool-loop sends projected current-turn profile to advisor guidance", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "tool_calls",
      calls: [
        {
          name: "load_advisor_guidance",
          input: {
            intent: "compare_or_decide",
            categories: ["mask", "oil"],
            profileFocus: ["dry_lengths", "frizz_control"],
          },
        },
      ],
    },
    {
      type: "final",
      answer: "Maske und Oel haben unterschiedliche Rollen.",
      statePatch: {
        active_topic: "mask",
        topic_relation: "same_topic",
      },
    },
  ])
  let advisorProfileConcerns: unknown = null

  await runAgenticToolTurn({
    message: "Ich habe Frizz und trockene Laengen. Maske oder Oel?",
    recentMessages: [],
    modelClient,
    tools: {
      load_advisor_guidance: async (input) => {
        const userContext = input.userContext as UserContextProjection
        advisorProfileConcerns = userContext.profile?.concerns
        return {
          loaded_guidance_ids: [
            "playbook:compare_or_decide",
            "playbook:category_comparison",
            "topic:mask",
            "topic:hair_oiling",
            "overlay:dry_lengths",
            "overlay:frizz_control",
          ],
          direct_answer_frame: "Compare mask and oil.",
          key_advice_points: [],
          profile_interpretation: [],
          category_implications: [],
          avoid: [],
          proactive_next_step_options: [],
        }
      },
      select_products: async () => createLeaveInProjection(),
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
    userContext: createUserContext({
      profile: {
        concerns: [],
      } as unknown as NonNullable<UserContextProjection["profile"]>,
    }),
    conversationState: null,
  })

  assert.deepEqual([...(advisorProfileConcerns as string[])].sort(), ["dryness", "frizz"])
})

test("current-turn concerns keep augment semantics for product tools", async () => {
  const toolInputs: Array<Record<string, unknown>> = []
  const modelClient = new FakeModelClient([
    { type: "tool_calls", calls: [{ name: "select_products", input: { category: "leave_in" } }] },
    {
      type: "final",
      answer: "Ein Leave-in kann bei Frizz helfen.",
      statePatch: { active_topic: "leave_in", last_product_category: "leave_in" },
    },
  ])

  await runAgenticToolTurn({
    message: "Meine Haare haben Frizz, welches Leave-in passt?",
    recentMessages: [],
    userContext: createUserContext(),
    conversationState: createDefaultConversationState(),
    modelClient,
    tools: {
      select_products: async (input) => {
        toolInputs.push(input as Record<string, unknown>)
        return createLeaveInProjection()
      },
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
  })

  const activeSignals = toolInputs[0]?.activeProfileSignals as
    | Array<{ value: string; selection_effect: string }>
    | undefined
  assert.ok(
    activeSignals?.some(
      (signal) => signal.value === "frizz" && signal.selection_effect === "augment",
    ),
  )
})

test("tool-loop still selects products for an explicit leave-in ask", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "tool_calls",
      calls: [{ name: "select_products", input: { category: "leave_in" } }],
    },
    {
      type: "final",
      answer: "Fuer dich passt ein leichtes Leave-in am besten.",
      statePatch: {
        active_topic: "leave_in",
        routine_layer: null,
        last_product_category: "leave_in",
        topic_relation: "same_topic",
      },
    },
  ])
  const toolInputs: Record<AgenticToolName, Record<string, unknown>[]> = {
    load_advisor_guidance: [],
    select_products: [],
    build_or_fix_routine: [],
    submit_final_answer: [],
  }

  const result = await runAgenticToolTurn({
    message: "ok welcher leave-in passt?",
    recentMessages: [
      {
        role: "assistant",
        content: "Leave-in kann sinnvoll sein, wenn du mehr Pflege in Laengen und Spitzen willst.",
      },
    ],
    modelClient,
    tools: {
      select_products: async (input) => {
        toolInputs.select_products.push(input)
        return createLeaveInProjection()
      },
      build_or_fix_routine: async (input) => {
        toolInputs.build_or_fix_routine.push(input)
        return {
          objective: null,
          steps: [],
          missing_info: [],
          confidence: 0,
          priority_context: null,
        }
      },
    },
    userContext: createUserContext(),
    conversationState: createRoutineState({ active_topic: "routine", routine_layer: "deep_dive" }),
  })

  assert.equal(toolInputs.select_products.length, 1)
  assert.equal(toolInputs.select_products[0]?.category, "leave_in")
  assert.equal(result.selected_products?.category, "leave_in")
  assert.equal(result.tool_calls[0]?.name, "select_products")
  assert.equal(result.trace.blocked_tool_calls.length, 0)
})

test("tool-loop can select bondbuilder products for explicit supported category asks", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "tool_calls",
      calls: [{ name: "select_products", input: { category: "bondbuilder" } }],
    },
    {
      type: "final",
      answer: "Ich wuerde Bondbuilder als gezielten Zusatz einordnen.",
      statePatch: {
        active_topic: "bondbuilder",
        routine_layer: null,
        last_product_category: "bondbuilder",
        topic_relation: "same_topic",
      },
    },
  ])
  const toolInputs: Record<AgenticToolName, Record<string, unknown>[]> = {
    load_advisor_guidance: [],
    select_products: [],
    build_or_fix_routine: [],
    submit_final_answer: [],
  }

  const result = await runAgenticToolTurn({
    message: "K18 oder OLAPLEX, was passt?",
    recentMessages: [],
    modelClient,
    tools: {
      select_products: async (input) => {
        toolInputs.select_products.push(input)
        return {
          ...createLeaveInProjection(),
          category: "bondbuilder",
          profile_basis: ["Bondbuilder optional bei strukturellem Schaden."],
          category_guidance: "Bondbuilder ist ein gezielter Reparaturzusatz.",
        }
      },
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
        priority_context: null,
      }),
    },
    userContext: createUserContext(),
    conversationState: null,
  })

  assert.equal(toolInputs.select_products.length, 1)
  assert.equal(toolInputs.select_products[0]?.category, "bondbuilder")
  assert.equal(result.selected_products?.category, "bondbuilder")
  assert.equal(result.state_transition.next_state.active_topic, "bondbuilder")
  assert.equal(result.state_transition.next_state.last_product_category, "bondbuilder")
})

test("tool-loop infers current-turn density for follow-up product tools", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "tool_calls",
      calls: [
        {
          name: "select_products",
          input: {
            category: "leave_in",
            activeProfileSignals: [
              {
                field: "density",
                value: "medium",
                source: "message",
                selection_effect: "qualifier",
                evidence: "User mentioned medium hair density.",
              },
            ],
          },
        },
      ],
    },
    {
      type: "final",
      answer: "Mit mittlerer Dichte kann ich Leave-ins passend einordnen.",
      statePatch: {
        active_topic: "leave_in",
        routine_layer: null,
        last_product_category: "leave_in",
        topic_relation: "same_topic",
      },
    },
  ])
  const toolInputs: Record<AgenticToolName, Record<string, unknown>[]> = {
    load_advisor_guidance: [],
    select_products: [],
    build_or_fix_routine: [],
    submit_final_answer: [],
  }

  await runAgenticToolTurn({
    message: "mittlere dichte",
    recentMessages: [{ role: "assistant", content: "Welche Dichte haben deine Haare?" }],
    modelClient,
    tools: {
      select_products: async (input) => {
        toolInputs.select_products.push(input)
        return createLeaveInProjection()
      },
      build_or_fix_routine: async (input) => {
        toolInputs.build_or_fix_routine.push(input)
        return {
          objective: null,
          steps: [],
          missing_info: [],
          confidence: 0,
          priority_context: null,
        }
      },
    },
    userContext: createUserContext(),
    conversationState: createRoutineState({
      active_topic: "leave_in",
      routine_layer: null,
      last_product_category: "leave_in",
    }),
  })

  const activeSignals = toolInputs.select_products[0]?.activeProfileSignals
  assert.ok(Array.isArray(activeSignals))
  assert.deepEqual(activeSignals[0], {
    field: "density",
    value: "medium",
    source: "message",
    selection_effect: "override",
    evidence: "mittlere Dichte",
  })
})

test("tool-loop does not use the conceptual curiosity guard for oil", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "tool_calls",
      calls: [{ name: "select_products", input: { category: "oil" } }],
    },
    {
      type: "final",
      answer: "Fuer Oel brauche ich zuerst den Zweck: Pre-Wash oder Finish?",
      statePatch: {
        active_topic: "oil",
        routine_layer: null,
        last_product_category: "oil",
        topic_relation: "same_topic",
      },
    },
  ])
  const toolInputs: Record<AgenticToolName, Record<string, unknown>[]> = {
    load_advisor_guidance: [],
    select_products: [],
    build_or_fix_routine: [],
    submit_final_answer: [],
  }

  const result = await runAgenticToolTurn({
    message: "ich habe gehoert oel soll gut sein",
    recentMessages: [{ role: "assistant", content: "Wir passen deine Routine an." }],
    modelClient,
    tools: {
      select_products: async (input) => {
        toolInputs.select_products.push(input)
        return {
          ...createLeaveInProjection(),
          category: "oil",
          decision: "needs_more_info",
          missing_info: [
            {
              key: "oil_purpose",
              label: "Oel-Zweck",
              why_it_matters: "Pre-Wash und Finish-Oel sind unterschiedliche Rollen.",
              blocking: true,
              expected_type: "pre_wash | finish",
            },
          ],
        }
      },
      build_or_fix_routine: async (input) => {
        toolInputs.build_or_fix_routine.push(input)
        return {
          objective: null,
          steps: [],
          missing_info: [],
          confidence: 0,
          priority_context: null,
        }
      },
    },
    userContext: createUserContext(),
    conversationState: createRoutineState({ active_topic: "routine", routine_layer: "deep_dive" }),
  })

  assert.equal(toolInputs.select_products.length, 1)
  assert.equal(toolInputs.select_products[0]?.category, "oil")
  assert.equal(result.trace.blocked_tool_calls.length, 0)
  assert.equal(result.selected_products?.category, "oil")
})

test("tool-loop budgets recent messages from the newest context", async () => {
  const recentMessages = Array.from({ length: 8 }, (_, index) => ({
    role: index % 2 === 0 ? ("user" as const) : ("assistant" as const),
    content: `turn-${index + 1} ${"x".repeat(590)}`,
  }))
  const modelClient = new FakeModelClient([
    {
      type: "final",
      answer: "Ich nutze den neuesten Kontext.",
      statePatch: {
        active_topic: "routine",
        routine_layer: "deep_dive",
        topic_relation: "same_topic",
      },
    },
  ])

  await runAgenticToolTurn({
    message: "und was heisst das jetzt?",
    recentMessages,
    modelClient,
    tools: {
      select_products: async () => createLeaveInProjection(),
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
        priority_context: null,
      }),
    },
    userContext: createUserContext(),
    conversationState: createRoutineState({ active_topic: "routine", routine_layer: "deep_dive" }),
  })

  const firstPayload = modelClient.requests[0]?.messages[0]?.content
  if (typeof firstPayload !== "string") {
    throw new Error("Expected first model payload to be a JSON string")
  }
  const parsedPayload = JSON.parse(firstPayload) as {
    recent_messages: Array<{ content: string }>
  }
  const serializedRecentMessages = JSON.stringify(parsedPayload.recent_messages)

  assert.match(serializedRecentMessages, /turn-8/)
  assert.doesNotMatch(serializedRecentMessages, /turn-1/)
})

test("tool-loop does not select products for a pure usage follow-up", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "final",
      answer: "Benutze es bei jeder Waesche nur auf der Kopfhaut.",
      statePatch: {
        active_topic: "shampoo",
        last_product_category: "shampoo",
        topic_relation: "same_topic",
      },
    },
  ])
  let selectProductCalls = 0

  const result = await runAgenticToolTurn({
    message: "wie oft soll ich das Shampoo benutzen?",
    recentMessages: [{ role: "assistant", content: "Ich empfehle dir Test Shampoo." }],
    modelClient,
    tools: {
      select_products: async () => {
        selectProductCalls += 1
        return createShampooProjection()
      },
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
    userContext: createUserContext(),
    conversationState: createRoutineState({
      active_topic: "shampoo",
      routine_layer: null,
      last_product_category: "shampoo",
    }),
  })

  assert.equal(selectProductCalls, 0)
  assert.equal(result.final_answer, "Benutze es bei jeder Waesche nur auf der Kopfhaut.")
  assert.equal(result.state_transition.next_state.active_topic, "shampoo")
})

test("tool-loop injects answer context after product tools in inline mode", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "tool_calls",
      calls: [
        {
          name: "select_products",
          input: { category: "conditioner", userJob: "product_pick" },
        },
      ],
    },
    {
      type: "final",
      answer: "Das ist die natuerliche Conditioner-Antwort.",
      statePatch: {
        active_topic: "conditioner",
        last_product_category: "conditioner",
        topic_relation: "same_topic",
      },
    },
  ])

  const result = await runAgenticToolTurn({
    message: "was fuer einen conditioner brauche ich",
    recentMessages: [],
    modelClient,
    tools: {
      select_products: async () => createConditionerProjection(),
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
    userContext: createUserContext(),
    conversationState: null,
    answerCompositionMode: "inline_context",
  })

  const serializedMessages = JSON.stringify(modelClient.requests.at(-1)?.messages)
  assert.match(serializedMessages, /answer_context/)
  assert.match(serializedMessages, /category.conditioner.recommend/)
  assert.match(serializedMessages, /selected_products\.profile_basis/)
  assert.match(serializedMessages, /products\[\*\]\.supported_claims/)
  assert.match(serializedMessages, /comparison_facts/)
  assert.match(serializedMessages, /category_guidance/)
  assert.match(serializedMessages, /beste erste Wahl/i)
  assert.match(serializedMessages, /einen sinnvollen Unterschied pro Produkt/i)
  assert.deepEqual(result.trace.answer_context?.capsule_ids.slice(0, 3), [
    "global.natural_consultant",
    "product.recommendation_shape",
    "category.conditioner.recommend",
  ])
})

test("tool-loop routes prior product explanation followups through product facts", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "tool_calls",
      calls: [
        {
          name: "load_advisor_guidance",
          input: {
            intent: "product_context",
            category: "conditioner",
            categories: ["conditioner"],
          },
        },
      ],
    },
    {
      type: "final",
      answer:
        "Die proteinlastige Richtung kommt aus deiner Protein-Feuchtigkeits-Balance und dem Conditioner-Fit.",
      statePatch: {
        active_topic: "conditioner",
        last_product_category: "conditioner",
        topic_relation: "same_topic",
      },
    },
  ])
  const toolInputs: Record<string, unknown>[] = []

  const result = await runAgenticToolTurn({
    message: "warum schlaegst du proteinlastige conditioner vor?",
    recentMessages: [
      {
        role: "assistant",
        content: "Ich wuerde dir diese Conditioner empfehlen: Test Conditioner als erste Wahl.",
      },
    ],
    modelClient,
    tools: {
      load_advisor_guidance: async () => {
        throw new Error("load_advisor_guidance should be rerouted to select_products")
      },
      select_products: async (input) => {
        toolInputs.push(input)
        return createConditionerProjection()
      },
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
    userContext: createUserContext(),
    conversationState: createRoutineState({
      active_topic: "conditioner",
      routine_layer: null,
      last_product_category: "conditioner",
      last_assistant_action: "product_recommendation",
    }),
    answerCompositionMode: "inline_context",
  })

  assert.deepEqual(
    result.tool_calls.map((call) => call.name),
    ["select_products"],
  )
  assert.equal(toolInputs[0]?.category, "conditioner")
  assert.ok(
    result.trace.answer_context?.capsule_ids.includes("product.explain_prior_recommendation"),
  )
})

test("tool-loop projects explicit current routine inventory into routine tool input", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "tool_calls",
      calls: [
        {
          name: "build_or_fix_routine",
          input: { objective: "fix_routine", layer: "basics" },
        },
      ],
    },
    {
      type: "final",
      answer: "Dann ist Leave-in der naechste sinnvolle Schritt.",
      statePatch: {
        active_topic: "routine",
        routine_layer: "basics",
        topic_relation: "same_topic",
      },
    },
  ])
  let receivedRoutineProducts: unknown = null

  await runAgenticToolTurn({
    message: "Ich habe nur Shampoo und Conditioner. Was sollte ich als naechstes ergaenzen?",
    recentMessages: [],
    modelClient,
    tools: {
      select_products: async () => createConditionerProjection(),
      build_or_fix_routine: async (input) => {
        const hairProfile = input.hairProfile as { current_routine_products?: unknown } | null
        receivedRoutineProducts = hairProfile?.current_routine_products
        return {
          objective: null,
          steps: [],
          missing_info: [],
          confidence: 1,
          priority_context: null,
        }
      },
    },
    userContext: createUserContext({
      profile: {
        thickness: "fine",
        hair_texture: "straight",
        current_routine_products: ["shampoo", "conditioner", "mask", "oil"],
      } as NonNullable<UserContextProjection["profile"]>,
    }),
    conversationState: null,
  })

  assert.deepEqual(receivedRoutineProducts, ["shampoo", "conditioner"])
})

test("tool-loop carries recent scalp facts into anaphoric routine followups", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "tool_calls",
      calls: [
        {
          name: "build_or_fix_routine",
          input: { objective: "fix_routine", layer: "problems" },
        },
      ],
    },
    {
      type: "final",
      answer:
        "Bis dahin wuerde ich die Kopfhaut moeglichst mild behandeln und Laengenpflege getrennt denken.",
      statePatch: {
        active_topic: "routine",
        routine_layer: "problems",
        topic_relation: "same_topic",
      },
    },
  ])
  let receivedScalpCondition: unknown = null

  const result = await runAgenticToolTurn({
    message: "ok und was kann ich bis dahin in der routine machen?",
    recentMessages: [
      {
        role: "user",
        content: "meine kopfhaut juckt und ich habe schuppen, welches shampoo soll ich nehmen?",
      },
      {
        role: "user",
        content: "eher trockene kleine schueppchen und gereizt",
      },
    ],
    modelClient,
    tools: {
      select_products: async () => createConditionerProjection(),
      build_or_fix_routine: async (input) => {
        const hairProfile = input.hairProfile as { scalp_condition?: unknown } | null
        receivedScalpCondition = hairProfile?.scalp_condition
        return {
          objective: "fix_routine",
          steps: [
            {
              id: "occasional-hair-reset",
              label: "Haar-Reset / Tiefenreinigung",
              action: "add",
              rationale: ["Reset"],
            },
            {
              id: "occasional-mask",
              label: "Maske / Kur",
              action: "add",
              rationale: ["Laengenpflege"],
            },
          ],
          missing_info: [],
          confidence: 0.8,
        }
      },
    },
    userContext: createUserContext({
      profile: {
        scalp_type: "balanced",
        scalp_condition: null,
      } as NonNullable<UserContextProjection["profile"]>,
    }),
    conversationState: createRoutineState({
      active_topic: "shampoo",
      routine_layer: null,
      last_product_category: "shampoo",
    }),
    answerCompositionMode: "inline_context",
  })

  assert.equal(receivedScalpCondition, "dry_flakes")
  assert.ok(result.trace.answer_context?.capsule_ids.includes("routine.scalp_safety"))
  const serializedMessages = JSON.stringify(modelClient.requests.at(-1)?.messages)
  assert.match(serializedMessages, /keine Maske, kein Oel/)
  const toolMessage = modelClient.requests
    .at(-1)
    ?.messages.find((message) => message.role === "tool")
  assert.ok(toolMessage && "content" in toolMessage && typeof toolMessage.content === "string")
  const toolPayload = JSON.parse(toolMessage.content) as { output?: unknown }
  assert.doesNotMatch(JSON.stringify(toolPayload.output), /Haar-Reset|Tiefenreinigung/)
})

test("tool-loop sends supported current-turn scalp and length signals to product selection", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "tool_calls",
      calls: [{ name: "select_products", input: { category: "shampoo" } }],
    },
    {
      type: "final",
      answer: "Nimm ein Shampoo fuer fettige Kopfhaut.",
      statePatch: {
        active_topic: "shampoo",
        last_product_category: "shampoo",
        topic_relation: "same_topic",
      },
    },
  ])
  const selectedInputs: Record<string, unknown>[] = []

  await runAgenticToolTurn({
    message: "Ich habe fettige Kopfhaut und trockene Laengen. Welches Shampoo passt?",
    recentMessages: [],
    modelClient,
    tools: {
      select_products: async (input) => {
        selectedInputs.push(input)
        return createShampooProjection()
      },
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
    userContext: createUserContext({
      profile: {
        scalp_type: "balanced",
        concerns: [],
      } as unknown as NonNullable<UserContextProjection["profile"]>,
    }),
    conversationState: null,
  })

  const selectedInput = selectedInputs[0]
  const activeSignals = selectedInput?.activeProfileSignals as Array<Record<string, unknown>>
  assert.ok(
    activeSignals.some((signal) => signal.field === "scalp_type" && signal.value === "oily"),
  )
  assert.ok(
    activeSignals.some((signal) => signal.field === "concerns" && signal.value === "dryness"),
  )
  assert.deepEqual([...(selectedInput?.concerns as string[])].sort(), ["dry_lengths", "oily_roots"])
})

test("tool-loop current frizz and tangling signals steer routine priority away from reset", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "tool_calls",
      calls: [
        {
          name: "build_or_fix_routine",
          input: { objective: "fix_routine", layer: "basics" },
        },
      ],
    },
    {
      type: "final",
      answer: "Als naechstes wuerde ich einen leichten Leave-in-Hebel testen.",
      statePatch: {
        active_topic: "routine",
        routine_layer: "basics",
        topic_relation: "same_topic",
      },
    },
  ])
  let selectedCategory: string | null = null

  await runAgenticToolTurn({
    message:
      "Ich habe lockiges Haar, Frizz und verknotete Spitzen. Was waere der naechste sinnvollste Schritt?",
    recentMessages: [],
    modelClient,
    tools: {
      select_products: async () => createLeaveInProjection(),
      build_or_fix_routine: async (input) => {
        const projection = projectRoutinePlan({
          hairProfile: input.hairProfile as Parameters<typeof projectRoutinePlan>[0]["hairProfile"],
          message: String(input.message),
          objective: input.objective as Parameters<typeof projectRoutinePlan>[0]["objective"],
          layer: "basics",
        })
        selectedCategory = projection.priority_context?.selected_category ?? null
        return projection
      },
    },
    userContext: createUserContext({
      profile: {
        id: "profile-1",
        user_id: "user-1",
        hair_texture: "straight",
        thickness: "normal",
        hair_length: null,
        density: "medium",
        concerns: [],
        products_used: "Shampoo, Conditioner, Maske, Oel",
        shampoo_frequency: "weekly_3_4x",
        heat_styling: "never",
        styling_tools: [],
        goals: [],
        cuticle_condition: null,
        protein_moisture_balance: null,
        scalp_type: "balanced",
        scalp_condition: null,
        chemical_treatment: ["natural"],
        desired_volume: "balanced",
        routine_preference: "balanced",
        current_routine_products: ["shampoo", "conditioner", "mask", "oil"],
        towel_material: null,
        towel_technique: null,
        drying_method: "air_dry",
        brush_type: null,
        night_protection: [],
        uses_heat_protection: false,
        additional_notes: null,
        conversation_memory: null,
        created_at: "2026-04-22T00:00:00.000Z",
        updated_at: "2026-04-22T00:00:00.000Z",
      } as NonNullable<UserContextProjection["profile"]>,
    }),
    conversationState: null,
  })

  assert.equal(selectedCategory, "leave_in")
})

test("answer context includes current-turn conflict capsule only for conflicting routine inventory", async () => {
  const conflictingModel = new FakeModelClient([
    {
      type: "tool_calls",
      calls: [
        {
          name: "build_or_fix_routine",
          input: { objective: "fix_routine", layer: "basics" },
        },
      ],
    },
    {
      type: "final",
      answer: "Konfliktbewusste Antwort.",
      statePatch: {
        active_topic: "routine",
        routine_layer: "basics",
        topic_relation: "same_topic",
      },
    },
  ])

  const conflictingResult = await runAgenticToolTurn({
    message: "Ich habe nur Shampoo und Conditioner. Was sollte ich als naechstes ergaenzen?",
    recentMessages: [],
    modelClient: conflictingModel,
    tools: {
      select_products: async () => createConditionerProjection(),
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 1,
        priority_context: null,
      }),
    },
    userContext: createUserContext({
      profile: {
        current_routine_products: ["shampoo", "conditioner", "mask"],
      } as NonNullable<UserContextProjection["profile"]>,
    }),
    conversationState: null,
    answerCompositionMode: "inline_context",
  })

  assert.ok(
    conflictingResult.trace.answer_context?.capsule_ids.includes("context.current_turn_conflict"),
  )
  assert.match(JSON.stringify(conflictingModel.requests.at(-1)?.messages), /gespeicherten Profil/)

  const ordinaryModel = new FakeModelClient([
    {
      type: "tool_calls",
      calls: [
        {
          name: "build_or_fix_routine",
          input: { objective: "fix_routine", layer: "basics" },
        },
      ],
    },
    {
      type: "final",
      answer: "Normale Antwort.",
      statePatch: {
        active_topic: "routine",
        routine_layer: "basics",
        topic_relation: "same_topic",
      },
    },
  ])

  const ordinaryResult = await runAgenticToolTurn({
    message: "Ich nutze Shampoo und Conditioner. Was sollte ich als naechstes ergaenzen?",
    recentMessages: [],
    modelClient: ordinaryModel,
    tools: {
      select_products: async () => createConditionerProjection(),
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 1,
        priority_context: null,
      }),
    },
    userContext: createUserContext({
      profile: {
        current_routine_products: ["shampoo", "conditioner"],
      } as NonNullable<UserContextProjection["profile"]>,
    }),
    conversationState: null,
    answerCompositionMode: "inline_context",
  })

  assert.equal(
    ordinaryResult.trace.answer_context?.capsule_ids.includes("context.current_turn_conflict"),
    false,
  )
})

test("answer context asks product-plus-usage turns to answer both parts", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "tool_calls",
      calls: [
        {
          name: "select_products",
          input: { category: "conditioner", userJob: "product_pick" },
        },
      ],
    },
    {
      type: "final",
      answer: "Produkt plus Anwendung.",
      statePatch: {
        active_topic: "conditioner",
        last_product_category: "conditioner",
        topic_relation: "same_topic",
      },
    },
  ])

  await runAgenticToolTurn({
    message: "welcher conditioner ist gut und wie wende ich den an?",
    recentMessages: [],
    modelClient,
    tools: {
      select_products: async () => createConditionerProjection(),
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
    userContext: createUserContext(),
    conversationState: null,
    answerCompositionMode: "inline_context",
  })

  const serializedMessages = JSON.stringify(modelClient.requests.at(-1)?.messages)
  assert.match(serializedMessages, /product\.usage_shape/)
  assert.match(serializedMessages, /welche Option passt/i)
  assert.match(serializedMessages, /wie du sie verwendest/i)
})

test("answer context asks routine basics to anchor existing steps", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "tool_calls",
      calls: [
        {
          name: "build_or_fix_routine",
          input: { objective: "build_routine", layer: "basics" },
        },
      ],
    },
    {
      type: "final",
      answer: "Routineantwort.",
      statePatch: { active_topic: "routine", routine_layer: "basics" },
    },
  ])

  await runAgenticToolTurn({
    message: "wie mache ich meine haare schoener",
    recentMessages: [],
    modelClient,
    tools: {
      select_products: async () => createConditionerProjection(),
      build_or_fix_routine: async () => ({
        objective: "build_routine",
        steps: [
          {
            id: "base-shampoo",
            label: "Shampoo",
            necessity: "core",
            action: "keep",
            category: "shampoo",
            frequency: "Taeglich",
            reasons: ["Nutzer verwendet bereits Shampoo."],
            caveats: [],
            fillable: false,
          },
          {
            id: "base-conditioner",
            label: "Conditioner",
            necessity: "core",
            action: "add",
            category: "conditioner",
            frequency: "Nach jeder Waesche",
            reasons: ["Naechster Pflegeanker."],
            caveats: [],
            fillable: true,
          },
        ],
        missing_info: [],
        confidence: 1,
        priority_context: null,
      }),
    },
    userContext: createUserContext({
      profile: {
        current_routine_products: ["shampoo"],
      } as NonNullable<UserContextProjection["profile"]>,
    }),
    conversationState: null,
    answerCompositionMode: "inline_context",
  })

  const serializedMessages = JSON.stringify(modelClient.requests.at(-1)?.messages)
  assert.match(serializedMessages, /routine\.existing_steps_anchor/)
  assert.match(serializedMessages, /routine\.basics_next_choice/)
  assert.match(serializedMessages, /bereits/i)
  assert.match(serializedMessages, /Ziele/)
  assert.match(serializedMessages, /Probleme/)
  assert.doesNotMatch(serializedMessages, /passende Produkte zeigen/)
})

test("tool-loop blocks redundant advisor guidance after product context exists", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "tool_calls",
      calls: [{ name: "select_products", input: { category: "conditioner" } }],
    },
    {
      type: "tool_calls",
      calls: [
        {
          name: "load_advisor_guidance",
          input: { intent: "usage", category: "conditioner", profileFocus: ["fine_hair"] },
        },
      ],
    },
    {
      type: "final",
      answer: "Nimm den Conditioner und verwende ihn nach jeder Waesche in Laengen und Spitzen.",
      statePatch: {
        active_topic: "conditioner",
        last_product_category: "conditioner",
        topic_relation: "same_topic",
      },
    },
  ])
  let advisorCalls = 0

  const result = await runAgenticToolTurn({
    message: "welchen conditioner soll ich nehmen und wie anwenden?",
    recentMessages: [],
    modelClient,
    tools: {
      load_advisor_guidance: async () => {
        advisorCalls += 1
        return {
          loaded_guidance_ids: [],
          direct_answer_frame: "",
          key_advice_points: [],
          profile_interpretation: [],
          category_implications: [],
          avoid: [],
          proactive_next_step_options: [],
        }
      },
      select_products: async () => createConditionerProjection(),
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
    userContext: createUserContext(),
    conversationState: null,
    answerCompositionMode: "inline_context",
  })

  assert.equal(advisorCalls, 0)
  assert.deepEqual(
    result.tool_calls.map((call) => call.name),
    ["select_products"],
  )
  assert.deepEqual(result.trace.blocked_tool_calls, [
    {
      id: "call-2-1",
      name: "load_advisor_guidance",
      reason: "redundant_advisor_guidance_after_product",
    },
  ])
  assert.ok(result.trace.guardrails.includes("redundant_advisor_guidance_after_product"))
  assert.equal(
    result.final_answer,
    "Nimm den Conditioner und verwende ihn nach jeder Waesche in Laengen und Spitzen.",
  )
})

test("tool-loop blocks redundant advisor guidance after products in baseline mode", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "tool_calls",
      calls: [{ name: "select_products", input: { category: "conditioner" } }],
    },
    {
      type: "tool_calls",
      calls: [
        {
          name: "load_advisor_guidance",
          input: { intent: "usage", category: "conditioner", profileFocus: ["fine_hair"] },
        },
      ],
    },
    {
      type: "final",
      answer: "Nimm den Conditioner, ohne zusaetzliche Beratung nachzuladen.",
      statePatch: {
        active_topic: "conditioner",
        last_product_category: "conditioner",
        topic_relation: "same_topic",
      },
    },
  ])
  let advisorCalls = 0

  const result = await runAgenticToolTurn({
    message: "welchen conditioner soll ich nehmen und wie anwenden?",
    recentMessages: [],
    modelClient,
    tools: {
      load_advisor_guidance: async () => {
        advisorCalls += 1
        return {
          loaded_guidance_ids: [],
          direct_answer_frame: "",
          key_advice_points: [],
          profile_interpretation: [],
          category_implications: [],
          avoid: [],
          proactive_next_step_options: [],
        }
      },
      select_products: async () => createConditionerProjection(),
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
    userContext: createUserContext(),
    conversationState: null,
  })

  assert.equal(advisorCalls, 0)
  assert.equal(result.trace.answer_context, null)
  assert.deepEqual(
    result.tool_calls.map((call) => call.name),
    ["select_products"],
  )
  assert.deepEqual(result.trace.blocked_tool_calls, [
    {
      id: "call-2-1",
      name: "load_advisor_guidance",
      reason: "redundant_advisor_guidance_after_product",
    },
  ])
})

test("advisor guidance can follow weak product results", async () => {
  const weakProjection: SelectedProductsProjection = {
    ...createShampooProjection(),
    decision: "not_recommended",
    product_response_policy: "caution_without_products",
    products: [],
  }
  let guidanceCalls = 0
  const modelClient = new FakeModelClient([
    { type: "tool_calls", calls: [{ name: "select_products", input: { category: "shampoo" } }] },
    {
      type: "tool_calls",
      calls: [
        {
          name: "load_advisor_guidance",
          input: { intent: "compare_or_decide", categories: ["shampoo"] },
        },
      ],
    },
    {
      type: "final",
      answer: "Shampoo ist hier nicht der groesste Hebel.",
      statePatch: { active_topic: "shampoo", last_product_category: "shampoo" },
    },
  ])

  await runAgenticToolTurn({
    message: "Hilft Shampoo gegen trockene Laengen?",
    recentMessages: [],
    userContext: createUserContext(),
    conversationState: createDefaultConversationState(),
    modelClient,
    tools: {
      select_products: async () => weakProjection,
      load_advisor_guidance: async () => {
        guidanceCalls += 1
        return createAdvisorGuidanceProjection()
      },
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
  })

  assert.equal(guidanceCalls, 1)
})

test("tool loop normalizes routine basics state after build_or_fix_routine basics", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "tool_calls",
      calls: [
        {
          name: "build_or_fix_routine",
          input: { objective: "fix_routine", layer: "basics" },
        },
      ],
    },
    {
      type: "final",
      answer: "Basisantwort.",
      statePatch: { active_topic: "routine" },
    },
  ])

  const result = await runAgenticToolTurn({
    message: "wie kann ich meine routine verbessern",
    recentMessages: [],
    modelClient,
    tools: {
      select_products: async () => createConditionerProjection(),
      build_or_fix_routine: async () => ({
        objective: "fix_routine",
        steps: [],
        missing_info: [],
        confidence: 1,
        priority_context: null,
      }),
    },
    userContext: createUserContext(),
    conversationState: null,
    answerCompositionMode: "inline_context",
  })

  assert.equal(result.state_transition.next_state.active_topic, "routine")
  assert.equal(result.state_transition.next_state.routine_layer, "basics")
  assert.equal(result.state_transition.next_state.pending_offer, "routine_goals_or_problems")
  assert.equal(result.state_transition.next_state.last_assistant_action, "answered_routine_basics")
})

test("tool loop does not normalize routine basics state when a later product tool runs", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "tool_calls",
      calls: [
        {
          name: "build_or_fix_routine",
          input: { objective: "fix_routine", layer: "basics" },
        },
        {
          name: "select_products",
          input: { category: "conditioner" },
        },
      ],
    },
    {
      type: "final",
      answer: "Conditionerantwort.",
      statePatch: {
        active_topic: "conditioner",
        last_product_category: "conditioner",
        topic_relation: "same_topic",
      },
    },
  ])

  const result = await runAgenticToolTurn({
    message: "baue meine routine und nenne mir einen conditioner",
    recentMessages: [],
    modelClient,
    tools: {
      select_products: async () => createConditionerProjection(),
      build_or_fix_routine: async () => ({
        objective: "fix_routine",
        steps: [],
        missing_info: [],
        confidence: 1,
        priority_context: null,
      }),
    },
    userContext: createUserContext(),
    conversationState: null,
    answerCompositionMode: "inline_context",
  })

  assert.equal(result.state_transition.next_state.active_topic, "conditioner")
  assert.equal(result.state_transition.next_state.routine_layer, null)
  assert.equal(result.state_transition.next_state.pending_offer, null)
  assert.equal(result.state_transition.next_state.last_product_category, "conditioner")
})

test("tool-loop composer mode rewrites final answer without changing state", async () => {
  const modelClient = new FakeModelClient(
    [
      {
        type: "tool_calls",
        calls: [
          {
            name: "select_products",
            input: { category: "conditioner", userJob: "product_pick" },
          },
        ],
      },
      {
        type: "final",
        answer: "Draft conditioner answer.",
        statePatch: {
          active_topic: "conditioner",
          last_product_category: "conditioner",
          topic_relation: "same_topic",
        },
      },
    ],
    "Composed conditioner answer.",
  )

  const result = await runAgenticToolTurn({
    message: "was fuer einen conditioner brauche ich",
    recentMessages: [],
    modelClient,
    tools: {
      select_products: async () => createConditionerProjection(),
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
    userContext: createUserContext(),
    conversationState: null,
    answerCompositionMode: "composer_context",
  })

  assert.equal(result.final_answer, "Composed conditioner answer.")
  assert.equal(result.state_transition.next_state.active_topic, "conditioner")
  assert.equal(result.trace.answer_composition_mode, "composer_context")
  assert.equal(modelClient.composeRequests.length, 1)
  assert.match(
    JSON.stringify(modelClient.composeRequests[0]?.answerContext),
    /category.conditioner.recommend/,
  )
})

test("tool-loop lets a tool-less topic pivot update state from the terminal patch", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "final",
      answer: "Beim Foehnen ist vor allem Hitzeschutz und Technik wichtig.",
      statePatch: {
        active_topic: null,
        last_product_category: null,
        last_assistant_action: "answered_foehnen_topic",
        topic_relation: "category_switch",
      },
    },
  ])

  const result = await runAgenticToolTurn({
    message: "vergiss das, ich will jetzt was ueber Foehnen wissen",
    recentMessages: [{ role: "assistant", content: "Wir waren beim Shampoo." }],
    modelClient,
    tools: {
      select_products: async () => createShampooProjection(),
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
    userContext: createUserContext(),
    conversationState: createRoutineState({
      active_topic: "shampoo",
      routine_layer: null,
      last_product_category: "shampoo",
    }),
  })

  assert.equal(
    result.tool_calls.some((call) => call.name === "select_products"),
    false,
  )
  assert.equal(
    result.tool_calls.some((call) => call.name === "build_or_fix_routine"),
    false,
  )
  assert.equal(result.final_answer.length > 0, true)
  assert.notEqual(result.state_transition.next_state.active_topic, "shampoo")
  assert.equal(result.state_transition.next_state.last_product_category, null)
})

test("tool-loop blocks and traces unknown tools", async () => {
  const modelClient = new FakeModelClient([
    { type: "tool_calls", calls: [{ name: "load_guidance", input: { ids: [] } }] },
    { type: "final", answer: "Ich beantworte das ohne internes Zusatztool." },
  ])

  const result = await runAgenticToolTurn({
    message: "was ist besser?",
    recentMessages: [],
    modelClient,
    tools: {
      select_products: async () => createShampooProjection(),
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
    userContext: createUserContext(),
    conversationState: null,
  })

  assert.deepEqual(result.trace.blocked_tool_calls, [
    {
      id: "call-1-1",
      name: "load_guidance",
      reason: "tool_not_allowed",
    },
  ])
})

test("tool-loop nudges free-text first responses in-loop and then succeeds", async () => {
  const modelClient = new FakeModelClient([
    { type: "message", content: "Ich wuerde das kurz direkt beantworten." },
    {
      type: "final",
      answer: "Jetzt korrekt als terminale Antwort.",
      statePatch: { active_topic: "routine", topic_relation: "same_topic" },
    },
  ])

  const result = await runAgenticToolTurn({
    message: "was ist besser?",
    recentMessages: [],
    modelClient,
    tools: {
      select_products: async () => createShampooProjection(),
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
    userContext: createUserContext(),
    conversationState: null,
    maxModelSteps: 2,
  })

  assert.equal(result.final_answer, "Jetzt korrekt als terminale Antwort.")
  assert.deepEqual(result.trace.repair_attempts, [])
  assert.equal(result.trace.failure_stage, null)
  assert.equal(result.trace.visible_failure, false)
  assert.match(
    JSON.stringify(modelClient.requests[1]?.messages),
    /Freitext ohne terminales Tool ist nicht gueltig/,
  )
})

test("tool-loop does not accept terminal answers mixed with executable tools", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "tool_calls",
      calls: [
        {
          name: "submit_final_answer",
          input: {
            answer: "Zu frueh.",
            state_patch: createStatePatch({ active_topic: null }),
          },
        },
        { name: "select_products", input: { category: "shampoo" } },
      ],
    },
    {
      type: "final",
      answer: "Jetzt mit Produktauswahl.",
      statePatch: { active_topic: "shampoo", last_product_category: "shampoo" },
    },
  ])

  const result = await runAgenticToolTurn({
    message: "welches Shampoo?",
    recentMessages: [],
    modelClient,
    tools: {
      select_products: async () => createShampooProjection(),
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
    userContext: createUserContext(),
    conversationState: null,
  })

  assert.equal(result.final_answer, "Jetzt mit Produktauswahl.")
  assert.equal(result.tool_calls.length, 1)
  assert.deepEqual(result.trace.blocked_tool_calls[0], {
    id: "call-1-1",
    name: "submit_final_answer",
    reason: "terminal_with_other_tool_calls",
  })
})

test("multiple terminal answers trigger final protocol repair and succeed", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "tool_calls",
      calls: [
        {
          name: "submit_final_answer",
          input: {
            answer: "Erste Antwort.",
            state_patch: createStatePatch({ active_topic: null }),
          },
        },
        {
          name: "submit_final_answer",
          input: {
            answer: "Zweite Antwort.",
            state_patch: createStatePatch({ active_topic: "shampoo" }),
          },
        },
      ],
    },
    {
      type: "final",
      answer: "Reparierte eindeutige Antwort.",
      statePatch: { active_topic: "shampoo", last_product_category: "shampoo" },
      productIds: ["shampoo-1"],
    },
  ])

  const result = await runAgenticToolTurn({
    message: "welches Shampoo?",
    recentMessages: [],
    modelClient,
    tools: {
      select_products: async () => createShampooProjection(),
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
    userContext: createUserContext(),
    conversationState: null,
  })

  assert.equal(result.trace.blocked_tool_calls.length, 2)
  assert.deepEqual(
    result.trace.blocked_tool_calls.map((call) => call.reason),
    ["multiple_terminal_answers", "multiple_terminal_answers"],
  )
  assert.ok(result.trace.guardrails.includes("multiple_terminal_answers"))
  assert.equal(result.final_answer, "Reparierte eindeutige Antwort.")
  assert.deepEqual(result.surfaced_product_ids, [])
  assert.deepEqual(result.trace.repair_attempts, [
    {
      reason: "multiple_terminal_answers",
      instruction_label: "terminal_protocol_repair",
    },
  ])
  assert.equal(result.trace.failure_stage, null)
  assert.equal(result.trace.visible_failure, false)
  assert.match(JSON.stringify(modelClient.requests.at(-1)?.tools), /submit_final_answer/)
  assert.doesNotMatch(JSON.stringify(modelClient.requests.at(-1)?.tools), /select_products/)
})

test("max executable tool-call budget triggers final protocol repair", async () => {
  const modelClient = new FakeModelClient([
    { type: "tool_calls", calls: [{ name: "select_products", input: { category: "shampoo" } }] },
    {
      type: "tool_calls",
      calls: [{ name: "select_products", input: { category: "conditioner" } }],
    },
    {
      type: "final",
      answer: "Reparierte Antwort nach Tool-Budget.",
      statePatch: { active_topic: "shampoo", last_product_category: "shampoo" },
    },
  ])

  const result = await runAgenticToolTurn({
    message: "ich brauche alles",
    recentMessages: [],
    modelClient,
    tools: {
      select_products: async (input) => ({
        ...createShampooProjection(),
        category: input.category,
      }),
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
    userContext: createUserContext(),
    conversationState: null,
    maxExecutableToolCalls: 1,
  })

  assert.equal(result.tool_calls.length, 1)
  assert.equal(result.final_answer, "Reparierte Antwort nach Tool-Budget.")
  assert.ok(result.trace.guardrails.includes("max_executable_tool_calls"))
  assert.deepEqual(result.trace.repair_attempts, [
    {
      reason: "max_executable_tool_calls",
      instruction_label: "terminal_protocol_repair",
    },
  ])
  assert.equal(result.trace.failure_stage, null)
  assert.equal(result.trace.visible_failure, false)
})

test("max model steps triggers final protocol repair", async () => {
  const modelClient = new FakeModelClient([
    { type: "tool_calls", calls: [{ name: "select_products", input: { category: "shampoo" } }] },
    {
      type: "final",
      answer: "Reparierte Antwort nach Max-Steps.",
      statePatch: { active_topic: "shampoo", last_product_category: "shampoo" },
      productIds: ["shampoo-1"],
    },
  ])

  const result = await runAgenticToolTurn({
    message: "welches Shampoo?",
    recentMessages: [],
    modelClient,
    tools: {
      select_products: async () => createShampooProjection(),
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
    userContext: createUserContext(),
    conversationState: null,
    maxModelSteps: 1,
  })

  assert.equal(result.final_answer, "Reparierte Antwort nach Max-Steps.")
  assert.deepEqual(result.surfaced_product_ids, ["shampoo-1"])
  assert.ok(result.trace.guardrails.includes("max_model_steps"))
  assert.deepEqual(result.trace.repair_attempts, [
    {
      reason: "max_model_steps",
      instruction_label: "terminal_protocol_repair",
    },
  ])
  assert.equal(result.trace.failure_stage, null)
  assert.equal(result.trace.visible_failure, false)
})

test("empty terminal answer becomes visible failure with canonical copy", async () => {
  const previousState = createDefaultConversationState()
  const result = await runAgenticToolTurn({
    message: "???",
    recentMessages: [],
    userContext: createUserContext(),
    conversationState: previousState,
    modelClient: new FakeModelClient([
      {
        type: "final",
        answer: "",
        statePatch: { active_topic: null, last_product_category: null },
      },
    ]),
    tools: {
      select_products: async () => createShampooProjection(),
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
  })

  assert.equal(result.trace.visible_failure, true)
  assert.equal(result.final_answer, VISIBLE_FAILURE_ANSWER)
  assert.equal(result.trace.failure_stage, "missing_terminal_answer")
  assert.deepEqual(result.state_transition.previous_state, previousState)
  assert.deepEqual(result.state_transition.next_state, previousState)
  assert.deepEqual(result.state_transition.changed_fields, [])
})

test("failed protocol repair returns visible failure and leaves state unchanged", async () => {
  const previousState = createRoutineState({
    active_topic: "conditioner",
    routine_layer: null,
    last_product_category: "conditioner",
  })
  const modelClient = new FakeModelClient([
    {
      type: "tool_calls",
      calls: [
        {
          name: "submit_final_answer",
          input: {
            answer: "Erste Antwort.",
            product_ids: [],
            state_patch: createStatePatch({ active_topic: null }),
          },
        },
        {
          name: "submit_final_answer",
          input: {
            answer: "Zweite Antwort.",
            product_ids: [],
            state_patch: createStatePatch({ active_topic: "shampoo" }),
          },
        },
      ],
    },
    { type: "tool_calls", calls: [{ name: "select_products", input: { category: "shampoo" } }] },
  ])

  const result = await runAgenticToolTurn({
    message: "welches Shampoo?",
    recentMessages: [],
    modelClient,
    tools: {
      select_products: async () => createShampooProjection(),
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
    userContext: createUserContext(),
    conversationState: previousState,
  })

  assert.equal(result.final_answer, VISIBLE_FAILURE_ANSWER)
  assert.equal(result.trace.visible_failure, true)
  assert.equal(result.trace.failure_stage, "repair_failed")
  assert.deepEqual(result.trace.repair_attempts, [
    {
      reason: "multiple_terminal_answers",
      instruction_label: "terminal_protocol_repair",
    },
  ])
  assert.deepEqual(result.state_transition.previous_state, previousState)
  assert.deepEqual(result.state_transition.next_state, previousState)
  assert.deepEqual(result.state_transition.changed_fields, [])
  assert.deepEqual(result.surfaced_product_ids, [])
})

test("deterministic no_catalog_match does not trigger protocol repair", async () => {
  const modelClient = new FakeModelClient([
    { type: "tool_calls", calls: [{ name: "select_products", input: { category: "shampoo" } }] },
    {
      type: "final",
      answer: "Dafuer habe ich gerade keinen passenden Katalogtreffer.",
      statePatch: { active_topic: "shampoo", last_product_category: "shampoo" },
    },
  ])

  const result = await runAgenticToolTurn({
    message: "welches Shampoo ohne Duftstoffe?",
    recentMessages: [],
    modelClient,
    tools: {
      select_products: async () => ({
        ...createShampooProjection(),
        decision: "no_catalog_match",
        product_response_policy: "no_catalog_match",
        products: [],
      }),
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
    userContext: createUserContext(),
    conversationState: null,
  })

  assert.equal(result.final_answer, "Dafuer habe ich gerade keinen passenden Katalogtreffer.")
  assert.deepEqual(result.trace.repair_attempts, [])
  assert.equal(result.trace.failure_stage, null)
  assert.equal(result.trace.visible_failure, false)
})

test("agentic tool definitions expose strict V1 function tools with optional advisor guidance", () => {
  const tools = buildAgenticToolDefinitions()
  const functionTools = tools.filter((tool) => tool.type === "function")
  const names = functionTools.map((tool) => tool.function.name)

  assert.deepEqual(names, ["select_products", "build_or_fix_routine", "submit_final_answer"])
  assert.equal(names.includes("load_guidance"), false)
  assert.equal(names.includes("get_user_context"), false)

  for (const tool of functionTools) {
    assert.equal(tool.function.strict, true)
    assertStrictObjects(tool.function.parameters)
  }

  const finalTool = functionTools.find((tool) => tool.function.name === "submit_final_answer")
  assert.ok(finalTool)
  const finalParameters = finalTool.function.parameters as {
    required?: string[]
    properties: Record<string, unknown>
  }
  assert.deepEqual(Object.keys(finalParameters.properties), [
    "answer",
    "product_ids",
    "state_patch",
  ])
  assert.deepEqual(finalParameters.required, ["answer", "product_ids", "state_patch"])

  const toolsWithGuidance = buildAgenticToolDefinitions({ includeAdvisorGuidance: true })
  const functionToolsWithGuidance = toolsWithGuidance.filter((tool) => tool.type === "function")
  const namesWithGuidance = functionToolsWithGuidance.map((tool) => tool.function.name)
  assert.deepEqual(namesWithGuidance, [
    "load_advisor_guidance",
    "select_products",
    "build_or_fix_routine",
    "submit_final_answer",
  ])
  const guidanceTool = functionToolsWithGuidance.find(
    (tool) => tool.function.name === "load_advisor_guidance",
  )
  assert.ok(guidanceTool)
  assert.match(guidanceTool.function.description ?? "", /never returns product names/i)
  const guidanceParameters = guidanceTool.function.parameters as {
    required?: string[]
    properties?: Record<string, unknown>
  }
  assert.ok(guidanceParameters.required?.includes("categories"))
  assert.ok(guidanceParameters.properties?.categories)
})

test("terminal final step receives native context without route-shaped packet fields", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "tool_calls",
      calls: [{ name: "select_products", input: { category: "shampoo" } }],
    },
    {
      type: "final",
      answer: "Das Shampoo passt am besten.",
      statePatch: { active_topic: "shampoo", last_product_category: "shampoo" },
    },
  ])

  await runAgenticToolTurn({
    message: "welches Shampoo?",
    recentMessages: [{ role: "assistant", content: "Wir bauen gerade deine Routine." }],
    modelClient,
    tools: {
      select_products: async () => createShampooProjection(),
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
    userContext: createUserContext({
      relevant_memory: [
        {
          id: "memory-1",
          user_id: "user-1",
          kind: "preference",
          content: "Mag kurze Routinen.",
          normalized_key: "preference:mag_kurze_routinen",
          source: "chat",
          source_conversation_id: null,
          evidence: null,
          confidence: 0.8,
          metadata: {},
          status: "active",
          superseded_by: null,
          archived_at: null,
          created_at: "2026-05-05T00:00:00.000Z",
          updated_at: "2026-05-05T00:00:00.000Z",
        },
      ],
    }),
    conversationState: createRoutineState(),
  })

  const finalRequest = modelClient.requests.at(-1)
  assert.ok(finalRequest)
  const serializedMessages = JSON.stringify(finalRequest.messages)

  assert.match(serializedMessages, /welches Shampoo/)
  assert.match(serializedMessages, /Wir bauen gerade deine Routine/)
  assert.match(serializedMessages, /conversation_state/)
  assert.match(serializedMessages, /Haardicke: fein/)
  assert.match(serializedMessages, /Mag kurze Routinen/)
  assert.match(serializedMessages, /selected_products/)
  assert.match(serializedMessages, /answer_current_delta_first/)
  assert.doesNotMatch(serializedMessages, /move_hint/)
  assert.doesNotMatch(serializedMessages, /structured_outputs\.route/)
})

test("tool-loop polishes empty generic final closers", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "final",
      answer:
        "Oel kann als kleiner Finish-Schritt fuer die Spitzen sinnvoll sein. Wenn du weitere Fragen hast, lass es mich wissen!",
      statePatch: {
        active_topic: "oil",
        topic_relation: "same_topic",
      },
    },
  ])

  const result = await runAgenticToolTurn({
    message: "Wie verwende ich Oel?",
    recentMessages: [],
    modelClient,
    tools: {
      select_products: async () => createLeaveInProjection(),
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
    userContext: createUserContext(),
    conversationState: null,
    answerCompositionMode: "inline_context",
  })

  assert.equal(
    result.final_answer,
    "Oel kann als kleiner Finish-Schritt fuer die Spitzen sinnvoll sein.",
  )
})

test("tool-loop replaces vague routine-offer closers with concrete next step", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "final",
      answer:
        "Eine Maske ist fuer deine trockenen Laengen der staerkere Pflegehebel. Wenn du moechtest, kann ich dir helfen, eine einfache Routine mit diesen Produkten zu erstellen.",
      statePatch: {
        active_topic: "routine",
        topic_relation: "same_topic",
      },
    },
  ])

  const result = await runAgenticToolTurn({
    message: "Maske oder Oel?",
    recentMessages: [],
    modelClient,
    tools: {
      select_products: async () => createLeaveInProjection(),
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
    userContext: createUserContext(),
    conversationState: null,
    answerCompositionMode: "inline_context",
  })

  assert.equal(
    result.final_answer,
    "Eine Maske ist fuer deine trockenen Laengen der staerkere Pflegehebel. Als naechsten Schritt koennen wir passende Produkte dafuer auswaehlen.",
  )
})

test("tool-loop removes vague product-integration closers", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "final",
      answer:
        "Bei feinem Haar gehoert Oel nur in die Spitzen und in sehr kleiner Menge. Wenn du weitere Fragen zur Integration dieser Produkte in deine Routine hast, lass es mich wissen!",
      statePatch: {
        active_topic: "oil",
        topic_relation: "same_topic",
      },
    },
  ])

  const result = await runAgenticToolTurn({
    message: "Wie verwende ich Oel bei feinem Haar?",
    recentMessages: [],
    modelClient,
    tools: {
      select_products: async () => createLeaveInProjection(),
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
    userContext: createUserContext(),
    conversationState: null,
    answerCompositionMode: "inline_context",
  })

  assert.equal(
    result.final_answer,
    "Bei feinem Haar gehoert Oel nur in die Spitzen und in sehr kleiner Menge.",
  )
})

test("tool-loop removes combined question-or-product closers", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "final",
      answer:
        "Bei feinem Haar gehoert Oel nur in die Spitzen und in sehr kleiner Menge. Wenn du weitere Fragen hast oder Produktvorschlaege moechtest, lass es mich wissen!",
      statePatch: {
        active_topic: "oil",
        topic_relation: "same_topic",
      },
    },
  ])

  const result = await runAgenticToolTurn({
    message: "Wie verwende ich Oel bei feinem Haar?",
    recentMessages: [],
    modelClient,
    tools: {
      select_products: async () => createLeaveInProjection(),
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
    userContext: createUserContext(),
    conversationState: null,
    answerCompositionMode: "inline_context",
  })

  assert.equal(
    result.final_answer,
    "Bei feinem Haar gehoert Oel nur in die Spitzen und in sehr kleiner Menge.",
  )
})

test("tool-loop replaces interest-in-product-suggestion closers", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "final",
      answer:
        "Maske und Oel sind nicht ausgeschlossen; ich wuerde sie nur als zweite Ebene einordnen. Wenn du Interesse an spezifischen Produktvorschlaegen fuer Masken oder Oele hast, lass es mich wissen, und ich kann dir passende Optionen empfehlen.",
      statePatch: {
        active_topic: "routine",
        topic_relation: "same_topic",
      },
    },
  ])

  const result = await runAgenticToolTurn({
    message: "aber maske und oel nicht dazu?",
    recentMessages: [],
    modelClient,
    tools: {
      select_products: async () => createLeaveInProjection(),
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
    userContext: createUserContext(),
    conversationState: {
      ...createDefaultConversationState(),
      active_topic: "leave_in",
      last_product_category: "leave_in",
      last_assistant_action: "product_recommendation",
    },
    answerCompositionMode: "inline_context",
  })

  assert.equal(
    result.final_answer,
    "Maske und Oel sind nicht ausgeschlossen; ich wuerde sie nur als zweite Ebene einordnen. Als naechsten Schritt koennen wir passende Produkte dafuer auswaehlen.",
  )
})

test("tool-loop replaces routine-refinement-or-product-suggestion closers", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "final",
      answer:
        "Maske und Oel sind nicht ausgeschlossen, aber ich wuerde sie nach dem Leave-in einordnen. Wenn du moechtest, kann ich dir helfen, die Routine weiter zu verfeinern oder konkrete Produktvorschlaege machen.",
      statePatch: {
        active_topic: "routine",
        topic_relation: "same_topic",
      },
    },
  ])

  const result = await runAgenticToolTurn({
    message: "aber maske und oel nicht dazu?",
    recentMessages: [],
    modelClient,
    tools: {
      select_products: async () => createLeaveInProjection(),
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
    userContext: createUserContext(),
    conversationState: {
      ...createDefaultConversationState(),
      active_topic: "leave_in",
      last_product_category: "leave_in",
      last_assistant_action: "product_recommendation",
    },
    answerCompositionMode: "inline_context",
  })

  assert.equal(
    result.final_answer,
    "Maske und Oel sind nicht ausgeschlossen, aber ich wuerde sie nach dem Leave-in einordnen. Als naechsten Schritt koennen wir passende Produkte dafuer auswaehlen.",
  )
})

test("tool-loop removes should-you-have-more-questions closers", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "final",
      answer:
        "Du kannst mit einer Maske alle 1-2 Wochen beginnen und Oel nach Bedarf auf die Spitzen geben. Solltest du weitere Fragen zur Anwendung oder Produktauswahl haben, lass es mich wissen!",
      statePatch: {
        active_topic: "routine",
        topic_relation: "same_topic",
      },
    },
  ])

  const result = await runAgenticToolTurn({
    message: "aber maske und oel nicht dazu?",
    recentMessages: [],
    modelClient,
    tools: {
      select_products: async () => createLeaveInProjection(),
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
    userContext: createUserContext(),
    conversationState: createDefaultConversationState(),
    answerCompositionMode: "inline_context",
  })

  assert.equal(
    result.final_answer,
    "Du kannst mit einer Maske alle 1-2 Wochen beginnen und Oel nach Bedarf auf die Spitzen geben.",
  )
})

test("tool-loop removes broader application-or-product closers", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "final",
      answer:
        "Oel kann als Finish fuer trockene Spitzen sinnvoll sein. Wenn du mehr ueber die Anwendung oder konkrete Produkte wissen moechtest, lass es mich wissen!",
      statePatch: {
        active_topic: "oil",
        topic_relation: "same_topic",
      },
    },
  ])

  const result = await runAgenticToolTurn({
    message: "Wie verwende ich Oel?",
    recentMessages: [],
    modelClient,
    tools: {
      select_products: async () => createLeaveInProjection(),
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
    userContext: createUserContext(),
    conversationState: null,
    answerCompositionMode: "inline_context",
  })

  assert.equal(result.final_answer, "Oel kann als Finish fuer trockene Spitzen sinnvoll sein.")
})

test("tool-loop replaces product-suggestion offer closers with a concrete next step", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "final",
      answer:
        "Conditioner ist der staerkere Frizz-Hebel. Wenn du moechtest, kann ich dir spezifische Produktvorschlaege fuer Conditioner oder Leave-in-Produkte machen.",
      statePatch: {
        active_topic: "conditioner",
        topic_relation: "same_topic",
      },
    },
  ])

  const result = await runAgenticToolTurn({
    message: "und was waere dann der bessere hebel danach?",
    recentMessages: [],
    modelClient,
    tools: {
      select_products: async () => createLeaveInProjection(),
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
    userContext: createUserContext(),
    conversationState: null,
    answerCompositionMode: "inline_context",
  })

  assert.equal(
    result.final_answer,
    "Conditioner ist der staerkere Frizz-Hebel. Als naechsten Schritt koennen wir passende Produkte dafuer auswaehlen.",
  )
})

test("tool-loop replaces selection-help offer closers with a concrete next step", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "final",
      answer:
        "Conditioner ist der staerkere Frizz-Hebel. Wenn du moechtest, kann ich dir bei der Auswahl eines passenden Conditioners oder Leave-ins helfen.",
      statePatch: {
        active_topic: "conditioner",
        topic_relation: "same_topic",
      },
    },
  ])

  const result = await runAgenticToolTurn({
    message: "und was waere dann der bessere hebel danach?",
    recentMessages: [],
    modelClient,
    tools: {
      select_products: async () => createLeaveInProjection(),
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
    userContext: createUserContext(),
    conversationState: null,
    answerCompositionMode: "inline_context",
  })

  assert.equal(
    result.final_answer,
    "Conditioner ist der staerkere Frizz-Hebel. Als naechsten Schritt koennen wir passende Produkte dafuer auswaehlen.",
  )
})

test("tool-loop softens broad scalp-soothing routine conclusions", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "final",
      answer:
        "Conditioner gehoert nur in die Laengen. Diese Schritte koennen helfen, deine Kopfhaut zu beruhigen und die Haare zu pflegen, bis du ein passendes Shampoo gefunden hast.",
      statePatch: {
        active_topic: "routine",
        topic_relation: "same_topic",
      },
    },
  ])

  const result = await runAgenticToolTurn({
    message: "ok und was kann ich bis dahin in der routine machen?",
    recentMessages: [],
    modelClient,
    tools: {
      select_products: async () => createLeaveInProjection(),
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
    userContext: createUserContext(),
    conversationState: null,
    answerCompositionMode: "inline_context",
  })

  assert.equal(
    result.final_answer,
    "Conditioner gehoert nur in die Laengen. Diese Schritte halten die Routine kopfhautschonender und pflegen die Haare, bis du ein passendes Shampoo gefunden hast.",
  )
})

test("tool-loop softens broad scalp-help routine introductions and conclusions", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "final",
      answer:
        "Du kannst einige Anpassungen vornehmen, die deiner Kopfhaut helfen koennten: Conditioner nur in die Laengen. Diese Schritte koennen helfen, die Kopfhaut zu beruhigen und die Haare gesund zu halten.",
      statePatch: {
        active_topic: "routine",
        topic_relation: "same_topic",
      },
    },
  ])

  const result = await runAgenticToolTurn({
    message: "ok und was kann ich bis dahin in der routine machen?",
    recentMessages: [],
    modelClient,
    tools: {
      select_products: async () => createLeaveInProjection(),
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
    userContext: createUserContext(),
    conversationState: null,
    answerCompositionMode: "inline_context",
  })

  assert.equal(
    result.final_answer,
    "Du kannst einige kopfhautschonende Anpassungen vornehmen: Conditioner nur in die Laengen. Diese Schritte halten die Routine kopfhautschonender und pflegen die Haare.",
  )
})

test("tool-loop keeps scalp routine answers informal and non-medical", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "final",
      answer:
        "Um Ihre Kopfhaut zu beruhigen und die Schuppen zu reduzieren, können Sie Folgendes machen: Verwenden Sie ein mildes Shampoo. Achten Sie darauf, nicht zu stark zu rubbeln. Vermeiden Sie harte Scalp-Brushes.",
      statePatch: {
        active_topic: "routine",
        topic_relation: "same_topic",
      },
    },
  ])

  const result = await runAgenticToolTurn({
    message: "ok und was kann ich bis dahin in der routine machen?",
    recentMessages: [],
    modelClient,
    tools: {
      select_products: async () => createLeaveInProjection(),
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
    userContext: createUserContext(),
    conversationState: null,
    answerCompositionMode: "inline_context",
  })

  assert.equal(
    result.final_answer,
    "Um deine Kopfhaut bis zur Shampoo-Auswahl moeglichst mild zu behandeln, kannst du Folgendes machen: Verwende ein mildes Shampoo. Achte darauf, nicht zu stark zu rubbeln. Vermeide harte Scalp-Brushes.",
  )
})

test("tool-loop avoids symptom-relief claims in scalp routine answers", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "final",
      answer:
        "Nutze Hitzeschutz, um zusätzlichen Stress für die Kopfhaut zu vermeiden. Diese Schritte können helfen, die Symptome zu lindern, bis du ein passendes Shampoo gefunden hast.",
      statePatch: {
        active_topic: "routine",
        topic_relation: "same_topic",
      },
    },
  ])

  const result = await runAgenticToolTurn({
    message: "ok und was kann ich bis dahin in der routine machen?",
    recentMessages: [],
    modelClient,
    tools: {
      select_products: async () => createLeaveInProjection(),
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
    userContext: createUserContext(),
    conversationState: null,
    answerCompositionMode: "inline_context",
  })

  assert.equal(
    result.final_answer,
    "Nutze Hitzeschutz, um die Laengen beim Foehnen zu schuetzen. Diese Schritte halten die Routine bis zur Shampoo-Auswahl sanfter.",
  )
})

test("tool-loop softens suitable-shampoo symptom-relief variants", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "final",
      answer:
        "Nutze Hitzeschutz, um die Kopfhaut nicht zusätzlich zu belasten. Diese Schritte können helfen, die Symptome zu lindern, bis du ein geeignetes Shampoo gefunden hast.",
      statePatch: {
        active_topic: "routine",
        topic_relation: "same_topic",
      },
    },
  ])

  const result = await runAgenticToolTurn({
    message: "ok und was kann ich bis dahin in der routine machen?",
    recentMessages: [],
    modelClient,
    tools: {
      select_products: async () => createLeaveInProjection(),
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
    userContext: createUserContext(),
    conversationState: null,
    answerCompositionMode: "inline_context",
  })

  assert.equal(
    result.final_answer,
    "Nutze Hitzeschutz, um die Laengen beim Foehnen zu schuetzen. Diese Schritte halten die Routine bis zur Shampoo-Auswahl sanfter.",
  )
})

test("tool-loop softens waiting-for-shampoo symptom-relief variants", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "final",
      answer:
        "Diese Anpassungen können helfen, die Symptome zu lindern, während du auf ein geeignetes Shampoo wartest.",
      statePatch: {
        active_topic: "routine",
        topic_relation: "same_topic",
      },
    },
  ])

  const result = await runAgenticToolTurn({
    message: "ok und was kann ich bis dahin in der routine machen?",
    recentMessages: [],
    modelClient,
    tools: {
      select_products: async () => createLeaveInProjection(),
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
    userContext: createUserContext(),
    conversationState: null,
    answerCompositionMode: "inline_context",
  })

  assert.equal(
    result.final_answer,
    "Diese Anpassungen halten die Routine bis zur Shampoo-Auswahl sanfter.",
  )
})

test("tool-loop softens waiting-for-shampoo-recommendation symptom-relief variants", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "final",
      answer:
        "Diese Schritte können helfen, die Symptome zu lindern, während du auf eine passende Shampoo-Empfehlung wartest.",
      statePatch: {
        active_topic: "routine",
        topic_relation: "same_topic",
      },
    },
  ])

  const result = await runAgenticToolTurn({
    message: "ok und was kann ich bis dahin in der routine machen?",
    recentMessages: [],
    modelClient,
    tools: {
      select_products: async () => createLeaveInProjection(),
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
    userContext: createUserContext(),
    conversationState: null,
    answerCompositionMode: "inline_context",
  })

  assert.equal(
    result.final_answer,
    "Diese Schritte halten die Routine bis zur Shampoo-Auswahl sanfter.",
  )
})

test("tool-loop softens alternate scalp-calming symptom claims", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "final",
      answer:
        "Um deine Kopfhaut bis zur Auswahl eines passenden Shampoos zu beruhigen, kannst du sanfter waschen. Diese Anpassungen können helfen, die Kopfhaut zu beruhigen und die Symptome zu lindern.",
      statePatch: {
        active_topic: "routine",
        topic_relation: "same_topic",
      },
    },
  ])

  const result = await runAgenticToolTurn({
    message: "ok und was kann ich bis dahin in der routine machen?",
    recentMessages: [],
    modelClient,
    tools: {
      select_products: async () => createLeaveInProjection(),
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
    userContext: createUserContext(),
    conversationState: null,
    answerCompositionMode: "inline_context",
  })

  assert.equal(
    result.final_answer,
    "Um deine Kopfhaut bis zur Auswahl eines passenden Shampoos moeglichst mild zu behandeln, kannst du sanfter waschen. Diese Anpassungen halten die Routine bis dahin sanfter.",
  )
})

test("tool-loop softens scalp-calming and flake-reduction claims", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "final",
      answer:
        "Diese sind oft sanfter und helfen, die Kopfhaut zu beruhigen. Diese Schritte helfen, die Kopfhaut zu beruhigen und die Schuppenbildung zu reduzieren.",
      statePatch: {
        active_topic: "routine",
        topic_relation: "same_topic",
      },
    },
  ])

  const result = await runAgenticToolTurn({
    message: "ok und was kann ich bis dahin in der routine machen?",
    recentMessages: [],
    modelClient,
    tools: {
      select_products: async () => createLeaveInProjection(),
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
    userContext: createUserContext(),
    conversationState: null,
    answerCompositionMode: "inline_context",
  })

  assert.equal(
    result.final_answer,
    "Diese sind oft sanfter zur Kopfhaut. Diese Schritte halten die Routine bis zur Shampoo-Auswahl sanfter.",
  )
})

test("tool-loop removes generic application-help closers", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "final",
      answer:
        "Das Oel passt als Finish in die Spitzen. Wenn du weitere Fragen hast oder Hilfe bei der Anwendung benötigst, lass es mich wissen!",
      statePatch: {
        active_topic: "oil",
        topic_relation: "same_topic",
      },
    },
  ])

  const result = await runAgenticToolTurn({
    message: "eher als finish, nicht auf die kopfhaut",
    recentMessages: [],
    modelClient,
    tools: {
      select_products: async () => createLeaveInProjection(),
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
    userContext: createUserContext(),
    conversationState: null,
    answerCompositionMode: "inline_context",
  })

  assert.equal(
    result.final_answer,
    "Das Oel passt als Finish in die Spitzen. Als naechsten Schritt koennen wir die Anwendung fuer dein ausgewaehltes Produkt kurz festlegen.",
  )
})

test("tool-loop carries recent oil purpose into anaphoric product followups", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "tool_calls",
      calls: [{ name: "select_products", input: { category: "oil" } }],
    },
    {
      type: "final",
      answer: "Dafuer passt ein Finish-Oel.",
      statePatch: {
        active_topic: "oil",
        last_product_category: "oil",
        topic_relation: "same_topic",
      },
    },
  ])
  const selectInputs: Record<string, unknown>[] = []

  await runAgenticToolTurn({
    message: "Welches Produkt passt dann?",
    recentMessages: [
      { role: "user", content: "Sollte ich eher Oel oder Maske gegen trockene Spitzen nehmen?" },
      { role: "assistant", content: "Oel waere eher ein Finish, Maske eher Pflege." },
      { role: "user", content: "Ich meine Oel eher als Finish, nicht auf die Kopfhaut." },
    ],
    modelClient,
    tools: {
      select_products: async (input) => {
        selectInputs.push(input)
        return {
          ...createLeaveInProjection(),
          category: "oil",
          products: [],
        }
      },
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
    userContext: createUserContext(),
    conversationState: createRoutineState({
      active_topic: "oil",
      last_product_category: "oil",
      routine_layer: null,
    }),
    answerCompositionMode: "inline_context",
  })

  assert.match(String(selectInputs[0]?.message), /Finish/i)
  assert.match(String(selectInputs[0]?.message), /nicht auf die Kopfhaut/i)
  assert.match(String(selectInputs[0]?.message), /Welches Produkt passt dann/i)
})

test("conceptual why questions after product turns are not forced into product selection", async () => {
  let selectCalls = 0
  const modelClient = new FakeModelClient([
    {
      type: "tool_calls",
      calls: [
        {
          name: "load_advisor_guidance",
          input: { intent: "compare_or_decide", categories: ["mask"] },
        },
      ],
    },
    {
      type: "final",
      answer: "Maske kann bei feinem Haar schwer wirken, wenn sie sehr reichhaltig ist.",
      statePatch: { active_topic: "mask", last_product_category: null },
    },
  ])

  await runAgenticToolTurn({
    message: "Warum ist die Maske bei feinem Haar oft zu schwer?",
    recentMessages: [],
    userContext: createUserContext(),
    conversationState: {
      ...createDefaultConversationState(),
      last_product_category: "conditioner",
      last_assistant_action: "answered_products",
    },
    modelClient,
    tools: {
      select_products: async () => {
        selectCalls += 1
        return {
          ...createLeaveInProjection(),
          category: "mask" as SelectedProductsProjection["category"],
        }
      },
      load_advisor_guidance: async () => createAdvisorGuidanceProjection(),
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
  })

  assert.equal(selectCalls, 0)
})

test("category-level why questions with articles do not become prior recommendation reroutes", async () => {
  let selectCalls = 0
  const modelClient = new FakeModelClient([
    {
      type: "tool_calls",
      calls: [
        {
          name: "load_advisor_guidance",
          input: { intent: "usage", categories: ["conditioner"], profileFocus: ["fine_hair"] },
        },
      ],
    },
    {
      type: "final",
      answer: "Conditioner kann bei feinem Haar gut passen, wenn er leicht genug ist.",
      statePatch: { active_topic: "conditioner", last_product_category: null },
    },
  ])

  await runAgenticToolTurn({
    message: "Warum den Conditioner bei feinem Haar?",
    recentMessages: [],
    userContext: createUserContext(),
    conversationState: {
      ...createDefaultConversationState(),
      last_product_category: "mask",
      last_assistant_action: "answered_products",
    },
    modelClient,
    tools: {
      select_products: async () => {
        selectCalls += 1
        return createConditionerProjection()
      },
      load_advisor_guidance: async () => createAdvisorGuidanceProjection(),
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
  })

  assert.equal(selectCalls, 0)
})

test("tool-loop explains prior recommendation without selecting the mentioned alternative category", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "tool_calls",
      calls: [{ name: "select_products", input: { category: "mask" } }],
    },
    {
      type: "final",
      answer: "Der Bondbuilder war wegen der Blondierung der passendere Strukturhebel.",
      statePatch: {
        active_topic: "bondbuilder",
        last_product_category: "bondbuilder",
        topic_relation: "same_topic",
      },
    },
  ])
  const categories: unknown[] = []

  const result = await runAgenticToolTurn({
    message: "Warum gerade den und nicht einfach eine Maske?",
    recentMessages: [{ role: "assistant", content: "Ich wuerde dir OLAPLEX No.3PLUS empfehlen." }],
    modelClient,
    tools: {
      select_products: async (input) => {
        categories.push(input.category)
        return {
          ...createLeaveInProjection(),
          category: input.category as SelectedProductsProjection["category"],
          products: [],
        }
      },
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
    userContext: createUserContext(),
    conversationState: createRoutineState({
      active_topic: "bondbuilder",
      last_product_category: "bondbuilder",
      routine_layer: null,
    }),
    answerCompositionMode: "inline_context",
  })

  assert.deepEqual(categories, ["bondbuilder"])
  assert.ok(
    result.trace.blocked_tool_calls.some(
      (call) => call.name === "select_products" && call.reason === "conceptual_category_curiosity",
    ),
  )
})

function assertStrictObjects(schema: unknown): void {
  if (!schema || typeof schema !== "object") return
  const record = schema as Record<string, unknown>

  if (record.type === "object") {
    assert.equal(record.additionalProperties, false)
    const properties =
      record.properties && typeof record.properties === "object"
        ? Object.keys(record.properties as Record<string, unknown>)
        : []
    assert.deepEqual(record.required, properties)
  }

  for (const value of Object.values(record)) {
    if (Array.isArray(value)) {
      value.forEach(assertStrictObjects)
    } else {
      assertStrictObjects(value)
    }
  }
}
