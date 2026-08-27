import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { resolveRoutinePage, RoutineUnavailableState } from "../src/app/routine/page"
import { RetryRefreshButtonView } from "../src/components/ui/retry-refresh-button"
import type { PersonalPlanRoutineView } from "../src/lib/personal-plan/routine/contracts"

const activeView: PersonalPlanRoutineView = {
  status: "active",
  personalPlanId: "plan-1",
  planRevision: 3,
  sourceRevision: 4,
  activeVersion: {
    id: "routine-1",
    payload: {
      schemaVersion: 1,
      planId: "11111111-1111-4111-8111-111111111111",
      versionId: "routine-1",
      parentVersionId: null,
      source: {
        refinedVersionId: "22222222-2222-4222-8222-222222222222",
        productPortfolioVersionId: "portfolio-1",
        sourceFingerprint: "a".repeat(64),
        compilerVersion: "test",
        authorityVersions: {},
      },
      intent: { schemaVersion: 1, categories: [] },
      sections: [
        { key: "basis", itemKeys: [] },
        { key: "optional", itemKeys: [] },
      ],
      items: [],
      createdAt: "2026-08-08T00:00:00.000Z",
    },
  },
  pendingProposal: null,
}
const stage4Access = {
  kind: "personal_plan" as const,
  personalPlanId: "plan-1",
  frontier: "stage4" as const,
  nextHref: "/routine" as const,
  allowed: { stage1: true, stage2: true, stage3: true, stage4: true, stage5: false },
}

test("Routine resolver preserves legacy only for people without a Personal Plan", async () => {
  const noPlan = await resolveRoutinePage({
    getUserId: async () => "user-1",
    loadJourneyAccess: async () => ({ kind: "legacy" }),
    stage4Enabled: () => true,
    readView: async () => ({ status: "no_personal_plan" }),
  })
  assert.deepEqual(noPlan, { kind: "legacy" })

  const personalPlan = await resolveRoutinePage({
    getUserId: async () => "user-1",
    loadJourneyAccess: async () => stage4Access,
    stage4Enabled: () => false,
    readView: async ({ enabled }) => {
      assert.equal(enabled, false)
      return activeView
    },
  })
  assert.equal(personalPlan.kind, "personal_plan")
  if (personalPlan.kind === "personal_plan") {
    assert.equal(personalPlan.enabled, false)
    assert.equal(personalPlan.view.activeVersion?.id, "routine-1")
    // Field test 26.08.2026: the Routine page no longer resolves Stage-5
    // reachability at all — the "Anwendung ansehen" hero button is gone and the
    // Bottom-Nav owns that destination behind its own `allowed.stage5` gate.
    assert.equal("stage5Reachable" in personalPlan, false)
  }

  const stage5Plan = await resolveRoutinePage({
    getUserId: async () => "user-1",
    loadJourneyAccess: async () => ({
      ...stage4Access,
      frontier: "stage5" as const,
      nextHref: "/anwendung" as const,
      allowed: { ...stage4Access.allowed, stage5: true },
    }),
    stage4Enabled: () => true,
    readView: async () => activeView,
  })
  assert.equal(stage5Plan.kind, "personal_plan")
})

test("Routine resolver shows scoped recovery instead of legacy on a Personal Plan read failure", async () => {
  const result = await resolveRoutinePage({
    getUserId: async () => "user-1",
    loadJourneyAccess: async () => stage4Access,
    stage4Enabled: () => true,
    readView: async () => {
      throw new Error("database unavailable")
    },
  })
  assert.deepEqual(result, { kind: "unavailable" })
})

