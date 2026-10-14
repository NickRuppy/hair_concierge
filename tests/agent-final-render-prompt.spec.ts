import assert from "node:assert/strict"
import test from "node:test"

import { buildAgenticAnswerContext } from "../src/lib/agent/orchestrator/agentic-answer-context"
import type { AgenticAnswerCapsuleId } from "../src/lib/agent/orchestrator/agentic-answer-context"
import type { SelectedProductsProjection } from "../src/lib/agent/tools/select-products"
import { createDefaultConversationState } from "../src/lib/chat-runtime/conversation-state"

function createSelectedProductsProjection(
  category: SelectedProductsProjection["category"],
  overrides: Partial<SelectedProductsProjection> = {},
): SelectedProductsProjection {
  return {
    category,
    decision: "recommended",
    product_response_policy: "recommend",
    policy_reason: "Passende Kategorieauswahl.",
    profile_basis: ["Haardicke: Fein", "Kopfhaut: schnell fettend"],
    category_guidance: "Kategorie-Kontext aus selected_products.",
    products: [],
    comparison_facts: null,
    missing_info: [],
    unsupported_requested_signals: [],
    ...overrides,
  }
}

test("agentic answer context selects recommendation capsules for every selected parity category", () => {
  const cases: Array<{
    category: NonNullable<SelectedProductsProjection["category"]>
    expected: AgenticAnswerCapsuleId[]
    message?: string
    overrides?: Partial<SelectedProductsProjection>
  }> = [
    { category: "shampoo", expected: ["category.shampoo.recommend"] },
    { category: "oil", expected: ["category.oil.recommend"] },
    { category: "bondbuilder", expected: ["category.bondbuilder.recommend"] },
    { category: "deep_cleansing_shampoo", expected: ["category.deep_cleansing.recommend"] },
    {
      category: "dry_shampoo",
      expected: ["category.dry_shampoo.recommend", "category.dry_shampoo.guardrail"],
    },
    { category: "peeling", expected: ["category.peeling.recommend"] },
  ]

  for (const { category, expected, message, overrides } of cases) {
    const context = buildAgenticAnswerContext({
      latestUserMessage: message ?? `welches ${category} passt zu mir`,
      selectedProducts: createSelectedProductsProjection(category, overrides),
      routinePlan: null,
      toolCalls: [{ name: "select_products", input: { category } }],
      conversationState: null,
    })

    for (const capsuleId of expected) {
      assert.ok(context.capsule_ids.includes(capsuleId), `${category} should include ${capsuleId}`)
    }
  }
})

test("agentic answer context includes dry shampoo non-cleansing wash-out guardrail", () => {
  const context = buildAgenticAnswerContext({
    latestUserMessage: "welches Trockenshampoo passt zu meinem fettigen Ansatz?",
    selectedProducts: createSelectedProductsProjection("dry_shampoo"),
    routinePlan: null,
    toolCalls: [{ name: "select_products", input: { category: "dry_shampoo" } }],
    conversationState: null,
  })
  const instructions = context.instructions.join("\n")

  assert.ok(context.capsule_ids.includes("category.dry_shampoo.guardrail"))
  assert.match(instructions, /reinigt die Kopfhaut nicht/i)
  assert.match(instructions, /absorbiert Fett nur optisch/i)
  assert.match(instructions, /spaeter.*normalem Shampoo und Wasser ausgewaschen/i)
})

test("agentic answer context carries dry shampoo guardrail into usage followups", () => {
  const context = buildAgenticAnswerContext({
    latestUserMessage: "Kann ich das dann einfach statt Waschen benutzen?",
    selectedProducts: null,
    routinePlan: null,
    toolCalls: [],
    conversationState: {
      ...createDefaultConversationState(),
      active_topic: "dry_shampoo",
      last_product_category: "dry_shampoo",
    },
  })
  const instructions = context.instructions.join("\n")

  assert.ok(context.capsule_ids.includes("category.dry_shampoo.guardrail"))
  assert.match(instructions, /reinigt die Kopfhaut nicht/i)
  assert.match(instructions, /dauerhaften Wasch-Ersatz/i)
})

test("agentic answer context keeps peeling conservative for irritated or sensitive scalps", () => {
  const context = buildAgenticAnswerContext({
    latestUserMessage: "welches Kopfhautpeeling bei gereizter empfindlicher Kopfhaut?",
    selectedProducts: createSelectedProductsProjection("peeling", {
      profile_basis: ["Kopfhaut: empfindlich"],
      category_guidance: "Peeling nur sehr vorsichtig einordnen.",
    }),
    routinePlan: null,
    toolCalls: [{ name: "select_products", input: { category: "peeling" } }],
    conversationState: null,
  })
  const instructions = context.instructions.join("\n")

  assert.ok(context.capsule_ids.includes("category.peeling.scalp_guardrail"))
  assert.match(instructions, /kein starkes mechanisches oder chemisches Peeling/i)
  assert.match(instructions, /anhaltenden oder starken Symptomen/i)
  assert.match(instructions, /dermatologische Abklaerung/i)
})

