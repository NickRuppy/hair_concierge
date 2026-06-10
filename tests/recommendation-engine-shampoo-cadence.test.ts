import assert from "node:assert/strict"
import test from "node:test"

import { adaptRecommendationInputFromPersistence } from "../src/lib/recommendation-engine/adapters/from-persistence"
import { buildShampooCadenceAssessment } from "../src/lib/recommendation-engine/shampoo-cadence"
import { buildEffectiveCareContext } from "../src/lib/recommendation-engine/effective-care-context"
import type {
  NormalizedProfile,
  NormalizedRoutineInventoryItem,
  ResetAssessment,
} from "../src/lib/recommendation-engine/types"
import type { ProductFrequency } from "../src/lib/vocabulary"
import { LOW_DAMAGE_PROFILE } from "./recommendation-engine-foundation.fixtures"

function inventoryItem(
  category: NormalizedRoutineInventoryItem["category"],
  frequencyBand: ProductFrequency | null,
  present = true,
): NormalizedRoutineInventoryItem {
  return {
    category,
    present,
    productName: present ? `${category} product` : null,
    frequencyBand,
  }
}

function profile(overrides: Partial<NormalizedProfile> = {}): NormalizedProfile {
  return {
    hairTexture: null,
    thickness: null,
    density: null,
    concerns: [],
    goals: [],
    washFrequency: null,
    heatStyling: null,
    stylingTools: null,
    cuticleCondition: null,
    proteinMoistureBalance: null,
    scalpType: null,
    scalpCondition: null,
    chemicalTreatment: [],
    towelMaterial: null,
    towelTechnique: null,
    dryingMethod: null,
    brushType: null,
    nightProtection: null,
    usesHeatProtection: false,
    routineInventory: {
      shampoo: null,
      conditioner: null,
      mask: null,
      leave_in: null,
      oil: null,
      bondbuilder: null,
      deep_cleansing_shampoo: null,
      dry_shampoo: null,
      peeling: null,
      heat_protectant: null,
    },
    ...overrides,
  }
}

function withShampooFrequency(
  frequencyBand: ProductFrequency | null,
  overrides: Partial<NormalizedProfile> = {},
) {
  return profile({
    ...overrides,
    routineInventory: {
      ...profile().routineInventory,
      ...overrides.routineInventory,
      shampoo: inventoryItem("shampoo", frequencyBand),
    },
  })
}

function reset(level: ResetAssessment["level"], triggers: string[] = []): ResetAssessment {
  return {
    level,
    triggers,
    triggerSources: triggers.length > 0 ? ["routine_exposure"] : [],
    resetFocus: null,
    overloadRisk: level,
    richOptionalCareRisk: level === "likely" || level === "strong",
    cautionFlags: [],
  }
}

test("oily scalp with weekly_1x shampoo is below the high target", () => {
  const assessment = buildShampooCadenceAssessment(
    withShampooFrequency("weekly_1x", { scalpType: "oily" }),
  )

  assert.equal(assessment.target?.band, "high")
  assert.equal(assessment.delta, "below")
  assert.equal(assessment.positionInRange, null)
})

test("oily scalp with weekly_2x shampoo is near the lower edge of the high target", () => {
  const assessment = buildShampooCadenceAssessment(
    withShampooFrequency("weekly_2x", { scalpType: "oily" }),
  )

  assert.equal(assessment.target?.band, "high")
  assert.equal(assessment.delta, "near")
  assert.equal(assessment.positionInRange, "lower_edge")
})

test("oily scalp with weekly_3_4x shampoo is near the preferred high target", () => {
  const assessment = buildShampooCadenceAssessment(
    withShampooFrequency("weekly_3_4x", { scalpType: "oily" }),
  )

  assert.equal(assessment.target?.band, "high")
  assert.equal(assessment.delta, "near")
  assert.equal(assessment.positionInRange, "preferred")
})

