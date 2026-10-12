import assert from "node:assert/strict"
import test from "node:test"

import {
  createStage2RefinementService,
  stage2SessionFromPersistedDraft,
  type Stage2PersistedDraft,
} from "@/lib/personal-plan/persistence/stage2-refinement-service"
import { Stage2RefinementError } from "@/lib/personal-plan/refinement/gateway"
import {
  resolveStage2FlowEntryView,
  scopeStage2SessionToModule,
} from "@/lib/personal-plan/refinement/module-scope"
import { resolveStage2RefinementContract } from "@/lib/personal-plan/refinement/question-path"
import { saveStage2SessionAnswer } from "@/lib/personal-plan/refinement/session"
import type {
  NightProtection,
  PersonalPlanRefinementAnswersV1,
  Stage2AnswerProvenance,
  Stage2QuestionId,
  Stage2TriggerContext,
} from "@/lib/personal-plan/refinement/types"

/**
 * Rev. 6 review fix F2 (2026-10-12): a Gewohnheiten entry saves the question it displays even
 * while Deine Tools (an earlier module) is still open, and a rejected save never reopens a
 * completed draft.
 */

function context(overrides: Partial<Stage2TriggerContext> = {}): Stage2TriggerContext {
  return {
    relevantCategories: ["shampoo", "conditioner"],
    hasReportedIrritatedScalp: false,
    dryShampooBridgeEligibility: "ineligible",
    ...overrides,
  }
}

const ON_MEDIUM = context({ toolsEnabled: true, hairLength: "medium" })

/** Everything a pre-port (rollout-off) member answered, Gewohnheiten incl. the old night question. */
function prePortAnswers(nightProtection: NightProtection[]): PersonalPlanRefinementAnswersV1 {
  return {
    currentProductCategories: [],
    wetWashFrequency: "weekly_2x",
    towel: { material: "mikrofaser", technique: "gentle_press" },
    dryingRoutes: ["air_dry"],
    additionalHeatTools: [],
    nightProtection,
  }
}

const PRE_PORT_COMPLETED: Stage2QuestionId[] = [
  "current_product_categories",
  "wet_wash_frequency",
  "towel_handling",
  "drying_routes",
  "additional_heat_tools",
  "night_protection",
]

function provenance(value: "user" | "assumed"): Stage2AnswerProvenance {
  return Object.fromEntries(PRE_PORT_COMPLETED.map((id) => [id, value]))
}

function draft(overrides: Partial<Stage2PersistedDraft> = {}): Stage2PersistedDraft {
  return {
    id: "draft-1",
    personalPlanId: "plan-1",
    baseInitialNeedVersionId: "initial-1",
    schemaVersion: 1,
    pathVersion: "stage2-v1",
    preparedArtifactSourceId: "artifact-1",
    baseInputSnapshot: {},
    triggerContext: ON_MEDIUM,
    answers: prePortAnswers(["silk_satin_pillow"]),
    completedQuestionIds: PRE_PORT_COMPLETED,
    answerProvenance: provenance("user"),
    moduleProjections: {},
    revision: 6,
    status: "complete",
    refinedVersionId: "refined-1",
    ...overrides,
  }
}

const notCalled = async (): Promise<never> => {
  throw new Error("unexpected persistence call")
}

function serviceFor(initial: Stage2PersistedDraft) {
  const calls = { reopened: 0, saved: [] as Array<Record<string, unknown>> }
  const service = createStage2RefinementService({
    userId: "user-1",
    snapshotBuilder: () => ({
      inputSnapshot: {},
      outputSnapshot: {},
      inputHash: "a".repeat(64),
      schemaVersion: 1,
      computationVersion: "test",
    }),
    persistence: {
      loadOrCreate: async () => structuredClone(initial),
      reopen: async ({ draft: historical }) => {
        calls.reopened += 1
        return { ...historical, id: "draft-2", status: "in_progress", refinedVersionId: null }
      },
      save: async (input) => {
        calls.saved.push(input as unknown as Record<string, unknown>)
        return { outcome: "saved", revision: input.expectedRevision + 1 }
      },
      complete: notCalled,
      completeModule: notCalled,
    },
  })
  return { service, calls }
}

