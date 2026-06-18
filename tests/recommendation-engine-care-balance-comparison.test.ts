import assert from "node:assert/strict"
import test from "node:test"

import { buildRecommendationEngineRuntimeFromPersistence } from "../src/lib/recommendation-engine/runtime"
import { buildRecommendationRequestContext } from "../src/lib/recommendation-engine/request-context"
import type {
  CareBalanceRecommendation,
  EngineCategoryId,
  InterventionPlan,
  RecommendationRequestContext,
} from "../src/lib/recommendation-engine/types"
import {
  LOW_DAMAGE_PROFILE,
  SEVERE_DAMAGE_PROFILE,
} from "./recommendation-engine-foundation.fixtures"

function hasPlanStep(plan: InterventionPlan, category: EngineCategoryId, action: string): boolean {
  return plan.steps.some((step) => step.category === category && step.action === action)
}

function careBalanceAction(
  runtime: ReturnType<typeof buildRecommendationEngineRuntimeFromPersistence>,
  category: EngineCategoryId,
): CareBalanceRecommendation {
  const row = runtime.careBalance.rows.find((candidate) => candidate.category === category)
  assert.ok(row, `missing care balance row for ${category}`)
  return row.recommendation
}

function comparisonAction(
  runtime: ReturnType<typeof buildRecommendationEngineRuntimeFromPersistence>,
  category: EngineCategoryId,
) {
  const comparison = runtime.legacyPlanComparison
  assert.ok(comparison, "missing legacy plan comparison")
  return comparison.differences.find((difference) => difference.category === category)
}

test("runtime keeps legacy planner authoritative while CareBalance also detects missing conditioner", () => {
  const runtime = buildRecommendationEngineRuntimeFromPersistence(
    {
      ...LOW_DAMAGE_PROFILE,
      concerns: ["dryness", "tangling"],
    },
    [],
  )

  assert.equal(runtime.effectiveContext.normalized, runtime.normalized)
  assert.ok(hasPlanStep(runtime.plan, "conditioner", "add"))
  assert.equal(careBalanceAction(runtime, "conditioner"), "add")
  assert.ok(hasPlanStep(runtime.legacyPlanComparison!.projectedPlan, "conditioner", "add"))
})

test("runtime preserves matched and pending routine product identity in effective context", () => {
  const runtime = buildRecommendationEngineRuntimeFromPersistence(LOW_DAMAGE_PROFILE, [
    {
      category: "conditioner",
      product_name: "User Conditioner",
      frequency_range: "weekly_3_4x",
      product_id: "conditioner-product-id",
      product_submission_id: null,
      match_status: "matched",
    },
    {
      category: "mask",
      product_name: "Pending Mask",
      frequency_range: "weekly_1x",
      product_id: null,
      product_submission_id: "mask-submission-id",
      match_status: "pending_review",
    },
  ])

  assert.equal(
    runtime.effectiveContext.normalized.routineInventory.conditioner?.productId,
    "conditioner-product-id",
  )
  assert.equal(
    runtime.effectiveContext.normalized.routineInventory.conditioner?.productSubmissionId,
    null,
  )
  assert.equal(
    runtime.effectiveContext.normalized.routineInventory.conditioner?.matchStatus,
    "matched",
  )
  assert.equal(runtime.effectiveContext.normalized.routineInventory.mask?.productId, null)
  assert.equal(
    runtime.effectiveContext.normalized.routineInventory.mask?.productSubmissionId,
    "mask-submission-id",
  )
  assert.equal(
    runtime.effectiveContext.normalized.routineInventory.mask?.matchStatus,
    "pending_review",
  )
})

test("runtime side-by-side detects high-priority missing bondbuilder in legacy and CareBalance", () => {
  const runtime = buildRecommendationEngineRuntimeFromPersistence(SEVERE_DAMAGE_PROFILE, [])

  assert.ok(hasPlanStep(runtime.plan, "bondbuilder", "add"))
  assert.equal(careBalanceAction(runtime, "bondbuilder"), "add")
  assert.ok(hasPlanStep(runtime.legacyPlanComparison!.projectedPlan, "bondbuilder", "add"))
})

