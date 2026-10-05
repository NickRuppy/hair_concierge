import assert from "node:assert/strict"
import test from "node:test"

import { computeNeedPlan } from "@/lib/personal-plan/compute-stage1"
import { buildRebaseProjection } from "@/lib/personal-plan/facts-recompute/rebase-projection"
import { syncPlanWithFacts } from "@/lib/personal-plan/facts-recompute/sync-plan-with-facts"
import type {
  FactsRecomputeDeps,
  FactsRecomputeInitialVersion,
  FactsRecomputePlan,
  FactsRecomputeSourceDraft,
  PersonalPlanRebaseOnFactsParams,
  PersonalPlanRebaseOnFactsResult,
} from "@/lib/personal-plan/facts-recompute/types"
import { hashPersonalPlanNeedVersionInput, type JsonValue } from "@/lib/personal-plan/persistence"
import { PERSONAL_PLAN_STAGE1_COMPUTATION_VERSION } from "@/lib/personal-plan/persistence/stage1-service"
import type { InitialNeedPlanSnapshot } from "@/lib/personal-plan/types"
import { projectArtifactToFacts } from "@/lib/user-facts/project-artifact"
import { toStage1SourceFromFacts, UserFactsReadError, type UserFacts } from "@/lib/user-facts/read"
import { COMPLETE_V3_PLAN_ENVELOPE } from "../fixtures"

/**
 * `syncPlanWithFacts` over fake deps (plans/2026-10-03-central-user-profile-pr2.md §4a): one
 * case per `SyncPlanWithFactsResult` branch, the one-retry rule, and "never throws". The facts
 * are real (`projectArtifactToFacts`), so the Stage-1 computation inside the lane is the real
 * one; only I/O is faked.
 */

const USER_ID = "user-1"
const PLAN_ID = "plan-1"
const ARTIFACT_ID = "11111111-1111-4111-8111-111111111111"
const CURRENT_INITIAL_ID = "22222222-2222-4222-8222-222222222222"
const FRESH_ID = "33333333-3333-4333-8333-333333333333"
const EXISTING_ID = "44444444-4444-4444-8444-444444444444"
const DRAFT_ID = "55555555-5555-4555-8555-555555555555"
const NOW = new Date("2026-10-03T12:00:00.000Z")
const EDITED_AT = "2026-10-03T10:00:00.000Z"

function uneditedFacts(revision = 4): UserFacts {
  const projected = projectArtifactToFacts({
    envelope: COMPLETE_V3_PLAN_ENVELOPE,
    artifactId: ARTIFACT_ID,
    leadId: "lead-1",
  })
  return {
    userId: USER_ID,
    diagnostics: projected.diagnostics,
    careHabits: null,
    quizContext: projected.quizContext,
    provenance: {},
    revision,
  }
}

/** A hand edit through the profile editor: native envelope, new hash. */
function editedFacts(revision = 5, thickness: "coarse" | "normal" = "coarse"): UserFacts {
  const facts = uneditedFacts(revision)
  return {
    ...facts,
    diagnostics: { ...facts.diagnostics!, thickness },
    provenance: {
      diagnostics: {
        source: { kind: "profile_editor" },
        schemaVersion: 1,
        at: EDITED_AT,
        editedAt: EDITED_AT,
      },
    },
  }
}

/** Stage 1 exactly as `stage1-service.ts` computes it, as the test's oracle. */
function stage1(facts: UserFacts) {
  const computed = computeNeedPlan({
    rawEnvelope: toStage1SourceFromFacts(facts),
    artifactId: ARTIFACT_ID,
    projection: "initial_quiz",
    computationVersion: PERSONAL_PLAN_STAGE1_COMPUTATION_VERSION,
    createdAt: NOW.toISOString(),
  })
  if (computed.status !== "ready") throw new Error("fixture not ready")
  const inputSnapshot = computed.snapshot.sourceQuiz as unknown as JsonValue
  return {
    snapshot: computed.snapshot,
    inputSnapshot,
    inputHash: hashPersonalPlanNeedVersionInput({
      schemaVersion: computed.snapshot.schemaVersion,
      computationVersion: computed.snapshot.computationVersion,
      inputSnapshot,
    }),
  }
}

const CURRENT_HASH = stage1(uneditedFacts()).inputHash

