import assert from "node:assert/strict"
import test from "node:test"

import {
  DISCOVERY_OIL_USAGE_ROLES,
  DISCOVERY_USAGE_QUESTIONS,
  DISCOVERY_USAGE_ROLES,
  classifyDiscoveryProduct,
  classifyDiscoveryProductType,
  discoveryUsageStepFor,
  isDiscoveryUsageWithinProductFamily,
  isValidDiscoveryUsage,
  type DiscoveryTypeRuleId,
  type DiscoveryUsage,
  type DiscoveryUsageOptionKey,
  type DiscoveryPreselectRuleId,
} from "../src/lib/discovery/classify"
import type { PersonalPlanCategory } from "../src/lib/personal-plan/products/contracts"
import { SUPPORTED_PRODUCT_CATEGORY_KEYS } from "../src/lib/product-identity"

/**
 * Batch 5 (plan Rev. 3, task 2): what a captured product IS (product type) and which usage
 * question the participant is asked, with the answer preselected (R9, F5).
 *
 * Every fixture names the rule it exercises, so a failing row says which rule moved. The
 * adversarial block pins deliberate behaviour for names that are easy to get wrong — it is
 * not there to be green, it is there so a change to any of them is a visible decision.
 */

// --- Product type (R2, P2-6, F1) --------------------------------------------------

type TypeFixture = {
  rule: DiscoveryTypeRuleId
  input: { catalogCategory?: string | null; name?: string | null }
  expected: PersonalPlanCategory | null
}

