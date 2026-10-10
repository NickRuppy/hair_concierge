import assert from "node:assert/strict"
import test from "node:test"

import {
  cloneStage2RefinementSession,
  createStage2RefinementSession,
  saveStage2SessionAnswer,
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
          nextHref: "/plan-start",
        },
      } as Parameters<typeof createStage2RefinementSession>[0]),
    /handoff/i,
  )
})

test("a fixture or new session still refuses a complete status on an incomplete path", () => {
  assert.throws(
    () =>
      createStage2RefinementSession({
        pathVersion: "stage2-v1",
        triggerContext,
        status: "complete",
        answers: completeAnswers,
        completedQuestionIds: completeQuestionIds.filter((id) => id !== "night_protection"),
        completedHandoff: { refinedVersionId: "refined-1", nextHref: "/plan-start" },
      }),
    /complete canonical path/i,
  )
})

test("a persisted complete draft whose path grew loads: status stays complete, the new question is open", () => {
  const { nightProtection: _grown, ...answersWithoutNewQuestion } = completeAnswers
  void _grown
  const session = createStage2RefinementSession({
    pathVersion: "stage2-v1",
    triggerContext,
    status: "complete",
    answers: answersWithoutNewQuestion,
    completedQuestionIds: completeQuestionIds.filter((id) => id !== "night_protection"),
    completedHandoff: { refinedVersionId: "refined-1", nextHref: "/plan-start" },
    tolerateGrownPath: true,
  })
  assert.equal(session.status, "complete")
  assert.equal(session.path.firstUnresolvedQuestionId, "night_protection")
  assert.equal(session.completedHandoff?.refinedVersionId, "refined-1")
})

test("grown-path tolerance does not excuse a missing handoff on a complete session", () => {
  assert.throws(
    () =>
      createStage2RefinementSession({
        pathVersion: "stage2-v1",
        triggerContext,
        status: "complete",
        answers: completeAnswers,
        completedQuestionIds: completeQuestionIds.filter((id) => id !== "night_protection"),
        tolerateGrownPath: true,
      }),
    /handoff/i,
  )
})

/* ── Hair Tools (rollout on): the overview and the per-page writes ─────────── */

const toolsOn = { ...triggerContext, toolsEnabled: true as const }

function sessionAtOverview() {
  return createStage2RefinementSession({
    pathVersion: "stage2-v1",
    triggerContext: toolsOn,
    answers: { currentProductCategories: [], wetWashFrequency: "weekly_1x" },
    completedQuestionIds: ["current_product_categories", "wet_wash_frequency"],
  })
}

test("submitting the overview stores families and makes every page of an unticked family none", () => {
  const session = saveStage2SessionAnswer(sessionAtOverview(), {
    questionId: "tools_overview",
    // The UI answers in sections; the order it sends them in does not matter.
    answer: ["trocknen_stylen", "abtrocknen_entwirren"],
  })
  assert.deepEqual(session.answers.toolFamiliesWithSomething, [
    "drying_textiles",
    "brushes_combs",
    "airflow",
    "heated_styling",
    "heatless_styling",
    "securing_sectioning",
  ])
  assert.deepEqual(session.answers.toolForms, {
    "wash_application:1": [],
    "night_protection:1": [],
  })
  assert.equal(session.path.firstUnresolvedQuestionId, "tools:drying_textiles:1")
  // Night protection is derived as none straight away; no Gewohnheiten question asks for it.
  assert.deepEqual(session.answers.nightProtection, [])
  assert.equal(session.path.orderedQuestionIds.includes("night_protection"), false)
})

test("re-submitting the overview empties a family the user unticks", () => {
  let session = saveStage2SessionAnswer(sessionAtOverview(), {
    questionId: "tools_overview",
    answer: ["nachtschutz"],
  })
  session = saveStage2SessionAnswer(session, {
    questionId: "tools:night_protection:1",
    answer: ["bonnet"],
  })
  assert.deepEqual(session.answers.nightProtection, ["silk_satin_bonnet"])
  session = saveStage2SessionAnswer(session, { questionId: "tools_overview", answer: [] })
  assert.deepEqual(session.answers.toolFamiliesWithSomething, [])
  assert.deepEqual(session.answers.toolForms?.["night_protection:1"], [])
  assert.deepEqual(session.answers.nightProtection, [])
})

