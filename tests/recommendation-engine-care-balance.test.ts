import assert from "node:assert/strict"
import test from "node:test"

import { adaptRecommendationInputFromPersistence } from "../src/lib/recommendation-engine/adapters/from-persistence"
import { buildDamageAssessment } from "../src/lib/recommendation-engine/assessments/damage"
import {
  classifyHeatExposure,
  compareFrequencyBands,
  hasDeepCleansingVulnerability,
  type DeepCleansingVulnerabilityReasonCode,
} from "../src/lib/recommendation-engine/care-balance/shared"
import { buildCareBalanceSet } from "../src/lib/recommendation-engine/care-balance"
import { buildCareNeedAssessment } from "../src/lib/recommendation-engine/assessments/care-needs"
import { buildResetAssessment } from "../src/lib/recommendation-engine/assessments/reset"
import { buildCareBalanceToolContext } from "../src/lib/agent/tools/care-balance-context"
import { buildEffectiveCareContext } from "../src/lib/recommendation-engine/effective-care-context"
import { buildRecommendationEngineRuntimeFromPersistence } from "../src/lib/recommendation-engine/runtime"
import type {
  CareBalanceRow,
  CurrentTurnCareFact,
  DamageAssessment,
  InventoryCategory,
  RecommendationRequestContext,
} from "../src/lib/recommendation-engine/types"
import type { ProductFrequency, StylingTool } from "../src/lib/vocabulary"
import { LOW_DAMAGE_PROFILE } from "./recommendation-engine-foundation.fixtures"

const EMPTY_REQUEST_CONTEXT: RecommendationRequestContext = {
  requestedCategory: null,
  resetTriggerTerms: [],
  resetTriggerSources: [],
  resetFocusRequest: null,
  colorSafeRequest: false,
  scalpTreatmentIntent: false,
  maskIntensityRequest: null,
  leaveInHeatProtectionRequest: null,
  leaveInSeparateHeatProtectantMentioned: false,
  leaveInWeightRequest: null,
  leaveInConditionerRelationshipRequest: null,
  leaveInRequestedFormats: [],
  oilPurpose: null,
  oilNoRecommendationReason: null,
}

function buildRows(
  profileOverrides: Partial<typeof LOW_DAMAGE_PROFILE>,
  routine: {
    category: InventoryCategory
    product_name?: string | null
    frequency_range?: ProductFrequency | null
  }[] = [],
  requestContext: RecommendationRequestContext = EMPTY_REQUEST_CONTEXT,
): CareBalanceRow[] {
  const rawInput = adaptRecommendationInputFromPersistence(
    {
      ...LOW_DAMAGE_PROFILE,
      ...profileOverrides,
    },
    routine.map((item) => ({
      category: item.category,
      product_name: item.product_name ?? "Existing product",
      frequency_range: item.frequency_range ?? null,
    })),
  ).input
  const context = buildEffectiveCareContext(rawInput)
  const damage = buildDamageAssessment(context.normalized)
  const careNeeds = buildCareNeedAssessment(context.normalized, damage)
  const reset = buildResetAssessment(context.normalized, requestContext)

  return buildCareBalanceSet({
    context,
    damage,
    careNeeds,
    reset,
  }).rows
}

function findRow(rows: CareBalanceRow[], category: InventoryCategory): CareBalanceRow {
  const row = rows.find((candidate) => candidate.category === category)
  assert.ok(row, `missing ${category} row`)
  return row
}

function assertRecommendation(
  rows: CareBalanceRow[],
  category: InventoryCategory,
  recommendation: CareBalanceRow["recommendation"],
) {
  const row = findRow(rows, category)
  assert.equal(row.recommendation, recommendation)
  assert.equal(typeof row.present, "boolean")
  assert.ok("currentFrequency" in row)
  assert.ok(row.primaryStatus)
  assert.ok(row.recommendationStrength)
  assert.ok(row.confidence)
  assert.ok(Array.isArray(row.decisiveReasonCodes))
  assert.ok(Array.isArray(row.contextReasonCodes))
  assert.ok(row.cadencePolicy)
  assert.ok(row.selectionHints)
}