const TYPE_FIXTURES: TypeFixture[] = [
  // T1 — a catalog product's `products.category_key` is authoritative, whatever its name says.
  { rule: "T1_catalog", input: { catalogCategory: "mask", name: "Öl-Kur" }, expected: "mask" },
  {
    rule: "T1_catalog",
    input: { catalogCategory: "scalp_care", name: "Scalp Oil" },
    expected: "scalp_care",
  },
  { rule: "T1_catalog", input: { catalogCategory: "oil", name: null }, expected: "oil" },
  // T2 — a catalog key outside the ten supported categories is no product type.
  {
    rule: "T2_catalog_unsupported",
    input: { catalogCategory: "serum", name: "Haaröl" },
    expected: null,
  },
  // T5 — the retailer-name rules (`suggestCategoryFromRetailerName`), one match.
  { rule: "T5_name", input: { name: "Elvital Hyaluron Pure Shampoo" }, expected: "shampoo" },
  { rule: "T5_name", input: { name: "Balea Trockenshampoo" }, expected: "dry_shampoo" },
  { rule: "T5_name", input: { name: "Clarifying Shampoo" }, expected: "deep_cleansing_shampoo" },
  { rule: "T5_name", input: { name: "Repair Conditioner" }, expected: "conditioner" },
  { rule: "T5_name", input: { name: "Spülung Feuchtigkeit" }, expected: "conditioner" },
  { rule: "T5_name", input: { name: "Haarkur Intensiv" }, expected: "mask" },
  { rule: "T5_name", input: { name: "Glanz Sprühkur" }, expected: "leave_in" },
  { rule: "T5_name", input: { name: "Hitzeschutz Spray" }, expected: "heat_protectant" },
  { rule: "T5_name", input: { name: "Haaröl Argan" }, expected: "oil" },
  // T6 — a German compound ending in „öl" is an oil (the retailer rule needs a word boundary).
  { rule: "T6_compound_oil", input: { name: "Arganöl" }, expected: "oil" },
  { rule: "T6_compound_oil", input: { name: "Kopfhautöl Beruhigend" }, expected: "oil" },
  // T7 — a scalp word in front of a base product is a modifier, not scalp care.
  { rule: "T7_scalp_modifier", input: { name: "Scalp Oil" }, expected: "oil" },
  { rule: "T7_scalp_modifier", input: { name: "Scalp Shampoo" }, expected: "shampoo" },
  {
    rule: "T7_scalp_modifier",
    input: { name: "Scalp Detox Shampoo" },
    expected: "deep_cleansing_shampoo",
  },
  // T8 — within the care family a leave-in statement decides.
  { rule: "T8_leave_in_dominates", input: { name: "Haarkur Leave-in" }, expected: "leave_in" },
  { rule: "T8_leave_in_dominates", input: { name: "Leave-in Conditioner" }, expected: "leave_in" },
  // T3 — colour products and 2-in-1s are never guessed, whatever else the name says.
  { rule: "T3_never_guessed", input: { name: "2in1 Shampoo & Spülung" }, expected: null },
  { rule: "T3_never_guessed", input: { name: "2in1 Öl-Kur" }, expected: null },
  { rule: "T3_never_guessed", input: { name: "Color Shampoo" }, expected: null },
  { rule: "T3_never_guessed", input: { name: "Tönung Kopfhaut Kur" }, expected: null },
  // T4 — a scalp word plus a treatment word, and no oil, is scalp care.
  { rule: "T4_scalp_treatment", input: { name: "Scalp Treatment" }, expected: "scalp_care" },
  { rule: "T4_scalp_treatment", input: { name: "Kopfhaut-Kur" }, expected: "scalp_care" },
  { rule: "T4_scalp_treatment", input: { name: "Kopfhaut-Serum" }, expected: "scalp_care" },
  { rule: "T4_scalp_treatment", input: { name: "Scalp Tonic" }, expected: "scalp_care" },
  // T9 — an oil with a treatment word is an oil.
  { rule: "T9_oil_treatment", input: { name: "Öl-Kur" }, expected: "oil" },
  { rule: "T9_oil_treatment", input: { name: "Oil Treatment" }, expected: "oil" },
  { rule: "T9_oil_treatment", input: { name: "Haaröl-Kur" }, expected: "oil" },
  { rule: "T9_oil_treatment", input: { name: "Ölkur Intensiv" }, expected: "oil" },
  { rule: "T9_oil_treatment", input: { name: "Scalp Oil Treatment" }, expected: "oil" },
  // T10 — an oil with a pre-wash word is an oil („Pre-Wash Oil" already is one by T5).
  { rule: "T10_oil_pre_wash", input: { name: "Pre-Shampoo Öl" }, expected: "oil" },
  { rule: "T5_name", input: { name: "Pre-Wash Oil" }, expected: "oil" },
  // T11 — an oil with a leave-in word is an oil.
  { rule: "T11_oil_leave_in", input: { name: "Leave-in Öl" }, expected: "oil" },
  { rule: "T11_oil_leave_in", input: { name: "Leave-in Oil" }, expected: "oil" },
  { rule: "T11_oil_leave_in", input: { name: "Sprühkur Öl" }, expected: "oil" },
  // T12 — nothing (or more than one product noun) matched: unknown. The oil rules need
  // the oil to be the only product noun left.
  { rule: "T12_unknown", input: { name: "Argan Oil Shampoo" }, expected: null },
  { rule: "T12_unknown", input: { name: "Öl Maske" }, expected: null },
  { rule: "T12_unknown", input: { name: "Haarkur mit Öl" }, expected: null },
  { rule: "T12_unknown", input: { name: "Leave-in Conditioner mit Öl" }, expected: null },
  { rule: "T12_unknown", input: { name: "Olaplex" }, expected: null },
  { rule: "T12_unknown", input: { name: "" }, expected: null },
  { rule: "T12_unknown", input: {}, expected: null },
]

for (const fixture of TYPE_FIXTURES) {
  test(`${fixture.rule}: ${JSON.stringify(fixture.input)} -> ${fixture.expected}`, () => {
    const result = classifyDiscoveryProductType(fixture.input)
    assert.equal(result.productType, fixture.expected)
    assert.equal(result.rule, fixture.rule)
  })
}

// --- Usage step + preselection (R9, F5) -------------------------------------------