type World = {
  plan: FactsRecomputePlan | null
  initial: FactsRecomputeInitialVersion | null
  facts: UserFacts | null | (() => UserFacts | null)
  existingInitialId: string | null
  draft: FactsRecomputeSourceDraft | null
  rpc: Array<PersonalPlanRebaseOnFactsResult | Error>
}

function plan(overrides: Partial<FactsRecomputePlan> = {}): FactsRecomputePlan {
  return {
    id: PLAN_ID,
    revision: 7,
    currentInitialNeedVersionId: CURRENT_INITIAL_ID,
    currentRefinedNeedVersionId: "refined-old",
    activeRoutineVersionId: "routine-1",
    ...overrides,
  }
}

function draft(overrides: Partial<FactsRecomputeSourceDraft> = {}): FactsRecomputeSourceDraft {
  return {
    id: DRAFT_ID,
    status: "in_progress",
    revision: 3,
    answers: { currentProductCategories: [], wetWashFrequency: "daily_1x" },
    completedQuestionIds: ["current_product_categories", "wet_wash_frequency"],
    answerProvenance: { current_product_categories: "user", wet_wash_frequency: "user" },
    ...overrides,
  }
}

function rebased(
  overrides: Partial<Extract<PersonalPlanRebaseOnFactsResult, { status: "rebased" }>> = {},
) {
  return {
    status: "rebased" as const,
    initialNeedVersionId: FRESH_ID,
    refinedNeedVersionId: "refined-new",
    cloneDraftId: "clone-1",
    revision: 8,
    factsRevision: 6,
    ...overrides,
  }
}

function pgError(code: string): Error {
  return Object.assign(new Error(`postgres ${code}`), { code })
}

function createDeps(world: Partial<World> = {}) {
  const state: World = {
    plan: plan(),
    initial: {
      id: CURRENT_INITIAL_ID,
      inputHash: CURRENT_HASH,
      preparedArtifactSourceId: ARTIFACT_ID,
      stage1SourceLeadId: null,
    },
    facts: editedFacts(),
    existingInitialId: null,
    draft: draft(),
    rpc: [rebased()],
    ...world,
  }
  const calls = {
    rebase: [] as PersonalPlanRebaseOnFactsParams[],
    loadPlan: 0,
    loadFacts: 0,
    loadSourceDraft: 0,
  }
  let ids = 0
  const deps: FactsRecomputeDeps = {
    async loadPlan(userId) {
      assert.equal(userId, USER_ID)
      calls.loadPlan += 1
      return state.plan
    },
    async loadInitialVersion({ needVersionId }) {
      assert.equal(needVersionId, state.plan?.currentInitialNeedVersionId)
      return state.initial
    },
    async loadFacts() {
      calls.loadFacts += 1
      return typeof state.facts === "function" ? state.facts() : state.facts
    },
    async findInitialVersionId({ personalPlanId }) {
      assert.equal(personalPlanId, PLAN_ID)
      return state.existingInitialId
    },
    async loadSourceDraft({ personalPlanId, initialNeedVersionId }) {
      assert.equal(personalPlanId, PLAN_ID)
      assert.equal(initialNeedVersionId, CURRENT_INITIAL_ID)
      calls.loadSourceDraft += 1
      return state.draft
    },
    async rebase(params) {
      calls.rebase.push(structuredClone(params))
      const next = state.rpc.shift()
      if (!next) throw new Error("unexpected rebase call")
      if (next instanceof Error) throw next
      return next
    },
    newId: () => (ids++ === 0 ? FRESH_ID : `fresh-${ids}`),
    now: () => NOW,
  }
  return { deps, calls, state }
}

const run = (deps: FactsRecomputeDeps) => syncPlanWithFacts(deps, { userId: USER_ID })

test("no plan → no_plan, nothing else read", async () => {
  const { deps, calls } = createDeps({ plan: null })
  assert.deepEqual(await run(deps), { status: "no_plan" })
  assert.equal(calls.loadFacts, 0)
})

test("facts hash equal to the current initial → unchanged, no RPC call", async () => {
  const { deps, calls } = createDeps({ facts: uneditedFacts() })
  assert.deepEqual(await run(deps), { status: "unchanged", personalPlanId: PLAN_ID })
  assert.equal(calls.rebase.length, 0)
  assert.equal(calls.loadSourceDraft, 0)
})

