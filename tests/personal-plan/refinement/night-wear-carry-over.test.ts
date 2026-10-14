import assert from "node:assert/strict"
import test from "node:test"

import {
  createStage2RefinementService,
  interpretStage2PersistedDraft,
  stage2SessionFromPersistedDraft,
  type Stage2PersistedDraft,
} from "@/lib/personal-plan/persistence/stage2-refinement-service"
import { scopeStage2SessionToModule } from "@/lib/personal-plan/refinement/module-scope"
import { stage2ModuleStates } from "@/lib/personal-plan/refinement/module-status"
import { buildRefinementStatusResponse } from "@/lib/personal-plan/refinement/refinement-status"
import { saveStage2SessionAnswer } from "@/lib/personal-plan/refinement/session"
import type {
  NightProtection,
  PersonalPlanRefinementAnswersV1,
  Stage2AnswerProvenance,
  Stage2QuestionId,
  Stage2TriggerContext,
} from "@/lib/personal-plan/refinement/types"
import { profileHabitsRows } from "@/lib/profile/section-config"

/**
 * Rev. 6 review fixes F2/F3 (2026-10-12): a member who finished Gewohnheiten before the night
 * question existed already told us how she wears her hair at night — the old multi-select
 * offered Pineapple and „locker zusammengebunden". That answer carries over into `night_wear`
 * (Nick: existing answers pre-fill, never re-asked; Gewohnheiten stays complete).
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
const ON_SHORT = context({ toolsEnabled: true, hairLength: "short" })

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

function moduleStatusInput(source: Stage2PersistedDraft) {
  return {
    triggerContext: source.triggerContext,
    answers: source.answers,
    completedQuestionIds: source.completedQuestionIds,
    answerProvenance: source.answerProvenance,
  }
}

/* ── F3: Gewohnheiten stays complete ────────────────────────────────────── */

test("F3: a user-completed Gewohnheiten stays complete; the old night answer carries over as „Offen“", async () => {
  const source = draft()
  const states = stage2ModuleStates(moduleStatusInput(source))
  assert.equal(states.habits.status, "complete")
  assert.equal(states.products.status, "complete")
  assert.equal(states.tools.status, "open", "the tools module is genuinely new")

  const status = buildRefinementStatusResponse({
    moduleStatusInput: moduleStatusInput(source),
    moduleProjections: {},
    bannerDismissals: { dismissedModules: new Set() },
  })
  assert.deepEqual(status.progress, { completedSteps: 4, totalSteps: 5 })
  assert.equal(status.banner.module, "tools", "no habits banner")

  const session = stage2SessionFromPersistedDraft(source)
  assert.equal(session.answers.nightWear, "open")
  assert.ok(session.completedQuestionIds.includes("night_wear"))
  assert.equal(session.path.firstUnresolvedQuestionId, "tools_overview")

  // The carried-over answer keeps the old answer's provenance when the draft is next saved.
  const { service, calls } = serviceFor(source)
  await service.load()
  await service.saveAnswer({
    questionId: "towel_handling",
    answer: { material: "mikrofaser", technique: "gentle_press" },
    expectedRevision: 6,
  })
  const saved = calls.saved.at(-1)!
  assert.equal((saved.answers as PersonalPlanRefinementAnswersV1).nightWear, "open")
  assert.ok((saved.completedQuestionIds as Stage2QuestionId[]).includes("night_wear"))
  assert.equal((saved.answerProvenance as Stage2AnswerProvenance).night_wear, "user")
})

test("F3: an earlier Pineapple / locker zusammengebunden carries over as that technique", () => {
  const cases = [
    [["silk_satin_pillow", "pineapple"], "pineapple"],
    [["loose_tied"], "loose_tied"],
    [["loose_tied", "pineapple"], "pineapple"],
    [[], "open"],
  ] as const
  for (const [nightProtection, expected] of cases) {
    const source = draft({ answers: prePortAnswers([...nightProtection]) })
    const session = stage2SessionFromPersistedDraft(source)
    assert.equal(session.answers.nightWear, expected, JSON.stringify(nightProtection))
    assert.equal(stage2ModuleStates(moduleStatusInput(source)).habits.status, "complete")
  }
})

test("F3: an assumed old night answer carries over as assumed; Gewohnheiten stays as it was", async () => {
  const source = draft({
    answers: prePortAnswers([]),
    answerProvenance: provenance("assumed"),
  })
  const states = stage2ModuleStates(moduleStatusInput(source))
  assert.equal(states.habits.status, "open", "an all-assumed module was never the member's")
  const session = stage2SessionFromPersistedDraft(source)
  assert.equal(session.answers.nightWear, "open")
  assert.ok(session.completedQuestionIds.includes("night_wear"), "answered by assumption")

  const { service, calls } = serviceFor(source)
  await service.load()
  await service.saveAnswer({
    questionId: "towel_handling",
    answer: { material: "mikrofaser", technique: "gentle_press" },
    expectedRevision: 6,
  })
  assert.equal(
    (calls.saved.at(-1)!.answerProvenance as Stage2AnswerProvenance).night_wear,
    "assumed",
  )
})

