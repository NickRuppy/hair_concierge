import assert from "node:assert/strict"
import test from "node:test"

import {
  HAIR_ASSESSMENT_DIMENSION_IDS,
  assessPersonalPlanHair,
  evidenceScoreToSegments,
  resolvePrimaryPersonalPlanConcern,
  type HairAssessmentDimensionId,
} from "../src/lib/personal-plan-quiz/hair-assessment"
import { buildPersonalPlanAssessmentRows } from "../src/lib/personal-plan-quiz/assessment-copy"
import { adaptLegacyQuizAnswersForAssessment } from "../src/lib/personal-plan-quiz/offer-adapter"
import {
  PERSONAL_PLAN_QUIZ_CONCERNS,
  PERSONAL_PLAN_QUIZ_GOALS,
  type PersonalPlanQuizAnswers,
} from "../src/lib/personal-plan-quiz/types"

const complete = (overrides: Partial<PersonalPlanQuizAnswers> = {}): PersonalPlanQuizAnswers => ({
  texture: "wavy",
  thickness: "normal",
  density: "medium",
  goals: ["moisture"],
  routineClarity: "partial",
  resultReliability: "sometimes",
  adaptationConfidence: "partly",
  currentConcerns: [],
  hairLength: "medium",
  hairSurface: "smooth",
  elasticResponse: "stretches_bounces",
  chemicalTreatments: ["natural"],
  scalpOiliness: "balanced",
  scalpConcerns: [],
  previousAttempts: "some_steps_helped",
  blockers: ["product_fit"],
  routineStyle: "simple_reliable",
  meaningfulMoment: "everyday",
  ...overrides,
})

function scores(answers: PersonalPlanQuizAnswers) {
  return Object.fromEntries(
    assessPersonalPlanHair(answers).dimensions.map((dimension) => [
      dimension.id,
      dimension.evidenceScore,
    ]),
  ) as Record<HairAssessmentDimensionId, number>
}

test("the ten dimensions use only the approved primary, observation and support weights", () => {
  const result = scores(
    complete({
      currentConcerns: [
        "dry_lengths",
        "frizz_flyaways",
        "low_shine",
        "hair_loss_or_thinning",
        "breakage",
        "split_ends",
        "tangling",
        "lost_shape",
        "low_volume_or_weighed_down",
      ],
      hairLength: "very_long",
      hairSurface: "rough",
      elasticResponse: "snaps",
      chemicalTreatments: ["lightened"],
      scalpOiliness: "dry",
      scalpConcerns: ["dry_dandruff", "irritated"],
    }),
  )

  assert.deepEqual(result, {
    scalp_balance: 2.5,
    hair_loss_thinning: 2,
    moisture_softness: 3,
    surface_frizz: 3,
    shine: 2.5,
    breakage_stability: 3,
    split_ends: 3,
    manageability_tangling: 3,
    shape_definition: 2.5,
    volume_lightness: 2,
  })
})

test("hair-loss dimension is pinned second for assessment tie-breaks", () => {
  assert.deepEqual(HAIR_ASSESSMENT_DIMENSION_IDS.slice(0, 3), [
    "scalp_balance",
    "hair_loss_thinning",
    "moisture_softness",
  ])
})

test("support and goals cannot activate a dimension or worsen its visible band", () => {
  const result = assessPersonalPlanHair(
    complete({
      goals: ["shine", "strength_ends", "manageability_styling"],
      hairLength: "very_long",
      hairSurface: "smooth",
      chemicalTreatments: ["lightened"],
    }),
  )
  const byId = Object.fromEntries(result.dimensions.map((dimension) => [dimension.id, dimension]))

  assert.equal(byId.shine.evidenceScore, 0)
  assert.equal(byId.shine.active, false)
  assert.equal(byId.split_ends.evidenceScore, 0)
  assert.equal(byId.manageability_tangling.evidenceScore, 0)
  assert.equal(evidenceScoreToSegments(0), 3)
  assert.equal(evidenceScoreToSegments(1.5), 2)
  assert.equal(evidenceScoreToSegments(2), 1)
})