type StepFixture = {
  rule: DiscoveryPreselectRuleId
  productType: PersonalPlanCategory | null
  name: string | null
  expected:
    | {
        kind: "ask"
        question: "oil_use" | "care_use" | "shampoo_use"
        preselected: DiscoveryUsageOptionKey
      }
    | { kind: "fixed"; usage: DiscoveryUsage }
    | { kind: "what_is_it" }
}

const STEP_FIXTURES: StepFixture[] = [
  // Oil: four uses, preselected from the name in this order.
  {
    rule: "P1_oil_scalp",
    productType: "oil",
    name: "Kopfhaut-Öl",
    expected: { kind: "ask", question: "oil_use", preselected: "oil_scalp" },
  },
  {
    rule: "P1_oil_scalp",
    productType: "oil",
    name: "Scalp Pre-Wash Oil",
    expected: { kind: "ask", question: "oil_use", preselected: "oil_scalp" },
  },
  {
    rule: "P2_oil_pre_wash",
    productType: "oil",
    name: "Pre-Wash Oil",
    expected: { kind: "ask", question: "oil_use", preselected: "oil_pre_wash" },
  },
  {
    rule: "P2_oil_pre_wash",
    productType: "oil",
    name: "Prewash Treatment Öl",
    expected: { kind: "ask", question: "oil_use", preselected: "oil_pre_wash" },
  },
  {
    rule: "P2_oil_pre_wash",
    productType: "oil",
    name: "Öl für vor der Wäsche",
    expected: { kind: "ask", question: "oil_use", preselected: "oil_pre_wash" },
  },
  {
    rule: "P2_oil_pre_wash",
    productType: "oil",
    name: "Ölkur Intensiv",
    expected: { kind: "ask", question: "oil_use", preselected: "oil_pre_wash" },
  },
  {
    rule: "P3_oil_finish",
    productType: "oil",
    name: "Glanzöl Finish",
    expected: { kind: "ask", question: "oil_use", preselected: "oil_dry_finish" },
  },
  {
    rule: "P3_oil_finish",
    productType: "oil",
    name: "Haar-Serum Öl",
    expected: { kind: "ask", question: "oil_use", preselected: "oil_dry_finish" },
  },
  {
    rule: "P4_oil_default",
    productType: "oil",
    name: "Olaplex No. 7 Bonding Oil",
    expected: { kind: "ask", question: "oil_use", preselected: "oil_damp" },
  },
  {
    rule: "P4_oil_default",
    productType: "oil",
    name: null,
    expected: { kind: "ask", question: "oil_use", preselected: "oil_damp" },
  },
  {
    rule: "P2_oil_pre_wash",
    productType: "oil",
    name: "Oil Treatment",
    expected: { kind: "ask", question: "oil_use", preselected: "oil_pre_wash" },
  },
  {
    rule: "P2_oil_pre_wash",
    productType: "oil",
    name: "Pre-Shampoo Öl",
    expected: { kind: "ask", question: "oil_use", preselected: "oil_pre_wash" },
  },
  {
    rule: "P4_oil_default",
    productType: "oil",
    name: "Leave-in Öl",
    expected: { kind: "ask", question: "oil_use", preselected: "oil_damp" },
  },
  // „Sprühkur" is a leave-in word, not a pre-wash treatment.
  {
    rule: "P4_oil_default",
    productType: "oil",
    name: "Sprühkur Öl",
    expected: { kind: "ask", question: "oil_use", preselected: "oil_damp" },
  },
  // „Kurz" is not „Kur": the pre-wash rule reads „kur" only at a word end.
  {
    rule: "P4_oil_default",
    productType: "oil",
    name: "Öl für kurzes Haar",
    expected: { kind: "ask", question: "oil_use", preselected: "oil_damp" },
  },
  // Care family: the detected type is preselected.
  {
    rule: "P5_care_type",
    productType: "conditioner",
    name: "Repair Conditioner",
    expected: { kind: "ask", question: "care_use", preselected: "conditioner" },
  },
  {
    rule: "P5_care_type",
    productType: "mask",
    name: null,
    expected: { kind: "ask", question: "care_use", preselected: "mask" },
  },
  {
    rule: "P5_care_type",
    productType: "leave_in",
    name: "Haarkur Leave-in",
    expected: { kind: "ask", question: "care_use", preselected: "leave_in" },
  },
  // Shampoo family.
  {
    rule: "P6_shampoo_type",
    productType: "shampoo",
    name: null,
    expected: { kind: "ask", question: "shampoo_use", preselected: "shampoo" },
  },
  {
    rule: "P6_shampoo_type",
    productType: "deep_cleansing_shampoo",
    name: "Clarifying Shampoo",
    expected: { kind: "ask", question: "shampoo_use", preselected: "deep_cleansing_shampoo" },
  },
  // No question: usage = product type.
  ...(["heat_protectant", "dry_shampoo", "bondbuilder", "scalp_care"] as const).map(
    (productType): StepFixture => ({
      rule: "P7_no_question",
      productType,
      name: "Kopfhaut Scalp Kur",
      expected: { kind: "fixed", usage: { category: productType, role: null } },
    }),
  ),
  // Unknown: „Was ist das?" with „Weiß ich nicht".
  { rule: "P8_what_is_it", productType: null, name: "Olaplex", expected: { kind: "what_is_it" } },
]