test("current-turn routine frequency overrides saved routine frequency and records conflict", () => {
  const rawInput = adaptRecommendationInputFromPersistence(LOW_DAMAGE_PROFILE, [
    {
      category: "oil",
      product_name: "Light Oil",
      frequency_range: "less_than_monthly",
    },
  ]).input
  const facts: CurrentTurnCareFact[] = [
    {
      kind: "routine_frequency",
      category: "oil",
      frequencyBand: "daily_1x",
      evidenceQuote: "Ich benutze Öl aktuell täglich",
      source: "current_turn",
    },
  ]

  const context = buildEffectiveCareContext(rawInput, facts)

  assert.equal(context.normalized.routineInventory.oil?.frequencyBand, "daily_1x")
  assert.deepEqual(context.currentTurnFacts, facts)
  assert.deepEqual(context.conflicts, [
    {
      fieldPath: "routine.oil.frequency",
      savedValue: "less_than_monthly",
      currentTurnValue: "daily_1x",
      source: "current_turn",
      evidenceQuote: "Ich benutze Öl aktuell täglich",
    },
  ])
  assert.deepEqual(context.provenance, [
    {
      fieldPath: "routine.oil.frequency",
      source: "current_turn",
      factKind: "routine_frequency",
      evidenceQuote: "Ich benutze Öl aktuell täglich",
    },
  ])
})

test("current-turn routine presence can clear or create a routine item", () => {
  const rawInput = adaptRecommendationInputFromPersistence(LOW_DAMAGE_PROFILE, [
    {
      category: "mask",
      product_name: "Weekly Mask",
      frequency_range: "weekly_1x",
    },
  ]).input

  const context = buildEffectiveCareContext(rawInput, [
    {
      kind: "routine_presence",
      category: "mask",
      present: false,
      evidenceQuote: "Ich nehme keine Maske mehr",
      source: "current_turn",
    },
    {
      kind: "routine_presence",
      category: "oil",
      present: true,
      evidenceQuote: "Ich benutze jetzt ein Öl",
      source: "current_turn",
    },
  ])

  assert.equal(context.normalized.routineInventory.mask, null)
  assert.deepEqual(context.normalized.routineInventory.oil, {
    category: "oil",
    present: true,
    productName: null,
    frequencyBand: null,
    productId: null,
    productSubmissionId: null,
    matchStatus: null,
  })
  assert.deepEqual(
    context.conflicts.map((conflict) => conflict.fieldPath),
    ["routine.mask.present", "routine.oil.present"],
  )
})

test("current-turn profile augment de-dupes canonical array values", () => {
  const rawInput = adaptRecommendationInputFromPersistence(
    {
      ...LOW_DAMAGE_PROFILE,
      concerns: ["frizz"],
    },
    [],
  ).input

  const context = buildEffectiveCareContext(rawInput, [
    {
      kind: "profile_augment",
      field: "concerns",
      values: ["frizz", "tangling"],
      evidenceQuote: "Meine Haare sind frizzy und verknoten",
      source: "current_turn",
    },
  ])

  assert.deepEqual(context.normalized.concerns, ["frizz", "tangling"])
  assert.deepEqual(context.conflicts, [
    {
      fieldPath: "profile.concerns",
      savedValue: ["frizz"],
      currentTurnValue: ["frizz", "tangling"],
      source: "current_turn",
      evidenceQuote: "Meine Haare sind frizzy und verknoten",
    },
  ])
})

test("current-turn profile override replaces a scalar normalized field", () => {
  const rawInput = adaptRecommendationInputFromPersistence(
    {
      ...LOW_DAMAGE_PROFILE,
      thickness: "normal",
    },
    [],
  ).input

  const context = buildEffectiveCareContext(rawInput, [
    {
      kind: "profile_override",
      field: "thickness",
      value: "fine",
      evidenceQuote: "Eigentlich sind meine Haare fein",
      source: "current_turn",
    },
  ])

  assert.equal(context.normalized.thickness, "fine")
  assert.deepEqual(context.conflicts, [
    {
      fieldPath: "profile.thickness",
      savedValue: "normal",
      currentTurnValue: "fine",
      source: "current_turn",
      evidenceQuote: "Eigentlich sind meine Haare fein",
    },
  ])
})

