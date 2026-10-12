import assert from "node:assert/strict"
import test from "node:test"

import {
  evaluateFit,
  type FitAxis,
  type FitEvaluationInput,
} from "../../src/lib/personal-plan/products/authority/fit-evaluator"
import { repairSupportAxisFitResult } from "../../src/lib/personal-plan/products/authority/categories/axis-fit"

const thickness: FitAxis = {
  id: "thickness",
  label: "Haardicke",
  scale: ["fine", "normal", "coarse"],
  productValues: ["fine"],
  targetValue: "fine",
}

// The ruled scales are independent fixtures, not calculated by the evaluator.
const orderedAxes = [
  { id: "thickness", label: "Haardicke", scale: ["fine", "normal", "coarse"] },
  { id: "weight", label: "Gewicht", scale: ["light", "moderate", "rich"] },
  { id: "care_direction", label: "Pflegeausrichtung", scale: ["protein", "balanced", "moisture"] },
  { id: "cleansing", label: "Reinigungsintensität", scale: ["gentle", "regular", "strong"] },
] as const

for (const axis of orderedAxes) {
  for (const row of [
    { productIndex: 0, targetIndex: 0, steps: 0, verdict: "ideal" },
    { productIndex: 0, targetIndex: 1, steps: 1, verdict: "supportive" },
    { productIndex: 0, targetIndex: 2, steps: 2, verdict: "mismatch" },
    { productIndex: 2, targetIndex: 1, steps: 1, verdict: "supportive" },
    { productIndex: 2, targetIndex: 0, steps: 2, verdict: "mismatch" },
  ] as const) {
    test(`${axis.id}: ${row.productIndex} to ${row.targetIndex} is ${row.steps} steps`, () => {
      const result = evaluateFit({
        gates: [],
        axes: [
          {
            ...axis,
            productValues: [axis.scale[row.productIndex]],
            targetValue: axis.scale[row.targetIndex],
          },
        ],
      })
      assert.equal(result.verdict, row.verdict)
      assert.equal(result.missCount, row.steps)
      assert.equal(result.axisOutcomes[0]?.steps, row.steps)
      assert.equal(result.reasons.length, row.steps === 0 ? 0 : 1)
      if (row.steps > 0) assert.equal(result.reasons[0], result.axisOutcomes[0]?.reason)
    })
  }
}

// Tint and scalp sensitivity are binary axes: a two-step distance is impossible.
for (const id of ["tint", "scalp_sensitivity"]) {
  for (const row of [
    { product: "match", steps: 0, verdict: "ideal" },
    { product: "other", steps: 1, verdict: "supportive" },
  ] as const) {
    test(`${id}: ${row.steps} steps`, () => {
      const result = evaluateFit({
        gates: [],
        axes: [
          {
            id,
            label: id,
            scale: ["match", "other"],
            productValues: [row.product],
            targetValue: "match",
          },
        ],
      })
      assert.equal(result.verdict, row.verdict)
      assert.equal(result.missCount, row.steps)
      assert.equal(result.axisOutcomes[0]?.steps, row.steps)
    })
  }
}

for (const row of [
  { product: "high", target: "low", steps: 0, verdict: "ideal", helper: "pass" },
  { product: "high", target: "medium", steps: 0, verdict: "ideal", helper: "pass" },
  { product: "medium", target: "medium", steps: 0, verdict: "ideal", helper: "pass" },
  { product: "low", target: "medium", steps: 1, verdict: "supportive", helper: "caution" },
  { product: "low", target: "high", steps: 2, verdict: "mismatch", helper: "fail" },
] as const) {
  test(`repair: ${row.product} against ${row.target}`, () => {
    const result = evaluateFit({
      gates: [],
      axes: [
        {
          id: "repair",
          label: "Repair-Unterstützung",
          scale: ["low", "medium", "high"],
          productValues: [row.product],
          targetValue: row.target,
          direction: "at_or_above_is_zero",
        },
      ],
    })
    assert.equal(result.verdict, row.verdict)
    assert.equal(result.missCount, row.steps)
    assert.equal(result.axisOutcomes[0]?.steps, row.steps)
    // spec §3 / §7a.2, ruled 2026-10-12: stronger repair is a pass.
    assert.equal(
      repairSupportAxisFitResult(row.product, row.target, ["low", "medium", "high"]),
      row.helper,
    )
  })
}

for (const id of [
  "safety",
  "lifecycle",
  "wrong_job",
  "medical_exclusion",
  "bondbuilder_technology",
]) {
  for (const row of [
    { outcome: "pass", verdict: "ideal", reasons: [] },
    { outcome: "fail", verdict: "mismatch", reasons: ["Konkreter Ausschluss"] },
    { outcome: "unknown", verdict: "unknown", reasons: [] },
  ] as const) {
    test(`gate ${id}: ${row.outcome}`, () => {
      const result = evaluateFit({
        gates: [{ id, label: id, outcome: row.outcome, reason: "Konkreter Ausschluss" }],
        axes: [],
      })
      assert.deepEqual(result, {
        verdict: row.verdict,
        missCount: 0,
        axisOutcomes: [],
        reasons: [...row.reasons],
      })
    })
  }
}

