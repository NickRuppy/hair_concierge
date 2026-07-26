import assert from "node:assert/strict"
import test from "node:test"

import { calculateHairPotential } from "../src/lib/quiz/hair-potential"
import type { GuidedStoryPriority } from "../src/lib/quiz/guided-story-priorities"
import { GUIDED_STORY_COPY_RECORDS } from "../src/lib/quiz/guided-story-copy"
import {
  QUIZ_CONCERN_VALUES,
  QUIZ_DENSITY_VALUES,
  QUIZ_FINGERTEST_VALUES,
  QUIZ_HAIR_LENGTH_VALUES,
  QUIZ_PULLTEST_VALUES,
  QUIZ_SCALP_CONDITION_VALUES,
  QUIZ_SCALP_TYPE_VALUES,
  QUIZ_STRUCTURE_VALUES,
  QUIZ_THICKNESS_VALUES,
  QUIZ_TREATMENT_VALUES,
} from "../src/lib/quiz/normalization"
import type { QuizAnswers } from "../src/lib/quiz/types"
import { GOALS } from "../src/lib/vocabulary/concerns-goals"

function answers(overrides: QuizAnswers = {}): QuizAnswers {
  return {
    structure: "straight",
    thickness: "normal",
    density: "medium",
    hair_length: "medium",
    fingertest: "glatt",
    pulltest: "stretches_bounces",
    scalp_type: "ausgeglichen",
    has_scalp_issue: false,
    concerns: [],
    treatment: ["natur"],
    goals: ["healthy_scalp"],
    ...overrides,
  }
}

function priorities(...variantIds: string[]): GuidedStoryPriority[] {
  return variantIds.map((variantId) => {
    const record = GUIDED_STORY_COPY_RECORDS.find((item) => item.variantId === variantId)
    assert.ok(record, variantId)
    return {
      family: record.family,
      tier: 1,
      variantId,
      title: record.title,
      finding: record.finding,
      why: record.why,
      helps: record.helps,
      matchedConcerns: [],
      matchedGoals: [],
      isCentral: false,
    }
  })
}

function score(input: QuizAnswers, ranked: GuidedStoryPriority[]) {
  const result = calculateHairPotential(input, ranked)
  assert.ok(result)
  return result
}

function familyValue(input: QuizAnswers, variantId: string): number {
  return score(
    input,
    priorities(variantId, "surface_manageability.frizz", "scalp_comfort.ausgeglichene_kopfhaut"),
  ).dimensions[0].value
}

test("scores all signed-off headline examples and uses the rounded arithmetic mean", () => {
  const dryFrizzyBleached = answers({
    concerns: ["dryness", "frizz"],
    treatment: ["blondiert"],
    fingertest: "rau",
    goals: ["moisture", "less_frizz", "strengthen"],
  })
  const result = score(
    dryFrizzyBleached,
    priorities(
      "moisture_dryness.trocken_rau_behandelt",
      "surface_manageability.frizz",
      "strength_damage.mit_chemischer_behandlung",
    ),
  )
  assert.equal(result.modelVersion, "hair_potential_v1")
  assert.deepEqual(
    result.dimensions.map(({ family, label, value }) => ({ family, label, value })),
    [
      { family: "moisture_dryness", label: "Feuchtigkeit", value: 45 },
      { family: "surface_manageability", label: "Oberfläche", value: 60 },
      { family: "strength_damage", label: "Stabilität", value: 45 },
    ],
  )
  assert.equal(result.overall, 50)
  assert.equal(
    result.overall,
    Math.round(result.dimensions.reduce((sum, dimension) => sum + dimension.value, 0) / 3),
  )
})