test("current-turn brush type override replaces saved brush tools for this turn", () => {
  const rawInput = adaptRecommendationInputFromPersistence(
    {
      ...LOW_DAMAGE_PROFILE,
      brush_type: ["paddle"],
    },
    [],
  ).input

  const context = buildEffectiveCareContext(rawInput, [
    {
      kind: "profile_override",
      field: "brushType",
      value: ["fingers"],
      evidenceQuote: "Ich entwirre eigentlich nur mit den Fingern",
      source: "current_turn",
    },
  ])

  assert.deepEqual(context.normalized.brushType, ["fingers"])
  assert.deepEqual(context.conflicts, [
    {
      fieldPath: "profile.brushType",
      savedValue: ["paddle"],
      currentTurnValue: ["fingers"],
      source: "current_turn",
      evidenceQuote: "Ich entwirre eigentlich nur mit den Fingern",
    },
  ])
})

test("current-turn brush type override can clear saved brush tools for this turn", () => {
  const rawInput = adaptRecommendationInputFromPersistence(
    {
      ...LOW_DAMAGE_PROFILE,
      brush_type: ["paddle"],
    },
    [],
  ).input

  const context = buildEffectiveCareContext(rawInput, [
    {
      kind: "profile_override",
      field: "brushType",
      value: [],
      evidenceQuote: "Ich nutze gerade keine Bürste regelmäßig",
      source: "current_turn",
    },
  ])

  assert.deepEqual(context.normalized.brushType, [])
  assert.deepEqual(context.conflicts, [
    {
      fieldPath: "profile.brushType",
      savedValue: ["paddle"],
      currentTurnValue: [],
      source: "current_turn",
      evidenceQuote: "Ich nutze gerade keine Bürste regelmäßig",
    },
  ])
})

test("context signals are retained without changing the effective profile", () => {
  const rawInput = adaptRecommendationInputFromPersistence(LOW_DAMAGE_PROFILE, []).input
  const facts: CurrentTurnCareFact[] = [
    {
      kind: "context_signal",
      key: "asked_for_simple_routine",
      value: true,
      evidenceQuote: "Ich will es simpel halten",
      source: "current_turn",
    },
  ]

  const context = buildEffectiveCareContext(rawInput, facts)

  assert.deepEqual(context.currentTurnFacts, facts)
  assert.deepEqual(context.conflicts, [])
  assert.deepEqual(context.provenance, [])
})

test("buildCareBalanceSet returns one stable row per strong category", () => {
  const rows = buildRows({})

  assert.deepEqual(
    rows.map((row) => row.category),
    [
      "shampoo",
      "conditioner",
      "leave_in",
      "mask",
      "oil",
      "heat_protectant",
      "bondbuilder",
      "deep_cleansing_shampoo",
      "dry_shampoo",
      "peeling",
    ],
  )
  assert.equal(rows.length, 10)
  for (const row of rows) {
    assert.equal(typeof row.present, "boolean")
    assert.ok("currentFrequency" in row)
    assert.ok(row.primaryStatus)
    assert.ok(row.recommendation)
    assert.ok(row.recommendationStrength)
    assert.ok(row.confidence)
    assert.ok(Array.isArray(row.decisiveReasonCodes))
    assert.ok(Array.isArray(row.contextReasonCodes))
    assert.ok(row.cadencePolicy)
    assert.ok(row.selectionHints)
  }
})

test("buildCareBalanceSet recommends adding missing conditioner for dry tangled lengths", () => {
  const rows = buildRows({
    concerns: ["dryness", "tangling"],
    goals: ["moisture"],
  })

  assertRecommendation(rows, "conditioner", "add")
})

test("buildCareBalanceSet recommends increasing rare conditioner against 3-4x wash cadence", () => {
  const rows = buildRows({}, [
    { category: "shampoo", frequency_range: "weekly_3_4x" },
    { category: "conditioner", frequency_range: "less_than_monthly" },
  ])

  assertRecommendation(rows, "conditioner", "increase_frequency")
})

test("buildCareBalanceSet recommends decreasing daily oil under buildup and flatness pressure", () => {
  const rows = buildRows(
    {
      goals: ["volume"],
    },
    [{ category: "oil", frequency_range: "daily_1x" }],
    { ...EMPTY_REQUEST_CONTEXT, resetTriggerTerms: ["buildup"], resetTriggerSources: ["symptom"] },
  )

  assertRecommendation(rows, "oil", "decrease_frequency")
})