const combinations: Array<{ name: string; axes: FitAxis[]; steps: number; verdict: string }> = [
  { name: "no gates or axes", axes: [], steps: 0, verdict: "ideal" },
  {
    name: "one miss",
    axes: [
      { ...thickness, productValues: ["normal"] },
      { ...thickness, id: "exact" },
    ],
    steps: 1,
    verdict: "supportive",
  },
  {
    name: "two one-step misses",
    axes: [
      { ...thickness, productValues: ["normal"] },
      { ...thickness, id: "second", productValues: ["normal"] },
    ],
    steps: 2,
    verdict: "mismatch",
  },
  {
    name: "one two-step miss",
    axes: [{ ...thickness, productValues: ["coarse"] }],
    steps: 2,
    verdict: "mismatch",
  },
  {
    name: "sum is not capped at two",
    axes: [
      { ...thickness, productValues: ["coarse"] },
      { ...thickness, id: "second", productValues: ["normal"] },
    ],
    steps: 3,
    verdict: "mismatch",
  },
]
for (const row of combinations) {
  test(`additive: ${row.name}`, () => {
    const result = evaluateFit({ gates: [], axes: row.axes })
    assert.equal(result.verdict, row.verdict)
    assert.equal(result.missCount, row.steps)
  })
}

for (const row of [
  { values: ["coarse", "fine"], target: "fine", steps: 0, verdict: "ideal" },
  { values: ["coarse", "normal"], target: "fine", steps: 1, verdict: "supportive" },
  { values: ["coarse"], target: "fine", steps: 2, verdict: "mismatch" },
  { values: ["fine", "coarse"], target: "normal", steps: 1, verdict: "supportive" },
] as const) {
  test(`thickness set ${row.values.join("/")} against ${row.target}`, () => {
    const result = evaluateFit({
      gates: [],
      axes: [{ ...thickness, productValues: row.values, targetValue: row.target }],
    })
    assert.equal(result.verdict, row.verdict)
    assert.equal(result.axisOutcomes[0]?.steps, row.steps)
  })
}

for (const row of [
  {
    productValues: ["protein"],
    acceptedTargets: ["moisture", "balanced"],
    steps: 1,
    verdict: "supportive",
  },
  {
    productValues: ["balanced"],
    acceptedTargets: ["moisture", "balanced"],
    steps: 0,
    verdict: "ideal",
  },
  {
    productValues: ["moisture"],
    acceptedTargets: ["balanced", "moisture"],
    steps: 0,
    verdict: "ideal",
  },
  { productValues: ["protein"], acceptedTargets: ["moisture"], steps: 2, verdict: "mismatch" },
  {
    productValues: ["protein", "moisture"],
    acceptedTargets: ["balanced", "moisture"],
    steps: 0,
    verdict: "ideal",
  },
] as const) {
  test(`accepted targets ${row.acceptedTargets.join("/")} for ${row.productValues.join("/")}`, () => {
    const result = evaluateFit({
      gates: [],
      axes: [
        {
          id: "mask.care_direction",
          label: "Pflegeausrichtung",
          scale: ["protein", "balanced", "moisture"],
          productValues: row.productValues,
          acceptedTargets: row.acceptedTargets,
        },
      ],
    })
    assert.equal(result.verdict, row.verdict)
    assert.equal(result.axisOutcomes[0]?.steps, row.steps)
  })
}

const missingAxes: Array<{ name: string; axis: FitAxis }> = [
  { name: "null product", axis: { ...thickness, productValues: null } },
  { name: "null target", axis: { ...thickness, targetValue: null } },
  { name: "empty product set", axis: { ...thickness, productValues: [] } },
  {
    name: "empty accepted set",
    axis: {
      id: "thickness",
      label: "Haardicke",
      scale: thickness.scale,
      productValues: ["fine"],
      acceptedTargets: [],
    },
  },
  { name: "product not on scale", axis: { ...thickness, productValues: ["invalid"] } },
  { name: "target not on scale", axis: { ...thickness, targetValue: "invalid" } },
  {
    name: "invalid member beside valid product",
    axis: { ...thickness, productValues: ["fine", "invalid"] },
  },
  {
    name: "invalid accepted target member",
    axis: {
      id: "thickness",
      label: "Haardicke",
      scale: thickness.scale,
      productValues: ["fine"],
      acceptedTargets: ["fine", "invalid"],
    },
  },
  { name: "empty scale", axis: { ...thickness, scale: [] } },
  {
    name: "invalid directional product",
    axis: { ...thickness, productValues: ["invalid"], direction: "at_or_above_is_zero" },
  },
]
for (const row of missingAxes) {
  test(`missing fact: ${row.name}`, () => {
    const result = evaluateFit({ gates: [], axes: [row.axis] })
    assert.equal(result.verdict, "unknown")
    assert.equal(result.missCount, 0)
    assert.equal(result.axisOutcomes[0]?.steps, null)
    assert.deepEqual(result.reasons, [])
  })
}