test("a page writes only its own answer, sorted into canonical family order", () => {
  let session = saveStage2SessionAnswer(sessionAtOverview(), {
    questionId: "tools_overview",
    answer: ["abtrocknen_entwirren"],
  })
  session = saveStage2SessionAnswer(session, {
    questionId: "tools:drying_textiles:1",
    answer: [],
  })
  session = saveStage2SessionAnswer(session, {
    questionId: "tools:brushes_combs:1",
    answer: ["fingers", "wide_tooth_comb"],
  })
  assert.deepEqual(session.answers.toolForms?.["brushes_combs:1"], ["wide_tooth_comb", "fingers"])
  assert.equal(session.answers.toolForms?.["brushes_combs:2"], undefined)
  assert.equal(session.path.firstUnresolvedQuestionId, "tools:brushes_combs:2")
  // A form of the other page is not this page's answer.
  assert.throws(
    () =>
      saveStage2SessionAnswer(session, {
        questionId: "tools:brushes_combs:2",
        answer: ["wide_tooth_comb"],
      }),
    /invalid/i,
  )
  // Nor is a form of another family silently read as „Nichts davon".
  assert.throws(
    () =>
      saveStage2SessionAnswer(session, {
        questionId: "tools:brushes_combs:2",
        answer: ["hair_dryer"],
      }),
    /invalid/i,
  )
})

function sessionAtDryingRoutes() {
  let session = saveStage2SessionAnswer(sessionAtOverview(), {
    questionId: "tools_overview",
    answer: ["trocknen_stylen"],
  })
  for (const [questionId, answer] of [
    ["tools:airflow:1", ["hair_dryer"]],
    ["tools:heated_styling:1", []],
    ["tools:heatless_styling:1", []],
    ["tools:securing_sectioning:1", []],
    ["tools:securing_sectioning:2", []],
  ] as const) {
    session = saveStage2SessionAnswer(session, { questionId, answer: [...answer] })
  }
  assert.equal(session.path.firstUnresolvedQuestionId, "drying_routes")
  return session
}

test("rollout on: a new empty drying answer is rejected, an offered route is saved (D2)", () => {
  const session = sessionAtDryingRoutes()
  assert.throws(
    () => saveStage2SessionAnswer(session, { questionId: "drying_routes", answer: [] }),
    /invalid/i,
  )
  const saved = saveStage2SessionAnswer(session, {
    questionId: "drying_routes",
    answer: ["air_dry", "ordinary_blow_dry"],
  })
  assert.deepEqual(saved.answers.dryingRoutes, ["air_dry", "ordinary_blow_dry"])
  assert.equal(saved.path.completedQuestionIds.includes("drying_routes"), true)
})

test("rollout on: a stored empty drying answer stays complete — nobody is re-asked (D2)", () => {
  const session = sessionAtDryingRoutes()
  const withStoredEmpty = createStage2RefinementSession({
    pathVersion: "stage2-v1",
    triggerContext: toolsOn,
    answers: { ...session.answers, dryingRoutes: [] },
    completedQuestionIds: [...session.path.completedQuestionIds, "drying_routes"],
  })
  assert.equal(withStoredEmpty.path.completedQuestionIds.includes("drying_routes"), true)
  assert.notEqual(withStoredEmpty.path.firstUnresolvedQuestionId, "drying_routes")
})

test("rollout off: the drying question still accepts the explicit empty answer", () => {
  const session = createStage2RefinementSession({
    pathVersion: "stage2-v1",
    triggerContext,
    answers: {
      currentProductCategories: [],
      wetWashFrequency: "weekly_1x",
      towel: { material: "no_towel" },
    },
    completedQuestionIds: ["current_product_categories", "wet_wash_frequency", "towel_handling"],
  })
  const saved = saveStage2SessionAnswer(session, { questionId: "drying_routes", answer: [] })
  assert.deepEqual(saved.answers.dryingRoutes, [])
})
