import assert from "node:assert/strict"
import test from "node:test"

import {
  DISCOVERY_SPRAY_QUESTION,
  DISCOVERY_STYLING_PRODUCT_TYPE,
  DISCOVERY_USAGE_QUESTIONS,
  DISCOVERY_USAGE_ROLES,
  classifyDiscoveryProduct,
  classifyDiscoveryProductType,
  isDiscoveryProductType,
  isValidDiscoveryUsage,
  type DiscoveryPreselectRuleId,
  type DiscoverySprayOptionKey,
} from "../src/lib/discovery/classify"
import { SUPPORTED_PRODUCT_CATEGORY_KEYS } from "../src/lib/product-identity"

/**
 * Batch 7 (plan plans/discovery-refinement-b7/plan.md Rev. 3, §2.4): D1 — a conditioner used
 * „Vor der Haarwäsche" (usage role `pre_wash_conditioner`, conditioner only); D2 — a spray
 * without a clear type is asked „Wofür nutzt du das Spray?", and „Styling & Halt" files it as
 * the non-evaluated product type `styling`. Every fixture names its rule.
 */

// --- D1 ----------------------------------------------------------------------------

test("D1: the care question's 4th option is the pre-wash conditioner", () => {
  const care = DISCOVERY_USAGE_QUESTIONS.care_use
  assert.equal(care.options.length, 4)
  const last = care.options[3]
  assert.equal(last.key, "conditioner_pre_wash")
  assert.equal(last.label, "Vor der Haarwäsche")
  assert.deepEqual(last.usage, { category: "conditioner", role: "pre_wash_conditioner" })
})

test("D1: pre_wash_conditioner is a usage role valid only with the conditioner category", () => {
  assert.ok((DISCOVERY_USAGE_ROLES as readonly string[]).includes("pre_wash_conditioner"))
  for (const category of SUPPORTED_PRODUCT_CATEGORY_KEYS) {
    assert.equal(
      isValidDiscoveryUsage({ category, role: "pre_wash_conditioner" }),
      category === "conditioner",
      category,
    )
  }
})

// --- D2: product type ----------------------------------------------------------------

test("D2: `styling` is a discovery product type, but not one of the ten categories", () => {
  assert.equal(DISCOVERY_STYLING_PRODUCT_TYPE, "styling")
  assert.equal(isDiscoveryProductType("styling"), true)
  assert.equal(isDiscoveryProductType("leave_in"), true)
  assert.equal(isDiscoveryProductType("hairspray"), false)
  assert.equal((SUPPORTED_PRODUCT_CATEGORY_KEYS as readonly string[]).includes("styling"), false)
})

type SprayTypeFixture = {
  rule: string
  input: { catalogCategory?: string | null; name?: string | null }
  expected: string | null
}

const SPRAY_TYPE_FIXTURES: SprayTypeFixture[] = [
  // T13 — a spray without a clear type: the spray question decides.
  { rule: "T13_spray", input: { name: "Volumen Spray" }, expected: null },
  { rule: "T13_spray", input: { name: "Haarspray Extra Stark" }, expected: null },
  { rule: "T13_spray", input: { name: "Hitzeschutzspray Ultralight" }, expected: null },
  { rule: "T13_spray", input: { name: "Overnight Repair Spray" }, expected: null },
  { rule: "T13_spray", input: { name: "Glossy Spray" }, expected: null },
  // A clear type keeps its rule — the spray question is only for the unclear ones.
  { rule: "T5_name", input: { name: "Hitzeschutz Spray" }, expected: "heat_protectant" },
  { rule: "T5_name", input: { name: "Leave-in Spray" }, expected: "leave_in" },
  { rule: "T5_name", input: { name: "Trockenshampoo Spray" }, expected: "dry_shampoo" },
  // The catalog stays authoritative.
  {
    rule: "T1_catalog",
    input: { catalogCategory: "leave_in", name: "Spray" },
    expected: "leave_in",
  },
  // Never guessed stays never guessed — no spray question for a colour or 2-in-1 spray.
  { rule: "T3_never_guessed", input: { name: "Color Spray" }, expected: null },
  { rule: "T3_never_guessed", input: { name: "2in1 Spray" }, expected: null },
]