test("oily scalp with weekly_5_6x shampoo is near the upper edge of the high target", () => {
  const assessment = buildShampooCadenceAssessment(
    withShampooFrequency("weekly_5_6x", { scalpType: "oily" }),
  )

  assert.equal(assessment.target?.band, "high")
  assert.equal(assessment.delta, "near")
  assert.equal(assessment.positionInRange, "upper_edge")
})

test("oily scalp with daily shampoo is above the high target", () => {
  const assessment = buildShampooCadenceAssessment(
    withShampooFrequency("daily_1x", { scalpType: "oily" }),
  )

  assert.equal(assessment.target?.band, "high")
  assert.equal(assessment.delta, "above")
  assert.equal(assessment.positionInRange, null)
})

test("balanced scalp maps to the medium target", () => {
  const assessment = buildShampooCadenceAssessment(profile({ scalpType: "balanced" }))

  assert.equal(assessment.target?.band, "medium")
  assert.equal(assessment.target?.minFrequency, "weekly_1x")
  assert.equal(assessment.target?.preferredFrequency, "weekly_2x")
  assert.equal(assessment.target?.maxFrequency, "weekly_3_4x")
})

test("irritated scalp takes precedence over oily scalp type and exposes oily caveat", () => {
  const assessment = buildShampooCadenceAssessment(
    profile({ scalpType: "oily", scalpCondition: "irritated" }),
  )

  assert.equal(assessment.baseBand, "medium")
  assert.equal(assessment.target?.band, "medium")
  assert.ok(assessment.reasonCodes.includes("base_scalp_condition_irritated"))
  assert.ok(assessment.caveatCodes.includes("secondary_scalp_type_oily"))
})

test("dandruff maps to the high target", () => {
  const assessment = buildShampooCadenceAssessment(profile({ scalpCondition: "dandruff" }))

  assert.equal(assessment.target?.band, "high")
  assert.ok(assessment.reasonCodes.includes("base_scalp_condition_dandruff"))
})

test("dry flakes map to the low target", () => {
  const assessment = buildShampooCadenceAssessment(profile({ scalpCondition: "dry_flakes" }))

  assert.equal(assessment.target?.band, "low")
  assert.equal(assessment.target?.minFrequency, "biweekly_1x")
  assert.equal(assessment.target?.preferredFrequency, "weekly_1x")
  assert.equal(assessment.target?.maxFrequency, "weekly_1x")
})

test("balanced scalp with oily scalp concern moves up to the high target", () => {
  const assessment = buildShampooCadenceAssessment(
    profile({ scalpType: "balanced", concerns: ["oily_scalp"] }),
  )

  assert.equal(assessment.baseBand, "medium")
  assert.equal(assessment.target?.band, "high")
  assert.ok(assessment.reasonCodes.includes("modifier_up_oily_scalp_concern"))
})

test("healthy scalp goal can move balanced scalp up one band", () => {
  const assessment = buildShampooCadenceAssessment(
    profile({ scalpType: "balanced", goals: ["healthy_scalp"] }),
  )

  assert.equal(assessment.baseBand, "medium")
  assert.equal(assessment.target?.band, "high")
  assert.ok(assessment.reasonCodes.includes("modifier_up_healthy_scalp_goal"))
})

test("multiple upward modifiers are capped to one band", () => {
  const assessment = buildShampooCadenceAssessment(
    profile({
      scalpType: "dry",
      concerns: ["oily_scalp"],
      goals: ["healthy_scalp"],
      routineInventory: {
        ...profile().routineInventory,
        dry_shampoo: inventoryItem("dry_shampoo", "weekly_3_4x"),
      },
    }),
    reset("strong", ["low_wash_cadence_relative_to_load"]),
  )

  assert.equal(assessment.baseBand, "low")
  assert.equal(assessment.target?.band, "medium")
  assert.ok(assessment.reasonCodes.includes("modifier_up_oily_scalp_concern"))
  assert.ok(assessment.reasonCodes.includes("modifier_up_healthy_scalp_goal"))
  assert.ok(assessment.reasonCodes.includes("modifier_up_frequent_dry_shampoo"))
  assert.ok(assessment.reasonCodes.includes("modifier_up_cadence_relevant_reset"))
})

