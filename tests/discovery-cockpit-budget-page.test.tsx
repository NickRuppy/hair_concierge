import assert from "node:assert/strict"
import test from "node:test"
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { createDiscoveryCockpitPage } from "../src/app/admin/beratung/[enrollmentId]/page"
import type { DiscoveryCallIntake, DiscoveryCockpitModel } from "../src/lib/discovery/cockpit"
import type { DiscoveryEnrollment } from "../src/lib/discovery/enrollment"
import { composeDiscoveryRefinedRoutine } from "../src/lib/discovery/refined-routine"
import type { ShoppingBudget } from "../src/lib/user-facts/schema"

/**
 * Profi-tier Task 8: the cockpit page shows the „Kundenbudget" panel in Phase 3 only with the
 * shopping-budget flag on, seeded from the model's budget and frozen once the call is finalised.
 */

const ids = {
  enrollment: "3f1a6f2e-2b44-4a1e-9a1a-6f2e2b444a1e",
  intake: "40000000-0000-4000-8000-000000000001",
  user: "20000000-0000-4000-8000-000000000002",
}

const enrollment: DiscoveryEnrollment = {
  enrollmentId: ids.enrollment,
  name: "Lena M.",
  email: "lena@example.test",
  tokenVersion: 1,
  claimedUserId: ids.user,
  claimedAt: "2026-09-19T10:00:00.000Z",
  createdAt: "2026-09-18T10:00:00.000Z",
}

const intake: DiscoveryCallIntake = {
  id: ids.intake,
  enrollmentId: ids.enrollment,
  userId: ids.user,
  state: "submitted",
  submittedAt: "2026-09-20T18:41:00.000Z",
  callFinalizedAt: null,
  finalizedSourceHash: null,
}

function model(shoppingBudget: ShoppingBudget | null): DiscoveryCockpitModel {
  return {
    status: "ready",
    steps: [],
    verdicts: [],
    previewSource: { personalPlanId: `discovery:${ids.intake}`, sourceNeedVersionId: "v1" },
    routine: composeDiscoveryRefinedRoutine({
      steps: [],
      items: [],
      decisions: [],
      swapProducts: [],
    }),
    recommendationProducts: [],
    recommendationBrandsAvailable: true,
    shoppingBudget,
  }
}

async function render(options: {
  enabled: boolean
  budget: ShoppingBudget | null
  finalized?: boolean
}): Promise<string> {
  const Page = createDiscoveryCockpitPage({
    flagEnabled: () => true,
    requireAdmin: async () => ({ userId: "admin-1" }),
    createAdminClient: () => ({}) as never,
    loadEnrollment: async () => enrollment,
    loadIntake: async () => ({
      ...intake,
      callFinalizedAt: options.finalized ? "2026-09-22T12:00:00.000Z" : null,
    }),
    loadModel: async () => model(options.budget),
    loadQuizLead: async () => null,
    loadPreflight: async () => ({ status: "ready" }),
    loadCallSheet: async () => null,
    shoppingBudgetEnabled: () => options.enabled,
  } as never)
  const element = await Page({ params: Promise.resolve({ enrollmentId: ids.enrollment }) })
  const router = { refresh() {}, push() {}, replace() {}, prefetch() {}, back() {}, forward() {} }
  return renderToStaticMarkup(
    <AppRouterContext.Provider value={router as never}>{element}</AppRouterContext.Provider>,
  )
}

test("flag on: Phase 3 shows the customer's budget with „Ändern“", async () => {
  const markup = await render({
    enabled: true,
    budget: { kind: "capped", limitEur: 5, allowExceptions: true },
  })
  assert.ok(markup.includes("Kundenbudget"))
  assert.ok(markup.includes("Angabe der Kundin / des Kunden"))
  assert.ok(markup.includes("Bis 5 € · einzelne dürfen mehr kosten"))
  assert.ok(markup.includes(">Ändern<"))
  // After the complexity choice, inside Phase 3.
  assert.ok(markup.indexOf("runsheet-complexity") < markup.indexOf("runsheet-budget"))
  assert.ok(markup.indexOf("runsheet-phase-3") < markup.indexOf("runsheet-budget"))
})

test("flag on, nothing saved: the panel says so", async () => {
  const markup = await render({ enabled: true, budget: null })
  assert.ok(markup.includes("Noch kein Budget angegeben"))
})

test("flag off: no budget panel at all, whatever the model carries", async () => {
  const markup = await render({ enabled: false, budget: { kind: "uncapped" } })
  assert.ok(!markup.includes("Kundenbudget"))
  assert.ok(!markup.includes("runsheet-budget"))
})

test("a finalised call freezes the panel", async () => {
  const markup = await render({ enabled: true, budget: { kind: "uncapped" }, finalized: true })
  assert.ok(markup.includes("Ohne feste Preisgrenze"))
  assert.ok(markup.includes("Erst Finalisierung aufheben."))
  assert.match(markup, /<button[^>]*disabled=""[^>]*>Ändern<\/button>/)
})
