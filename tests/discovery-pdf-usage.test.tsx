import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { DiscoveryRoutineDocument } from "../src/components/discovery/print/discovery-routine-document"
import { buildDiscoveryCockpitView, type DiscoveryCockpitModel } from "../src/lib/discovery/cockpit"
import type { DiscoveryIdealStep } from "../src/lib/discovery/load-ideal-routine"
import {
  composeDiscoveryRefinedRoutine,
  type DiscoveryCallDecision,
  type DiscoveryIntakeItem,
} from "../src/lib/discovery/refined-routine"
import type { PersonalPlanCategory } from "../src/lib/personal-plan/products/contracts"

/**
 * F6 (batch 5): the participant's sheet says briefly when she uses a product differently
 * from what it is („als Haarmaske benutzt") — and a legacy (tile) document, which has no
 * product type, prints exactly as before.
 */

function step(category: PersonalPlanCategory, role: string): DiscoveryIdealStep {
  return {
    decisionKey: `decision:${category}:${role}:gap`,
    category,
    role: role as never,
    section: "basis",
    categoryLabel: category === "mask" ? "Haarmaske" : "Conditioner",
    roleLabel: role,
    roleDescription: `Schritt ${role}.`,
    frequencyLabel: "1×/Woche",
    preview: null,
  }
}

const STEPS = [
  step("conditioner", "conditioner_rinse_out"),
  step("mask", "intensive_conditioning_mask"),
]

function item(overrides: Partial<DiscoveryIntakeItem> & { id: string }): DiscoveryIntakeItem {
  return {
    category: "mask",
    source: "catalog_search",
    brandText: "Marke",
    productNameText: "Repair Spülung",
    barcodeIdentifier: null,
    productId: `p-${overrides.id}`,
    productSubmissionId: null,
    createdAt: "2026-09-20T10:00:00.000Z",
    ...overrides,
  }
}

function render(items: DiscoveryIntakeItem[], decisions: DiscoveryCallDecision[]) {
  const model: DiscoveryCockpitModel = {
    status: "ready",
    routine: composeDiscoveryRefinedRoutine({ steps: STEPS, items, decisions, swapProducts: [] }),
    steps: STEPS,
    verdicts: [],
    previewSource: { personalPlanId: "discovery:x", sourceNeedVersionId: "v1" },
    recommendationProducts: [],
    recommendationBrandsAvailable: true,
  }
  const view = buildDiscoveryCockpitView(model)
  return {
    view,
    markup: renderToStaticMarkup(
      <DiscoveryRoutineDocument name="Lena" view={view} finalizedAt="2026-09-22T12:00:00.000Z" />,
    ),
  }
}

const KEEP_MASK: DiscoveryCallDecision = {
  decisionKey: "decision:mask:intensive_conditioning_mask:gap",
  decision: "keep",
  swapProductId: null,
  intakeItemId: "used-as-mask",
}

test("F6: a kept conditioner used as a mask reads „als Haarmaske benutzt“ at its step and on the shelf", () => {
  const { markup, view } = render(
    [
      item({ id: "used-as-mask", productType: "conditioner" }),
      item({
        id: "pending",
        category: "mask",
        productType: "leave_in",
        productId: null,
        source: "name_research",
        brandText: "Balea",
        productNameText: "Sprühkur",
      }),
    ],
    [KEEP_MASK],
  )
  // Once at the step, once on the shelf, once for the pending product.
  assert.equal(markup.split("als Haarmaske benutzt").length - 1, 3)
  assert.equal(view.steps[1]!.ownedUsageLabel, "als Haarmaske benutzt")
  assert.equal(view.unassigned[0]!.usageLabel, "als Haarmaske benutzt")
})

test("F6: a legacy (tile) document prints no usage note at all", () => {
  const { markup, view } = render([item({ id: "used-as-mask" })], [KEEP_MASK])
  assert.ok(!markup.includes("benutzt"))
  assert.equal(view.steps[1]!.ownedUsageLabel, null)
  assert.ok(markup.includes("Marke Repair Spülung"))
})

test("a product with an open usage never vanishes from the paper — it is a follow-up", () => {
  const { markup } = render(
    [item({ id: "open", category: null, productId: null, source: "name_research" })],
    [],
  )
  assert.ok(markup.includes("Dazu melden wir uns noch"))
  assert.ok(markup.includes("Marke Repair Spülung"))
})