test("oily scalp with stacked fiber fragility moves down to the medium target", () => {
  const assessment = buildShampooCadenceAssessment(
    profile({ scalpType: "oily", hairTexture: "curly", concerns: ["breakage"] }),
  )

  assert.equal(assessment.baseBand, "high")
  assert.equal(assessment.target?.band, "medium")
  assert.ok(assessment.reasonCodes.includes("modifier_down_stacked_fiber_fragility"))
})

test("oily scalp with up and down modifiers keeps the high base target and exposes both signals", () => {
  const assessment = buildShampooCadenceAssessment(
    profile({
      scalpType: "oily",
      hairTexture: "curly",
      concerns: ["breakage"],
      routineInventory: {
        ...profile().routineInventory,
        dry_shampoo: inventoryItem("dry_shampoo", "weekly_3_4x"),
      },
    }),
  )

  assert.equal(assessment.baseBand, "high")
  assert.equal(assessment.target?.band, "high")
  assert.ok(assessment.reasonCodes.includes("modifier_up_frequent_dry_shampoo"))
  assert.ok(assessment.reasonCodes.includes("modifier_down_stacked_fiber_fragility"))
  assert.ok(assessment.caveatCodes.includes("conflicting_cadence_modifiers"))
})

test("known scalp target with no shampoo frequency falls back to rare shampoo cadence", () => {
  const assessment = buildShampooCadenceAssessment(profile({ scalpType: "oily" }))

  assert.equal(assessment.target?.band, "high")
  assert.equal(assessment.currentFrequency, "less_than_monthly")
  assert.equal(assessment.delta, "below")
  assert.equal(assessment.positionInRange, null)
})

test("less_than_monthly shampoo cadence is treated as current frequency and falls below oily target", () => {
  const assessment = buildShampooCadenceAssessment(
    profile({
      scalpType: "oily",
      routineInventory: {
        ...profile().routineInventory,
        shampoo: inventoryItem("shampoo", "less_than_monthly", false),
      },
    }),
  )

  assert.equal(assessment.currentFrequency, "less_than_monthly")
  assert.equal(assessment.target?.band, "high")
  assert.equal(assessment.delta, "below")
})

test("hidden unselected shampoo fallback is hidden from inventory but still drives cadence delta", () => {
  const rawInput = adaptRecommendationInputFromPersistence(
    {
      ...LOW_DAMAGE_PROFILE,
      scalp_type: "oily",
      scalp_condition: null,
    },
    [
      {
        category: "shampoo",
        product_name: "__system_no_shampoo_selected__",
        frequency_range: "less_than_monthly",
      },
    ],
  ).input
  const context = buildEffectiveCareContext(rawInput)

  assert.equal(context.normalized.routineInventory.shampoo, null)
  assert.equal(context.normalized.washFrequency, "less_than_monthly")

  const assessment = buildShampooCadenceAssessment(context.normalized)

  assert.equal(assessment.currentFrequency, "less_than_monthly")
  assert.equal(assessment.target?.band, "high")
  assert.equal(assessment.delta, "below")
})

test("visible shampoo with unknown frequency uses the same fallback as an empty shampoo row", () => {
  const assessment = buildShampooCadenceAssessment(
    profile({
      scalpType: "oily",
      routineInventory: {
        ...profile().routineInventory,
        shampoo: inventoryItem("shampoo", null),
      },
    }),
  )

  assert.equal(assessment.currentFrequency, "less_than_monthly")
  assert.equal(assessment.target?.band, "high")
  assert.equal(assessment.delta, "below")
})