test("goals and exact-concern recurrence affect ordering only", () => {
  const base = complete({
    goals: ["shine"],
    currentConcerns: ["dry_lengths", "low_shine", "tangling"],
    concernRecurrence: { concernId: "tangling", frequency: "often" },
    hairSurface: "slightly_uneven",
  })
  const assessment = assessPersonalPlanHair(base)

  assert.deepEqual(assessment.selectedDimensionIds, [
    "shine",
    "manageability_tangling",
    "moisture_softness",
  ])
  assert.equal(
    assessment.dimensions.find((dimension) => dimension.id === "shine")?.evidenceScore,
    2,
  )
})

test("surface and shine are display siblings while breakage and split ends stay independent", () => {
  const assessment = assessPersonalPlanHair(
    complete({
      currentConcerns: ["frizz_flyaways", "low_shine", "breakage", "split_ends"],
      goals: ["shine"],
    }),
  )
  assert.deepEqual(assessment.selectedDimensionIds, ["shine", "breakage_stability", "split_ends"])
})

test("Haarschäden and Frizz stay independent assessment signals", () => {
  const answers = complete({
    currentConcerns: ["hair_damage", "frizz_flyaways"],
    hairSurface: "smooth",
    elasticResponse: "stretches_bounces",
  })
  const assessment = assessPersonalPlanHair(answers)
  const rows = buildPersonalPlanAssessmentRows(assessment, answers)

  assert.equal(assessment.selectedDimensionIds.includes("breakage_stability"), true)
  assert.equal(assessment.selectedDimensionIds.includes("surface_frizz"), true)
  assert.equal(
    assessment.dimensions
      .find((dimension) => dimension.id === "breakage_stability")
      ?.evidence.some((evidence) => evidence.id === "hair_damage"),
    true,
  )
  const damageRow = rows.find((row) => row.id === "breakage_stability")
  const frizzRow = rows.find((row) => row.id === "surface_frizz")
  assert.equal(damageRow?.title, "Struktur & Stabilität")
  assert.match(damageRow?.summary ?? "", /Strapazierte oder geschädigte Längen/)
  assert.doesNotMatch(damageRow?.summary ?? "", /flexible Ausgangslage/)
  assert.match(frizzRow?.summary ?? "", /Frizz oder abstehende Haare/)
  assert.doesNotMatch(frizzRow?.summary ?? "", /ruhige Haargefühl/)
})

test("generic damage honors its exact recurrence only as an ordering tie-break", () => {
  const assessment = assessPersonalPlanHair(
    complete({
      currentConcerns: ["hair_damage", "frizz_flyaways"],
      concernRecurrence: { concernId: "hair_damage", frequency: "often" },
      hairSurface: "smooth",
    }),
  )
  assert.deepEqual(assessment.selectedDimensionIds.slice(0, 2), [
    "breakage_stability",
    "surface_frizz",
  ])
})

test("primary concern resolver uses pre-recurrence assessment ranking", () => {
  const selected = resolvePrimaryPersonalPlanConcern(
    complete({
      currentConcerns: ["dry_lengths", "tangling"],
      concernRecurrence: { concernId: "tangling", frequency: "often" },
      goals: [],
    }),
  )

  assert.equal(selected, "dry_lengths")
})

test("primary concern resolver maps the combined hair-loss dimension back to its quiz concern", () => {
  assert.equal(
    resolvePrimaryPersonalPlanConcern(
      complete({
        currentConcerns: ["dry_lengths", "hair_loss_or_thinning"],
        goals: [],
      }),
    ),
    "hair_loss_or_thinning",
  )
})