test("uses the lowest matching scalp rows including bounded matching-type combinations", () => {
  const cases: Array<{ input: QuizAnswers; expected: number }> = [
    {
      input: answers({
        scalp_type: "trocken",
        has_scalp_issue: true,
        scalp_condition: "trockene_schuppen",
      }),
      expected: 45,
    },
    {
      input: answers({
        scalp_type: "fettig",
        has_scalp_issue: true,
        scalp_condition: "schuppen",
      }),
      expected: 40,
    },
    {
      input: answers({
        scalp_type: "fettig",
        has_scalp_issue: true,
        scalp_condition: "gereizt",
      }),
      expected: 40,
    },
  ]

  for (const { input, expected } of cases) {
    const result = score(
      input,
      priorities(
        input.scalp_condition === "gereizt"
          ? "scalp_comfort.gereizte_kopfhaut"
          : "scalp_flakes.schuppen",
        "moisture_dryness.trockenheit_basis",
        "surface_manageability.frizz",
      ),
    )
    assert.equal(result.dimensions[0]?.value, expected)
    assert.equal(result.dimensions[0]?.label, "Kopfhaut")
  }
})

test("keeps pull-test lanes separate and applies bounded strong-signal rows", () => {
  const strength = score(
    answers({
      concerns: ["breakage", "hair_damage"],
      pulltest: "stretches_stays",
      fingertest: "rau",
      treatment: ["blondiert"],
      goals: ["strengthen", "healthy_scalp"],
    }),
    priorities(
      "strength_damage.haarbruch_schaden_basis",
      "surface_manageability.frizz",
      "scalp_comfort.ausgeglichene_kopfhaut",
    ),
  )
  assert.equal(
    strength.dimensions.find((dimension) => dimension.family === "strength_damage")?.value,
    40,
  )

  const moisture = score(
    answers({
      concerns: ["dryness"],
      pulltest: "snaps",
      goals: ["moisture", "healthy_scalp"],
    }),
    priorities(
      "moisture_dryness.trockenheit_basis",
      "surface_manageability.frizz",
      "scalp_comfort.ausgeglichene_kopfhaut",
    ),
  )
  assert.equal(
    moisture.dimensions.find((dimension) => dimension.family === "moisture_dryness")?.value,
    55,
  )
})

test("scores goal-relative dimensions without penalizing natural traits outside the stated goal", () => {
  const definition = score(
    answers({
      structure: "straight",
      concerns: ["dryness", "frizz"],
      fingertest: "rau",
      goals: ["curl_definition", "healthy_scalp"],
    }),
    priorities(
      "definition.glattes_haar_definitions_ziel",
      "surface_manageability.frizz",
      "scalp_comfort.ausgeglichene_kopfhaut",
    ),
  )
  assert.equal(
    definition.dimensions.find((dimension) => dimension.family === "definition")?.value,
    50,
  )

  const volume = score(
    answers({
      thickness: "fine",
      density: "low",
      goals: ["volume", "healthy_scalp"],
    }),
    priorities(
      "volume_weight.mehr_volumen_fein_niedrige_dichte",
      "surface_manageability.frizz",
      "scalp_comfort.ausgeglichene_kopfhaut",
    ),
  )
  assert.equal(
    volume.dimensions.find((dimension) => dimension.family === "volume_weight")?.value,
    55,
  )
})