/* ── F2: the habits entry can save before Tools is answered ─────────────── */

test("F2: a completed pre-port draft's habits entry saves the question it displays", async () => {
  const source = draft()
  const { service, calls } = serviceFor(source)
  const loaded = await service.load()
  const entry = resolveStage2FlowEntryView({
    session: scopeStage2SessionToModule(loaded, "habits"),
    moduleScope: "explicit",
  })
  assert.equal(entry.mode, "question")
  assert.equal(entry.activeQuestionId, "towel_handling", "an edit visit from the first question")

  const edited = await service.saveAnswer({
    questionId: "night_wear",
    answer: "pineapple",
    expectedRevision: 6,
  })
  assert.equal(calls.reopened, 1)
  assert.equal(edited.answers.nightWear, "pineapple")
  assert.equal(edited.path.firstUnresolvedQuestionId, "tools_overview")
})

test("F2: a rejected save never reopens a completed draft", async () => {
  const { service, calls } = serviceFor(draft())
  await service.load()
  await assert.rejects(
    service.saveAnswer({ questionId: "night_wear", answer: "bonnet", expectedRevision: 6 }),
    (error: unknown) => error instanceof Stage2RefinementError && error.code === "invalid_answer",
  )
  await assert.rejects(
    service.saveAnswer({ questionId: "tools:airflow:1", answer: [], expectedRevision: 6 }),
    (error: unknown) =>
      error instanceof Stage2RefinementError && error.code === "question_not_current",
  )
  assert.equal(calls.reopened, 0)
  assert.equal(calls.saved.length, 0)
})

test("F2 (B): a partly answered Gewohnheiten saves its next question while Tools is still open", async () => {
  const source = draft({
    status: "in_progress",
    refinedVersionId: null,
    answers: {
      currentProductCategories: [],
      wetWashFrequency: "weekly_2x",
      towel: { material: "mikrofaser", technique: "gentle_press" },
    },
    completedQuestionIds: ["current_product_categories", "wet_wash_frequency", "towel_handling"],
    answerProvenance: {
      current_product_categories: "user",
      wet_wash_frequency: "user",
      towel_handling: "user",
    },
  })
  const { service } = serviceFor(source)
  const loaded = await service.load()
  const entry = resolveStage2FlowEntryView({
    session: scopeStage2SessionToModule(loaded, "habits"),
    moduleScope: "explicit",
  })
  assert.equal(entry.activeQuestionId, "drying_routes")
  const saved = await service.saveAnswer({
    questionId: "drying_routes",
    answer: ["air_dry"],
    expectedRevision: 6,
  })
  assert.ok(saved.completedQuestionIds.includes("drying_routes"))
  assert.equal(saved.path.firstUnresolvedQuestionId, "tools_overview")
  // Order inside a module is unchanged: the night question still waits for the drying answer.
  assert.throws(
    () =>
      saveStage2SessionAnswer(stage2SessionFromPersistedDraft(source), {
        questionId: "night_wear",
        answer: "open",
      }),
    (error: unknown) =>
      error instanceof Stage2RefinementError && error.code === "question_not_current",
  )
})

test("B proof: the contract keeps completed answers that follow an unresolved question", () => {
  const contract = resolveStage2RefinementContract({
    triggerContext: ON_MEDIUM,
    answers: {
      currentProductCategories: [],
      wetWashFrequency: "weekly_2x",
      towel: { material: "mikrofaser", technique: "gentle_press" },
      dryingRoutes: ["air_dry"],
    },
    completedQuestionIds: [
      "current_product_categories",
      "wet_wash_frequency",
      "towel_handling",
      "drying_routes",
    ],
  })
  assert.equal(contract.path.firstUnresolvedQuestionId, "tools_overview")
  assert.deepEqual(contract.completedQuestionIds, [
    "current_product_categories",
    "wet_wash_frequency",
    "towel_handling",
    "drying_routes",
  ])
})
