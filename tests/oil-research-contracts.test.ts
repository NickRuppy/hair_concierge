import { strict as assert } from "node:assert"
import { test } from "node:test"
import { OilResearchInputSchema, sha256Utf8 } from "../src/lib/oil-research/contracts"
import {
  makeOilEnvelope,
  makeOilExclusion,
  preserveFixtureProfile,
} from "./fixtures/oil-research/fixture"

test("preserves complete historical profile, numeric INCI comma, and source-specific fit", () => {
  const e = makeOilEnvelope()
  const parsed = OilResearchInputSchema.parse(e)
  assert.deepEqual(parsed, e)
  assert.equal(e.formula.ingredients[1].raw_name, "1,2-HEXANEDIOL")
  assert.deepEqual(OilResearchInputSchema.parse(makeOilExclusion()), makeOilExclusion())
})

test("rejects missing or inconsistent evidence roots instead of silently filling defaults", () => {
  const mutations: [string, (e: ReturnType<typeof makeOilEnvelope>) => void][] = [
    [
      "hash",
      (e) => {
        e.formula.raw_sha256 = "0".repeat(64)
      },
    ],
    [
      "ordered rank",
      (e) => {
        e.formula.ingredients[1].rank = 3
      },
    ],
    [
      "normalization",
      (e) => {
        e.formula.normalization_receipt.pop()
      },
    ],
    [
      "original preservation",
      (e) => {
        e.profile.weight.reason = "rewritten"
      },
    ],
    [
      "source closure",
      (e) => {
        e.identity.source_ids = ["not-recorded"]
      },
    ],
    [
      "direction closure",
      (e) => {
        e.sources[0].directions = []
      },
    ],
    [
      "stale policy",
      (e) => {
        e.research_method.policy_pins[Object.keys(e.research_method.policy_pins)[0]] = "0".repeat(
          64,
        )
      },
    ],
    [
      "missing fit",
      (e) => {
        e.scenario_fit = []
      },
    ],
    [
      "canonical identity",
      (e) => {
        e.identity.brand = "Different brand"
      },
    ],
    [
      "unbound claim",
      (e) => {
        e.profile.provides_heat_protection.evidence = []
        preserveFixtureProfile(e)
      },
    ],
    [
      "trace evidence",
      (e) => {
        e.persistence_trace.evidence[0].canonical_name = "OTHER OIL"
      },
    ],
    [
      "incomplete rank consideration",
      (e) => {
        e.persistence_trace.considered_ranks = [1]
      },
    ],
  ]
  for (const [name, mutate] of mutations) {
    const e = makeOilEnvelope()
    mutate(e)
    assert.equal(OilResearchInputSchema.safeParse(e).success, false, name)
  }
  for (const key of [
    "estimate",
    "confidence",
    "evidence",
    "counter_signal",
    "nearest_alternative",
    "reason",
    "unresolved",
  ]) {
    const e = makeOilEnvelope()
    delete (e.profile.weight as Record<string, unknown>)[key]
    preserveFixtureProfile(e)
    assert.equal(OilResearchInputSchema.safeParse(e).success, false, key)
  }
  for (const bad of ["unknown", { value: "moderate" }, null]) {
    const e = makeOilEnvelope()
    ;(e.profile as Record<string, unknown>).persistence_potential = bad
    preserveFixtureProfile(e)
    assert.equal(OilResearchInputSchema.safeParse(e).success, false, JSON.stringify(bad))
  }
})

test("historical absent tipping assumption requires explicit provenance; current omission refuses", () => {
  const e = makeOilEnvelope()
  e.persistence_trace.tipping_assumption = null
  e.persistence_trace.tipping_assumption_note = "Not separately recorded in historical trace"
  delete e.persistence_trace.original.tipping_assumption
  assert.equal(OilResearchInputSchema.safeParse(e).success, true)
  e.provenance.import_kind = "current"
  assert.equal(OilResearchInputSchema.safeParse(e).success, false)
})

test("retains raw whitespace and only admits explicitly bound declaration suffixes", () => {
  const e = makeOilEnvelope()
  e.formula.raw_inci = "  " + e.formula.raw_inci + "  "
  ;(e.profile.formula as { raw_inci: string }).raw_inci = e.formula.raw_inci
  e.formula.raw_sha256 = sha256Utf8(e.formula.raw_inci)
  preserveFixtureProfile(e)
  assert.equal(OilResearchInputSchema.parse(e).formula.raw_inci, e.formula.raw_inci)
  e.formula.raw_inci += " [CODE]"
  ;(e.profile.formula as { raw_inci: string }).raw_inci = e.formula.raw_inci
  e.formula.raw_sha256 = sha256Utf8(e.formula.raw_inci)
  preserveFixtureProfile(e)
  assert.equal(OilResearchInputSchema.safeParse(e).success, false)
  e.formula.contextual_declarations = [
    {
      literal: "[CODE]",
      kind: "formula_code",
      source_id: "maker",
      reason: "Printed noningredient formula code",
    },
  ]
  assert.equal(OilResearchInputSchema.safeParse(e).success, true)
})