test("covers every signed-off row for strength, moisture, surface, ends, definition, volume, and color", () => {
  const cases: Array<{ variant: string; input: QuizAnswers; expected: number }> = [
    {
      variant: "strength_damage.haarbruch_schaden_basis",
      input: answers({ goals: ["strengthen"] }),
      expected: 80,
    },
    {
      variant: "strength_damage.mit_chemischer_behandlung",
      input: answers({ treatment: ["gefaerbt"] }),
      expected: 85,
    },
    {
      variant: "strength_damage.mit_chemischer_behandlung",
      input: answers({ treatment: ["dauerwelle"] }),
      expected: 75,
    },
    {
      variant: "strength_damage.mit_chemischer_behandlung",
      input: answers({ treatment: ["chemisch_geglaettet"] }),
      expected: 70,
    },
    {
      variant: "strength_damage.mit_chemischer_behandlung",
      input: answers({ treatment: ["blondiert"] }),
      expected: 65,
    },
    {
      variant: "strength_damage.haarbruch_schaden_basis",
      input: answers({ concerns: ["hair_damage"] }),
      expected: 60,
    },
    {
      variant: "strength_damage.haarbruch_schaden_basis",
      input: answers({ concerns: ["breakage"] }),
      expected: 50,
    },
    {
      variant: "strength_damage.auffalliger_zugtest",
      input: answers({ pulltest: "stretches_stays" }),
      expected: 45,
    },
    {
      variant: "moisture_dryness.trockenheit_basis",
      input: answers({ goals: ["moisture"] }),
      expected: 80,
    },
    {
      variant: "moisture_dryness.trockenheit_basis",
      input: answers({ concerns: ["dryness"] }),
      expected: 60,
    },
    {
      variant: "moisture_dryness.trockenheit_basis",
      input: answers({ concerns: ["dryness"], fingertest: "rau" }),
      expected: 50,
    },
    {
      variant: "surface_manageability.frizz",
      input: answers({ fingertest: "leicht_uneben" }),
      expected: 85,
    },
    { variant: "surface_manageability.frizz", input: answers({ goals: ["shine"] }), expected: 80 },
    { variant: "surface_manageability.frizz", input: answers({ fingertest: "rau" }), expected: 65 },
    {
      variant: "surface_manageability.verknotungen",
      input: answers({ concerns: ["tangling"] }),
      expected: 55,
    },
    {
      variant: "surface_manageability.frizz_knoten_glanz",
      input: answers({ concerns: ["frizz", "tangling"] }),
      expected: 45,
    },
    {
      variant: "surface_manageability.frizz_knoten_glanz",
      input: answers({ concerns: ["frizz", "tangling"], fingertest: "rau" }),
      expected: 40,
    },
    {
      variant: "ends_protection.spliss_lange_spitzen",
      input: answers({ goals: ["less_split_ends"] }),
      expected: 80,
    },
    {
      variant: "ends_protection.spliss_lange_spitzen",
      input: answers({ concerns: ["split_ends"] }),
      expected: 50,
    },
    {
      variant: "ends_protection.spliss_lange_spitzen",
      input: answers({ concerns: ["split_ends"], hair_length: "long" }),
      expected: 45,
    },
    {
      variant: "ends_protection.spliss_lange_spitzen",
      input: answers({ concerns: ["split_ends"], hair_length: "long", fingertest: "rau" }),
      expected: 40,
    },
    {
      variant: "definition.glattes_haar_definitions_ziel",
      input: answers({ goals: ["curl_definition"] }),
      expected: 80,
    },
    {
      variant: "definition.glattes_haar_definitions_ziel",
      input: answers({ goals: ["curl_definition"], concerns: ["frizz"] }),
      expected: 65,
    },
    {
      variant: "definition.glattes_haar_definitions_ziel",
      input: answers({ goals: ["curl_definition"], concerns: ["frizz", "dryness"] }),
      expected: 55,
    },
    {
      variant: "volume_weight.weniger_volumen_allgemein",
      input: answers({ goals: ["less_volume"] }),
      expected: 80,
    },
    {
      variant: "volume_weight.weniger_volumen_viel_kraftig_texturiert",
      input: answers({ goals: ["less_volume"], density: "high" }),
      expected: 65,
    },
    {
      variant: "volume_weight.weniger_volumen_viel_kraftig_texturiert",
      input: answers({ goals: ["less_volume"], density: "high", thickness: "coarse" }),
      expected: 55,
    },
    {
      variant: "color_protection.naturhaar_farbschutz_ziel",
      input: answers({ goals: ["color_protection"] }),
      expected: 80,
    },
    {
      variant: "color_protection.gefarbt_blondiert",
      input: answers({ goals: ["color_protection"], treatment: ["gefaerbt"] }),
      expected: 65,
    },
    {
      variant: "color_protection.gefarbt_blondiert",
      input: answers({ goals: ["color_protection"], treatment: ["blondiert"] }),
      expected: 55,
    },
  ]

  for (const item of cases) {
    assert.equal(familyValue(item.input, item.variant), item.expected, item.variant)
  }
})

test("leaves free-text concern notes score-neutral", () => {
  const base = answers({ goals: ["moisture"] })
  const variant = "moisture_dryness.trockenheit_basis"
  assert.equal(
    familyValue(base, variant),
    familyValue({ ...base, concerns_other_text: "massiver Haarausfall" }, variant),
  )
})