test("primary concern resolver keeps breakage and generic damage distinct", () => {
  assert.equal(
    resolvePrimaryPersonalPlanConcern(complete({ currentConcerns: ["hair_damage"], goals: [] })),
    "hair_damage",
  )
  assert.equal(
    resolvePrimaryPersonalPlanConcern(
      complete({ currentConcerns: ["hair_damage", "breakage"], goals: [] }),
    ),
    "breakage",
  )
})

test("primary concern resolver never lets observation-only dimensions win", () => {
  assert.equal(
    resolvePrimaryPersonalPlanConcern(
      complete({
        currentConcerns: [],
        hairSurface: "rough",
        elasticResponse: "snaps",
        goals: ["frizz_surface"],
      }),
    ),
    null,
  )
})

test("hair-loss assessment row uses the reviewed cautious two-sentence copy", () => {
  const answers = complete({
    currentConcerns: ["hair_loss_or_thinning", "dry_lengths", "frizz_flyaways"],
    goals: ["moisture"],
  })
  const rows = buildPersonalPlanAssessmentRows(assessPersonalPlanHair(answers), answers)
  const row = rows.find((candidate) => candidate.id === "hair_loss_thinning")

  assert.equal(row?.title, "Haarausfall & dünner werdendes Haar")
  assert.equal(
    row?.summary,
    "Schonende Pflege schützt bei Haarausfall und dünner werdendem Haar vor zusätzlichem Haarbruch, Zug und Reibung. Medizinische Behandlungen können Haarausfall bremsen oder neues Wachstum unterstützen.",
  )
  assert.deepEqual(row?.explanationParts, [
    { kind: "text", text: "Schonende Pflege schützt bei " },
    { kind: "answer", text: "Haarausfall und dünner werdendem Haar" },
    {
      kind: "text",
      text: " vor zusätzlichem Haarbruch, Zug und Reibung. Medizinische Behandlungen können Haarausfall bremsen oder neues Wachstum unterstützen.",
    },
  ])
})

test("explicit Haarschäden copy takes precedence over a stays-stretched observation", () => {
  const answers = complete({
    currentConcerns: ["hair_damage"],
    elasticResponse: "stretches_stays",
  })
  const assessment = assessPersonalPlanHair(answers)
  const damageRow = buildPersonalPlanAssessmentRows(assessment, answers).find(
    (row) => row.id === "breakage_stability",
  )

  assert.equal(damageRow?.title, "Struktur & Stabilität")
  assert.match(damageRow?.summary ?? "", /Strapazierte oder geschädigte Längen/)
  assert.doesNotMatch(damageRow?.summary ?? "", /blieb dein Haar gedehnt/)
})

test("legacy factual answers adapt to the shared diagnosis without invented context", () => {
  const input = adaptLegacyQuizAnswersForAssessment({
    structure: "wavy",
    thickness: "fine",
    density: "low",
    hair_length: "long",
    fingertest: "rau",
    pulltest: "snaps",
    scalp_type: "trocken",
    has_scalp_issue: true,
    scalp_condition: "gereizt",
    treatment: ["blondiert"],
    concerns: ["hair_damage", "frizz_flyaways"],
    goals: ["volume_balance", "manageability_styling"],
  })

  assert.deepEqual(input, {
    texture: "wavy",
    thickness: "fine",
    density: "low",
    hairLength: "long",
    hairSurface: "rough",
    elasticResponse: "snaps",
    scalpOiliness: "dry",
    scalpConcerns: ["irritated"],
    chemicalTreatments: ["lightened"],
    currentConcerns: ["hair_damage", "frizz_flyaways"],
    goals: ["volume_balance", "manageability_styling"],
  })
  assert.equal("concernRecurrence" in input, false)
})

test("a stretch observation cannot place Haarbruch beside explicitly selected Spliss", () => {
  const assessment = assessPersonalPlanHair(
    complete({
      currentConcerns: ["split_ends"],
      elasticResponse: "snaps",
      hairLength: "very_long",
    }),
  )

  assert.equal(assessment.selectedDimensionIds.includes("split_ends"), true)
  assert.equal(assessment.selectedDimensionIds.includes("breakage_stability"), false)
})