test("buildCareBalanceSet recommends adding absent leave-in for frizz and tangling", () => {
  const rows = buildRows({
    concerns: ["frizz", "tangling"],
  })

  assertRecommendation(rows, "leave_in", "add")
})

test("buildCareBalanceSet recommends decreasing frequent mask under buildup pressure", () => {
  const rows = buildRows({}, [{ category: "mask", frequency_range: "weekly_3_4x" }], {
    ...EMPTY_REQUEST_CONTEXT,
    resetTriggerTerms: ["buildup"],
    resetTriggerSources: ["symptom"],
  })

  assertRecommendation(rows, "mask", "decrease_frequency")
})

test("buildCareBalanceSet recommends adding absent heat protectant for flat iron", () => {
  const rows = buildRows({
    heat_styling: "once_weekly",
    styling_tools: ["flat_iron"],
    uses_heat_protection: false,
  })

  assertRecommendation(rows, "heat_protectant", "add")
})

test("buildCareBalanceSet keeps absent heat protectant as no action for blow dryer only", () => {
  const rows = buildRows({
    heat_styling: "once_weekly",
    styling_tools: ["blow_dryer"],
    drying_method: "blow_dry",
    uses_heat_protection: false,
  })

  assertRecommendation(rows, "heat_protectant", "no_action")
})

test("buildCareBalanceSet recommends increasing rare heat protectant for cumulative moderate heat tools", () => {
  const rows = buildRows(
    {
      heat_styling: "several_weekly",
      styling_tools: ["hot_air_brush", "thermal_rollers"],
      uses_heat_protection: true,
    },
    [{ category: "heat_protectant", frequency_range: "less_than_monthly" }],
  )

  assertRecommendation(rows, "heat_protectant", "increase_frequency")
})

test("buildCareBalanceSet recommends adding absent bondbuilder for high bond priority", () => {
  const rows = buildRows({
    chemical_treatment: ["bleached"],
    protein_moisture_balance: "snaps",
    cuticle_condition: "rough",
    concerns: ["hair_damage"],
  })

  assertRecommendation(rows, "bondbuilder", "add")
})

test("buildCareBalanceSet recommends decreasing deep-cleansing shampoo at 3-4x use", () => {
  const rows = buildRows({}, [
    { category: "deep_cleansing_shampoo", frequency_range: "weekly_3_4x" },
  ])

  assertRecommendation(rows, "deep_cleansing_shampoo", "decrease_frequency")
})

test("buildCareBalanceSet recommends decreasing weekly deep-cleansing shampoo with vulnerability", () => {
  const rows = buildRows(
    {
      concerns: ["dryness"],
      scalp_type: "dry",
    },
    [{ category: "deep_cleansing_shampoo", frequency_range: "weekly_1x" }],
  )

  assertRecommendation(rows, "deep_cleansing_shampoo", "decrease_frequency")
})

test("buildCareBalanceSet recommends decreasing daily dry shampoo under reset pressure", () => {
  const rows = buildRows({}, [{ category: "dry_shampoo", frequency_range: "daily_1x" }], {
    ...EMPTY_REQUEST_CONTEXT,
    resetTriggerTerms: ["buildup"],
    resetTriggerSources: ["symptom"],
  })

  assertRecommendation(rows, "dry_shampoo", "decrease_frequency")
})

test("buildCareBalanceSet recommends decreasing peeling when scalp is irritated", () => {
  const rows = buildRows(
    {
      scalp_condition: "irritated",
    },
    [{ category: "peeling", frequency_range: "weekly_1x" }],
  )

  assertRecommendation(rows, "peeling", "decrease_frequency")
})

test("buildCareBalanceSet recommends adding absent shampoo", () => {
  const rows = buildRows({})

  assertRecommendation(rows, "shampoo", "add")
})

