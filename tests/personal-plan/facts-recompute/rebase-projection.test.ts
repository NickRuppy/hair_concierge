import assert from "node:assert/strict"
import test from "node:test"

import { computeNeedPlan } from "@/lib/personal-plan/compute-stage1"
import { buildDirectAcceptanceStage2Defaults } from "@/lib/personal-plan/direct-acceptance/defaults"
import {
  buildRebaseProjection,
  RebaseProjectionIncompleteError,
  type RebaseSourceDraft,
} from "@/lib/personal-plan/facts-recompute/rebase-projection"
import type { JsonValue } from "@/lib/personal-plan/persistence"
import { PERSONAL_PLAN_STAGE1_COMPUTATION_VERSION } from "@/lib/personal-plan/persistence/stage1-service"
import {
  createStage2RefinementService,
  type SaveCareHabitsFacts,
  type Stage2PersistedDraft,
  type Stage2RefinementPersistence,
} from "@/lib/personal-plan/persistence/stage2-refinement-service"
import { buildAssumedAnswerProvenance } from "@/lib/personal-plan/refinement/answer-provenance"
import { resolveAssumedAnswers } from "@/lib/personal-plan/refinement/assumed-defaults"
import {
  createPersistedStage2RefinementGateway,
  createRefinedNeedSnapshot,
} from "@/lib/personal-plan/refinement/production-persistence-gateway"
import { resolveStage2RefinementContract } from "@/lib/personal-plan/refinement/question-path"
import { deriveStage2TriggerContext } from "@/lib/personal-plan/refinement/stage1-adapter"
import type {
  PersonalPlanRefinementAnswersV1,
  Stage2AnswerProvenance,
  Stage2Module,
  Stage2QuestionId,
  Stage2TriggerContext,
} from "@/lib/personal-plan/refinement/types"
import type { InitialNeedPlanSnapshot } from "@/lib/personal-plan/types"
import { toCareHabitsPatch, toFieldProvenance } from "@/lib/user-facts/from-refinement-draft"
import { CARE_HABITS_SCHEMA_VERSION } from "@/lib/user-facts/schema"
import type { SaveUserFactsInput } from "@/lib/user-facts/save"
import { COMPLETE_V3_PLAN_ENVELOPE } from "../fixtures"

/**
 * `buildRebaseProjection` (plans/2026-10-03-central-user-profile-pr2.md §4a, „Clone content and
 * projection"): the acceptance test is HASH EQUALITY against the real lanes on the same parent.
 * Every oracle below drives the production code path itself — `createStage2RefinementService`
 * with the production snapshot builder (`createRefinedNeedSnapshot`, exactly as
 * `createPersistedStage2RefinementGateway` wires it), or that gateway directly — over a fake
 * persistence that only captures what the service hands to the completion RPC.
 */

const ARTIFACT_ID = "11111111-1111-4111-8111-111111111111"
const NEW_INITIAL_ID = "33333333-3333-4333-8333-333333333333"
const OTHER_INITIAL_ID = "44444444-4444-4444-8444-444444444444"
const SOURCE_DRAFT_ID = "55555555-5555-4555-8555-555555555555"
const USER_ID = "66666666-6666-4666-8666-666666666666"
const NOW = new Date("2026-10-03T12:00:00.000Z")

type Parent = {
  id: string
  inputSnapshot: JsonValue
  outputSnapshot: InitialNeedPlanSnapshot
  triggerContext: Stage2TriggerContext
}

function parentFrom(envelope: unknown, id = NEW_INITIAL_ID): Parent {
  const computed = computeNeedPlan({
    rawEnvelope: envelope,
    artifactId: ARTIFACT_ID,
    projection: "initial_quiz",
    computationVersion: PERSONAL_PLAN_STAGE1_COMPUTATION_VERSION,
    createdAt: "2026-10-01T09:00:00.000Z",
  })
  assert.equal(computed.status, "ready")
  if (computed.status !== "ready") throw new Error("unreachable")
  return {
    id,
    inputSnapshot: computed.snapshot.sourceQuiz as unknown as JsonValue,
    outputSnapshot: computed.snapshot,
    triggerContext: deriveStage2TriggerContext(computed.snapshot),
  }
}