for (const fixture of SPRAY_TYPE_FIXTURES) {
  test(`${fixture.rule}: ${JSON.stringify(fixture.input)} -> ${fixture.expected}`, () => {
    const result = classifyDiscoveryProductType(fixture.input)
    assert.equal(result.productType, fixture.expected)
    assert.equal(result.rule, fixture.rule)
  })
}

// --- D2: the spray question ----------------------------------------------------------

test("D2: the spray question and its four answers (Nick's copy note: the care option reads as leave-in)", () => {
  assert.equal(DISCOVERY_SPRAY_QUESTION.prompt, "Wofür nutzt du das Spray?")
  assert.deepEqual(
    DISCOVERY_SPRAY_QUESTION.options.map((option) => [
      option.key,
      option.label,
      option.productType,
      option.usage,
    ]),
    [
      [
        "spray_heat_protectant",
        "Hitzeschutz",
        "heat_protectant",
        { category: "heat_protectant", role: null },
      ],
      [
        "spray_leave_in",
        "Pflegespray – bleibt im Haar (Leave-in)",
        "leave_in",
        { category: "leave_in", role: null },
      ],
      ["spray_styling", "Styling & Halt", "styling", null],
      ["spray_unknown", "Weiß ich nicht", null, null],
    ],
  )
  for (const option of DISCOVERY_SPRAY_QUESTION.options) {
    if (option.usage) assert.ok(isValidDiscoveryUsage(option.usage), option.key)
  }
})

type SprayStepFixture = {
  rule: DiscoveryPreselectRuleId
  name: string
  preselected: DiscoverySprayOptionKey | null
}

const SPRAY_STEP_FIXTURES: SprayStepFixture[] = [
  {
    rule: "P9_spray_heat",
    name: "Hitzeschutzspray Ultralight",
    preselected: "spray_heat_protectant",
  },
  { rule: "P9_spray_heat", name: "Thermo Spray", preselected: "spray_heat_protectant" },
  // Overnight sprays belong to the leave-in option (D2).
  { rule: "P10_spray_leave_in", name: "Overnight Repair Spray", preselected: "spray_leave_in" },
  { rule: "P10_spray_leave_in", name: "Nachtspray Intensiv", preselected: "spray_leave_in" },
  { rule: "P10_spray_leave_in", name: "Pflegespray Seide", preselected: "spray_leave_in" },
  { rule: "P11_spray_styling", name: "Haarspray Extra Stark", preselected: "spray_styling" },
  { rule: "P11_spray_styling", name: "Volumen Spray", preselected: "spray_styling" },
  { rule: "P11_spray_styling", name: "Sea Salt Spray", preselected: "spray_styling" },
  // Nothing to go on: no preselection — she answers.
  { rule: "P12_spray_open", name: "Glossy Spray", preselected: null },
]

for (const fixture of SPRAY_STEP_FIXTURES) {
  test(`${fixture.rule}: „${fixture.name}"`, () => {
    const result = classifyDiscoveryProduct({ name: fixture.name })
    assert.equal(result.rule, "T13_spray")
    assert.equal(result.step.kind, "spray")
    if (result.step.kind !== "spray") return
    assert.equal(result.step.rule, fixture.rule)
    assert.equal(result.step.preselected, fixture.preselected)
    assert.equal(result.step.question, DISCOVERY_SPRAY_QUESTION)
  })
}

test("D2: a never-guessed spray still asks „Was ist das?“, a typed spray its own question", () => {
  assert.equal(classifyDiscoveryProduct({ name: "Color Spray" }).step.kind, "what_is_it")
  assert.equal(classifyDiscoveryProduct({ name: "Hitzeschutz Spray" }).step.kind, "fixed")
  const leaveIn = classifyDiscoveryProduct({ name: "Leave-in Spray" })
  assert.equal(leaveIn.step.kind, "ask")
  // Brand-only names are unchanged.
  assert.equal(classifyDiscoveryProduct({ name: "Olaplex" }).step.kind, "what_is_it")
})