test("a stays-stretched observation guarantees a neutral Stability row without claiming Haarbruch", () => {
  const answers = complete({
    currentConcerns: [],
    elasticResponse: "stretches_stays",
  })
  const assessment = assessPersonalPlanHair(answers)
  const stability = assessment.dimensions.find((dimension) => dimension.id === "breakage_stability")
  const row = buildPersonalPlanAssessmentRows(assessment, answers).find(
    (candidate) => candidate.id === "breakage_stability",
  )

  assert.equal(stability?.active, true)
  assert.equal(stability?.evidenceScore, 1)
  assert.equal(row?.title, "Stabilität")
  assert.equal(row?.todaySegments, 2)
  assert.equal(
    row?.summary,
    "Beim sanften Dehnen blieb dein Haar gedehnt. Das spricht dafür, dass es sich unter Zug aktuell weniger gut zurückformt.",
  )
})

test("scalp irritation is retained regardless of concern order", () => {
  for (const scalpConcerns of [
    ["dry_dandruff", "irritated"],
    ["irritated", "dry_dandruff"],
  ] satisfies PersonalPlanQuizAnswers["scalpConcerns"][]) {
    const answers = complete({ scalpOiliness: "oily", scalpConcerns })
    const assessment = assessPersonalPlanHair(answers)
    const scalp = assessment.dimensions.find((dimension) => dimension.id === "scalp_balance")
    const row = buildPersonalPlanAssessmentRows(assessment, answers).find(
      (candidate) => candidate.id === "scalp_balance",
    )

    assert.equal(
      scalp?.evidence.some((item) => item.id === "scalp_irritated"),
      true,
    )
    assert.match(row?.summary ?? "", /Jucken, Rötung oder Brennen/)
    assert.match(row?.summary ?? "", /Verträglichkeit/)
  }
})

test("positive fill uses only explicit neutral observations and still respects siblings", () => {
  const assessment = assessPersonalPlanHair(
    complete({ currentConcerns: ["low_shine"], goals: ["shine"], hairSurface: "smooth" }),
  )
  assert.deepEqual(assessment.selectedDimensionIds, [
    "shine",
    "scalp_balance",
    "breakage_stability",
  ])
  const breakageRow = buildPersonalPlanAssessmentRows(assessment, complete()).find(
    (row) => row.id === "breakage_stability",
  )
  assert.match(breakageRow?.summary ?? "", /aktuell flexible Ausgangslage/)
  assert.doesNotMatch(breakageRow?.summary ?? "", /belastbar/)
})

test("an active dimension is not selected again as positive fill", () => {
  const assessment = assessPersonalPlanHair(
    complete({ currentConcerns: ["frizz_flyaways"], hairSurface: "smooth" }),
  )

  assert.deepEqual(assessment.selectedDimensionIds, [
    "surface_frizz",
    "scalp_balance",
    "breakage_stability",
  ])
  assert.equal(new Set(assessment.selectedDimensionIds).size, 3)
})

test("crowded evidence ownership omits lower-priority clauses instead of breaking the copy contract", () => {
  const scenarios = [
    complete({
      currentConcerns: [],
      elasticResponse: "snaps",
      chemicalTreatments: ["lightened"],
    }),
    complete({
      currentConcerns: ["frizz_flyaways", "lost_shape", "low_shine"],
      goals: ["shine"],
    }),
    complete({
      currentConcerns: ["dry_lengths", "low_shine", "breakage", "tangling"],
      goals: ["moisture"],
      hairLength: "long",
      hairSurface: "rough",
      elasticResponse: "snaps",
    }),
  ]

  for (const answers of scenarios) {
    const rows = buildPersonalPlanAssessmentRows(assessPersonalPlanHair(answers), answers)
    for (const row of rows) {
      assert.equal(row.summary.trim().split(/\s+/).length <= 28, true, row.summary)
      assert.equal(
        row.summary.split(/[.!?]+/).filter((value) => value.trim()).length <= 2,
        true,
        row.summary,
      )
      assert.equal(
        row.explanationParts.filter((part) => part.kind === "answer").length <= 3,
        true,
        row.summary,
      )
    }
  }
})