/** Plain V3 parent: no irritated scalp, so `scalp_irritation_detail` is not on the path. */
const PLAIN = parentFrom(COMPLETE_V3_PLAN_ENVELOPE)
/** Same answers plus an irritated scalp: `scalp_irritation_detail` opens. */
const IRRITATED = parentFrom({
  ...COMPLETE_V3_PLAN_ENVELOPE,
  answers: { ...COMPLETE_V3_PLAN_ENVELOPE.answers, scalpConcerns: ["irritated"] },
})

test("fixture sanity: the two parents differ exactly in the irritated-scalp trigger", () => {
  assert.equal(PLAIN.triggerContext.hasReportedIrritatedScalp, false)
  assert.equal(IRRITATED.triggerContext.hasReportedIrritatedScalp, true)
})

const PRODUCTS_ANSWERS: PersonalPlanRefinementAnswersV1 = {
  currentProductCategories: [],
  wetWashFrequency: "daily_1x",
}
const PRODUCTS_IDS: Stage2QuestionId[] = ["current_product_categories", "wet_wash_frequency"]
const HABITS_ANSWERS: PersonalPlanRefinementAnswersV1 = {
  towel: { material: "frottee", technique: "rough_rubbing" },
  dryingRoutes: ["air_dry"],
  additionalHeatTools: [],
  nightProtection: [],
}
const HABITS_IDS: Stage2QuestionId[] = [
  "towel_handling",
  "drying_routes",
  "additional_heat_tools",
  "night_protection",
]

function provenance(
  ids: readonly Stage2QuestionId[],
  value: "user" | "assumed" = "user",
): Stage2AnswerProvenance {
  const result: Stage2AnswerProvenance = {}
  for (const id of ids) result[id] = value
  return result
}

function source(input: {
  status: "in_progress" | "complete"
  answers: PersonalPlanRefinementAnswersV1
  completedQuestionIds: Stage2QuestionId[]
  answerProvenance: Stage2AnswerProvenance
}): RebaseSourceDraft {
  return { id: SOURCE_DRAFT_ID, ...input }
}

function project(
  sourceDraft: RebaseSourceDraft,
  parent: Parent,
  options: { hasRefinedHead?: boolean } = {},
) {
  return buildRebaseProjection({
    sourceDraft,
    newInitial: {
      id: parent.id,
      inputSnapshot: parent.inputSnapshot,
      outputSnapshot: parent.outputSnapshot,
    },
    sourceId: ARTIFACT_ID,
    hasRefinedHead: options.hasRefinedHead ?? true,
    now: NOW,
  })
}

type CapturedCompletion = {
  rpc: "complete" | "completeModule"
  inputHash: string
  inputSnapshot: Record<string, unknown>
  outputSnapshot: Record<string, unknown>
  schemaVersion: number
  computationVersion: string
}

/**
 * A fake persistence holding ONE draft row on `parent`. `save` replaces its content (direct
 * acceptance writes its defaults through it); both completion RPCs only capture their input.
 */
function createCapturingPersistence(parent: Parent, initial: RebaseSourceDraft) {
  let row: Stage2PersistedDraft = {
    id: initial.id,
    personalPlanId: "plan-1",
    baseInitialNeedVersionId: parent.id,
    schemaVersion: 1,
    preparedArtifactSourceId: ARTIFACT_ID,
    baseInputSnapshot: parent.inputSnapshot,
    pathVersion: "stage2-v1",
    triggerContext: parent.triggerContext,
    answers: structuredClone(initial.answers),
    completedQuestionIds: [...initial.completedQuestionIds],
    answerProvenance: { ...initial.answerProvenance },
    moduleProjections: {},
    revision: 3,
    // The real lanes only complete an OPEN draft; the source's own status is the projection's
    // business, not the oracle's.
    status: "in_progress",
    refinedVersionId: null,
  }
  const captured: CapturedCompletion[] = []
  const persistence: Stage2RefinementPersistence = {
    async loadOrCreate() {
      return structuredClone(row)
    },
    async reopen() {
      throw new Error("unexpected reopen")
    },
    async save(input) {
      row = {
        ...row,
        answers: structuredClone(input.answers),
        completedQuestionIds: [...input.completedQuestionIds],
        answerProvenance: { ...input.answerProvenance },
        revision: row.revision + 1,
      }
      return { outcome: "saved", revision: row.revision }
    },
    async complete(input) {
      captured.push({ rpc: "complete", ...pickSnapshot(input) })
      return { outcome: "completed", refinedVersionId: "refined-real" }
    },
    async completeModule(input) {
      captured.push({ rpc: "completeModule", ...pickSnapshot(input) })
      return { outcome: "completed", refinedVersionId: "refined-real", stage3Handoff: false }
    },
  }
  return { persistence, captured, current: () => row }
}