test("scores merged priorities from every constituent and retains the lower score", () => {
  const input = answers({
    concerns: ["breakage", "split_ends"],
    hair_length: "long",
    goals: ["strengthen", "less_split_ends", "healthy_scalp"],
  })
  const ranked = priorities(
    "strength_damage.haarbruch_schaden_basis",
    "surface_manageability.frizz",
    "scalp_comfort.ausgeglichene_kopfhaut",
  )
  const merged = {
    ...ranked[0]!,
    mergedVariantIds: [
      "strength_damage.haarbruch_schaden_basis",
      "ends_protection.spliss_lange_spitzen",
    ],
  }
  ranked[0] = merged
  const result = score(input, ranked)
  const dimension = result.dimensions.find((item) => item.priorityVariantId === merged.variantId)
  assert.deepEqual(dimension?.mergedVariantIds, merged.mergedVariantIds)
  assert.equal(dimension?.value, 45)
})

test("supports every approved close-neighbor merge path", () => {
  const cases = [
    {
      input: answers({
        concerns: ["breakage", "split_ends"],
        hair_length: "long",
        goals: ["strengthen", "less_split_ends"],
      }),
      primary: "strength_damage.haarbruch_schaden_basis",
      secondary: "ends_protection.spliss_lange_spitzen",
      expected: 45,
    },
    {
      input: answers({
        concerns: ["dryness", "tangling"],
        goals: ["moisture", "less_frizz"],
      }),
      primary: "moisture_dryness.trockenheit_basis",
      secondary: "surface_manageability.verknotungen",
      expected: 55,
    },
    {
      input: answers({
        scalp_type: "trocken",
        has_scalp_issue: true,
        scalp_condition: "trockene_schuppen",
      }),
      primary: "scalp_flakes.trockene_schuppen",
      secondary: "scalp_comfort.trockene_kopfhaut",
      expected: 45,
    },
    {
      input: answers({
        concerns: ["dryness", "frizz"],
        goals: ["curl_definition", "less_frizz"],
      }),
      primary: "definition.wellig_lockig_oder_coily",
      secondary: "surface_manageability.frizz",
      expected: 55,
    },
    {
      input: answers({
        treatment: ["blondiert"],
        goals: ["color_protection", "strengthen"],
      }),
      primary: "color_protection.gefarbt_blondiert",
      secondary: "strength_damage.mit_chemischer_behandlung",
      expected: 55,
    },
  ] as const

  for (const item of cases) {
    const ranked = priorities(
      item.primary,
      "scalp_comfort.ausgeglichene_kopfhaut",
      "moisture_dryness.trockenheit_basis",
    )
    ranked[0] = {
      ...ranked[0]!,
      mergedVariantIds: [item.primary, item.secondary],
    }
    assert.equal(score(item.input, ranked).dimensions[0].value, item.expected)
  }
})

test("rejects incomplete, legacy, unknown, and invalid priority-identity paths", () => {
  const valid = answers()
  const ranked = priorities(
    "scalp_comfort.ausgeglichene_kopfhaut",
    "surface_manageability.frizz",
    "moisture_dryness.trockenheit_basis",
  )
  assert.equal(calculateHairPotential({ ...valid, density: undefined }, ranked), null)
  assert.equal(calculateHairPotential({ ...valid, pulltest: "ueberdehnt" }, ranked), null)
  assert.equal(calculateHairPotential({ ...valid, treatment: ["unknown"] }, ranked), null)
  assert.equal(
    calculateHairPotential(valid, [
      { ...ranked[0]!, variantId: "unknown.variant" },
      ...ranked.slice(1),
    ]),
    null,
  )
  assert.equal(
    calculateHairPotential(valid, [
      { ...ranked[0]!, variantId: "legacy.basis" },
      ...ranked.slice(1),
    ]),
    null,
  )
  assert.equal(
    calculateHairPotential(valid, [
      { ...ranked[0]!, mergedVariantIds: ["unknown.variant"] },
      ...ranked.slice(1),
    ]),
    null,
  )
  assert.equal(
    calculateHairPotential(valid, [
      { ...ranked[0]!, family: "surface_manageability" },
      ...ranked.slice(1),
    ]),
    null,
  )
  assert.equal(
    calculateHairPotential(valid, [
      {
        ...ranked[0]!,
        mergedVariantIds: [ranked[0]!.variantId, ranked[0]!.variantId],
      },
      ...ranked.slice(1),
    ]),
    null,
  )
  assert.equal(
    calculateHairPotential(valid, [{ ...ranked[0]!, mergedVariantIds: [] }, ...ranked.slice(1)]),
    null,
  )
})