for (const fixture of STEP_FIXTURES) {
  test(`${fixture.rule}: ${fixture.productType} „${fixture.name}"`, () => {
    const step = discoveryUsageStepFor(fixture.productType, fixture.name)
    assert.equal(step.rule, fixture.rule)
    if (fixture.expected.kind === "ask") {
      assert.equal(step.kind, "ask")
      if (step.kind !== "ask") return
      assert.equal(step.question.kind, fixture.expected.question)
      assert.equal(step.preselected, fixture.expected.preselected)
      // The preselected answer is one of the question's own options.
      assert.ok(step.question.options.some((option) => option.key === step.preselected))
    } else if (fixture.expected.kind === "fixed") {
      assert.equal(step.kind, "fixed")
      if (step.kind !== "fixed") return
      assert.deepEqual(step.usage, fixture.expected.usage)
    } else {
      assert.equal(step.kind, "what_is_it")
    }
  })
}

// --- Adversarial set (end to end: type + step) ------------------------------------

type EndToEnd = {
  name: string
  catalogCategory?: string
  productType: PersonalPlanCategory | null
  step: "what_is_it" | DiscoveryUsageOptionKey | "fixed"
}

const ADVERSARIAL: EndToEnd[] = [
  { name: "Kopfhaut-Öl", productType: "oil", step: "oil_scalp" },
  { name: "Scalp Oil", productType: "oil", step: "oil_scalp" },
  // 2-in-1 is two products in one bottle: she says which one she means.
  { name: "2in1 Shampoo & Spülung", productType: null, step: "what_is_it" },
  { name: "2 in 1 Scalp Shampoo", productType: null, step: "what_is_it" },
  { name: "Haarkur Leave-in", productType: "leave_in", step: "leave_in" },
  // A „bonding" oil is still an oil by name; the bondbuilder type only comes from the catalog.
  { name: "Olaplex No. 7 Bonding Oil", productType: "oil", step: "oil_damp" },
  {
    name: "Olaplex No. 7 Bonding Oil",
    catalogCategory: "bondbuilder",
    productType: "bondbuilder",
    step: "fixed",
  },
  { name: "Olaplex", productType: null, step: "what_is_it" },
  { name: "Kérastase", productType: null, step: "what_is_it" },
  { name: "Guhl", productType: null, step: "what_is_it" },
  { name: "", productType: null, step: "what_is_it" },
  { name: "   ", productType: null, step: "what_is_it" },
  // Clearly oils (coordinator ruling 2026-09-24): an oil treatment or pre-wash oil is used
  // before washing, a leave-in oil after.
  { name: "Öl-Kur", productType: "oil", step: "oil_pre_wash" },
  { name: "Oil Treatment", productType: "oil", step: "oil_pre_wash" },
  { name: "Haaröl-Kur", productType: "oil", step: "oil_pre_wash" },
  { name: "Pre-Shampoo Öl", productType: "oil", step: "oil_pre_wash" },
  { name: "Pre-Wash Oil", productType: "oil", step: "oil_pre_wash" },
  { name: "Leave-in Öl", productType: "oil", step: "oil_damp" },
  { name: "Leave-in Oil", productType: "oil", step: "oil_damp" },
  { name: "Scalp Oil Treatment", productType: "oil", step: "oil_scalp" },
  // A scalp TREATMENT is scalp care, not a mask with a scalp word in front of it.
  { name: "Scalp Treatment", productType: "scalp_care", step: "fixed" },
  { name: "Kopfhaut-Kur", productType: "scalp_care", step: "fixed" },
  { name: "Kopfhaut-Serum", productType: "scalp_care", step: "fixed" },
  // An oil next to another product noun is still not guessed.
  { name: "Argan Oil Shampoo", productType: null, step: "what_is_it" },
  { name: "Leave-in Conditioner mit Öl", productType: null, step: "what_is_it" },
  { name: "2in1 Öl-Kur", productType: null, step: "what_is_it" },
  // Colour products are never guessed.
  { name: "Color Shampoo", productType: null, step: "what_is_it" },
  // Upper case and the umlaut's case fold.
  { name: "ARGANÖL", productType: "oil", step: "oil_damp" },
  { name: "Kopfhaut Serum", productType: "scalp_care", step: "fixed" },
]