function pickSnapshot(input: {
  inputHash: string
  inputSnapshot: Record<string, unknown>
  outputSnapshot: Record<string, unknown>
  schemaVersion: number
  computationVersion: string
}) {
  return {
    inputHash: input.inputHash,
    inputSnapshot: structuredClone(input.inputSnapshot),
    outputSnapshot: structuredClone(input.outputSnapshot),
    schemaVersion: input.schemaVersion,
    computationVersion: input.computationVersion,
  }
}

function createFakeSaveFacts() {
  const calls: Array<Extract<SaveUserFactsInput, { domain: "care_habits" }>> = []
  const saveFacts: SaveCareHabitsFacts = async (input) => {
    calls.push(structuredClone(input))
    return { status: "ok", revision: 2, changed: true, diagnosticsHash: null }
  }
  return { saveFacts, calls }
}

/** The production service, exactly as `createPersistedStage2RefinementGateway` composes it. */
function realService(parent: Parent, draft: RebaseSourceDraft) {
  const store = createCapturingPersistence(parent, draft)
  const facts = createFakeSaveFacts()
  const service = createStage2RefinementService({
    userId: USER_ID,
    persistence: store.persistence,
    snapshotBuilder: (snapshotInput) =>
      createRefinedNeedSnapshot({ ...snapshotInput, createdAt: NOW.toISOString() }),
    saveFacts: facts.saveFacts,
    now: () => NOW,
  })
  return { service, store, facts }
}

async function realModuleCompletion(
  parent: Parent,
  draft: RebaseSourceDraft,
  module: Stage2Module,
) {
  const real = realService(parent, draft)
  await real.service.completeModule({ module, expectedRevision: 3 })
  assert.equal(real.store.captured.length, 1)
  return { completion: real.store.captured[0]!, facts: real.facts.calls }
}

async function realTerminalCompletion(parent: Parent, draft: RebaseSourceDraft) {
  const real = realService(parent, draft)
  await real.service.complete({ expectedRevision: 3 })
  assert.equal(real.store.captured.length, 1)
  assert.equal(real.store.captured[0]!.rpc, "complete")
  return { completion: real.store.captured[0]!, facts: real.facts.calls }
}

/** `createdAt` is the clock of the call, never part of the hash; everything else must match. */
function withoutCreatedAt(snapshot: Record<string, unknown>) {
  const { createdAt: _createdAt, ...rest } = snapshot
  return rest
}

function assertSameRefined(
  refined: ReturnType<typeof project>["refined"],
  completion: CapturedCompletion,
) {
  assert.ok(refined, "projection published no refined version")
  assert.equal(refined.inputHash, completion.inputHash)
  assert.deepEqual(refined.inputSnapshot, completion.inputSnapshot)
  assert.deepEqual(
    withoutCreatedAt(refined.outputSnapshot as Record<string, unknown>),
    withoutCreatedAt(completion.outputSnapshot),
  )
  assert.equal(refined.schemaVersion, completion.schemaVersion)
  assert.equal(refined.computationVersion, completion.computationVersion)
}

/* ── in-progress source: the module lane ──────────────────────────────────── */

