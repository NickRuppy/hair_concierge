import assert from "node:assert/strict"
import test from "node:test"

import { buildCareBalanceToolContext } from "../src/lib/agent/tools/care-balance-context"
import { mapCadencePolicyToFrequencyTarget } from "../src/lib/recommendation-engine/care-balance/frequency-targets"
import { buildRecommendationEngineRuntimeFromPersistence } from "../src/lib/recommendation-engine/runtime"
import type {
  CareBalanceRow,
  InventoryCategory,
  RecommendationRequestContext,
} from "../src/lib/recommendation-engine/types"
import type { ProductFrequency } from "../src/lib/vocabulary"
import {
  LOW_DAMAGE_PROFILE,
  SEVERE_DAMAGE_PROFILE,
} from "./recommendation-engine-foundation.fixtures"

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

const RESET_CONTEXT = {
  ...EMPTY_REQUEST_CONTEXT,
  resetTriggerTerms: ["buildup"],
  resetTriggerSources: ["symptom" as const],
}

function rowsFor(
  profileOverrides: Partial<typeof LOW_DAMAGE_PROFILE>,
  routine: {
    category: InventoryCategory
    product_name?: string | null
    frequency_range?: ProductFrequency | null
  }[] = [],
  requestContext = EMPTY_REQUEST_CONTEXT,
): CareBalanceRow[] {
  return buildRecommendationEngineRuntimeFromPersistence(
    { ...LOW_DAMAGE_PROFILE, ...profileOverrides },
    routine.map((item) => ({
      category: item.category,
      product_name: item.product_name ?? "Existing product",
      frequency_range: item.frequency_range ?? null,
    })),
    requestContext,
  ).careBalance.rows
}

function rowFor(rows: CareBalanceRow[], category: InventoryCategory): CareBalanceRow {
  const row = rows.find((candidate) => candidate.category === category)
  assert.ok(row, `missing ${category} row`)
  return row
}

function assertTarget(
  row: CareBalanceRow,
  expected: {
    min: ProductFrequency
    max: ProductFrequency
    preferred: ProductFrequency
    delta: "missing" | "below" | "in_range" | "above" | "unknown"
  },
) {
  assert.ok(row.frequencyTarget, `${row.category} should expose a frequency target`)
  assert.equal(row.frequencyTarget.minFrequency, expected.min)
  assert.equal(row.frequencyTarget.maxFrequency, expected.max)
  assert.equal(row.frequencyTarget.preferredFrequency, expected.preferred)
  assert.equal(row.frequencyTarget.delta, expected.delta)
}

test("missing shampoo still exposes the shampoo cadence target with null current frequency", () => {
  const shampoo = rowFor(rowsFor({ scalp_type: "balanced" }, []), "shampoo")

  assert.equal(shampoo.present, false)
  assert.equal(shampoo.currentFrequency, null)
  assert.equal(shampoo.cadencePolicy.kind, "baseline_cleansing")
  assertTarget(shampoo, {
    min: "weekly_1x",
    max: "weekly_3_4x",
    preferred: "weekly_2x",
    delta: "missing",
  })
})

test("conditioner follows the shampoo target and does not exceed shampoo cadence", () => {
  const rows = rowsFor({ scalp_type: "balanced" }, [
    { category: "shampoo", frequency_range: "weekly_3_4x" },
    { category: "conditioner", frequency_range: "weekly_1x" },
  ])
  const shampoo = rowFor(rows, "shampoo")
  const conditioner = rowFor(rows, "conditioner")

  assertTarget(shampoo, {
    min: "weekly_1x",
    max: "weekly_3_4x",
    preferred: "weekly_2x",
    delta: "in_range",
  })
  assertTarget(conditioner, {
    min: "weekly_1x",
    max: "weekly_3_4x",
    preferred: "weekly_2x",
    delta: "in_range",
  })
})