test("covers every supported structured value without silently returning an unsupported score", () => {
  const structuredValues: Array<[keyof QuizAnswers, readonly unknown[]]> = [
    ["structure", ["straight", "wavy", "curly", "coily"]],
    ["thickness", ["fine", "normal", "coarse"]],
    ["density", ["low", "medium", "high"]],
    ["hair_length", ["very_short", "short", "medium", "long", "very_long"]],
    ["fingertest", ["glatt", "leicht_uneben", "rau"]],
    ["pulltest", ["stretches_bounces", "stretches_stays", "snaps"]],
    ["scalp_type", ["fettig", "ausgeglichen", "trocken"]],
    ["scalp_condition", ["schuppen", "trockene_schuppen", "gereizt"]],
    ["concerns", ["hair_damage", "split_ends", "breakage", "dryness", "frizz", "tangling"]],
    ["treatment", ["natur", "gefaerbt", "blondiert", "dauerwelle", "chemisch_geglaettet"]],
    [
      "goals",
      [
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
      ],
    ],
  ]
  const canonicalValues: Partial<Record<keyof QuizAnswers, readonly unknown[]>> = {
    structure: QUIZ_STRUCTURE_VALUES,
    thickness: QUIZ_THICKNESS_VALUES,
    density: QUIZ_DENSITY_VALUES,
    hair_length: QUIZ_HAIR_LENGTH_VALUES,
    fingertest: QUIZ_FINGERTEST_VALUES,
    pulltest: QUIZ_PULLTEST_VALUES,
    scalp_type: QUIZ_SCALP_TYPE_VALUES,
    scalp_condition: QUIZ_SCALP_CONDITION_VALUES,
    concerns: QUIZ_CONCERN_VALUES,
    treatment: QUIZ_TREATMENT_VALUES,
    goals: GOALS,
  }

  for (const [field, values] of structuredValues) {
    assert.deepEqual(values, canonicalValues[field], `${field} coverage inventory is stale`)
    for (const value of values) {
      const input = answers()
      if (field === "scalp_condition") {
        input.has_scalp_issue = true
        input.scalp_condition = value as string
      } else if (field === "concerns") {
        input.concerns = [value as never]
      } else if (field === "treatment") {
        input.treatment = [value as string]
      } else if (field === "goals") {
        input.goals = [value as string]
      } else {
        ;(input as Record<string, unknown>)[field] = value
      }
      const result = calculateHairPotential(
        input,
        priorities(
          "scalp_comfort.ausgeglichene_kopfhaut",
          "surface_manageability.frizz",
          "moisture_dryness.trockenheit_basis",
        ),
      )
      assert.ok(result, `${field}:${value}`)
      assert.ok(
        result.dimensions.every((dimension) => dimension.value >= 40 && dimension.value <= 100),
      )
      assert.ok(result.dimensions.every((dimension) => dimension.value % 5 === 0))
    }
  }

  for (const hasScalpIssue of [false, true]) {
    const input = answers({
      has_scalp_issue: hasScalpIssue,
      ...(hasScalpIssue ? { scalp_condition: "gereizt" } : {}),
    })
    assert.ok(
      calculateHairPotential(
        input,
        priorities(
          hasScalpIssue
            ? "scalp_comfort.gereizte_kopfhaut"
            : "scalp_comfort.ausgeglichene_kopfhaut",
          "surface_manageability.frizz",
          "moisture_dryness.trockenheit_basis",
        ),
      ),
    )
  }
})
