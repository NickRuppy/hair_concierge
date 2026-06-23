import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

type ExpectedRegressionBehavior = {
  primary_intent: string
  product_request_kind: string
  routine_intent: string
  care_category: string
  requested_product_count: number | null
  count_policy: string
  required_tool: "none" | "select_products" | "build_or_fix_routine"
  must_not_surface_products: boolean
  must_not_mutate_routine: boolean
  routine_context_required: boolean
  safety_mode: "normal" | "restricted" | "hard_short_circuit" | null
  requires_evidence_quote: boolean
}

type RequestInterpretationRegressionCase = {
  id: string
  dimension: string
  description: string
  prompt?: string
  turns?: string[]
  expected: ExpectedRegressionBehavior
  answer_quality_criteria: string[]
}

const regressionCases = JSON.parse(
  readFileSync("data/agent-v2/evals/request-interpretation-regression.json", "utf8"),
) as RequestInterpretationRegressionCase[]

type GuidanceMigrationRegressionCase = {
  id: string
  prompt?: string
  turns?: string[]
  profile_context_key?: string
  expected_tools: string[]
  expected_guidance: string[]
  must_not_contain: string[]
  quality_criteria: string[]
}

type GuidanceMigrationRegressionFixture = {
  profiles: Record<string, Record<string, unknown>>
  default_profile_context_key: string
  incomplete_profile_context_keys: string[]
  cases: GuidanceMigrationRegressionCase[]
  edge_cases: GuidanceMigrationRegressionCase[]
}

const guidanceMigrationFixture = JSON.parse(
  readFileSync("data/agent-v2/evals/guidance-migration-regression.json", "utf8"),
) as GuidanceMigrationRegressionFixture
const guidanceMigrationCases = guidanceMigrationFixture.cases
const guidanceMigrationEdgeCases = guidanceMigrationFixture.edge_cases ?? []

function findPrompt(prompt: string): RequestInterpretationRegressionCase {
  const entry = regressionCases.find((item) => item.prompt === prompt)
  assert.ok(entry, `missing regression prompt: ${prompt}`)
  return entry
}

function findTurns(turns: string[]): RequestInterpretationRegressionCase {
  const entry = regressionCases.find(
    (item) =>
      Array.isArray(item.turns) &&
      item.turns.length === turns.length &&
      item.turns.every((turn, index) => turn === turns[index]),
  )
  assert.ok(entry, `missing regression turns: ${turns.join(" -> ")}`)
  return entry
}

function assertExpected(
  entry: RequestInterpretationRegressionCase,
  expected: Partial<ExpectedRegressionBehavior>,
): void {
  assert.deepEqual(
    Object.fromEntries(
      Object.keys(expected).map((key) => [
        key,
        entry.expected[key as keyof ExpectedRegressionBehavior],
      ]),
    ),
    expected,
    entry.id,
  )
}

test("AgentV2 manual regression fixture covers the agreed 10-case batch", () => {
  for (const prompt of [
    "Welche Spülung passt zu feinem Haar?",
    "Welche Art von Spülung passt zu feinem Haar?",
    "Nenn mir zwei Conditioner.",
    "Brauche ich eher eine Maske oder Conditioner?",
    "Ich will meine Routine einfacher machen.",
    "Meine Kopfhaut juckt und ist gerötet, welches Shampoo soll ich nehmen?",
    "Welches Öl passt, ohne dass es schwer wird?",
    "Vergleich mir Leave-in Spray und Creme für feines Haar.",
    "Ich habe coloriertes, trockenes Haar und Frizz. Was soll ich ändern?",
  ]) {
    findPrompt(prompt)
  }

  findTurns([
    "Ich will meine Routine einfacher machen.",
    "Welches Produkt passt für den ersten Zusatz?",
  ])
})

test("AgentV2 manual regression fixture encodes product ask and category education boundaries", () => {
  assertExpected(findPrompt("Welche Spülung passt zu feinem Haar?"), {
    primary_intent: "product_recommendation",
    product_request_kind: "specific_products",
    care_category: "conditioner",
    requested_product_count: 3,
    count_policy: "default",
    required_tool: "select_products",
    must_not_surface_products: false,
  })

  assertExpected(findPrompt("Welche Art von Spülung passt zu feinem Haar?"), {
    primary_intent: "category_education",
    product_request_kind: "category_education",
    care_category: "conditioner",
    requested_product_count: null,
    required_tool: "none",
    must_not_surface_products: true,
  })

  assertExpected(findPrompt("Nenn mir zwei Conditioner."), {
    product_request_kind: "specific_products",
    requested_product_count: 2,
    count_policy: "exact",
    required_tool: "select_products",
    must_not_surface_products: false,
  })

  assertExpected(findPrompt("Brauche ich eher eine Maske oder Conditioner?"), {
    primary_intent: "category_education",
    product_request_kind: "category_education",
    care_category: "none",
    requested_product_count: null,
    required_tool: "none",
    must_not_surface_products: true,
  })

  assertExpected(findPrompt("Nenn mir ein paar passende Conditioner."), {
    product_request_kind: "specific_products",
    requested_product_count: 3,
    count_policy: "default",
    required_tool: "select_products",
  })
})

