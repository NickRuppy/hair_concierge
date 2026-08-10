import assert from "node:assert/strict"
import test from "node:test"

import { CATEGORY_ROLE_POLICIES } from "../src/lib/personal-plan/products/authorities"
import { buildStage3EntryContext } from "../src/lib/personal-plan/products/stage2-entry-adapter"
import type { InitialNeedPlanSnapshot } from "../src/lib/personal-plan/types"

function refinedSnapshot(renderedOrder: InitialNeedPlanSnapshot["renderedOrder"]) {
  return {
    inputHash: "refined-input-hash-1",
    coverage: [
      {
        job: "heat_protection",
        ruleId: "portfolio.heat.carrier_allocation_deferred",
        primaryCategories: ["heat_protectant"],
        supportingCategories: ["leave_in", "oil"],
        outcome: "deferred_allocation",
      },
    ],
    profile: { source: { projection: "refined_post_plan" } },
    renderedOrder,
    decisions: renderedOrder.map((category) => ({
      category,
      roles: [CATEGORY_ROLE_POLICIES[category].allowedRoles[0]],
      ...(category === "heat_protectant"
        ? {
            target: {
              category: "heat_protectant",
              roles: ["pre_heat_protection"],
              qualifyingRoutes: ["direct_contact_heat"],
              carrierPolicy: "integrated_or_separate_verified_binary_capability",
            },
          }
        : {}),
    })),
  } as InitialNeedPlanSnapshot
}

test("builds Stage 3 entry requirements and inventory prompts in refined rendered order", () => {
  const context = buildStage3EntryContext(
    refinedSnapshot(["oil", "conditioner", "heat_protectant"]),
    { personalPlanId: "plan-opaque-1", refinedVersionId: "refined-opaque-1" },
  )

  assert.deepEqual(context.orderedCategories, [
    {
      category: "oil",
      requiredRoles: ["pre_wash_fibre_treatment"],
      needSummary: "Versorgt die Längen gezielt und unterstützt Pre-Wash, Leave-in und Finish.",
      authorityVersion: CATEGORY_ROLE_POLICIES.oil.authorityVersion,
    },
    {
      category: "conditioner",
      requiredRoles: ["conditioner_rinse_out"],
      needSummary: "Pflegt und entwirrt die Längen nach der Haarwäsche.",
      authorityVersion: CATEGORY_ROLE_POLICIES.conditioner.authorityVersion,
    },
    {
      category: "heat_protectant",
      requiredRoles: ["pre_heat_protection"],
      qualifyingRoutes: ["direct_contact_heat"],
      needSummary: "Schützt das Haar bei Styling mit Hitze.",
      authorityVersion: CATEGORY_ROLE_POLICIES.heat_protectant.authorityVersion,
    },
  ])
  assert.deepEqual(context.inventoryPrompts, [
    { category: "oil", allowsMultiple: true, allowsExplicitNone: true },
    { category: "conditioner", allowsMultiple: true, allowsExplicitNone: true },
    { category: "heat_protectant", allowsMultiple: true, allowsExplicitNone: true },
  ])
  assert.deepEqual(context.authoritySnapshot, {
    schemaVersion: 1,
    refinedNeedVersionId: "refined-opaque-1",
    refinedInputHash: "refined-input-hash-1",
    categoryDecisions: refinedSnapshot(["oil", "conditioner", "heat_protectant"]).decisions,
    coverage: refinedSnapshot(["oil", "conditioner", "heat_protectant"]).coverage,
    orderedCategories: ["oil", "conditioner", "heat_protectant"],
    inventoryOnlyCategories: [],
    authorityVersions: Object.fromEntries(
      Object.entries(CATEGORY_ROLE_POLICIES).map(([category, policy]) => [
        category,
        policy.authorityVersion,
      ]),
    ),
  })
})

test("authority snapshot preserves Oil role tier and exact Stage 1 coverage without recomputation", () => {
  const snapshot = refinedSnapshot(["oil", "leave_in"])
  snapshot.decisions[0] = {
    ...snapshot.decisions[0],
    target: {
      category: "oil",
      roles: ["dry_finish"],
      roleTargets: [
        {
          role: "dry_finish",
          tier: "optional",
          weight: "light",
          functionalBenefits: [],
        },
      ],
    },
  } as never
  snapshot.coverage = [
    {
      job: "damp_smoothing",
      ruleId: "portfolio.smoothing.leave_in_primary",
      primaryCategories: ["leave_in"],
      supportingCategories: ["oil"],
      outcome: "duplicate_purchase_suppressed",
    },
  ]

  const context = buildStage3EntryContext(snapshot, {
    personalPlanId: "plan-opaque-1",
    refinedVersionId: "refined-opaque-1",
  })

  assert.equal(context.authoritySnapshot.categoryDecisions[0]?.target?.category, "oil")
  assert.deepEqual(context.authoritySnapshot.coverage, snapshot.coverage)
})