test("recommendation runtime exposes oily weekly shampoo cadence as below high target", () => {
  const runtime = buildRecommendationEngineRuntimeFromPersistence(
    {
      ...LOW_DAMAGE_PROFILE,
      scalp_type: "oily",
      concerns: ["oily_scalp"],
    },
    [{ category: "shampoo", product_name: "Existing shampoo", frequency_range: "weekly_1x" }],
  )
  const assessment = runtime.shampooCadenceAssessment
  assert.ok(assessment)

  assert.equal(assessment.currentFrequency, "weekly_1x")
  assert.equal(assessment.baseBand, "high")
  assert.equal(assessment.target?.band, "high")
  assert.equal(assessment.target?.minFrequency, "weekly_2x")
  assert.equal(assessment.delta, "below")
  assert.ok(assessment.reasonCodes.includes("base_scalp_type_oily"))

  const toolContext = buildCareBalanceToolContext({
    runtime,
    rows: runtime.careBalance.rows,
  })

  assert.deepEqual(toolContext.shampoo_cadence, {
    current_frequency: "weekly_1x",
    target_min: "weekly_2x",
    target_max: "weekly_5_6x",
    target_preferred: "weekly_3_4x",
    delta: "below",
    position_in_range: null,
    base_band: "high",
    target_band: "high",
    reason_codes: assessment.reasonCodes,
    caveat_codes: assessment.caveatCodes,
  })
})

test("compareFrequencyBands orders known bands and returns null when either side is unknown", () => {
  assert.equal(compareFrequencyBands("weekly_1x", "weekly_3_4x"), -1)
  assert.equal(compareFrequencyBands("weekly_3_4x", "weekly_3_4x"), 0)
  assert.equal(compareFrequencyBands("daily_1x", "weekly_1x"), 1)
  assert.equal(compareFrequencyBands(null, "weekly_1x"), null)
  assert.equal(compareFrequencyBands("weekly_1x", null), null)
})

test("hasDeepCleansingVulnerability reports vulnerable drivers for dry, damaged, textured, or rough profiles", () => {
  const rawInput = adaptRecommendationInputFromPersistence(
    {
      ...LOW_DAMAGE_PROFILE,
      hair_texture: "curly",
      concerns: ["dryness"],
      scalp_type: "dry",
      chemical_treatment: ["colored"],
      cuticle_condition: "rough",
    },
    [],
  ).input
  const vulnerableProfile = buildEffectiveCareContext(rawInput).normalized
  const vulnerableDamage = buildDamageAssessment(vulnerableProfile)

  const vulnerability = hasDeepCleansingVulnerability(vulnerableProfile, vulnerableDamage)

  assert.equal(vulnerability.vulnerable, true)
  assert.deepEqual(vulnerability.relevantTools, [])
  assert.deepEqual(vulnerability.reasonCodes, [
    "dry_scalp",
    "dry_lengths_or_concerns",
    "high_damage",
    "color_or_bleach",
    "curly_or_coily_texture",
    "rough_cuticle",
  ])
})

test("hasDeepCleansingVulnerability treats each vulnerability driver as independently sufficient", () => {
  const buildProfile = (overrides: Partial<typeof LOW_DAMAGE_PROFILE>) =>
    buildEffectiveCareContext(
      adaptRecommendationInputFromPersistence(
        {
          ...LOW_DAMAGE_PROFILE,
          ...overrides,
        },
        [],
      ).input,
    ).normalized

  const cases: {
    name: string
    profile: ReturnType<typeof buildProfile>
    damageOverride?: Partial<DamageAssessment>
    expectedReasonCode: DeepCleansingVulnerabilityReasonCode
  }[] = [
    {
      name: "dry scalp",
      profile: buildProfile({ scalp_type: "dry" }),
      expectedReasonCode: "dry_scalp",
    },
    {
      name: "dry lengths",
      profile: buildProfile({ concerns: ["dryness"] }),
      expectedReasonCode: "dry_lengths_or_concerns",
    },
    {
      name: "high damage",
      profile: buildProfile({}),
      damageOverride: { overallLevel: "high" },
      expectedReasonCode: "high_damage",
    },
    {
      name: "color or bleach",
      profile: buildProfile({ chemical_treatment: ["bleached"] }),
      expectedReasonCode: "color_or_bleach",
    },
    {
      name: "curly or coily",
      profile: buildProfile({ hair_texture: "coily" }),
      expectedReasonCode: "curly_or_coily_texture",
    },
    {
      name: "rough cuticle",
      profile: buildProfile({ cuticle_condition: "rough" }),
      expectedReasonCode: "rough_cuticle",
    },
  ]

  for (const testCase of cases) {
    const damage = {
      ...buildDamageAssessment(testCase.profile),
      ...testCase.damageOverride,
    }
    const vulnerability = hasDeepCleansingVulnerability(testCase.profile, damage)

    assert.equal(vulnerability.vulnerable, true, testCase.name)
    assert.equal(
      vulnerability.reasonCodes.includes(testCase.expectedReasonCode),
      true,
      testCase.name,
    )
  }
})