test("F3: an in-progress Gewohnheiten asks the night question in its normal order", () => {
  const source = draft({
    status: "in_progress",
    refinedVersionId: null,
    answers: {
      currentProductCategories: [],
      wetWashFrequency: "weekly_2x",
      towel: { material: "mikrofaser", technique: "gentle_press" },
    },
    completedQuestionIds: ["current_product_categories", "wet_wash_frequency", "towel_handling"],
  })
  const session = stage2SessionFromPersistedDraft(source)
  assert.equal(session.answers.nightWear, undefined)
  assert.equal(session.completedQuestionIds.includes("night_wear"), false)
  const habits = scopeStage2SessionToModule(session, "habits")
  assert.deepEqual(habits.path.orderedQuestionIds, [
    "towel_handling",
    "drying_routes",
    "night_wear",
  ])
  assert.equal(habits.path.firstUnresolvedQuestionId, "drying_routes")
})

test("F3: hair too short to tie never gets a night question", () => {
  const source = draft({ triggerContext: ON_SHORT })
  const session = stage2SessionFromPersistedDraft(source)
  assert.equal(session.path.orderedQuestionIds.includes("night_wear"), false)
  assert.equal(session.answers.nightWear, undefined)
  assert.equal(stage2ModuleStates(moduleStatusInput(source)).habits.status, "complete")
})

test("new members are unchanged: night_wear is asked last and completion still requires it", () => {
  const answers: PersonalPlanRefinementAnswersV1 = {
    currentProductCategories: [],
    wetWashFrequency: "weekly_2x",
    toolFamiliesWithSomething: [],
    towel: { material: "mikrofaser", technique: "gentle_press" },
    dryingRoutes: ["air_dry"],
  }
  const completedQuestionIds: Stage2QuestionId[] = [
    "current_product_categories",
    "wet_wash_frequency",
    "tools_overview",
    "towel_handling",
    "drying_routes",
  ]
  const fresh = draft({
    status: "in_progress",
    refinedVersionId: null,
    answers,
    completedQuestionIds,
    answerProvenance: Object.fromEntries(completedQuestionIds.map((id) => [id, "user"])),
  })
  const session = stage2SessionFromPersistedDraft(fresh)
  assert.equal(session.path.orderedQuestionIds.at(-1), "night_wear")
  assert.equal(session.path.firstUnresolvedQuestionId, "night_wear")
  assert.equal(stage2ModuleStates(moduleStatusInput(fresh)).habits.status, "open")
  const saved = saveStage2SessionAnswer(session, { questionId: "night_wear", answer: "loose_tied" })
  assert.equal(saved.path.firstUnresolvedQuestionId, null)
})

test("Profil „Nachts“ shows the carried-over value of a pre-port answer", () => {
  const row = (plan: PersonalPlanRefinementAnswersV1) =>
    profileHabitsRows(null, plan).find((candidate) => candidate.key === "night_wear")?.value
  assert.equal(row(prePortAnswers(["silk_satin_pillow"])), "Offen")
  assert.equal(row(prePortAnswers(["pineapple"])), "Pineapple")
})

test("S4 + Tools: a grown tools path keeps finished products assumed and carries the old night answer", () => {
  const source = draft({
    triggerContext: { ...ON_MEDIUM, relevantCategories: ["shampoo", "bondbuilder"] },
    answers: prePortAnswers(["pineapple"]),
  })
  const interpreted = interpretStage2PersistedDraft(source)
  const session = stage2SessionFromPersistedDraft(source)
  assert.equal(session.status, "complete")
  assert.equal(session.answers.bondbuilderTiming, "no_preference")
  assert.equal(session.answers.nightWear, "pineapple")
  assert.equal(session.path.firstUnresolvedQuestionId, "tools_overview")
  assert.equal(interpreted.answerProvenance.bondbuilder_timing, "assumed")
  assert.equal(interpreted.answerProvenance.night_wear, "user")
  const states = stage2ModuleStates(moduleStatusInput(interpreted))
  assert.equal(states.products.status, "complete")
  assert.equal(states.habits.status, "complete")
  assert.equal(states.tools.status, "open")
  assert.equal(source.answers.bondbuilderTiming, undefined)
})
