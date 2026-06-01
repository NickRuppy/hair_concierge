import assert from "node:assert/strict"
import test from "node:test"

import { projectRoutineForAgentV2 } from "../src/lib/agent-v2/tools/routine-projection"
import { projectSelectProductsForAgentV2 } from "../src/lib/agent-v2/tools/select-products-projection"
import type { AgentV2RoutineLayer } from "../src/lib/agent-v2/contracts"
import type { BuildOrFixRoutineProjection } from "../src/lib/agent/tools/build-or-fix-routine"
import type { SelectProductsToolResult } from "../src/lib/agent/tools/select-products"

const ASCII_GERMAN_PROMPT_VARIANTS =
  /\b(?:Moechtest|Naechstes|naeherbringt|loest|moechtest|koennen|fuer|zurueckgehen|naechsten)\b/

test("projectSelectProductsForAgentV2 exposes product ids and supported claims", () => {
  const input = {
    projection: {
      category: "shampoo",
      decision: "recommended",
      product_response_policy: "recommend",
      policy_reason: "Profile and category fit.",
      profile_basis: ["Haardicke: fein", "Kopfhaut: fettig"],
      category_guidance: "Shampoo wirkt primär an der Kopfhaut.",
      products: [
        {
          rank: 1,
          product_id: "prod_1",
          name: "Mildes Shampoo",
          brand: "Brand",
          price_eur: 12.5,
          currency: "EUR",
          fit_reason: "Reinigt leicht ohne die Längen zu beschweren.",
          caveat: null,
          supported_claims: [
            {
              field: "shampoo_bucket",
              value: "light",
              evidence: "product_spec",
              label: "leichte Reinigung",
            },
          ],
          unsupported_requested_signals: [],
        },
      ],
      comparison_facts: null,
      missing_info: [],
      unsupported_requested_signals: [],
    },
    products: [],
    effectiveHairProfile: null,
    runtime: {} as SelectProductsToolResult["runtime"],
  } satisfies SelectProductsToolResult

  const output = projectSelectProductsForAgentV2(input)

  assert.equal(output.category, "shampoo")
  assert.deepEqual(output.valid_product_ids, ["prod_1"])
  assert.equal(output.products[0].supported_claims[0].field, "shampoo_bucket")
  assert.ok(output.allowed_claim_sources.includes("selected_products.supported_claims"))
})

test("projectSelectProductsForAgentV2 exposes advertised comparison facts", () => {
  const input = {
    projection: {
      category: "conditioner",
      decision: "recommended",
      product_response_policy: "recommend",
      policy_reason: "Profile and category fit.",
      profile_basis: ["Haardicke: fein"],
      category_guidance: "Conditioner wirkt primär in den Längen.",
      products: [
        {
          rank: 1,
          product_id: "prod_1",
          name: "Leichter Conditioner",
          brand: "Brand",
          price_eur: 10,
          currency: "EUR",
          fit_reason: "Pflegt ohne zu beschweren.",
          caveat: null,
          supported_claims: [],
          unsupported_requested_signals: [],
        },
      ],
      comparison_facts: {
        prod_1: ["leichter als reichhaltige Alternativen"],
      },
      missing_info: [],
      unsupported_requested_signals: [],
    },
    products: [],
    effectiveHairProfile: null,
    runtime: {} as SelectProductsToolResult["runtime"],
  } satisfies SelectProductsToolResult

  const output = projectSelectProductsForAgentV2(input)

  assert.ok(output.allowed_claim_sources.includes("selected_products.comparison_facts"))
  assert.deepEqual(output.comparison_facts, {
    prod_1: ["leichter als reichhaltige Alternativen"],
  })
})