test("Routine resolver loads v3 presentation from an initial proposal candidate", async () => {
  let loadedPortfolioVersionId: string | null = null
  const proposal: PersonalPlanRoutineView = {
    ...activeView,
    status: "proposal",
    activeVersion: null,
    pendingProposal: {
      id: "proposal-1",
      candidateVersionId: "routine-candidate",
      sourceRevision: 4,
      delta: { schemaVersion: 1, direct: [], consequential: [], unchangedItemCount: 0 },
      candidate: { ...activeView.activeVersion!.payload, versionId: "routine-candidate" },
    },
  }
  const result = await resolveRoutinePage({
    getUserId: async () => "user-1",
    loadJourneyAccess: async () => stage4Access,
    stage4Enabled: () => true,
    readView: async () => proposal,
    readPortfolioPresentation: async (_userId, _planId, portfolioVersionId) => {
      loadedPortfolioVersionId = portfolioVersionId
      return null
    },
  })
  assert.equal(result.kind, "personal_plan")
  assert.equal(loadedPortfolioVersionId, "portfolio-1")
})

test("Routine resolver threads the refinement banner view model through from readRefinementBanner", async () => {
  const result = await resolveRoutinePage({
    getUserId: async () => "user-1",
    loadJourneyAccess: async () => stage4Access,
    stage4Enabled: () => true,
    readView: async () => activeView,
    readRefinementBanner: async (userId) => {
      assert.equal(userId, "user-1")
      return { module: "products", completedSteps: 2, totalSteps: 4 }
    },
  })
  assert.equal(result.kind, "personal_plan")
  if (result.kind === "personal_plan") {
    assert.deepEqual(result.refinementBanner, {
      module: "products",
      completedSteps: 2,
      totalSteps: 4,
    })
  }
})

test("Routine resolver degrades to no banner when readRefinementBanner is absent or fails", async () => {
  const withoutDep = await resolveRoutinePage({
    getUserId: async () => "user-1",
    loadJourneyAccess: async () => stage4Access,
    stage4Enabled: () => true,
    readView: async () => activeView,
  })
  assert.equal(withoutDep.kind, "personal_plan")
  if (withoutDep.kind === "personal_plan") assert.equal(withoutDep.refinementBanner, null)

  const withFailingDep = await resolveRoutinePage({
    getUserId: async () => "user-1",
    loadJourneyAccess: async () => stage4Access,
    stage4Enabled: () => true,
    readView: async () => activeView,
    readRefinementBanner: async () => {
      throw new Error("temporarily_unavailable")
    },
  })
  assert.equal(withFailingDep.kind, "personal_plan")
  if (withFailingDep.kind === "personal_plan") {
    assert.equal(withFailingDep.refinementBanner, null)
  }
})

test("Routine unavailable recovery offers an explicit reload action", () => {
  const html = renderToStaticMarkup(
    RoutineUnavailableState({
      retryAction: createElement(RetryRefreshButtonView, {
        label: "Erneut laden",
        onRetry: () => undefined,
      }),
    }),
  )
  assert.match(html, /<button[^>]*type="button"/)
  assert.match(html, />Erneut laden<\/button>/)

  let retries = 0
  const retry = RetryRefreshButtonView({ label: "Erneut laden", onRetry: () => retries++ })
  retry.props.onClick()
  assert.equal(retries, 1)

  const retrySource = readFileSync("src/components/ui/retry-refresh-button.tsx", "utf8")
  assert.match(retrySource, /onRetry=\{\(\) => router\.refresh\(\)\}/)
})

test("Routine resolver does not construct a Personal Plan Routine view before Stage 4 is reachable", async () => {
  let read = false
  const result = await resolveRoutinePage({
    getUserId: async () => "user-1",
    stage4Enabled: () => true,
    loadJourneyAccess: async () => ({
      kind: "personal_plan",
      personalPlanId: "plan-1",
      frontier: "stage3",
      nextHref: "/plan-start",
      allowed: { stage1: true, stage2: true, stage3: true, stage4: false, stage5: false },
    }),
    readView: async () => {
      read = true
      return activeView
    },
  } as never)

  assert.deepEqual(result, { kind: "unavailable" })
  assert.equal(read, false)
})