for (const [label, facts] of [
  ["no facts row", null],
  ["no diagnostics", { ...uneditedFacts(), diagnostics: null }],
  [
    "legacy_columns source (UnsupportedUserFactsSourceError)",
    {
      ...editedFacts(),
      diagnostics: { ...editedFacts().diagnostics!, source: { kind: "legacy_columns" } },
    },
  ],
  [
    "incomplete edited facts (UserFactsIncompleteError)",
    (() => {
      const facts = editedFacts()
      const { hairLength: _hairLength, ...diagnostics } = facts.diagnostics!
      return { ...facts, diagnostics }
    })(),
  ],
] as const) {
  test(`facts_not_computable: ${label} — nothing written, not retryable`, async () => {
    const { deps, calls } = createDeps({ facts: facts as UserFacts | null })
    assert.deepEqual(await run(deps), {
      status: "unavailable",
      reason: "facts_not_computable",
      retryable: false,
    })
    assert.equal(calls.rebase.length, 0)
  })
}

test("rebased with an in-progress source draft and a refined head: the RPC gets Stage 1 + the projection", async () => {
  const { deps, calls } = createDeps()
  const result = await run(deps)
  assert.deepEqual(result, {
    status: "rebased",
    personalPlanId: PLAN_ID,
    initialNeedVersionId: FRESH_ID,
    refinedVersionId: "refined-new",
    activeRoutineVersionId: "routine-1",
  })

  assert.equal(calls.rebase.length, 1)
  const params = calls.rebase[0]!
  const expected = stage1(editedFacts())
  const projection = buildRebaseProjection({
    sourceDraft: draft(),
    newInitial: {
      id: FRESH_ID,
      inputSnapshot: expected.inputSnapshot,
      outputSnapshot: expected.snapshot as InitialNeedPlanSnapshot,
    },
    sourceId: ARTIFACT_ID,
    hasRefinedHead: true,
    now: NOW,
  })
  assert.deepEqual(params, {
    p_user_id: USER_ID,
    p_personal_plan_id: PLAN_ID,
    p_expected_plan_revision: 7,
    p_expected_facts_revision: 5,
    p_initial_id: FRESH_ID,
    p_schema_version: expected.snapshot.schemaVersion,
    p_computation_version: expected.snapshot.computationVersion,
    p_initial_input_hash: expected.inputHash,
    p_initial_input_snapshot: expected.inputSnapshot,
    p_initial_output_snapshot: expected.snapshot as unknown as JsonValue,
    p_source_draft_id: DRAFT_ID,
    p_expected_draft_revision: 3,
    p_clone_answers: projection.clone.answers,
    p_clone_completed_question_ids: projection.clone.completedQuestionIds,
    p_clone_answer_provenance: projection.clone.answerProvenance,
    p_care_habits_patch: projection.careHabits!.patch,
    p_care_habits_provenance: projection.careHabits!.provenance,
    p_refined_schema_version: projection.refined!.schemaVersion,
    p_refined_computation_version: projection.refined!.computationVersion,
    p_refined_input_hash: projection.refined!.inputHash,
    p_refined_input_snapshot: projection.refined!.inputSnapshot,
    p_refined_output_snapshot: projection.refined!.outputSnapshot as unknown as JsonValue,
  })
})

test("rebased with a source draft but no refined head: clone parameters only", async () => {
  const { deps, calls } = createDeps({
    plan: plan({ currentRefinedNeedVersionId: null, activeRoutineVersionId: null }),
    rpc: [rebased({ refinedNeedVersionId: null })],
  })
  assert.deepEqual(await run(deps), {
    status: "rebased",
    personalPlanId: PLAN_ID,
    initialNeedVersionId: FRESH_ID,
    refinedVersionId: null,
    activeRoutineVersionId: null,
  })
  const params = calls.rebase[0]!
  assert.equal(params.p_source_draft_id, DRAFT_ID)
  assert.ok(params.p_clone_answers)
  for (const key of [
    "p_care_habits_patch",
    "p_care_habits_provenance",
    "p_refined_schema_version",
    "p_refined_computation_version",
    "p_refined_input_hash",
    "p_refined_input_snapshot",
    "p_refined_output_snapshot",
  ] as const) {
    assert.equal(key in params, false, key)
  }
})

test("rebased without any source draft (and no refined head): initial parameters only", async () => {
  const { deps, calls } = createDeps({
    plan: plan({ currentRefinedNeedVersionId: null }),
    draft: null,
    rpc: [rebased({ refinedNeedVersionId: null, cloneDraftId: null })],
  })
  const result = await run(deps)
  assert.equal(result.status, "rebased")
  const params = calls.rebase[0]!
  assert.deepEqual(
    Object.keys(params).filter(
      (key) =>
        key.startsWith("p_source") ||
        key.startsWith("p_clone") ||
        key.startsWith("p_refined") ||
        key.startsWith("p_care"),
    ),
    [],
  )
})