test("agentic answer context uses category keyword fallback only for conceptual answers without selected products", () => {
  const conceptualDryShampoo = buildAgenticAnswerContext({
    latestUserMessage: "ist Trockenshampoo eigentlich sinnvoll?",
    selectedProducts: null,
    routinePlan: null,
    toolCalls: [],
    conversationState: null,
  })
  const productOil = buildAgenticAnswerContext({
    latestUserMessage: "ist Oel sinnvoll?",
    selectedProducts: createSelectedProductsProjection("oil"),
    routinePlan: null,
    toolCalls: [{ name: "select_products", input: { category: "oil" } }],
    conversationState: null,
  })

  assert.ok(conceptualDryShampoo.capsule_ids.includes("category.conceptual_topology"))
  assert.ok(conceptualDryShampoo.capsule_ids.includes("category.dry_shampoo.guardrail"))
  assert.equal(productOil.capsule_ids.includes("category.conceptual_topology"), false)
  assert.ok(productOil.capsule_ids.includes("category.oil.recommend"))
})

test("agentic answer context discourages generic endings and asks sharp scalp followups", () => {
  const context = buildAgenticAnswerContext({
    latestUserMessage:
      "Ich habe Schuppen und meine Kopfhaut juckt, welches Shampoo soll ich nehmen?",
    selectedProducts: {
      category: "shampoo",
      decision: "not_recommended",
      product_response_policy: "caution_without_products",
      policy_reason: "Schuppen und Juckreiz brauchen vorsichtige Einordnung.",
      profile_basis: [],
      category_guidance: "Kopfhaut vorsichtig einordnen.",
      products: [],
      comparison_facts: null,
      missing_info: [],
      unsupported_requested_signals: [],
    },
    routinePlan: null,
    toolCalls: [{ name: "select_products", input: { category: "shampoo" } }],
    conversationState: null,
  })

  assert.ok(context.capsule_ids.includes("product.caution_without_products"))
  assert.match(context.instructions.join("\n"), /lass es mich wissen/i)
  assert.match(context.instructions.join("\n"), /fettige\/gelbliche Schuppen/i)
  assert.match(context.instructions.join("\n"), /trockene kleine Schueppchen/i)
})

test("agentic answer context treats not-included category followups as routine transitions", () => {
  const context = buildAgenticAnswerContext({
    latestUserMessage: "aber Maske und Oel nicht dazu?",
    selectedProducts: null,
    routinePlan: null,
    toolCalls: [
      {
        name: "load_advisor_guidance",
        input: { categories: ["mask", "oil"], intent: "category_explanation" },
      },
    ],
    conversationState: {
      ...createDefaultConversationState(),
      active_topic: "leave_in",
      last_product_category: "leave_in",
      last_assistant_action: "product_recommendation",
    },
  })

  assert.ok(context.capsule_ids.includes("category.conceptual_topology"))
  assert.ok(context.capsule_ids.includes("routine.adjacent_category_transition"))
  assert.match(context.instructions.join("\n"), /nicht ausgeschlossen/i)
  assert.match(context.instructions.join("\n"), /vorherige Empfehlung/i)
})

test("agentic answer context selects caveated product recommendation capsules", () => {
  const context = buildAgenticAnswerContext({
    latestUserMessage: "welches shampoo hilft gegen frizz",
    selectedProducts: {
      category: "shampoo",
      decision: "recommended",
      product_response_policy: "recommend_with_caveat",
      policy_reason: "Shampoo ist nicht der stärkste Hebel für Frizz.",
      profile_basis: ["Kopfhaut: ausgeglichen"],
      category_guidance: "Shampoo kann empfohlen werden, aber Frizz ist meist Längenpflege.",
      products: [],
      comparison_facts: null,
      missing_info: [],
      unsupported_requested_signals: [],
    },
    routinePlan: null,
    toolCalls: [
      {
        name: "select_products",
        input: { category: "shampoo", userJob: "product_pick" },
      },
    ],
    conversationState: null,
  })

  assert.deepEqual(context.capsule_ids.slice(0, 4), [
    "global.natural_consultant",
    "product.recommend_with_caveat",
    "product.recommendation_shape",
    "category.shampoo.redirect",
  ])
  assert.match(context.instructions.join("\n"), /Nicht wie eine Ablehnung/i)
})