test("projectRoutineForAgentV2 explains basics layer and product policy", () => {
  const input: BuildOrFixRoutineProjection = {
    objective: "build_routine",
    confidence: 0.9,
    missing_info: [],
    steps: [
      {
        id: "base-shampoo",
        label: "Shampoo",
        necessity: "core",
        action: "keep",
        category: "shampoo",
        frequency: "nach Bedarf",
        reasons: ["Reinigt die Kopfhaut."],
        caveats: [],
        fillable: true,
      },
      {
        id: "base-conditioner",
        label: "Conditioner",
        necessity: "core",
        action: "add",
        category: "conditioner",
        frequency: "nach jeder Wäsche",
        reasons: ["Pflegt die Längen."],
        caveats: [],
        fillable: true,
      },
      {
        id: "priority-leave-in",
        label: "Leave-in",
        necessity: "recommended",
        action: "add",
        category: "leave_in",
        frequency: "nach der Wäsche",
        reasons: ["Größter Zusatzhebel für Frizz."],
        caveats: [],
        fillable: true,
      },
    ],
    priority_context: {
      selected_step_id: "priority-leave-in",
      selected_label: "Leave-in",
      selected_category: "leave_in",
      selected_role: "everyday_maintenance",
      selected_reason: "Größter Zusatzhebel für Frizz.",
      adjacent_levers: [],
    },
  }

  const output = projectRoutineForAgentV2(input, { requestedLayer: "basics" })

  assert.equal(output.routine_layer, "basics")
  assert.deepEqual(output.next_layer_options, ["goals", "problems"])
  assert.equal(output.product_request_policy.default, "do_not_name_products")
  assert.equal(output.visible_steps.length, 3)
  assert.equal(output.visible_steps[2]?.display_role, "Nächster Hebel")
  assert.equal(
    output.conversation_prompt_de,
    "Möchtest du als Nächstes eher sehen, was dich deinen Zielen näherbringt, oder was konkrete Probleme löst?",
  )
  assert.doesNotMatch(output.conversation_prompt_de, ASCII_GERMAN_PROMPT_VARIANTS)
})

test("projectRoutineForAgentV2 exposes standard German prompts for every routine layer", () => {
  const input: BuildOrFixRoutineProjection = {
    objective: "build_routine",
    confidence: 0.9,
    missing_info: [],
    steps: [
      {
        id: "priority-leave-in",
        label: "Leave-in",
        necessity: "recommended",
        action: "add",
        category: "leave_in",
        frequency: "nach der Wäsche",
        reasons: ["Größter Zusatzhebel für Frizz."],
        caveats: [],
        fillable: true,
      },
    ],
    priority_context: null,
  }

  const expectedPrompts: Record<AgentV2RoutineLayer, string> = {
    basics:
      "Möchtest du als Nächstes eher sehen, was dich deinen Zielen näherbringt, oder was konkrete Probleme löst?",
    goals:
      "Wenn du möchtest, können wir danach die konkrete Produktauswahl für den wichtigsten Ziel-Hebel anschauen.",
    problems:
      "Wenn du möchtest, können wir danach den wichtigsten Problem-Hebel als Produkt-Deep-Dive anschauen.",
    deep_dive: "Danach können wir zur Routine zurückgehen und den nächsten Hebel einordnen.",
  }

  for (const [layer, expectedPrompt] of Object.entries(expectedPrompts) as Array<
    [AgentV2RoutineLayer, string]
  >) {
    const output = projectRoutineForAgentV2(input, { requestedLayer: layer })

    assert.equal(output.conversation_prompt_de, expectedPrompt)
    assert.doesNotMatch(output.conversation_prompt_de, ASCII_GERMAN_PROMPT_VARIANTS)
  }
})

test("projectRoutineForAgentV2 translates internal leave-in finish labels for user-facing context", () => {
  const input: BuildOrFixRoutineProjection = {
    objective: "build_routine",
    confidence: 0.9,
    missing_info: [],
    steps: [
      {
        id: "maintenance-leave-in",
        label: "Leave-in / Finish",
        necessity: "recommended",
        action: "add",
        category: "leave_in",
        frequency: "nach der Wäsche",
        reasons: ["Ein Leave-in oder Finish-Schritt macht die Routine nach dem Waschen runder."],
        caveats: [],
        fillable: true,
      },
    ],
    priority_context: null,
  }

  const output = projectRoutineForAgentV2(input, { requestedLayer: "basics" })

  assert.equal(output.visible_steps[0]?.label, "Leichtes Leave-in")
  assert.equal(
    output.visible_steps[0]?.short_reason,
    "Ein Leave-in-Schritt macht die Routine nach dem Waschen runder.",
  )
})