test("in-progress source (products done): refined equals real module completion on P′, clone verbatim, facts equal the lane's write", async () => {
  const draft = source({
    status: "in_progress",
    answers: PRODUCTS_ANSWERS,
    completedQuestionIds: PRODUCTS_IDS,
    answerProvenance: provenance(PRODUCTS_IDS),
  })
  const projection = project(draft, PLAIN)
  const real = await realModuleCompletion(PLAIN, draft, "products")

  assert.equal(real.completion.rpc, "completeModule")
  assertSameRefined(projection.refined, real.completion)
  assert.deepEqual(projection.clone, {
    answers: PRODUCTS_ANSWERS,
    completedQuestionIds: PRODUCTS_IDS,
    answerProvenance: provenance(PRODUCTS_IDS),
  })

  // The care-habits write is the one `writeCareHabitsFacts` makes for the same draft.
  assert.equal(real.facts.length, 1)
  const write = real.facts[0]!
  assert.ok(projection.careHabits)
  assert.deepEqual(projection.careHabits.patch, write.patch)
  assert.deepEqual(projection.careHabits.provenance, {
    source: { kind: "feinschliff_draft", id: SOURCE_DRAFT_ID },
    schemaVersion: CARE_HABITS_SCHEMA_VERSION,
    at: NOW.toISOString(),
    fields: write.provenance.fields,
  })
  assert.deepEqual(projection.careHabits.provenance, write.provenance)
})

test("in-progress source with both modules user-complete: refined equals the real CLOSING module completion (terminal form)", async () => {
  const draft = source({
    status: "in_progress",
    answers: { ...PRODUCTS_ANSWERS, ...HABITS_ANSWERS },
    completedQuestionIds: [...PRODUCTS_IDS, ...HABITS_IDS],
    answerProvenance: provenance([...PRODUCTS_IDS, ...HABITS_IDS]),
  })
  const projection = project(draft, PLAIN)
  const real = await realModuleCompletion(PLAIN, draft, "habits")

  // The closing module delegates to the terminal completion (`completeDraft`).
  assert.equal(real.completion.rpc, "complete")
  assertSameRefined(projection.refined, real.completion)
  // Terminal form: no resolver-added `heatEvents: {}` (the module form would carry one).
  assert.equal(
    (projection.refined!.inputSnapshot.answers as Record<string, unknown>).heatEvents,
    undefined,
  )
})

test("in-progress source with neither module complete: still projected (no module gate), in the module-lane form", () => {
  const draft = source({
    status: "in_progress",
    answers: { wetWashFrequency: "daily_1x" },
    completedQuestionIds: ["wet_wash_frequency"],
    answerProvenance: provenance(["wet_wash_frequency"]),
  })
  const projection = project(draft, PLAIN)

  // The real module lane refuses this draft (its module gate), so the oracle is its own two
  // steps — resolver over the user answers, snapshot with `habitsModuleUserComplete` — called
  // directly.
  const resolution = resolveAssumedAnswers({
    triggerContext: PLAIN.triggerContext,
    answers: draft.answers,
    userAnsweredQuestionIds: ["wet_wash_frequency"],
  })
  const expected = createRefinedNeedSnapshot({
    baseInitialNeedVersionId: PLAIN.id,
    preparedArtifactSourceId: ARTIFACT_ID,
    baseInputSnapshot: PLAIN.inputSnapshot,
    triggerContext: PLAIN.triggerContext,
    answers: resolution.answers,
    completedQuestionIds: resolution.orderedQuestionIds,
    habitsModuleUserComplete: false,
    createdAt: NOW.toISOString(),
  })
  assert.ok(projection.refined)
  assert.equal(projection.refined.inputHash, expected.inputHash)
  assert.deepEqual(projection.refined.inputSnapshot, expected.inputSnapshot)
  assert.equal(projection.refined.inputSnapshot.habitsModuleUserComplete, false)
  assert.deepEqual(projection.clone.answers, draft.answers)
})

