import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

type ExpectedRegressionBehavior = {
  primary_intent: string
  product_request_kind: string
  routine_intent: string
  category: string
  requested_product_count: number | null
  count_policy: string
  required_tool: "none" | "select_products" | "build_or_fix_routine"
  must_not_surface_products: boolean
  must_not_mutate_routine: boolean
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
    category: "conditioner",
    requested_product_count: 3,
    count_policy: "default",
    required_tool: "select_products",
    must_not_surface_products: false,
  })

  assertExpected(findPrompt("Welche Art von Spülung passt zu feinem Haar?"), {
    primary_intent: "category_education",
    product_request_kind: "category_education",
    category: "conditioner",
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
      product_request_kind: "routine_product_deep_dive",
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

// Live manual batch reruns intentionally stay outside CI. To inspect real GPT-5.4-mini output,
// run the app locally and submit these cases through /api/labs/agent-compare or Compare Lab.
