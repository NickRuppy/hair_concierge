import assert from "node:assert/strict"
import test from "node:test"

import {
  cloneStage2RefinementSession,
  createStage2RefinementSession,
} from "../src/lib/personal-plan/refinement/session"

const triggerContext = {
  relevantCategories: ["shampoo" as const],
  hasReportedIrritatedScalp: false,
  dryShampooBridgeEligibility: "ineligible" as const,
}

const completeAnswers = {
  currentProductCategories: [],
  wetWashFrequency: "weekly_1x" as const,
  towel: { material: "no_towel" as const },
  dryingRoutes: [],
  additionalHeatTools: [],
  nightProtection: [],
}

const completeQuestionIds = [
  "current_product_categories",
  "wet_wash_frequency",
  "towel_handling",
  "drying_routes",
  "additional_heat_tools",
  "night_protection",
] as const

test("creates a canonical session from Slice A and detaches snapshots", () => {
  const session = createStage2RefinementSession({ pathVersion: "stage2-v1", triggerContext })
  assert.equal(session.schemaVersion, 1)
  assert.equal(session.path.firstUnresolvedQuestionId, "current_product_categories")
  assert.deepEqual(session.path.orderedQuestionIds.slice(0, 2), [
    "current_product_categories",
    "wet_wash_frequency",
  ])

  const snapshot = cloneStage2RefinementSession(session)
  snapshot.triggerContext.relevantCategories.push("oil")
  snapshot.path.orderedQuestionIds.pop()
  assert.deepEqual(session.triggerContext.relevantCategories, ["shampoo"])
  assert.equal(session.path.orderedQuestionIds.includes("night_protection"), true)
})

test("canonicalizes stale conditional data in a resumed session", () => {
  const session = createStage2RefinementSession({
    pathVersion: "stage2-v1",
    triggerContext,
    revision: 4,
    answers: {
      currentProductCategories: [],
      oilPurposes: ["dry_finish"],
    },
    completedQuestionIds: ["current_product_categories", "oil_purposes"],
  })

  assert.equal(session.revision, 4)
  assert.deepEqual(session.answers.currentProductCategories, [])
  assert.equal(session.answers.oilPurposes, undefined)
  assert.deepEqual(session.completedQuestionIds, ["current_product_categories"])
  assert.equal(session.path.firstUnresolvedQuestionId, "wet_wash_frequency")
})

test("rejects status and handoff combinations that cannot be true", () => {
  assert.throws(
    () =>
      createStage2RefinementSession({
        pathVersion: "stage2-v1",
        triggerContext,
        status: "complete",
        answers: completeAnswers,
        completedQuestionIds: [...completeQuestionIds],
      }),
    /handoff/i,
  )
  assert.throws(
    () =>
      createStage2RefinementSession({
        pathVersion: "stage2-v1",
        triggerContext,
        completedHandoff: {
          refinedVersionId: "fixture-refined-stage2-v1-r7",
          nextHref: "/plan-start/produkte",
        },
      } as Parameters<typeof createStage2RefinementSession>[0]),
    /handoff/i,
  )
})