for (const fixture of ADVERSARIAL) {
  test(`adversarial: „${fixture.name}"${fixture.catalogCategory ? ` (catalog ${fixture.catalogCategory})` : ""}`, () => {
    const result = classifyDiscoveryProduct({
      name: fixture.name,
      catalogCategory: fixture.catalogCategory ?? null,
    })
    assert.equal(result.productType, fixture.productType)
    if (fixture.step === "what_is_it" || fixture.step === "fixed") {
      assert.equal(result.step.kind, fixture.step)
    } else {
      assert.equal(result.step.kind, "ask")
      if (result.step.kind === "ask") assert.equal(result.step.preselected, fixture.step)
    }
  })
}

// --- Question vocabulary (R9) ----------------------------------------------------

test("R9: the oil question offers exactly the four uses, three oil roles and the scalp", () => {
  const oil = DISCOVERY_USAGE_QUESTIONS.oil_use
  assert.equal(oil.prompt, "Wann benutzt du das Öl?")
  assert.deepEqual(
    oil.options.map((option) => [option.key, option.label, option.usage]),
    [
      ["oil_pre_wash", "Vor der Haarwäsche", { category: "oil", role: "pre_wash_fibre_treatment" }],
      [
        "oil_damp",
        "Nach der Wäsche ins feuchte Haar",
        { category: "oil", role: "leave_on_fibre_conditioning" },
      ],
      ["oil_dry_finish", "Als Finish ins trockene Haar", { category: "oil", role: "dry_finish" }],
      [
        "oil_scalp",
        "Auf die Kopfhaut",
        { category: "scalp_care", role: "scalp_flake_oil_adjunct" },
      ],
    ],
  )
})

