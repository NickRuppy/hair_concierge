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
import { buildEffectiveCareContext } from "../src/lib/recommendation-engine/effective-care-context"
import type { CurrentTurnCareFact, DamageAssessment } from "../src/lib/recommendation-engine/types"
import type { StylingTool } from "../src/lib/vocabulary"
import { LOW_DAMAGE_PROFILE } from "./recommendation-engine-foundation.fixtures"

test("current-turn routine frequency overrides saved routine frequency and records conflict", () => {
  const rawInput = adaptRecommendationInputFromPersistence(LOW_DAMAGE_PROFILE, [
    {
      category: "oil",
      product_name: "Light Oil",
      frequency_range: "rarely",
    },
  ]).input
  const facts: CurrentTurnCareFact[] = [
    {
      kind: "routine_frequency",
      category: "oil",
      frequencyBand: "daily",
      evidenceQuote: "Ich benutze Öl aktuell täglich",
      source: "current_turn",
    },
  ]

  const context = buildEffectiveCareContext(rawInput, facts)

  assert.equal(context.normalized.routineInventory.oil?.frequencyBand, "daily")
  assert.deepEqual(context.currentTurnFacts, facts)
  assert.deepEqual(context.conflicts, [
    {
      fieldPath: "routine.oil.frequency",
      savedValue: "rarely",
      currentTurnValue: "daily",
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
      frequency_range: "1_2x",
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

test("compareFrequencyBands orders known bands and returns null when either side is unknown", () => {
  assert.equal(compareFrequencyBands("1_2x", "3_4x"), -1)
  assert.equal(compareFrequencyBands("3_4x", "3_4x"), 0)
  assert.equal(compareFrequencyBands("daily", "1_2x"), 1)
  assert.equal(compareFrequencyBands(null, "1_2x"), null)
  assert.equal(compareFrequencyBands("1_2x", null), null)
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