test("AgentV2 manual regression fixture encodes routine track and routine product deep dives", () => {
  assertExpected(findPrompt("Ich will meine Routine einfacher machen."), {
    primary_intent: "routine_mutation",
    product_request_kind: "none",
    routine_intent: "modify",
    required_tool: "build_or_fix_routine",
    must_not_surface_products: true,
    must_not_mutate_routine: false,
  })

  assertExpected(
    findTurns([
      "Ich will meine Routine einfacher machen.",
      "Welches Produkt passt für den ersten Zusatz?",
    ]),
    {
      primary_intent: "product_recommendation",
      product_request_kind: "specific_products",
      routine_context_required: true,
      requested_product_count: 3,
      required_tool: "select_products",
      must_not_surface_products: false,
      must_not_mutate_routine: true,
    },
  )
})

test("AgentV2 manual regression fixture encodes safety and no-tool expectations", () => {
  for (const entry of [
    findPrompt("Meine Kopfhaut juckt und ich habe Schuppen."),
    findPrompt("Meine Kopfhaut juckt und ist gerötet, welches Shampoo soll ich nehmen?"),
  ]) {
    assertExpected(entry, {
      primary_intent: "safety_boundary",
      product_request_kind: "none",
      required_tool: "none",
      must_not_surface_products: true,
      safety_mode: "restricted",
    })
  }

  assertExpected(findPrompt("Meine Kopfhaut blutet und Haare fallen büschelweise aus."), {
    primary_intent: "safety_boundary",
    required_tool: "none",
    must_not_surface_products: true,
    safety_mode: "hard_short_circuit",
  })
})

test("AgentV2 manual regression fixture keeps manual quality gates attached to cases", () => {
  for (const entry of regressionCases) {
    assert.ok(
      entry.answer_quality_criteria.includes("direct_german_answer_first"),
      `${entry.id}: every manual case should preserve direct German answer shape`,
    )
    assert.ok(
      entry.answer_quality_criteria.includes("no_raw_internal_or_tool_language") ||
        entry.answer_quality_criteria.includes("practical_next_step_or_caveat") ||
        entry.answer_quality_criteria.includes("no_bullet_wall"),
      `${entry.id}: each manual case needs at least one user-facing quality guard`,
    )
  }
})

test("AgentV2 guidance migration regression fixture covers broad manual prompt batch", () => {
  assert.equal(guidanceMigrationCases.length, 58)

  for (const entry of guidanceMigrationCases) {
    assert.ok(entry.id.length > 0)
    assert.ok(entry.prompt || (Array.isArray(entry.turns) && entry.turns.length > 0), entry.id)
    assert.ok(Array.isArray(entry.expected_tools), entry.id)
    assert.ok(Array.isArray(entry.expected_guidance), entry.id)
    assert.ok(Array.isArray(entry.must_not_contain), entry.id)
    assert.ok(entry.quality_criteria.length > 0, entry.id)
  }

  for (const id of [
    "bondbuilder-types-no-hallucinated-product-forms",
    "routine-context-first-extra-product",
    "restricted-scalp-symptoms",
    "hard-short-circuit-hair-loss",
    "previous-offer-reference",
  ]) {
    assert.ok(
      guidanceMigrationCases.some((entry) => entry.id === id),
      `missing ${id}`,
    )
  }

  const firstExtraProduct = guidanceMigrationCases.find(
    (entry) => entry.id === "routine-context-first-extra-product",
  )
  assert.ok(firstExtraProduct)
  assert.match(
    firstExtraProduct.quality_criteria.join("\n"),
    /why this category\/product is the next add-on.*visible profile, routine, CareBalance, or routine-thread fact/i,
  )

  assert.ok(
    guidanceMigrationEdgeCases.some(
      (entry) => entry.profile_context_key === "incomplete_missing_balance",
    ),
    "incomplete profile case should be separated from the 46-case review batch",
  )
})