test("agentic answer context only offers proactive next steps for explicit situations", () => {
  const ordinaryRecommendation = buildAgenticAnswerContext({
    latestUserMessage: "was fuer einen conditioner brauche ich",
    selectedProducts: {
      category: "conditioner",
      decision: "recommended",
      product_response_policy: "recommend",
      policy_reason: "Conditioner folgt Gewicht und Balance.",
      profile_basis: [],
      category_guidance: "Conditioner ist der Pflegeanker.",
      products: [],
      comparison_facts: null,
      missing_info: [],
      unsupported_requested_signals: [],
    },
    routinePlan: null,
    toolCalls: [{ name: "select_products", input: { category: "conditioner" } }],
    conversationState: null,
  })
  assert.equal(ordinaryRecommendation.capsule_ids.includes("followup.proactive_next_step"), false)

  const redirectWithNextStep = buildAgenticAnswerContext({
    latestUserMessage: "welches shampoo hilft gegen frizz",
    selectedProducts: {
      category: "shampoo",
      decision: "not_recommended",
      product_response_policy: "redirect_to_better_lever",
      policy_reason: "Shampoo ist nicht der stärkste Hebel.",
      profile_basis: [],
      category_guidance: "Frizz ist meist ein Längen-, Pflege- oder Stylingthema.",
      products: [],
      comparison_facts: null,
      missing_info: [],
      unsupported_requested_signals: [],
    },
    routinePlan: null,
    toolCalls: [{ name: "select_products", input: { category: "shampoo" } }],
    conversationState: null,
  })
  assert.equal(redirectWithNextStep.capsule_ids.includes("followup.proactive_next_step"), true)
})

test("agentic answer context selects leave-in usage capsules", () => {
  const context = buildAgenticAnswerContext({
    latestUserMessage: "wie benutze ich den hask leave-in",
    selectedProducts: {
      category: "leave_in",
      decision: "recommended",
      product_response_policy: "recommend",
      policy_reason: "Leave-in passt als Booster.",
      profile_basis: ["Hitzeschutz-Bedarf: Moderat"],
      category_guidance: "Leave-in ist ein Booster.",
      products: [],
      comparison_facts: null,
      missing_info: [],
      unsupported_requested_signals: [],
    },
    routinePlan: null,
    toolCalls: [
      {
        name: "select_products",
        input: { category: "leave_in" },
      },
    ],
    conversationState: null,
  })

  assert.ok(context.capsule_ids.includes("product.usage_shape"))
  assert.ok(context.capsule_ids.includes("category.leave_in.usage"))
  assert.match(context.instructions.join("\n"), /Wasch- oder Foehnrhythmus/i)
})

test("agentic answer context selects routine broad-goal capsules", () => {
  const context = buildAgenticAnswerContext({
    latestUserMessage: "wie kann ich meine haare glatter und glaenzender machen",
    selectedProducts: null,
    routinePlan: {
      objective: "build_routine",
      steps: [],
      missing_info: [],
      confidence: 1,
    },
    toolCalls: [
      {
        name: "build_or_fix_routine",
        input: { objective: "build_routine", layer: "goals" },
      },
    ],
    conversationState: null,
  })

  assert.ok(context.capsule_ids.includes("routine.broad_goal"))
  assert.ok(context.capsule_ids.includes("routine.layered_answer"))
  assert.match(context.instructions.join("\n"), /Produkt-Lanes/i)
})

test("agentic answer context includes routine priority context guidance", () => {
  const context = buildAgenticAnswerContext({
    latestUserMessage: "was ist der wichtigste dritte schritt fuer meine routine",
    selectedProducts: null,
    routinePlan: {
      objective: "build_routine",
      steps: [],
      missing_info: [],
      confidence: 1,
      priority_context: {
        selected_step_id: "occasional-hair-reset",
        selected_label: "Tiefenreinigung",
        selected_category: "shampoo",
        selected_role: "cleanup_reset",
        selected_reason: "Rückstände und Build-up brauchen gelegentlich einen Reset.",
        adjacent_levers: [
          {
            step_id: "leave-in-care",
            label: "Leave-in",
            category: "leave_in",
            role: "everyday_maintenance",
            reason: "Alltagshebel für Längen und Frizz.",
          },
        ],
      },
    },
    toolCalls: [
      {
        name: "build_or_fix_routine",
        input: { objective: "build_routine", layer: "goals" },
      },
    ],
    conversationState: null,
  })

  assert.ok(context.capsule_ids.includes("routine.priority_context"))
  assert.match(context.instructions.join("\n"), /gewaehlten.*Hebel|ausgewaehlten.*Hebel/i)
  assert.match(context.instructions.join("\n"), /Reset|Cleanup/i)
  assert.match(context.instructions.join("\n"), /Leave-in/i)
  assert.match(context.instructions.join("\n"), /Alltag|everyday/i)
})

