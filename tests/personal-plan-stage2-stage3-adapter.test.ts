import assert from "node:assert/strict"
import test from "node:test"

import { CATEGORY_ROLE_POLICIES } from "../src/lib/personal-plan/products/authorities"
import { buildStage3EntryContext } from "../src/lib/personal-plan/products/stage2-entry-adapter"
import type { InitialNeedPlanSnapshot } from "../src/lib/personal-plan/types"

function refinedSnapshot(renderedOrder: InitialNeedPlanSnapshot["renderedOrder"]) {
  return {
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