test("leave-in exposes a high need target for curly dry frizzy tangled hair", () => {
  const leaveIn = rowFor(
    rowsFor(
      {
        hair_texture: "curly",
        concerns: ["dryness", "frizz", "tangling"],
      },
      [{ category: "leave_in", frequency_range: "weekly_1x" }],
    ),
    "leave_in",
  )

  assertTarget(leaveIn, {
    min: "weekly_3_4x",
    max: "daily_1x",
    preferred: "weekly_3_4x",
    delta: "below",
  })
})

test("daily mask and oil are overuse against need-based support targets", () => {
  const rows = rowsFor({}, [
    { category: "mask", frequency_range: "daily_1x" },
    { category: "oil", frequency_range: "daily_1x" },
  ])
  const mask = rowFor(rows, "mask")
  const oil = rowFor(rows, "oil")

  assert.equal(mask.primaryStatus, "overused")
  assert.equal(oil.primaryStatus, "overused")
  assertTarget(mask, {
    min: "biweekly_1x",
    max: "weekly_1x",
    preferred: "weekly_1x",
    delta: "above",
  })
  assertTarget(oil, {
    min: "monthly_1x",
    max: "weekly_1x",
    preferred: "weekly_1x",
    delta: "above",
  })
})

test("frequency target mapper projects need-based and reset policy without raw profile facts", () => {
  const leaveIn = mapCadencePolicyToFrequencyTarget({
    cadencePolicy: {
      kind: "need_based_support",
      supportNeed: "high",
      loadSensitive: false,
      suggestedBand: "weekly_2x",
      targetBand: {
        minFrequency: "weekly_2x",
        maxFrequency: "weekly_3_4x",
        preferredFrequency: "weekly_2x",
      },
    },
    currentFrequency: "weekly_1x",
  })
  const deepCleansing = mapCadencePolicyToFrequencyTarget({
    cadencePolicy: {
      kind: "occasional_reset",
      resetNeed: "strong",
      cautionAtOrAbove: "weekly_3_4x",
      vulnerableCautionAtOrAbove: null,
      targetBand: {
        minFrequency: "monthly_1x",
        maxFrequency: "weekly_1x",
        preferredFrequency: "biweekly_1x",
      },
    },
    currentFrequency: "weekly_3_4x",
  })

  assert.deepEqual(leaveIn, {
    minFrequency: "weekly_2x",
    maxFrequency: "weekly_3_4x",
    preferredFrequency: "weekly_2x",
    delta: "below",
  })
  assert.deepEqual(deepCleansing, {
    minFrequency: "monthly_1x",
    maxFrequency: "weekly_1x",
    preferredFrequency: "biweekly_1x",
    delta: "above",
  })
})

test("heat protectant target follows supported heat styling exposure", () => {
  const heatProtectant = rowFor(
    rowsFor(
      {
        heat_styling: "daily",
        styling_tools: ["flat_iron"],
        uses_heat_protection: true,
      },
      [{ category: "heat_protectant", frequency_range: "weekly_3_4x" }],
    ),
    "heat_protectant",
  )

  assertTarget(heatProtectant, {
    min: "weekly_5_6x",
    max: "daily_1x",
    preferred: "daily_1x",
    delta: "below",
  })
})

test("hot air brush requires heat protectant at the saved heat styling frequency", () => {
  const heatProtectant = rowFor(
    rowsFor({
      heat_styling: "once_weekly",
      styling_tools: ["hot_air_brush"],
      uses_heat_protection: false,
    }),
    "heat_protectant",
  )

  assert.equal(heatProtectant.primaryStatus, "missing_needed")
  assertTarget(heatProtectant, {
    min: "weekly_1x",
    max: "weekly_1x",
    preferred: "weekly_1x",
    delta: "missing",
  })
})