const internalConsistencyMutations: [string, (e: ReturnType<typeof makeOilEnvelope>) => void][] = [
  [
    "trace reason",
    (e) => {
      e.persistence_trace.reason = "Different reason"
    },
  ],
  [
    "trace evidence",
    (e) => {
      e.persistence_trace.evidence = [e.persistence_trace.evidence[0]]
    },
  ],
  [
    "trace considered ranks",
    (e) => {
      e.persistence_trace.original.considered_ranks = [1]
    },
  ],
  [
    "trace tipping assumption",
    (e) => {
      e.persistence_trace.tipping_assumption = "Different assumption"
    },
  ],
  [
    "trace scalar",
    (e) => {
      e.persistence_trace.original.persistence_potential = "high"
    },
  ],
  [
    "fit axis",
    (e) => {
      e.scenario_fit[0].thickness.fine.value = "unsuitable"
    },
  ],
  [
    "fit source identity",
    (e) => {
      e.scenario_fit[0].original.source_id = "different"
    },
  ],
  [
    "fit weight authority",
    (e) => {
      e.scenario_fit[0].original.weight_authority = {
        path: "different",
        sha256: "a".repeat(64),
        record_key: "S01",
        reason: "Different",
      }
    },
  ],
  [
    "malformed claim source",
    (e) => {
      e.profile.provides_heat_protection.evidence = ["source_id=???"]
      preserveFixtureProfile(e)
    },
  ],
  [
    "rank-only evidence",
    (e) => {
      e.profile.weight.evidence = [{ rank: 999 }]
      preserveFixtureProfile(e)
    },
  ],
  [
    "matched hero ranks",
    (e) => {
      e.profile.named_oils = [
        {
          hero_id: "hero",
          hero_name: "Oil",
          matched_ranks: [999],
          prominence: { ...e.profile.weight, value: "supporting" },
        },
      ]
      preserveFixtureProfile(e)
    },
  ],
  [
    "string ingredient reference",
    (e) => {
      e.profile.weight.evidence = ["blind-packet.json#S01/ingredients/999: JOJOBA OIL"]
      preserveFixtureProfile(e)
    },
  ],
  [
    "auxiliary boundary rank",
    (e) => {
      e.profile.auxiliary_suffix.start_rank = 999
      preserveFixtureProfile(e)
    },
  ],
  [
    "historical admission receipt",
    (e) => {
      e.provenance.mapping_receipts = []
    },
  ],
]
for (const [name, corrupt] of internalConsistencyMutations) {
  test(`rejects inconsistent ${name} without aliased canonical/original fixtures`, () => {
    const e = JSON.parse(JSON.stringify(makeOilEnvelope())) as ReturnType<typeof makeOilEnvelope>
    if (name === "trace scalar")
      e.persistence_trace.original.persistence_potential = e.profile.persistence_potential
    assert.equal(OilResearchInputSchema.safeParse(e).success, true)
    corrupt(e)
    assert.equal(OilResearchInputSchema.safeParse(e).success, false)
  })
}

test("rejects bare numeric INCI fragments even when ordered ranks, digests and ledger agree", () => {
  const e = JSON.parse(JSON.stringify(makeOilEnvelope())) as ReturnType<typeof makeOilEnvelope>
  e.formula.ingredients[1].raw_name = "1"
  e.formula.ingredients[1].canonical_name = "1"
  e.formula.ingredients.push({ rank: 3, raw_name: "2-HEXANEDIOL", canonical_name: "2-HEXANEDIOL" })
  e.formula.normalized_sha256 = sha256Utf8(
    JSON.stringify(
      e.formula.ingredients.map(({ rank, canonical_name }) => ({ rank, canonical_name })),
    ),
  )
  e.formula.normalization_receipt = e.formula.ingredients.map((i) => ({
    ...i,
    reason: "Mistaken tokenization",
  }))
  ;(e.profile.formula as { ingredients: unknown }).ingredients = structuredClone(
    e.formula.ingredients,
  )
  e.profile.ingredient_ledger = e.formula.ingredients.map((i) => ({
    ...e.profile.ingredient_ledger[0],
    ...i,
  }))
  e.persistence_trace.evidence = e.formula.ingredients.map(({ rank, canonical_name }) => ({
    rank,
    canonical_name,
  }))
  e.persistence_trace.considered_ranks = [1, 2, 3]
  e.persistence_trace.original.evidence = structuredClone(e.persistence_trace.evidence)
  e.persistence_trace.original.considered_ranks = [1, 2, 3]
  preserveFixtureProfile(e)
  assert.equal(OilResearchInputSchema.safeParse(e).success, false)
})

test("preserves multiple contextual declaration suffixes in their recorded order", () => {
  const e = JSON.parse(JSON.stringify(makeOilEnvelope())) as ReturnType<typeof makeOilEnvelope>
  e.formula.raw_inci += " [A] [B]"
  e.formula.raw_sha256 = sha256Utf8(e.formula.raw_inci)
  ;(e.profile.formula as { raw_inci: string }).raw_inci = e.formula.raw_inci
  e.formula.contextual_declarations = ["[A]", "[B]"].map((literal) => ({
    literal,
    kind: "formula_code",
    source_id: "maker",
    reason: "Recorded noningredient suffix",
  }))
  preserveFixtureProfile(e)
  assert.equal(OilResearchInputSchema.safeParse(e).success, true)
  e.formula.contextual_declarations.reverse()
  assert.equal(OilResearchInputSchema.safeParse(e).success, false)
})

test("duplicate scenario-role bindings cannot hide an unrelated fit row", () => {
  const e = JSON.parse(JSON.stringify(makeOilEnvelope())) as ReturnType<typeof makeOilEnvelope>
  e.profile.application_scenarios.push(structuredClone(e.profile.application_scenarios[0]))
  e.sources[0].directions.push({ direction_id: "unused", text: "Another recorded direction." })
  const stray = structuredClone(e.scenario_fit[0])
  stray.direction_id = "unused"
  stray.original.direction_id = "unused"
  e.scenario_fit.push(stray)
  preserveFixtureProfile(e)
  assert.equal(OilResearchInputSchema.safeParse(e).success, false)
})