test("runtime side-by-side preserves deferred legacy bondbuilder placement", () => {
  const runtime = buildRecommendationEngineRuntimeFromPersistence(
    {
      ...SEVERE_DAMAGE_PROFILE,
      concerns: [],
      cuticle_condition: "slightly_rough",
      chemical_treatment: ["colored"],
      protein_moisture_balance: "stretches_bounces",
      heat_styling: "once_weekly",
      uses_heat_protection: true,
    },
    [],
  )

  assert.equal(
    runtime.plan.steps.some((step) => step.category === "bondbuilder"),
    false,
  )
  assert.ok(
    runtime.plan.deferredSteps.some(
      (step) => step.category === "bondbuilder" && step.action === "add",
    ),
  )
  assert.deepEqual(comparisonAction(runtime, "bondbuilder"), {
    category: "bondbuilder",
    legacyAction: "add",
    legacyPlacement: "deferred",
    careBalanceAction: "no_action",
    legacyReasonCodes: ["bond_builder_consider", "missing_bondbuilder_inventory"],
    careBalanceReasonCodes: [],
  })
})

test("runtime side-by-side detects dry shampoo overuse in legacy and CareBalance", () => {
  const requestContext = buildRecommendationRequestContext({
    requestedCategory: null,
    message: "Meine Haare fühlen sich nach viel Trockenshampoo belegt an.",
  })
  const runtime = buildRecommendationEngineRuntimeFromPersistence(
    LOW_DAMAGE_PROFILE,
    [{ category: "dry_shampoo", product_name: "Bridge Spray", frequency_range: "daily_1x" }],
    requestContext,
  )

  assert.ok(hasPlanStep(runtime.plan, "dry_shampoo", "decrease_frequency"))
  assert.equal(careBalanceAction(runtime, "dry_shampoo"), "decrease_frequency")
  assert.ok(
    hasPlanStep(runtime.legacyPlanComparison!.projectedPlan, "dry_shampoo", "decrease_frequency"),
  )
})

test("runtime side-by-side detects peeling overuse when scalp is irritated", () => {
  const runtime = buildRecommendationEngineRuntimeFromPersistence(
    {
      ...LOW_DAMAGE_PROFILE,
      scalp_condition: "irritated",
    },
    [{ category: "peeling", product_name: "Scalp Scrub", frequency_range: "weekly_1x" }],
  )

  assert.ok(hasPlanStep(runtime.plan, "peeling", "decrease_frequency"))
  assert.equal(careBalanceAction(runtime, "peeling"), "decrease_frequency")
  assert.ok(
    hasPlanStep(runtime.legacyPlanComparison!.projectedPlan, "peeling", "decrease_frequency"),
  )
})

test("CareBalance projection surfaces weekly deep-cleansing vulnerability even when legacy plan lacks it", () => {
  const runtime = buildRecommendationEngineRuntimeFromPersistence(
    {
      ...LOW_DAMAGE_PROFILE,
      concerns: ["dryness"],
      scalp_type: "dry",
    },
    [
      {
        category: "deep_cleansing_shampoo",
        product_name: "Reset Wash",
        frequency_range: "weekly_1x",
      },
    ],
  )

  assert.equal(hasPlanStep(runtime.plan, "deep_cleansing_shampoo", "decrease_frequency"), false)
  assert.equal(careBalanceAction(runtime, "deep_cleansing_shampoo"), "decrease_frequency")
  assert.ok(
    hasPlanStep(
      runtime.legacyPlanComparison!.projectedPlan,
      "deep_cleansing_shampoo",
      "decrease_frequency",
    ),
  )
  assert.deepEqual(comparisonAction(runtime, "deep_cleansing_shampoo"), {
    category: "deep_cleansing_shampoo",
    legacyAction: null,
    legacyPlacement: null,
    careBalanceAction: "decrease_frequency",
    legacyReasonCodes: [],
    careBalanceReasonCodes: [
      "deep_cleansing_vulnerability",
      "dry_scalp",
      "dry_lengths_or_concerns",
    ],
  })
})

test("blow-dryer-only heat protectant stays non-authoritative when CareBalance says no action", () => {
  const runtime = buildRecommendationEngineRuntimeFromPersistence(
    {
      ...LOW_DAMAGE_PROFILE,
      heat_styling: "once_weekly",
      styling_tools: ["blow_dryer"],
      drying_method: "blow_dry",
      uses_heat_protection: false,
    },
    [],
  )

  assert.ok(hasPlanStep(runtime.plan, "heat_protectant", "add"))
  assert.equal(careBalanceAction(runtime, "heat_protectant"), "no_action")
  assert.equal(
    hasPlanStep(runtime.legacyPlanComparison!.projectedPlan, "heat_protectant", "add"),
    false,
  )
  assert.deepEqual(comparisonAction(runtime, "heat_protectant"), {
    category: "heat_protectant",
    legacyAction: "add",
    legacyPlacement: "active",
    careBalanceAction: "no_action",
    legacyReasonCodes: ["heat_events_present", "missing_heat_protectant_inventory"],
    careBalanceReasonCodes: [],
  })
})