test("agentic answer context frames broad category overviews through routine basics", () => {
  const germanContext = buildAgenticAnswerContext({
    latestUserMessage: "was sollte ich noch hinzufügen?",
    selectedProducts: null,
    routinePlan: {
      objective: "build_routine",
      steps: [],
      missing_info: [],
      confidence: 1,
      priority_context: {
        selected_step_id: "conditioner-anchor",
        selected_label: "Conditioner",
        selected_category: "conditioner",
        selected_role: "supporting_step",
        selected_reason: "Conditioner ist der Pflegeanker nach jeder Wäsche.",
        adjacent_levers: [],
      },
    },
    toolCalls: [
      {
        name: "build_or_fix_routine",
        input: { objective: "build_routine", layer: "basics" },
      },
    ],
    conversationState: null,
  })
  const englishContext = buildAgenticAnswerContext({
    latestUserMessage: "what else should I add?",
    selectedProducts: null,
    routinePlan: {
      objective: "build_routine",
      steps: [],
      missing_info: [],
      confidence: 1,
      priority_context: {
        selected_step_id: "conditioner-anchor",
        selected_label: "Conditioner",
        selected_category: "conditioner",
        selected_role: "supporting_step",
        selected_reason: "Conditioner ist der Pflegeanker nach jeder Wäsche.",
        adjacent_levers: [],
      },
    },
    toolCalls: [
      {
        name: "build_or_fix_routine",
        input: { objective: "build_routine", layer: "basics" },
      },
    ],
    conversationState: null,
  })

  assert.ok(germanContext.capsule_ids.includes("routine.category_overview"))
  assert.ok(englishContext.capsule_ids.includes("routine.category_overview"))
  assert.match(germanContext.instructions.join("\n"), /Dann schauen wir zuerst auf die Basis/)
  assert.match(germanContext.instructions.join("\n"), /Zielen oder Problemen/)
})

test("agentic answer context guides practical leave-in product comparisons", () => {
  const context = buildAgenticAnswerContext({
    latestUserMessage: "welches leave-in passt zu mir",
    selectedProducts: {
      category: "leave_in",
      decision: "recommended",
      product_response_policy: "recommend",
      policy_reason: "Leave-in passt als leichter Alltagshebel.",
      profile_basis: ["Haardicke: Fein", "Frizz-Ziel: Ja"],
      category_guidance: "Leave-in hilft als Alltagsbooster.",
      products: [],
      comparison_facts: null,
      missing_info: [],
      unsupported_requested_signals: [],
    },
    routinePlan: null,
    toolCalls: [
      {
        name: "select_products",
        input: { category: "leave_in", userJob: "product_pick" },
      },
    ],
    conversationState: null,
  })

  assert.ok(context.capsule_ids.includes("category.leave_in.recommend"))
  assert.match(context.instructions.join("\n"), /praktisch.*Vergleich|praktische.*Alternative/i)
  assert.match(context.instructions.join("\n"), /Unterschied/i)
  assert.match(context.instructions.join("\n"), /erste Wahl|First-Choice|staerkste.*Wahl/i)
})

test("agentic answer context surfaces leave-in heat consolidation when tool facts support it", () => {
  const context = buildAgenticAnswerContext({
    latestUserMessage: "was sind die besten leave ins fuer mich",
    selectedProducts: {
      category: "leave_in",
      decision: "recommended",
      product_response_policy: "recommend",
      policy_reason: "Die Auswahl folgt den aktuell verfuegbaren Profil- und Produktdaten.",
      profile_basis: ["Haardicke: Fein", "Nutzer hat bereits separaten Hitzeschutz."],
      category_guidance:
        "Leave-in kann hier als Booster genutzt werden; Hitzeschutz ist nicht zwingend, kann aber Pflege plus Föhnschutz bündeln.",
      products: [
        {
          rank: 1,
          product_id: "leave-in-heat",
          name: "Heat Leave-in",
          brand: "Test",
          price_eur: 4.99,
          currency: "EUR",
          fit_reason: "Idealer Treffer",
          caveat: null,
          supported_claims: [
            {
              field: "heat_protection",
              value: "yes",
              evidence: "product_spec",
              label: "Hitzeschutz: Ja",
            },
          ],
          unsupported_requested_signals: [],
        },
      ],
      comparison_facts: null,
      missing_info: [],
      unsupported_requested_signals: [],
    },
    routinePlan: null,
    toolCalls: [{ name: "select_products", input: { category: "leave_in" } }],
    conversationState: null,
  })

  assert.ok(context.capsule_ids.includes("category.leave_in.heat_consolidation"))
  assert.match(context.instructions.join("\n"), /ein Produkt weniger in der Routine/)
})