test("in-progress source: answers that left the path are pruned from the snapshot, the clone stays verbatim", async () => {
  // Answered on an irritated parent; the new parent has no irritated scalp.
  const ids: Stage2QuestionId[] = [...PRODUCTS_IDS, "scalp_irritation_detail"]
  const draft = source({
    status: "in_progress",
    answers: { ...PRODUCTS_ANSWERS, scalpIrritationDetail: "mild_sensitive_or_itchy" },
    completedQuestionIds: ids,
    answerProvenance: provenance(ids),
  })
  const projection = project(draft, PLAIN)
  const real = await realModuleCompletion(PLAIN, draft, "products")

  assertSameRefined(projection.refined, real.completion)
  const snapshotAnswers = projection.refined!.inputSnapshot.answers as Record<string, unknown>
  assert.equal("scalpIrritationDetail" in snapshotAnswers, false)
  assert.equal(
    (projection.refined!.inputSnapshot.completedQuestionIds as string[]).includes(
      "scalp_irritation_detail",
    ),
    false,
  )
  assert.deepEqual(projection.clone, {
    answers: draft.answers,
    completedQuestionIds: ids,
    answerProvenance: provenance(ids),
  })
})

test("in-progress source without a refined head: clone only, no refined version, no facts write", () => {
  const draft = source({
    status: "in_progress",
    answers: PRODUCTS_ANSWERS,
    completedQuestionIds: PRODUCTS_IDS,
    answerProvenance: provenance(PRODUCTS_IDS),
  })
  const projection = project(draft, PLAIN, { hasRefinedHead: false })

  assert.equal(projection.refined, null)
  assert.equal(projection.careHabits, null)
  assert.deepEqual(projection.clone.answers, PRODUCTS_ANSWERS)
})

test("R16: a saved but unpublished answer is published with the facts (patch and provenance from the clone)", async () => {
  // Products done and projected; the towel answer was saved inside the open habits module.
  const ids: Stage2QuestionId[] = [...PRODUCTS_IDS, "towel_handling"]
  const answers: PersonalPlanRefinementAnswersV1 = {
    ...PRODUCTS_ANSWERS,
    towel: { material: "tshirt", technique: "gentle_press" },
  }
  const draft = source({
    status: "in_progress",
    answers,
    completedQuestionIds: ids,
    answerProvenance: provenance(ids),
  })
  const projection = project(draft, PLAIN)

  assert.ok(projection.careHabits)
  assert.deepEqual(projection.careHabits.patch, toCareHabitsPatch(projection.clone.answers))
  assert.deepEqual(projection.careHabits.provenance.fields, toFieldProvenance(projection.clone))
  assert.deepEqual(projection.careHabits.patch.towel, answers.towel)
  assert.equal(projection.careHabits.provenance.fields?.towel, "user")

  // ... and it is the write the real module lane would make for the same draft.
  const real = await realModuleCompletion(PLAIN, draft, "products")
  assert.deepEqual(projection.careHabits.patch, real.facts[0]!.patch)
  assert.deepEqual(projection.careHabits.provenance, real.facts[0]!.provenance)
  assertSameRefined(projection.refined, real.completion)
})

test("in-progress closing form with a user-marked but invalid answer: the projection refuses like the real lane", async () => {
  // Every path id is user-marked, so both modules count as complete, but one stored value is
  // not a valid answer: `completeDraft`'s contract check rejects it.
  const ids = [...PRODUCTS_IDS, ...HABITS_IDS]
  const draft = source({
    status: "in_progress",
    answers: {
      ...PRODUCTS_ANSWERS,
      ...HABITS_ANSWERS,
      wetWashFrequency: "bogus" as never,
    },
    completedQuestionIds: ids,
    answerProvenance: provenance(ids),
  })

  assert.throws(() => project(draft, PLAIN), RebaseProjectionIncompleteError)
  const real = realService(PLAIN, draft)
  await assert.rejects(real.service.completeModule({ module: "habits", expectedRevision: 3 }), {
    code: "incomplete_refinement",
  })
})

/* ── complete source: the terminal lane ───────────────────────────────────── */

