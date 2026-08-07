import assert from "node:assert/strict"
import test from "node:test"

import { CATEGORY_AUTHORITY_STUBS } from "../src/lib/personal-plan/products/authorities"
import { buildStage3EntryContext } from "../src/lib/personal-plan/products/stage2-entry-adapter"
import type { InitialNeedPlanSnapshot } from "../src/lib/personal-plan/types"

function refinedSnapshot(renderedOrder: InitialNeedPlanSnapshot["renderedOrder"]) {
  return {
    profile: { source: { projection: "refined_post_plan" } },
    renderedOrder,
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
      requiredRoles: [...CATEGORY_AUTHORITY_STUBS.oil.requiredRoles],
      needSummary: "Versorgt die Längen gezielt und unterstützt Pre-Wash, Leave-in und Finish.",
      authorityVersion: CATEGORY_AUTHORITY_STUBS.oil.authorityVersion,
    },
    {
      category: "conditioner",
      requiredRoles: [...CATEGORY_AUTHORITY_STUBS.conditioner.requiredRoles],
      needSummary: "Pflegt und entwirrt die Längen nach der Haarwäsche.",
      authorityVersion: CATEGORY_AUTHORITY_STUBS.conditioner.authorityVersion,
    },
    {
      category: "heat_protectant",
      requiredRoles: [...CATEGORY_AUTHORITY_STUBS.heat_protectant.requiredRoles],
      needSummary: "Schützt das Haar bei Styling mit Hitze.",
      authorityVersion: CATEGORY_AUTHORITY_STUBS.heat_protectant.authorityVersion,
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