test("preserves refined rendered order and appends current-only inventory in canonical order", () => {
  const snapshot = refinedSnapshot(["oil", "conditioner"])
  snapshot.profile = {
    source: { projection: "refined_post_plan" },
    concerns: [],
    scalp: { oiliness: "balanced", concerns: [] },
    routine: {
      shampooFrequency: { state: "known", value: "weekly_2x" },
      currentProductLoad: {
        state: "known",
        value: {
          // Intentionally out of canonical order, including a category already rendered.
          categories: ["dry_shampoo", "conditioner", "shampoo", "leave_in"],
          oilPurposes: [],
        },
      },
    },
  } as never

  const context = buildStage3EntryContext(snapshot, {
    personalPlanId: "plan-opaque-1",
    refinedVersionId: "refined-opaque-1",
  })

  assert.deepEqual(
    context.orderedCategories.map(({ category }) => category),
    ["oil", "conditioner", "shampoo", "leave_in", "dry_shampoo"],
  )
  assert.deepEqual(context.authoritySnapshot.inventoryOnlyCategories, [
    "shampoo",
    "leave_in",
    "dry_shampoo",
  ])
  assert.deepEqual(context.authoritySnapshot.productLoadContext?.ownedCategories, [
    "dry_shampoo",
    "conditioner",
    "shampoo",
    "leave_in",
  ])
  assert.equal(context.authoritySnapshot.productLoadContext?.shampooFrequency, "weekly_2x")
})

test("preserves unknown current product load instead of encoding known-empty authority facts", () => {
  const snapshot = refinedSnapshot(["shampoo"])
  snapshot.profile = {
    source: { projection: "refined_post_plan" },
    concerns: [],
    scalp: { oiliness: "balanced", concerns: [] },
    routine: {
      shampooFrequency: { state: "known", value: "weekly_2x" },
      currentProductLoad: { state: "unknown", reason: "current_product_load" },
    },
  } as never

  const context = buildStage3EntryContext(snapshot, {
    personalPlanId: "plan-opaque-1",
    refinedVersionId: "refined-opaque-1",
  })

  assert.equal(context.authoritySnapshot.productLoadContext, undefined)
  assert.deepEqual(context.authoritySnapshot.inventoryOnlyCategories, [])
})

test("preserves an explicitly known empty current product load", () => {
  const snapshot = refinedSnapshot(["shampoo"])
  snapshot.profile = {
    source: { projection: "refined_post_plan" },
    concerns: [],
    scalp: { oiliness: "balanced", concerns: [] },
    routine: {
      shampooFrequency: { state: "known", value: "weekly_2x" },
      currentProductLoad: {
        state: "known",
        value: { categories: [], oilPurposes: [] },
      },
    },
  } as never

  const context = buildStage3EntryContext(snapshot, {
    personalPlanId: "plan-opaque-1",
    refinedVersionId: "refined-opaque-1",
  })

  assert.deepEqual(context.authoritySnapshot.productLoadContext?.ownedCategories, [])
  assert.deepEqual(context.authoritySnapshot.productLoadContext?.oilPurposes, [])
  assert.equal(context.authoritySnapshot.productLoadContext?.shampooFrequency, "weekly_2x")
})

test("rejects an unrefined snapshot and blank opaque entry IDs", () => {
  const initialProjection = refinedSnapshot(["shampoo"])
  initialProjection.profile.source.projection = "initial_quiz"

  assert.throws(
    () =>
      buildStage3EntryContext(initialProjection, {
        personalPlanId: "plan-opaque-1",
        refinedVersionId: "refined-opaque-1",
      }),
    /refined_post_plan/,
  )

  assert.throws(
    () =>
      buildStage3EntryContext(refinedSnapshot(["shampoo"]), {
        personalPlanId: " ",
        refinedVersionId: "refined-opaque-1",
      }),
    /personalPlanId/,
  )
  assert.throws(
    () =>
      buildStage3EntryContext(refinedSnapshot(["shampoo"]), {
        personalPlanId: "plan-opaque-1",
        refinedVersionId: "",
      }),
    /refinedVersionId/,
  )

  assert.throws(
    () =>
      buildStage3EntryContext(refinedSnapshot([]), {
        personalPlanId: "plan-opaque-1",
        refinedVersionId: "refined-opaque-1",
      }),
    /at least one rendered category/,
  )
})