test("complete user-only source (no heat): refined equals real terminal completion of the same answers on P′", async () => {
  const draft = source({
    status: "complete",
    answers: { ...PRODUCTS_ANSWERS, ...HABITS_ANSWERS },
    completedQuestionIds: [...PRODUCTS_IDS, ...HABITS_IDS],
    answerProvenance: provenance([...PRODUCTS_IDS, ...HABITS_IDS]),
  })
  const projection = project(draft, PLAIN)
  const real = await realTerminalCompletion(PLAIN, draft)

  assertSameRefined(projection.refined, real.completion)
  // The clone is the source again (same path, nothing assumed) — and the facts write is the
  // one the terminal lane makes for it.
  assert.deepEqual(projection.clone.answers, draft.answers)
  assert.deepEqual(projection.clone.answerProvenance, draft.answerProvenance)
  assert.deepEqual(projection.careHabits!.patch, real.facts[0]!.patch)
  assert.deepEqual(projection.careHabits!.provenance, real.facts[0]!.provenance)
})

test("complete user-only source with a heat event: refined equals real terminal completion", async () => {
  const ids: Stage2QuestionId[] = [
    ...PRODUCTS_IDS,
    "towel_handling",
    "drying_routes",
    "additional_heat_tools",
    "heat:straightener",
    "night_protection",
  ]
  const draft = source({
    status: "complete",
    answers: {
      ...PRODUCTS_ANSWERS,
      ...HABITS_ANSWERS,
      additionalHeatTools: ["straightener"],
      heatEvents: {
        "heat:straightener": { frequency: "weekly_1x", protectionConsistency: "always" },
      },
    },
    completedQuestionIds: ids,
    answerProvenance: provenance(ids),
  })
  const projection = project(draft, PLAIN)
  const real = await realTerminalCompletion(PLAIN, draft)

  assertSameRefined(projection.refined, real.completion)
  assert.deepEqual(projection.clone.completedQuestionIds, ids)
})

test("complete mixed-provenance source: refined equals real terminal completion (direct acceptance itself rejects mixed drafts)", async () => {
  const defaults = buildDirectAcceptanceStage2Defaults(PLAIN.triggerContext)
  const answerProvenance: Stage2AnswerProvenance = {
    ...buildAssumedAnswerProvenance(defaults.completedQuestionIds),
    wet_wash_frequency: "user",
  }
  const draft = source({
    status: "complete",
    answers: { ...defaults.answers, wetWashFrequency: "daily_1x" },
    completedQuestionIds: defaults.completedQuestionIds,
    answerProvenance,
  })
  const projection = project(draft, PLAIN)
  const real = await realTerminalCompletion(PLAIN, draft)

  assertSameRefined(projection.refined, real.completion)
  assert.deepEqual(projection.clone.answerProvenance, answerProvenance)
  assert.equal(projection.clone.answers.wetWashFrequency, "daily_1x")
})

test("complete all-assumed source: refined equals real direct acceptance (defaults + the terminal gateway it uses)", async () => {
  // `acceptIdealPlan`'s Stage-2 leg (`completeSyntheticRefinement`, accept.ts) step for step:
  // defaults from the draft's trigger context, saved with assumed provenance, completed through
  // `createPersistedStage2RefinementGateway(...).complete`. Its Stage-3 leg runs after the
  // refined version exists and does not touch it, so it is not driven here.
  const empty = source({
    status: "in_progress",
    answers: {},
    completedQuestionIds: [],
    answerProvenance: {},
  })
  const store = createCapturingPersistence(PLAIN, empty)
  const facts = createFakeSaveFacts()
  const loaded = await store.persistence.loadOrCreate(USER_ID)
  const defaults = buildDirectAcceptanceStage2Defaults(loaded.triggerContext)
  const saved = await store.persistence.save({
    userId: USER_ID,
    draft: loaded,
    expectedRevision: loaded.revision,
    answers: defaults.answers,
    completedQuestionIds: defaults.completedQuestionIds,
    answerProvenance: buildAssumedAnswerProvenance(defaults.completedQuestionIds),
  })
  assert.equal(saved.outcome, "saved")
  if (saved.outcome !== "saved") return
  await createPersistedStage2RefinementGateway({
    userId: USER_ID,
    persistence: store.persistence,
    saveFacts: facts.saveFacts,
    now: () => NOW,
  }).complete({ expectedRevision: saved.revision })
  assert.equal(store.captured.length, 1)

  const accepted = store.current()
  const projection = project(
    source({
      status: "complete",
      answers: accepted.answers,
      completedQuestionIds: accepted.completedQuestionIds,
      answerProvenance: accepted.answerProvenance,
    }),
    PLAIN,
  )
  assertSameRefined(projection.refined, store.captured[0]!)
  assert.deepEqual(projection.careHabits!.patch, facts.calls[0]!.patch)
  assert.deepEqual(projection.careHabits!.provenance, facts.calls[0]!.provenance)
})