test("R9: the care and shampoo questions map to their categories without roles", () => {
  assert.equal(DISCOVERY_USAGE_QUESTIONS.care_use.prompt, "Wie benutzt du das?")
  assert.deepEqual(
    DISCOVERY_USAGE_QUESTIONS.care_use.options.map((option) => [option.label, option.usage]),
    [
      ["Kurz einwirken & ausspülen", { category: "conditioner", role: null }],
      ["Länger einwirken als Kur", { category: "mask", role: null }],
      ["Bleibt im Haar", { category: "leave_in", role: null }],
    ],
  )
  assert.equal(DISCOVERY_USAGE_QUESTIONS.shampoo_use.prompt, "Wie oft benutzt du das?")
  assert.deepEqual(
    DISCOVERY_USAGE_QUESTIONS.shampoo_use.options.map((option) => [option.label, option.usage]),
    [
      ["Bei jeder Wäsche", { category: "shampoo", role: null }],
      ["Ab und zu zur Tiefenreinigung", { category: "deep_cleansing_shampoo", role: null }],
    ],
  )
})

test("every question option is a valid usage (the DB CHECK's pairs)", () => {
  for (const question of Object.values(DISCOVERY_USAGE_QUESTIONS)) {
    for (const option of question.options)
      assert.ok(isValidDiscoveryUsage(option.usage), option.key)
  }
})

test("usage roles: only the three oil roles with oil, the scalp oil role with scalp care", () => {
  assert.deepEqual(
    [...DISCOVERY_OIL_USAGE_ROLES],
    ["pre_wash_fibre_treatment", "leave_on_fibre_conditioning", "dry_finish"],
  )
  assert.deepEqual(
    [...DISCOVERY_USAGE_ROLES],
    [
      "pre_wash_fibre_treatment",
      "leave_on_fibre_conditioning",
      "dry_finish",
      "scalp_flake_oil_adjunct",
    ],
  )
  for (const category of SUPPORTED_PRODUCT_CATEGORY_KEYS) {
    assert.ok(isValidDiscoveryUsage({ category, role: null }), `${category} without a role`)
    for (const role of DISCOVERY_USAGE_ROLES) {
      const allowed =
        (category === "oil" && role !== "scalp_flake_oil_adjunct") ||
        (category === "scalp_care" && role === "scalp_flake_oil_adjunct")
      assert.equal(isValidDiscoveryUsage({ category, role }), allowed, `${category}/${role}`)
    }
  }
  assert.equal(
    isValidDiscoveryUsage({ category: "oil", role: "scalp_comfort" as never }),
    false,
    "a routine role the discovery usage does not know",
  )
})

// --- F2: legitimate usage differences ---------------------------------------------

test("F2: a usage inside the product's R9 family is legitimate; outside it is not", () => {
  const legit: Array<[PersonalPlanCategory, PersonalPlanCategory]> = [
    ["conditioner", "mask"],
    ["conditioner", "leave_in"],
    ["mask", "conditioner"],
    ["mask", "leave_in"],
    ["leave_in", "conditioner"],
    ["leave_in", "mask"],
    ["shampoo", "deep_cleansing_shampoo"],
    ["deep_cleansing_shampoo", "shampoo"],
    ["oil", "scalp_care"],
  ]
  for (const [productType, usage] of legit) {
    assert.equal(
      isDiscoveryUsageWithinProductFamily(productType, usage),
      true,
      `${productType}→${usage}`,
    )
  }
  const outside: Array<[PersonalPlanCategory, PersonalPlanCategory]> = [
    // One-directional: a scalp-care product is never asked, so it has no oil use.
    ["scalp_care", "oil"],
    ["shampoo", "conditioner"],
    ["conditioner", "shampoo"],
    ["oil", "leave_in"],
    ["mask", "oil"],
    ["heat_protectant", "leave_in"],
    ["dry_shampoo", "shampoo"],
    ["bondbuilder", "mask"],
  ]
  for (const [productType, usage] of outside) {
    assert.equal(
      isDiscoveryUsageWithinProductFamily(productType, usage),
      false,
      `${productType}→${usage}`,
    )
  }
  // Same category is never a difference.
  for (const category of SUPPORTED_PRODUCT_CATEGORY_KEYS) {
    assert.equal(isDiscoveryUsageWithinProductFamily(category, category), true, category)
  }
})