test("AgentV2 guidance migration regression fixture keeps edge cases runnable but separated", () => {
  assert.ok(guidanceMigrationEdgeCases.length > 0)

  const normalIds = new Set(guidanceMigrationCases.map((entry) => entry.id))
  for (const entry of guidanceMigrationEdgeCases) {
    assert.ok(!normalIds.has(entry.id), `${entry.id}: edge case id must not duplicate normal cases`)
    assert.ok(entry.prompt || (Array.isArray(entry.turns) && entry.turns.length > 0), entry.id)
    assert.ok(Array.isArray(entry.expected_tools), entry.id)
    assert.ok(Array.isArray(entry.expected_guidance), entry.id)
    assert.ok(Array.isArray(entry.must_not_contain), entry.id)
    assert.ok(entry.quality_criteria.length > 0, entry.id)

    const profileKey = entry.profile_context_key
    assert.ok(profileKey, `${entry.id}: edge cases should name their profile context explicitly`)
    assert.ok(
      guidanceMigrationFixture.profiles[profileKey],
      `${entry.id}: unknown profile ${profileKey}`,
    )
    assert.ok(
      guidanceMigrationFixture.incomplete_profile_context_keys.includes(profileKey),
      `${entry.id}: incomplete edge profile must be explicitly registered`,
    )
  }
})

test("AgentV2 guidance migration regression fixture pins natural opening and feasible CTA quality", () => {
  const expectedCriteriaById: Record<string, RegExp[]> = {
    "mask-vs-conditioner-education": [
      /mirrors.*Maske.*Conditioner|answers.*Maske.*Conditioner/i,
      /ending.*not repeat.*Maske.*Conditioner|CTA.*not repeat.*answered question/i,
    ],
    "bondbuilder-brand-comparison-grounded": [
      /opens.*K18.*OLAPLEX|mirrors.*K18.*OLAPLEX/i,
      /does not ask.*which brand.*just compared|CTA.*does not re-ask.*comparison/i,
    ],
    "deep-cleansing-product-detail": [
      /CTA.*not offer.*unsupported.*claim|does not offer.*unsupported.*claim check/i,
      /feasible.*exact variant|grounded.*next action/i,
    ],
    "dry-shampoo-product-detail": [
      /CTA.*not offer.*unsupported.*white.*cast|does not offer.*unsupported.*residue check/i,
      /feasible.*variant|grounded.*next action/i,
    ],
    "oil-education-finish-vs-prewash": [
      /opens.*vor dem Waschen.*nach dem Stylen|mirrors.*finish.*pre-wash/i,
      /ending.*material question|CTA.*one material question|bridge.*routine/i,
    ],
    "leave-in-spray-vs-cream": [
      /opens.*Spray.*Creme|mirrors.*Spray.*Creme/i,
      /CTA.*specific.*feasible.*next step|ending.*not repeat.*Spray.*Creme/i,
    ],
    "oil-growth-safety-boundary": [
      /opens.*Rosmarin.*Haarausfall|mirrors.*Rosmarin.*Haarausfall/i,
      /CTA.*safety.*feasible|ending.*not offer.*growth.*product/i,
    ],
    "peeling-scalp-buildup": [
      /opens.*Kopfhautpeeling.*Rückständen|mirrors.*Kopfhautpeeling.*Rückständen/i,
      /CTA.*not repeat.*Rückständen|bridge.*reset.*routine|material question/i,
    ],
  }

  for (const [id, patterns] of Object.entries(expectedCriteriaById)) {
    const entry = guidanceMigrationCases.find((item) => item.id === id)
    assert.ok(entry, `missing ${id}`)
    const criteria = entry.quality_criteria.join("\n")

    for (const pattern of patterns) {
      assert.match(criteria, pattern, `${id}: missing quality criterion ${pattern}`)
    }
  }
})