test("complete source whose new trigger context opens a question: clone stays contract-complete, the new question is assumed", async () => {
  // Completed by the user on the plain parent; the edit makes the scalp irritated.
  const draft = source({
    status: "complete",
    answers: { ...PRODUCTS_ANSWERS, ...HABITS_ANSWERS },
    completedQuestionIds: [...PRODUCTS_IDS, ...HABITS_IDS],
    answerProvenance: provenance([...PRODUCTS_IDS, ...HABITS_IDS]),
  })
  const irritated = { ...IRRITATED, id: OTHER_INITIAL_ID }
  const projection = project(draft, irritated)

  const contract = resolveStage2RefinementContract({
    triggerContext: irritated.triggerContext,
    answers: projection.clone.answers,
    completedQuestionIds: projection.clone.completedQuestionIds,
  })
  assert.equal(contract.isComplete, true)
  assert.ok(projection.clone.completedQuestionIds.includes("scalp_irritation_detail"))
  assert.equal(projection.clone.answerProvenance.scalp_irritation_detail, "assumed")
  assert.equal(projection.clone.answers.scalpIrritationDetail, "normal")
  for (const id of [...PRODUCTS_IDS, ...HABITS_IDS]) {
    assert.equal(projection.clone.answerProvenance[id], "user", id)
  }
  assert.equal(projection.careHabits!.provenance.fields?.scalpIrritationDetail, "assumed")

  // The refined version is what the terminal lane produces for the clone on that parent.
  const real = await realTerminalCompletion(
    irritated,
    source({ status: "complete", ...projection.clone }),
  )
  assertSameRefined(projection.refined, real.completion)
})

test("complete source: answers that left the path drop out of clone and snapshot alike", async () => {
  const ids: Stage2QuestionId[] = [...PRODUCTS_IDS, "scalp_irritation_detail", ...HABITS_IDS]
  const draft = source({
    status: "complete",
    answers: { ...PRODUCTS_ANSWERS, scalpIrritationDetail: "normal", ...HABITS_ANSWERS },
    completedQuestionIds: ids,
    answerProvenance: provenance(ids),
  })
  const projection = project(draft, PLAIN)
  const real = await realTerminalCompletion(PLAIN, draft)

  assertSameRefined(projection.refined, real.completion)
  assert.equal("scalpIrritationDetail" in projection.clone.answers, false)
  assert.equal(projection.clone.completedQuestionIds.includes("scalp_irritation_detail"), false)
})

test("complete source without a refined head: no refined version and no facts write (the RPC refuses this shape)", () => {
  const draft = source({
    status: "complete",
    answers: { ...PRODUCTS_ANSWERS, ...HABITS_ANSWERS },
    completedQuestionIds: [...PRODUCTS_IDS, ...HABITS_IDS],
    answerProvenance: provenance([...PRODUCTS_IDS, ...HABITS_IDS]),
  })
  const projection = project(draft, PLAIN, { hasRefinedHead: false })
  assert.equal(projection.refined, null)
  assert.equal(projection.careHabits, null)
})

test("the refined hash names the new parent: same answers on another parent id hash differently", () => {
  const draft = source({
    status: "in_progress",
    answers: PRODUCTS_ANSWERS,
    completedQuestionIds: PRODUCTS_IDS,
    answerProvenance: provenance(PRODUCTS_IDS),
  })
  const onNew = project(draft, PLAIN)
  const onOther = project(draft, { ...PLAIN, id: OTHER_INITIAL_ID })
  assert.notEqual(onNew.refined!.inputHash, onOther.refined!.inputHash)
  assert.deepEqual(onNew.refined!.inputSnapshot, onOther.refined!.inputSnapshot)
})