test("rebased on a plan with a legacy-lead initial: the lead id is the computation's source id", async () => {
  const { deps, calls, state } = createDeps()
  state.initial = {
    ...state.initial!,
    preparedArtifactSourceId: null,
    stage1SourceLeadId: "lead-9",
  }
  await run(deps)
  const outputSnapshot = calls.rebase[0]!.p_initial_output_snapshot as { artifactId?: string }
  assert.equal(JSON.stringify(outputSnapshot).includes("lead-9"), true)
})

test("an existing initial row with the new hash is reused as the parent (A→B→A)", async () => {
  const { deps, calls } = createDeps({ existingInitialId: EXISTING_ID })
  await run(deps)
  assert.equal(calls.rebase[0]!.p_initial_id, EXISTING_ID)
})

for (const conflict of [
  { status: "plan_revision_conflict", currentRevision: 8 },
  { status: "facts_revision_conflict", currentRevision: 6 },
  { status: "draft_conflict", currentDraftId: "other", currentDraftRevision: 4 },
] as const) {
  test(`${conflict.status} → exactly one retry with reloaded inputs → rebased`, async () => {
    let factsReads = 0
    const { deps, calls, state } = createDeps({
      facts: () => (factsReads++ === 0 ? editedFacts(5) : editedFacts(6)),
      rpc: [conflict, rebased()],
    })
    const originalLoadPlan = deps.loadPlan
    deps.loadPlan = async (userId) => {
      const loaded = await originalLoadPlan(userId)
      // The second read sees the plan the conflicting writer left behind.
      state.plan = plan({ revision: 8 })
      return loaded
    }
    const result = await run(deps)
    assert.equal(result.status, "rebased")
    assert.equal(calls.rebase.length, 2)
    assert.equal(calls.loadPlan, 2)
    assert.equal(calls.loadFacts, 2)
    assert.equal(calls.loadSourceDraft, 2)
    assert.equal(calls.rebase[0]!.p_expected_plan_revision, 7)
    assert.equal(calls.rebase[1]!.p_expected_plan_revision, 8)
    assert.equal(calls.rebase[0]!.p_expected_facts_revision, 5)
    assert.equal(calls.rebase[1]!.p_expected_facts_revision, 6)
  })
}

test("initial_conflict → the retry uses existingId as the parent, and the refined hash follows it", async () => {
  const { deps, calls } = createDeps({
    rpc: [
      { status: "initial_conflict", existingId: EXISTING_ID },
      rebased({ initialNeedVersionId: EXISTING_ID }),
    ],
  })
  const result = await run(deps)
  assert.equal(result.status, "rebased")
  assert.equal(calls.rebase.length, 2)
  const [first, second] = calls.rebase
  assert.equal(first!.p_initial_id, FRESH_ID)
  assert.equal(second!.p_initial_id, EXISTING_ID)
  assert.notEqual(first!.p_refined_input_hash, second!.p_refined_input_hash)
  assert.deepEqual(first!.p_refined_input_snapshot, second!.p_refined_input_snapshot)
  assert.equal(
    second!.p_refined_input_hash,
    hashPersonalPlanNeedVersionInput({
      schemaVersion: second!.p_refined_schema_version!,
      computationVersion: second!.p_refined_computation_version!,
      inputSnapshot: second!.p_refined_input_snapshot!,
      parentNeedVersionId: EXISTING_ID,
    }),
  )
})

test("two conflicts in a row → unavailable / conflict, retryable", async () => {
  const { deps, calls } = createDeps({
    rpc: [
      { status: "plan_revision_conflict", currentRevision: 8 },
      { status: "draft_conflict", currentDraftId: null, currentDraftRevision: null },
    ],
  })
  assert.deepEqual(await run(deps), { status: "unavailable", reason: "conflict", retryable: true })
  assert.equal(calls.rebase.length, 2)
})

for (const code of ["40P01", "40001"]) {
  test(`RPC error with SQLSTATE ${code} is retried once`, async () => {
    const { deps, calls } = createDeps({ rpc: [pgError(code), rebased()] })
    assert.equal((await run(deps)).status, "rebased")
    assert.equal(calls.rebase.length, 2)
  })
}