test("every selectable concern and observation composition stays inside the public copy contract", () => {
  const surfaces = ["smooth", "slightly_uneven", "rough"] as const
  const elasticResponses = ["stretches_bounces", "stretches_stays", "snaps"] as const
  const treatments = ["natural", "lightened", "permed", "chemically_straightened"] as const
  const lengths = ["very_short", "medium", "long", "very_long"] as const

  for (let concernMask = 0; concernMask < 1 << PERSONAL_PLAN_QUIZ_CONCERNS.length; concernMask++) {
    const currentConcerns = PERSONAL_PLAN_QUIZ_CONCERNS.filter(
      (_, index) => concernMask & (1 << index),
    )
    for (const hairSurface of surfaces)
      for (const elasticResponse of elasticResponses)
        for (const chemicalTreatment of treatments)
          for (const hairLength of lengths) {
            const answers = complete({
              currentConcerns,
              goals: [PERSONAL_PLAN_QUIZ_GOALS[concernMask % PERSONAL_PLAN_QUIZ_GOALS.length]],
              hairSurface,
              elasticResponse,
              chemicalTreatments: [chemicalTreatment],
              hairLength,
            })
            const assessment = assessPersonalPlanHair(answers)
            assert.equal(assessment.selectedDimensionIds.length, 3)
            assert.equal(new Set(assessment.selectedDimensionIds).size, 3)
            assert.doesNotThrow(() => buildPersonalPlanAssessmentRows(assessment, answers))
          }
  }
})

test("all reviewed row families keep public copy within two sentences and 28 words", () => {
  const scenarios: PersonalPlanQuizAnswers[] = [
    complete({ scalpOiliness: "oily", scalpConcerns: ["oily_dandruff"] }),
    complete({ scalpOiliness: "dry", scalpConcerns: ["dry_dandruff", "irritated"] }),
    complete({
      currentConcerns: ["dry_lengths"],
      hairSurface: "rough",
      chemicalTreatments: ["lightened"],
    }),
    complete({ currentConcerns: ["frizz_flyaways"], hairSurface: "rough" }),
    complete({ currentConcerns: ["low_shine"], hairSurface: "smooth", goals: ["shine"] }),
    complete({
      currentConcerns: ["breakage"],
      elasticResponse: "snaps",
      chemicalTreatments: ["lightened"],
    }),
    complete({
      currentConcerns: ["split_ends"],
      hairLength: "very_long",
      chemicalTreatments: ["permed"],
    }),
    complete({ currentConcerns: ["tangling"], hairLength: "long", hairSurface: "rough" }),
    complete({ texture: "curly", currentConcerns: ["lost_shape", "frizz_flyaways"] }),
    complete({ texture: "coily", currentConcerns: ["low_volume_or_weighed_down"] }),
    complete({ currentConcerns: ["hair_loss_or_thinning"] }),
  ]

  for (const answers of scenarios) {
    const rows = buildPersonalPlanAssessmentRows(assessPersonalPlanHair(answers), answers)
    for (const row of rows) {
      const words = row.summary.trim().split(/\s+/)
      const sentences = row.summary.split(/[.!?]+/).filter((value) => value.trim()).length
      assert.equal(words.length <= 28, true, `${row.title}: ${words.length} words: ${row.summary}`)
      assert.equal(sentences <= 2, true, `${row.title}: ${sentences} sentences: ${row.summary}`)
      assert.equal(
        row.explanationParts.every((part) => part.kind !== "answer" || !/[<>]/.test(part.text)),
        true,
      )
    }
  }
})
