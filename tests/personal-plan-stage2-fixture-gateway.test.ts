import assert from "node:assert/strict"
import test from "node:test"

import { Stage2RefinementError } from "../src/lib/personal-plan/refinement/gateway"
import { createStage2FixtureGateway } from "../src/lib/personal-plan/refinement/fixture-gateway"

const triggerContext = {
  relevantCategories: [],
  hasReportedIrritatedScalp: false,
  dryShampooBridgeEligibility: "ineligible" as const,
}

function fixture() {
  return createStage2FixtureGateway({ runtimeEnvironment: "test", triggerContext })
}

const completeAnswers = {
  currentProductCategories: [],
  wetWashFrequency: "weekly_1x" as const,
  towel: { material: "no_towel" as const },
  dryingRoutes: ["air_dry" as const],
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

async function assertCode(promise: Promise<unknown>, code: Stage2RefinementError["code"]) {
  await assert.rejects(promise, (error: unknown) => {
    assert.equal(error instanceof Stage2RefinementError, true)
    assert.equal((error as Stage2RefinementError).code, code)
    return true
  })
}

test("loads detached canonical snapshots and resumes at the first unresolved question", async () => {
  const gateway = fixture()
  const first = await gateway.load()
  assert.equal(first.path.firstUnresolvedQuestionId, "current_product_categories")
  first.answers.currentProductCategories = ["oil"]
  first.triggerContext.relevantCategories.push("oil")

  const second = await gateway.load()
  assert.equal(second.answers.currentProductCategories, undefined)
  assert.equal(second.answers.heatEvents, undefined)
  assert.deepEqual(second.triggerContext.relevantCategories, [])
})

test("saves full answers in order, including a completed empty multi-select", async () => {
  const gateway = fixture()
  const categories = await gateway.saveAnswer({
    questionId: "current_product_categories",
    answer: [],
    expectedRevision: 0,
  })
  assert.equal(categories.revision, 1)
  assert.deepEqual(categories.answers.currentProductCategories, [])
  assert.deepEqual(categories.completedQuestionIds, ["current_product_categories"])
  assert.equal(categories.path.firstUnresolvedQuestionId, "wet_wash_frequency")

  const wash = await gateway.saveAnswer({
    questionId: "wet_wash_frequency",
    answer: "weekly_2x",
    expectedRevision: 1,
  })
  assert.equal(wash.revision, 2)
  assert.equal(wash.answers.wetWashFrequency, "weekly_2x")
  assert.equal(wash.path.firstUnresolvedQuestionId, "towel_handling")
})

test("rejects invalid and out-of-order answers without mutating state", async () => {
  const gateway = fixture()
  await assertCode(
    gateway.saveAnswer({
      questionId: "wet_wash_frequency",
      answer: "weekly_2x",
      expectedRevision: 0,
    }),
    "question_not_current",
  )
  await assertCode(
    gateway.saveAnswer({
      questionId: "current_product_categories",
      answer: ["unsupported"],
      expectedRevision: 0,
    }),
    "invalid_answer",
  )
  const current = await gateway.load()
  assert.equal(current.revision, 0)
  assert.equal(current.answers.currentProductCategories, undefined)
})

test("editing a completed parent prunes stale conditional answers and completions", async () => {
  const gateway = createStage2FixtureGateway({
    runtimeEnvironment: "test",
    triggerContext: { ...triggerContext, dryShampooBridgeEligibility: "eligible" },
  })
  let session = await gateway.saveAnswer({
    questionId: "current_product_categories",
    answer: ["oil"],
    expectedRevision: 0,
  })
  session = await gateway.saveAnswer({
    questionId: "wet_wash_frequency",
    answer: "weekly_1x",
    expectedRevision: session.revision,
  })
  session = await gateway.saveAnswer({
    questionId: "dry_shampoo_bridge_preference",
    answer: "decline",
    expectedRevision: session.revision,
  })
  session = await gateway.saveAnswer({
    questionId: "oil_purposes",
    answer: ["dry_finish"],
    expectedRevision: session.revision,
  })
  session = await gateway.saveAnswer({
    questionId: "current_product_categories",
    answer: [],
    expectedRevision: session.revision,
  })

  assert.equal(session.revision, 5)
  assert.equal(session.answers.oilPurposes, undefined)
  assert.equal(session.completedQuestionIds.includes("oil_purposes"), false)
  assert.equal(session.completedQuestionIds.includes("dry_shampoo_bridge_preference"), true)
  assert.equal(session.path.firstUnresolvedQuestionId, "towel_handling")
})

test("one-shot save failure retries safely and a stale client reloads external progress", async () => {
  const gateway = fixture()
  gateway.failNextSave()
  const input = {
    questionId: "current_product_categories" as const,
    answer: [],
    expectedRevision: 0,
  }
  await assertCode(gateway.saveAnswer(input), "save_failed")
  assert.equal((await gateway.load()).revision, 0)

  const saved = await gateway.saveAnswer(input)
  assert.equal(saved.revision, 1)
  gateway.simulateExternalRevision()
  await assertCode(
    gateway.saveAnswer({
      questionId: "wet_wash_frequency",
      answer: "weekly_2x",
      expectedRevision: saved.revision,
    }),
    "revision_conflict",
  )
  const reloaded = await gateway.load()
  assert.equal(reloaded.revision, 2)
  assert.deepEqual(reloaded.answers.currentProductCategories, [])
})

test("completion rejects an unresolved path and repeats one deterministic opaque handoff", async () => {
  const incomplete = fixture()
  await assertCode(incomplete.complete({ expectedRevision: 0 }), "incomplete_refinement")

  const gateway = fixture()
  let session = await gateway.saveAnswer({
    questionId: "current_product_categories",
    answer: [],
    expectedRevision: 0,
  })
  session = await gateway.saveAnswer({
    questionId: "wet_wash_frequency",
    answer: "weekly_1x",
    expectedRevision: session.revision,
  })
  session = await gateway.saveAnswer({
    questionId: "towel_handling",
    answer: { material: "no_towel" },
    expectedRevision: session.revision,
  })
  for (const [questionId, answer] of [
    ["drying_routes", ["air_dry"]],
    ["additional_heat_tools", []],
    ["night_protection", []],
  ] as const) {
    session = await gateway.saveAnswer({ questionId, answer, expectedRevision: session.revision })
  }
  assert.equal(session.path.firstUnresolvedQuestionId, null)

  await assertCode(
    gateway.complete({ expectedRevision: session.revision - 1 }),
    "revision_conflict",
  )
  const first = await gateway.complete({ expectedRevision: session.revision })
  const second = await gateway.complete({ expectedRevision: session.revision })
  assert.deepEqual(second, first)
  assert.equal(first.nextHref, "/plan-start")
  assert.match(first.refinedVersionId, /^fixture-refined-/)
  assert.equal((await gateway.load()).status, "complete")
})

test("a completed fixture loads with a detached canonical handoff", async () => {
  const gateway = createStage2FixtureGateway({
    runtimeEnvironment: "test",
    triggerContext,
    initialAnswers: completeAnswers,
    initialCompletedQuestionIds: [...completeQuestionIds],
    initialRevision: 7,
    initialStatus: "complete",
  })

  const first = await gateway.load()
  assert.equal(first.status, "complete")
  assert.deepEqual(first.completedHandoff, {
    refinedVersionId: "fixture-refined-stage2-fixture-v1-r7",
    nextHref: "/plan-start",
  })
  first.completedHandoff!.refinedVersionId = "mutated-by-caller"
  assert.equal(
    (await gateway.load()).completedHandoff?.refinedVersionId,
    "fixture-refined-stage2-fixture-v1-r7",
  )
})

test("one-shot completion failure preserves progress and retries truthfully", async () => {
  const gateway = fixture()
  let session = await gateway.saveAnswer({
    questionId: "current_product_categories",
    answer: [],
    expectedRevision: 0,
  })
  session = await gateway.saveAnswer({
    questionId: "wet_wash_frequency",
    answer: "weekly_1x",
    expectedRevision: session.revision,
  })
  session = await gateway.saveAnswer({
    questionId: "towel_handling",
    answer: { material: "no_towel" },
    expectedRevision: session.revision,
  })
  for (const [questionId, answer] of [
    ["drying_routes", ["air_dry"]],
    ["additional_heat_tools", []],
    ["night_protection", []],
  ] as const) {
    session = await gateway.saveAnswer({ questionId, answer, expectedRevision: session.revision })
  }
  const beforeFailure = await gateway.load()

  gateway.failNextComplete()
  await assertCode(gateway.complete({ expectedRevision: session.revision }), "completion_failed")
  const afterFailure = await gateway.load()
  assert.equal(afterFailure.revision, beforeFailure.revision)
  assert.deepEqual(afterFailure.path, beforeFailure.path)
  assert.equal(afterFailure.status, "in_progress")
  assert.equal(afterFailure.completedHandoff, undefined)

  const handoff = await gateway.complete({ expectedRevision: session.revision })
  const completed = await gateway.load()
  assert.equal(completed.status, "complete")
  assert.deepEqual(completed.completedHandoff, handoff)
})

test("production construction fails closed", () => {
  assert.throws(
    () => createStage2FixtureGateway({ runtimeEnvironment: "production", triggerContext }),
    /production/i,
  )
})