test("blow dryer and diffuser alone do not create a heat protectant target", () => {
  const heatProtectant = rowFor(
    rowsFor({
      heat_styling: "several_weekly",
      styling_tools: ["blow_dryer", "diffuser"],
      drying_method: "blow_dry_diffuser",
      uses_heat_protection: false,
    }),
    "heat_protectant",
  )

  assert.equal(heatProtectant.primaryStatus, "not_relevant")
  assert.equal(heatProtectant.frequencyTarget, null)
})

test("never heat styling keeps heat protectant target null even with a selected heat tool", () => {
  const heatProtectant = rowFor(
    rowsFor({
      heat_styling: "never",
      styling_tools: ["flat_iron"],
      uses_heat_protection: false,
    }),
    "heat_protectant",
  )

  assert.equal(heatProtectant.frequencyTarget, null)
})

test("bondbuilder high damage allows weekly to twice weekly but not daily", () => {
  const bondbuilder = rowFor(
    buildRecommendationEngineRuntimeFromPersistence(SEVERE_DAMAGE_PROFILE, [
      { category: "bondbuilder", product_name: "Bond Builder", frequency_range: "daily_1x" },
    ]).careBalance.rows,
    "bondbuilder",
  )

  assertTarget(bondbuilder, {
    min: "biweekly_1x",
    max: "weekly_2x",
    preferred: "weekly_2x",
    delta: "above",
  })
})

test("deep cleansing reaches weekly only for strong buildup without vulnerability", () => {
  const deepCleansing = rowFor(
    rowsFor(
      {
        scalp_type: "oily",
        concerns: ["oily_scalp"],
      },
      [
        { category: "shampoo", frequency_range: "weekly_1x" },
        { category: "dry_shampoo", frequency_range: "weekly_5_6x" },
        { category: "oil", frequency_range: "weekly_3_4x" },
        { category: "mask", frequency_range: "weekly_3_4x" },
        { category: "deep_cleansing_shampoo", frequency_range: "monthly_1x" },
      ],
      RESET_CONTEXT,
    ),
    "deep_cleansing_shampoo",
  )

  assertTarget(deepCleansing, {
    min: "monthly_1x",
    max: "weekly_1x",
    preferred: "biweekly_1x",
    delta: "in_range",
  })
})

test("peeling target caps low on irritated scalp", () => {
  const peeling = rowFor(
    rowsFor(
      {
        scalp_condition: "irritated",
      },
      [{ category: "peeling", frequency_range: "weekly_1x" }],
    ),
    "peeling",
  )

  assertTarget(peeling, {
    min: "less_than_monthly",
    max: "monthly_1x",
    preferred: "monthly_1x",
    delta: "above",
  })
})

test("dry shampoo daily is overuse and remains a bridge target only", () => {
  const dryShampoo = rowFor(
    rowsFor(
      {
        scalp_type: "oily",
        shampoo_frequency: "weekly_1x",
      },
      [
        { category: "shampoo", frequency_range: "weekly_1x" },
        { category: "dry_shampoo", frequency_range: "daily_1x" },
      ],
    ),
    "dry_shampoo",
  )

  assert.equal(dryShampoo.primaryStatus, "overused")
  assertTarget(dryShampoo, {
    min: "weekly_1x",
    max: "weekly_2x",
    preferred: "weekly_1x",
    delta: "above",
  })
})

test("agent care balance context serializes the frequency target", () => {
  const runtime = buildRecommendationEngineRuntimeFromPersistence(
    { ...LOW_DAMAGE_PROFILE, scalp_type: "balanced" },
    [{ category: "shampoo", product_name: "Existing shampoo", frequency_range: "weekly_1x" }],
  )
  const toolContext = buildCareBalanceToolContext({
    runtime,
    rows: runtime.careBalance.rows,
  })
  const shampoo = toolContext.rows.find((candidate) => candidate.category === "shampoo")

  assert.ok(shampoo)
  assert.deepEqual(shampoo.frequency_target, {
    min_frequency: "weekly_1x",
    max_frequency: "weekly_3_4x",
    preferred_frequency: "weekly_2x",
    delta: "in_range",
  })
})