test("hasDeepCleansingVulnerability is false for quiet balanced profiles", () => {
  const balancedProfile = buildEffectiveCareContext(
    adaptRecommendationInputFromPersistence(LOW_DAMAGE_PROFILE, []).input,
  ).normalized
  const balancedDamage = buildDamageAssessment(balancedProfile)

  assert.deepEqual(hasDeepCleansingVulnerability(balancedProfile, balancedDamage), {
    vulnerable: false,
    relevantTools: [],
    reasonCodes: [],
  })
})

test("classifyHeatExposure distinguishes airflow, moderate, cumulative, direct, and none tiers", () => {
  type StylingTools = StylingTool[]
  const buildProfileWithTools = (
    stylingTools: StylingTools,
    dryingMethod: typeof LOW_DAMAGE_PROFILE.drying_method = "air_dry",
  ) =>
    buildEffectiveCareContext(
      adaptRecommendationInputFromPersistence(
        {
          ...LOW_DAMAGE_PROFILE,
          drying_method: dryingMethod,
          heat_styling: stylingTools.length > 0 ? "once_weekly" : "never",
          styling_tools: stylingTools,
        },
        [],
      ).input,
    ).normalized

  assert.deepEqual(classifyHeatExposure(buildProfileWithTools(["blow_dryer"])), {
    tier: "airflow",
    relevantTools: ["blow_dryer"],
    reasonCodes: ["airflow_heat_tool"],
  })
  assert.deepEqual(classifyHeatExposure(buildProfileWithTools(["diffuser"])), {
    tier: "airflow",
    relevantTools: ["diffuser"],
    reasonCodes: ["airflow_heat_tool"],
  })
  assert.deepEqual(classifyHeatExposure(buildProfileWithTools([], "blow_dry")), {
    tier: "airflow",
    relevantTools: ["blow_dryer"],
    reasonCodes: ["airflow_heat_tool"],
  })
  assert.deepEqual(classifyHeatExposure(buildProfileWithTools([], "blow_dry_diffuser")), {
    tier: "airflow",
    relevantTools: ["diffuser"],
    reasonCodes: ["airflow_heat_tool"],
  })
  assert.deepEqual(classifyHeatExposure(buildProfileWithTools(["hot_air_brush"])), {
    tier: "moderate",
    relevantTools: ["hot_air_brush"],
    reasonCodes: ["moderate_heat_tool"],
  })
  assert.deepEqual(classifyHeatExposure(buildProfileWithTools(["thermal_rollers"])), {
    tier: "moderate",
    relevantTools: ["thermal_rollers"],
    reasonCodes: ["moderate_heat_tool"],
  })
  assert.deepEqual(
    classifyHeatExposure(buildProfileWithTools(["hot_air_brush", "thermal_rollers"])),
    {
      tier: "high_cumulative",
      relevantTools: ["hot_air_brush", "thermal_rollers"],
      reasonCodes: ["cumulative_moderate_heat_tools"],
    },
  )
  assert.deepEqual(classifyHeatExposure(buildProfileWithTools(["flat_iron"])), {
    tier: "high_direct",
    relevantTools: ["flat_iron"],
    reasonCodes: ["direct_high_heat_tool"],
  })
  assert.equal(classifyHeatExposure(buildProfileWithTools(["curling_iron"])).tier, "high_direct")
  assert.equal(classifyHeatExposure(buildProfileWithTools(["wave_iron"])).tier, "high_direct")
  assert.equal(classifyHeatExposure(buildProfileWithTools(["multi_tool"])).tier, "high_direct")
  assert.deepEqual(classifyHeatExposure(buildProfileWithTools([])), {
    tier: "none",
    relevantTools: [],
    reasonCodes: [],
  })
})