test("AgentV2 guidance migration regression fixture keeps normal cases on complete canonical profiles", () => {
  const canonical = {
    hair_texture: new Set(["straight", "wavy", "curly", "coily"]),
    thickness: new Set(["fine", "normal", "coarse"]),
    density: new Set(["low", "medium", "high"]),
    concerns: new Set([
      "hair_loss",
      "dandruff",
      "dryness",
      "oily_scalp",
      "hair_damage",
      "split_ends",
      "breakage",
      "frizz",
      "tangling",
      "thinning",
    ]),
    goals: new Set([
      "volume",
      "healthier_hair",
      "less_frizz",
      "color_protection",
      "moisture",
      "healthy_scalp",
      "shine",
      "curl_definition",
      "less_split_ends",
      "less_volume",
      "strengthen",
      "anti_breakage",
    ]),
    chemical_treatment: new Set([
      "natural",
      "colored",
      "bleached",
      "permed",
      "chemically_straightened",
    ]),
    scalp_type: new Set(["oily", "balanced", "dry"]),
    scalp_condition: new Set(["dandruff", "dry_flakes", "irritated", null]),
    shampoo_frequency: new Set([
      "less_than_monthly",
      "monthly_1x",
      "biweekly_1x",
      "weekly_1x",
      "weekly_2x",
      "weekly_3_4x",
      "weekly_5_6x",
      "daily_1x",
    ]),
    protein_moisture_balance: new Set(["snaps", "stretches_bounces", "stretches_stays"]),
    drying_method: new Set(["air_dry", "blow_dry", "blow_dry_diffuser"]),
    heat_styling: new Set(["daily", "several_weekly", "once_weekly", "rarely", "never"]),
  }
  const requiredNormalFields = [
    "hair_texture",
    "thickness",
    "density",
    "scalp_type",
    "scalp_condition",
    "concerns",
    "goals",
    "chemical_treatment",
    "shampoo_frequency",
    "drying_method",
    "heat_styling",
    "protein_moisture_balance",
  ]

  assert.ok(guidanceMigrationFixture.profiles, "fixture should define named profile fixtures")
  assert.equal(guidanceMigrationFixture.default_profile_context_key, "fine_wavy_colored_dry_frizz")
  assert.ok(
    Array.isArray(guidanceMigrationFixture.incomplete_profile_context_keys),
    "fixture should explicitly name incomplete-profile edge contexts",
  )
  for (const treatment of ["permed", "chemically_straightened"]) {
    assert.ok(
      canonical.chemical_treatment.has(treatment as never),
      `canonical chemical_treatment allowlist missing ${treatment}`,
    )
  }

  for (const entry of guidanceMigrationCases) {
    const profileKey =
      entry.profile_context_key ?? guidanceMigrationFixture.default_profile_context_key
    const profile = guidanceMigrationFixture.profiles[profileKey]
    assert.ok(profile, `${entry.id}: unknown profile context ${profileKey}`)

    const isIncompleteEdgeCase =
      guidanceMigrationFixture.incomplete_profile_context_keys.includes(profileKey)
    if (isIncompleteEdgeCase) {
      assert.match(
        entry.id,
        /incomplete|missing/i,
        `${entry.id}: incomplete profile contexts must be explicit edge cases`,
      )
      continue
    }

    for (const field of requiredNormalFields) {
      assert.ok(
        Object.hasOwn(profile, field) && profile[field] !== undefined,
        `${entry.id}: normal profile ${profileKey} missing ${field}`,
      )
    }
    assert.ok(
      canonical.hair_texture.has(profile.hair_texture as never),
      `${entry.id}: non-canonical hair_texture`,
    )
    assert.ok(
      canonical.thickness.has(profile.thickness as never),
      `${entry.id}: non-canonical thickness`,
    )
    assert.ok(canonical.density.has(profile.density as never), `${entry.id}: non-canonical density`)
    assert.ok(
      Array.isArray(profile.concerns) &&
        profile.concerns.every((value) => canonical.concerns.has(value as never)),
      `${entry.id}: non-canonical concern`,
    )
    assert.ok(
      Array.isArray(profile.goals) &&
        profile.goals.every((value) => canonical.goals.has(value as never)),
      `${entry.id}: non-canonical goal`,
    )
    assert.ok(
      Array.isArray(profile.chemical_treatment) &&
        profile.chemical_treatment.every((value) =>
          canonical.chemical_treatment.has(value as never),
        ),
      `${entry.id}: non-canonical chemical_treatment`,
    )
    assert.ok(
      canonical.scalp_type.has(profile.scalp_type as never),
      `${entry.id}: non-canonical scalp_type`,
    )
    assert.ok(
      canonical.scalp_condition.has(profile.scalp_condition as never),
      `${entry.id}: non-canonical scalp_condition`,
    )
    assert.ok(
      canonical.shampoo_frequency.has(profile.shampoo_frequency as never),
      `${entry.id}: non-canonical shampoo_frequency`,
    )
    assert.ok(
      canonical.protein_moisture_balance.has(profile.protein_moisture_balance as never),
      `${entry.id}: missing or non-canonical protein_moisture_balance`,
    )
    assert.ok(
      canonical.drying_method.has(profile.drying_method as never),
      `${entry.id}: non-canonical drying_method`,
    )
    assert.ok(
      canonical.heat_styling.has(profile.heat_styling as never),
      `${entry.id}: non-canonical heat_styling`,
    )
  }
})

test("AgentV2 guidance migration runner exits nonzero for failed reports by default", async () => {
  const module = await import("../scripts/agent-v2/run-guidance-regression")

  assert.equal(
    module.shouldFailGuidanceRegressionProcess({ failCount: 1, argv: ["node", "script"] }),
    true,
  )
  assert.equal(
    module.shouldFailGuidanceRegressionProcess({
      failCount: 1,
      argv: ["node", "script", "--allow-failures"],
    }),
    false,
  )
  assert.equal(
    module.shouldFailGuidanceRegressionProcess({ failCount: 0, argv: ["node", "script"] }),
    false,
  )
})

// Live manual batch reruns intentionally stay outside CI. To inspect real GPT-5.4-mini output,
// run `npx tsx scripts/agent-v2/run-guidance-regression.ts`; use `--allow-failures` only when
// you intentionally want a report artifact even if cases fail. You can also submit these cases
// through /api/labs/agent-compare / Compare Lab.