test("two deadlocks in a row → unavailable / conflict", async () => {
  const { deps } = createDeps({ rpc: [pgError("40P01"), pgError("40P01")] })
  assert.deepEqual(await run(deps), { status: "unavailable", reason: "conflict", retryable: true })
})

test("RPC invalid_source → unavailable / invalid_source, not retried", async () => {
  const { deps, calls } = createDeps({
    rpc: [{ status: "invalid_source", reasonCode: "refined_head_without_draft" }],
  })
  assert.deepEqual(await run(deps), {
    status: "unavailable",
    reason: "invalid_source",
    retryable: false,
  })
  assert.equal(calls.rebase.length, 1)
})

test("a projection that cannot meet the refinement contract → invalid_source, no RPC call", async () => {
  const ids = [
    "current_product_categories",
    "wet_wash_frequency",
    "towel_handling",
    "drying_routes",
    "additional_heat_tools",
    "night_protection",
  ] as const
  const { deps, calls } = createDeps({
    draft: draft({
      answers: {
        currentProductCategories: [],
        wetWashFrequency: "bogus" as never,
        towel: { material: "frottee", technique: "rough_rubbing" },
        dryingRoutes: ["air_dry"],
        additionalHeatTools: [],
        nightProtection: [],
      },
      completedQuestionIds: [...ids],
      answerProvenance: Object.fromEntries(ids.map((id) => [id, "user"])),
    }),
  })
  assert.deepEqual(await run(deps), {
    status: "unavailable",
    reason: "invalid_source",
    retryable: false,
  })
  assert.equal(calls.rebase.length, 0)
})

test("a plan without a current initial version → invalid_source", async () => {
  const { deps } = createDeps({ plan: plan({ currentInitialNeedVersionId: null }) })
  assert.deepEqual(await run(deps), {
    status: "unavailable",
    reason: "invalid_source",
    retryable: false,
  })
})

test("RPC unchanged (raced to the same facts) → unchanged", async () => {
  const { deps } = createDeps({
    rpc: [{ status: "unchanged", initialNeedVersionId: CURRENT_INITIAL_ID, revision: 7 }],
  })
  assert.deepEqual(await run(deps), { status: "unchanged", personalPlanId: PLAN_ID })
})

test("a thrown dependency → unavailable / unexpected_error, retryable; never throws", async () => {
  for (const failing of [
    "loadPlan",
    "loadInitialVersion",
    "loadFacts",
    "findInitialVersionId",
    "loadSourceDraft",
    "rebase",
  ] as const) {
    const { deps } = createDeps()
    ;(deps as Record<string, unknown>)[failing] = async () => {
      throw new Error(`${failing} down`)
    }
    assert.deepEqual(
      await run(deps),
      { status: "unavailable", reason: "unexpected_error", retryable: true },
      failing,
    )
  }
})

test("a swallowed failure logs the error class and SQLSTATE, never the message (W02)", async (t) => {
  const logged: unknown[][] = []
  t.mock.method(console, "error", (...args: unknown[]) => {
    logged.push(args)
  })
  const { deps } = createDeps()
  // The real facts reader's messages carry the user id (src/lib/user-facts/read.ts).
  deps.loadFacts = async () => {
    throw new UserFactsReadError(`user_facts_read_failed for ${USER_ID}: boom`)
  }
  assert.deepEqual(await run(deps), {
    status: "unavailable",
    reason: "unexpected_error",
    retryable: true,
  })
  assert.deepEqual(logged, [
    ["personal_plan_facts_recompute", { event: "unexpected_error", error: "UserFactsReadError" }],
  ])
  assert.equal(JSON.stringify(logged).includes(USER_ID), false)

  logged.length = 0
  const second = createDeps()
  second.deps.rebase = async () => {
    throw Object.assign(new Error(`rpc failed for ${USER_ID}`), { code: "P0001" })
  }
  await run(second.deps)
  assert.deepEqual(logged, [
    ["personal_plan_facts_recompute", { event: "unexpected_error", error: "Error", code: "P0001" }],
  ])
})

test("an RPC result with an unknown status → unexpected_error", async () => {
  const { deps } = createDeps({
    rpc: [{ status: "surprise" } as unknown as PersonalPlanRebaseOnFactsResult],
  })
  assert.deepEqual(await run(deps), {
    status: "unavailable",
    reason: "unexpected_error",
    retryable: true,
  })
})