test("agentic answer context does not surface heat consolidation for negative heat claims", () => {
  const context = buildAgenticAnswerContext({
    latestUserMessage: "was sind die besten leave ins fuer mich",
    selectedProducts: {
      category: "leave_in",
      decision: "recommended",
      product_response_policy: "recommend",
      policy_reason: "Die Auswahl folgt den aktuell verfuegbaren Profil- und Produktdaten.",
      profile_basis: ["Nutzer hat bereits separaten Hitzeschutz."],
      category_guidance: "Leave-in kann hier als Booster genutzt werden.",
      products: [
        {
          rank: 1,
          product_id: "leave-in-no-heat",
          name: "No Heat Leave-in",
          brand: "Test",
          price_eur: 4.99,
          currency: "EUR",
          fit_reason: "Treffer ohne Hitzeschutz.",
          caveat: null,
          supported_claims: [
            {
              field: "heat_protection",
              value: "nein",
              evidence: "product_spec",
              label: "Hitzeschutz: Nein",
            },
          ],
          unsupported_requested_signals: [],
        },
      ],
      comparison_facts: null,
      missing_info: [],
      unsupported_requested_signals: [],
    },
    routinePlan: null,
    toolCalls: [{ name: "select_products", input: { category: "leave_in" } }],
    conversationState: null,
  })

  assert.equal(context.capsule_ids.includes("category.leave_in.heat_consolidation"), false)
})

test("agentic answer context preserves oil purpose clarification before products", () => {
  const context = buildAgenticAnswerContext({
    latestUserMessage: "welches haaroel passt zu mir",
    selectedProducts: {
      category: "oil",
      decision: "needs_more_info",
      product_response_policy: "needs_more_info",
      policy_reason: "Der Öl-Zweck fehlt.",
      profile_basis: ["Haardicke: Fein"],
      category_guidance: "Öl kann je nach Zweck Finish oder Pre-Wash sein.",
      products: [],
      comparison_facts: null,
      missing_info: [
        {
          key: "oil_purpose",
          label: "Öl-Zweck",
          blocking: true,
          detail: "Finish und Pre-Wash sind unterschiedliche Rollen.",
        },
      ],
      unsupported_requested_signals: [],
    },
    routinePlan: null,
    toolCalls: [{ name: "select_products", input: { category: "oil" } }],
    conversationState: null,
  })

  assert.ok(context.capsule_ids.includes("category.oil.purpose_before_products"))
  assert.match(context.instructions.join("\n"), /Finish\/Glanz/)
  assert.match(context.instructions.join("\n"), /needs_more_info/)
})

test("agentic answer context gives conceptual category answers a stable topology", () => {
  const context = buildAgenticAnswerContext({
    latestUserMessage: "waere es wichtig einen leave-in in meine routine zu integrieren?",
    selectedProducts: null,
    routinePlan: null,
    toolCalls: [],
    conversationState: {
      version: 1,
      active_topic: "leave_in",
      routine_layer: null,
      pending_offer: null,
      answered_slots: [],
      last_assistant_action: "answered_direct",
      last_product_category: "leave_in",
    },
  })

  assert.ok(context.capsule_ids.includes("category.conceptual_topology"))
  assert.match(context.instructions.join("\n"), /direkte Antwort/)
  assert.match(context.instructions.join("\n"), /Profilgrund/)
})

test("agentic answer context uses active category state for pronoun-only conceptual follow-ups", () => {
  const context = buildAgenticAnswerContext({
    latestUserMessage: "ok waere es wichtig einen in meine routine zu integrieren?",
    selectedProducts: null,
    routinePlan: null,
    toolCalls: [],
    conversationState: {
      version: 1,
      active_topic: "leave_in",
      routine_layer: null,
      pending_offer: null,
      answered_slots: [],
      last_assistant_action: "answered_direct",
      last_product_category: "leave_in",
    },
  })

  assert.ok(context.capsule_ids.includes("category.conceptual_topology"))
  assert.match(context.instructions.join("\n"), /direkte Antwort/)
  assert.match(context.instructions.join("\n"), /naechster Schritt/)
})