test("legacy wash frequency still backfills an unknown shampoo cadence before the rare fallback", () => {
  const assessment = buildShampooCadenceAssessment(
    profile({
      scalpType: "oily",
      washFrequency: "weekly_2x",
      routineInventory: {
        ...profile().routineInventory,
        shampoo: inventoryItem("shampoo", null),
      },
    }),
  )

  assert.equal(assessment.currentFrequency, "weekly_2x")
  assert.equal(assessment.target?.band, "high")
  assert.equal(assessment.delta, "near")
  assert.equal(assessment.positionInRange, "lower_edge")
})

test("cadence-relevant likely reset assessment moves a balanced scalp up to the high target", () => {
  const assessment = buildShampooCadenceAssessment(
    profile({ scalpType: "balanced" }),
    reset("likely", ["low_wash_cadence_relative_to_load"]),
  )

  assert.equal(assessment.baseBand, "medium")
  assert.equal(assessment.target?.band, "high")
  assert.ok(assessment.reasonCodes.includes("modifier_up_cadence_relevant_reset"))
})

test("strong reset assessment uses the same upward modifier as likely reset when cadence relevant", () => {
  const assessment = buildShampooCadenceAssessment(
    profile({ scalpType: "balanced" }),
    reset("strong", ["heavy_residue_prone_routine"]),
  )

  assert.equal(assessment.baseBand, "medium")
  assert.equal(assessment.target?.band, "high")
  assert.ok(assessment.reasonCodes.includes("modifier_up_cadence_relevant_reset"))
})

test("mineral-only reset assessment does not move shampoo cadence upward", () => {
  const assessment = buildShampooCadenceAssessment(
    profile({ scalpType: "balanced" }),
    reset("strong", ["hard_water_mineral_context"]),
  )

  assert.equal(assessment.baseBand, "medium")
  assert.equal(assessment.target?.band, "medium")
  assert.ok(!assessment.reasonCodes.includes("modifier_up_cadence_relevant_reset"))
})

test("weekly dry shampoo alone does not move shampoo cadence upward", () => {
  const assessment = buildShampooCadenceAssessment(
    profile({
      scalpType: "balanced",
      routineInventory: {
        ...profile().routineInventory,
        dry_shampoo: inventoryItem("dry_shampoo", "weekly_1x"),
      },
    }),
  )

  assert.equal(assessment.baseBand, "medium")
  assert.equal(assessment.target?.band, "medium")
  assert.ok(!assessment.reasonCodes.includes("modifier_up_frequent_dry_shampoo"))
})

test("twice-weekly dry shampoo moves shampoo cadence upward one band", () => {
  const assessment = buildShampooCadenceAssessment(
    profile({
      scalpType: "balanced",
      routineInventory: {
        ...profile().routineInventory,
        dry_shampoo: inventoryItem("dry_shampoo", "weekly_2x"),
      },
    }),
  )

  assert.equal(assessment.baseBand, "medium")
  assert.equal(assessment.target?.band, "high")
  assert.ok(assessment.reasonCodes.includes("modifier_up_frequent_dry_shampoo"))
})

test("dry-flake scalp condition outranks broad dandruff concern", () => {
  const assessment = buildShampooCadenceAssessment(
    profile({ scalpCondition: "dry_flakes", concerns: ["dandruff"] }),
  )

  assert.equal(assessment.baseBand, "low")
  assert.equal(assessment.target?.band, "low")
  assert.ok(assessment.reasonCodes.includes("base_scalp_condition_dry_flakes"))
})

test("dandruff concern without a specific scalp condition maps to the high target", () => {
  const assessment = buildShampooCadenceAssessment(profile({ concerns: ["dandruff"] }))

  assert.equal(assessment.baseBand, "high")
  assert.equal(assessment.target?.band, "high")
  assert.ok(assessment.reasonCodes.includes("base_concern_dandruff"))
})