for (const missing of ["gate", "axis"] as const) {
  for (const row of [
    { product: "fine", verdict: "unknown", steps: 0 },
    { product: "normal", verdict: "unknown", steps: 1 },
    { product: "coarse", verdict: "mismatch", steps: 2 },
  ] as const) {
    test(`precedence: ${row.steps} known steps with missing ${missing}`, () => {
      const result = evaluateFit({
        gates:
          missing === "gate" ? [{ id: "safety", label: "Sicherheit", outcome: "unknown" }] : [],
        axes: [
          { ...thickness, productValues: [row.product] },
          ...(missing === "axis" ? [{ ...thickness, id: "missing", productValues: null }] : []),
        ],
      })
      assert.equal(result.verdict, row.verdict)
      assert.equal(result.missCount, row.steps)
    })
  }
}

test("known additive mismatch dominates a missing fact", () => {
  const result = evaluateFit({
    gates: [{ id: "lifecycle", label: "Status", outcome: "unknown" }],
    axes: [
      { ...thickness, productValues: ["normal"] },
      { ...thickness, id: "second", productValues: ["normal"] },
      { ...thickness, id: "missing", targetValue: null },
    ],
  })
  assert.equal(result.verdict, "mismatch")
  assert.equal(result.missCount, 2)
})

test("gate failure dominates unknown facts and exact axes, retaining input-ordered reasons", () => {
  const result = evaluateFit({
    gates: [
      { id: "first", label: "Erster Ausschluss", outcome: "fail" },
      { id: "unknown", label: "Unbekannt", outcome: "unknown" },
      { id: "last", label: "Letzter Ausschluss", outcome: "fail", reason: "Bekannte Reaktion" },
    ],
    axes: [
      { ...thickness },
      { ...thickness, id: "missing", productValues: null },
      { ...thickness, id: "near", productValues: ["normal"] },
      { ...thickness, id: "far", label: "Gewicht", productValues: ["coarse"] },
    ],
  })
  assert.equal(result.verdict, "mismatch")
  assert.equal(result.missCount, 3)
  assert.deepEqual(
    result.axisOutcomes.map(({ id, steps }) => ({ id, steps })),
    [
      { id: "thickness", steps: 0 },
      { id: "missing", steps: null },
      { id: "near", steps: 1 },
      { id: "far", steps: 2 },
    ],
  )
  assert.deepEqual(result.reasons, [
    "Erster Ausschluss",
    "Bekannte Reaktion",
    "Haardicke: 1 Schritt vom Ziel entfernt.",
    "Gewicht: 2 Schritte vom Ziel entfernt.",
  ])
})

test("failed gate with no axis miss still returns mismatch", () => {
  assert.equal(
    evaluateFit({
      gates: [{ id: "safety", label: "Sicherheit", outcome: "fail" }],
      axes: [{ ...thickness }, { ...thickness, id: "missing", productValues: null }],
    }).verdict,
    "mismatch",
  )
})

test("evaluation leaves caller-owned arrays and facts unchanged", () => {
  const input: FitEvaluationInput = {
    gates: [{ id: "lifecycle", label: "Status", outcome: "pass" }],
    axes: [{ ...thickness, productValues: ["coarse", "normal"], direction: "symmetric" }],
  }
  const before = structuredClone(input)
  Object.freeze(input.gates[0])
  Object.freeze(input.gates)
  Object.freeze(input.axes[0].productValues)
  Object.freeze(input.axes[0].scale)
  Object.freeze(input.axes[0])
  Object.freeze(input.axes)
  Object.freeze(input)
  const first = evaluateFit(input)
  assert.deepEqual(evaluateFit(input), first)
  assert.deepEqual(input, before)
})

test("axis reason provider receives distance and original value sets, replacing the fallback", () => {
  const seen: unknown[] = []
  const result = evaluateFit({
    gates: [],
    axes: [
      {
        ...thickness,
        productValues: ["normal", "coarse"],
        reason: (outcome) => {
          seen.push(outcome)
          return "Eher für kräftigeres Haar gedacht"
        },
      },
    ],
  })
  assert.deepEqual(seen, [{ steps: 1, productValues: ["normal", "coarse"], target: ["fine"] }])
  assert.deepEqual(result.reasons, ["Eher für kräftigeres Haar gedacht"])
  assert.equal(result.axisOutcomes[0].reason, result.reasons[0])
})

test("reason providers get accepted targets and run only for known misses", () => {
  let calls = 0
  const reason = (outcome: { steps: number; target: readonly string[] }) => {
    calls++
    assert.deepEqual(outcome.target, ["normal", "coarse"])
    return "Eher für feines Haar gedacht"
  }
  const result = evaluateFit({
    gates: [],
    axes: [
      { ...thickness, targetValue: undefined, acceptedTargets: ["normal", "coarse"], reason },
      { ...thickness, id: "exact", reason },
      { ...thickness, id: "missing", productValues: null, reason },
    ],
  })
  assert.equal(calls, 1)
  assert.equal(result.verdict, "unknown")
  assert.equal(result.axisOutcomes[0].reason, "Eher für feines Haar gedacht")
})
