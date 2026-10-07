import assert from "node:assert/strict"
import test from "node:test"

import * as answersRoute from "../src/app/api/profile/answers/route"
import {
  createProfileAnswersPost,
  saveProfileAnswers,
  type ProfileAnswersSaveDeps,
} from "../src/lib/hair-profile/edit-route"
import { profileAnswersSchema, type ProfileAnswers } from "../src/lib/hair-profile/profile-answers"
import type {
  SyncPlanWithFacts,
  SyncPlanWithFactsResult,
} from "../src/lib/personal-plan/facts-recompute/types"
import { ProfileEditError } from "../src/lib/scan/profile-edit"
import { deriveDiagnosticsColumns } from "../src/lib/user-facts/derive-legacy-columns"
import { diagnosticsV1Schema } from "../src/lib/user-facts/schema"
import { ERR_INVALID_DATA } from "../src/lib/vocabulary"

/**
 * Clean-switch task 5: `saveProfileAnswers` — the service behind `POST /api/profile/answers`.
 * Every save goes through `user_facts_save_v1`: a complete profile through the scanner
 * publisher's facts path (one transaction with the scanner context), anything else straight
 * through the door. Nothing writes a hair_profiles column directly.
 */

const userId = "11111111-1111-4111-8111-111111111111"
const NOW = "2026-09-30T12:00:00.000Z"

const diagnostics = diagnosticsV1Schema.parse({
  texture: "wavy",
  thickness: "fine",
  density: "medium",
  hairLength: "long",
  hairSurface: "smooth",
  elasticResponse: "stretches_bounces",
  chemicalTreatments: ["natural"],
  scalpOiliness: "balanced",
  scalpConcerns: [],
  goals: ["moisture"],
  currentConcerns: ["dry_lengths"],
  source: {
    kind: "legacy_quiz",
    version: 1,
    leadId: "lead-1",
    raw: { kind: "legacy_quiz", version: 1, leadId: "lead-1", answers: {} },
  },
})

const completeRow = {
  user_id: userId,
  ...deriveDiagnosticsColumns(diagnostics),
  diagnostics,
  facts_provenance: {
    diagnostics: {
      source: { kind: "legacy_lead", id: "lead-1" },
      schemaVersion: 1,
      at: "2026-09-01T00:00:00.000Z",
    },
  },
  facts_revision: 4,
}

function answers(body: unknown): ProfileAnswers {
  return profileAnswersSchema.parse(body)
}

function makeDeps(overrides: Partial<ProfileAnswersSaveDeps> & { row?: unknown } = {}) {
  const calls = { publish: [] as unknown[], door: [] as unknown[], loads: 0 }
  const row = "row" in overrides ? overrides.row : completeRow
  const deps: ProfileAnswersSaveDeps = {
    createAdminClient: () => ({}) as never,
    readScannerProfileSource: async () =>
      ({ userId, sourceRevision: "3", profileRevision: "7", profile: row }) as never,
    prepareScannerContext: () => ({}) as never,
    publishProfileEdit: async (_client, ownerId, input) => {
      calls.publish.push({ ownerId, input })
      return {
        profileRevision: "8",
        contextRevision: "ctx-9",
        profile: { user_id: ownerId, published: true },
        prepared: {} as never,
        quizAnswers: {} as never,
      }
    },
    saveUserFacts: async (_admin, input) => {
      calls.door.push(input)
      return { status: "ok", revision: 5, changed: true, diagnosticsHash: null }
    },
    loadProfileRow: async () => {
      calls.loads += 1
      return { user_id: userId, reloaded: true }
    },
    randomUUID: () => "22222222-2222-4222-8222-222222222222",
    now: () => NOW,
    ...overrides,
  }
  return { deps, calls }
}

test("the answers route exposes only POST (plus the maxDuration route config)", () => {
  assert.deepEqual(
    Object.keys(answersRoute).filter((key) => key !== "maxDuration"),
    ["POST"],
  )
  assert.equal(answersRoute.maxDuration, 60)
})

test("a complete profile is saved through the publisher's facts path with the server-read revision", async () => {
  const { deps, calls } = makeDeps()
  const result = await saveProfileAnswers(deps, userId, answers({ goals: ["shine"] }))
  assert.deepEqual(result, {
    kind: "published",
    profile: { user_id: userId, published: true },
    profileRevision: "8",
    contextRevision: "ctx-9",
  })
  assert.deepEqual(calls.publish, [
    {
      ownerId: userId,
      input: {
        expectedProfileRevision: "7",
        requestId: "22222222-2222-4222-8222-222222222222",
        profileAnswers: { goals: ["shine"] },
      },
    },
  ])
  assert.equal(calls.door.length, 0)
})

test("a profile that stays incomplete is saved straight through the door with the facts revision", async () => {
  const { deps, calls } = makeDeps({ prepareScannerContext: () => null })
  const result = await saveProfileAnswers(deps, userId, answers({ goals: ["shine"] }))
  assert.deepEqual(result, { kind: "saved", profile: { user_id: userId, reloaded: true } })
  assert.equal(calls.publish.length, 0)
  assert.equal(calls.door.length, 1)
  const door = calls.door[0] as {
    userId: string
    domain: string
    expectedRevision: number
    patch: Record<string, unknown>
    provenance: { editedAt?: string; source: { kind: string } }
  }
  assert.equal(door.userId, userId)
  assert.equal(door.domain, "diagnostics")
  assert.equal(door.expectedRevision, 4)
  assert.deepEqual(door.patch, { goals: ["shine"] })
  assert.equal(door.provenance.editedAt, NOW)
  assert.equal(door.provenance.source.kind, "profile_editor")
})

test("a user without a profile row: the door creates it with what was entered (expected revision 0)", async () => {
  const { deps, calls } = makeDeps({ row: null, prepareScannerContext: () => null })
  await saveProfileAnswers(deps, userId, answers({ goals: ["moisture", "shine"] }))
  const door = calls.door[0] as { expectedRevision: number; patch: Record<string, unknown> }
  assert.equal(door.expectedRevision, 0)
  assert.deepEqual(door.patch.goals, ["moisture", "shine"])
  assert.equal((door.patch.source as { kind: string }).kind, "legacy_quiz")
})

test("a profile that is incomplete after the edit goes through the door, never the publisher", async () => {
  // The scanner can prepare a context (a lead exists), but the profile has no scalp answer.
  const { scalpOiliness: _oiliness, scalpConcerns: _concerns, ...rest } = diagnostics
  void _oiliness
  void _concerns
  const partial = diagnosticsV1Schema.parse(rest)
  const incomplete = { ...completeRow, ...deriveDiagnosticsColumns(partial), diagnostics: partial }
  const { deps, calls } = makeDeps({ row: incomplete })
  await saveProfileAnswers(deps, userId, answers({ texture: "curly" }))
  assert.equal(calls.publish.length, 0)
  assert.equal(calls.door.length, 1)
})

test("fix round 2 (1): a save that changes no value writes nothing and publishes nothing", async () => {
  for (const prepare of [() => ({}) as never, () => null]) {
    const { deps, calls } = makeDeps({ prepareScannerContext: prepare })
    const result = await saveProfileAnswers(deps, userId, answers({ goals: ["moisture"] }))
    assert.deepEqual(result, { kind: "saved", profile: completeRow })
    assert.equal(calls.publish.length, 0)
    assert.equal(calls.door.length, 0)
  }
})

test("stale revision: the door's conflict is a profile_conflict, nothing else is written", async () => {
  const { deps, calls } = makeDeps({
    prepareScannerContext: () => null,
    saveUserFacts: async (_admin, input) => {
      calls.door.push(input)
      return { status: "revision_conflict", revision: 9 }
    },
  })
  await assert.rejects(saveProfileAnswers(deps, userId, answers({ goals: ["shine"] })), {
    code: "profile_conflict",
  })
  assert.equal(calls.loads, 0)
})

test("a source read outage is temporarily_unavailable and writes nothing", async () => {
  const { deps, calls } = makeDeps({
    readScannerProfileSource: async () => {
      throw new Error("database unavailable")
    },
  })
  await assert.rejects(saveProfileAnswers(deps, userId, answers({ goals: ["shine"] })), {
    code: "temporarily_unavailable",
  })
  assert.equal(calls.door.length + calls.publish.length, 0)
})

test("corrupt stored facts are temporarily_unavailable, never overwritten", async () => {
  const { deps, calls } = makeDeps({
    row: { ...completeRow, diagnostics: { texture: "not-a-texture" } },
  })
  await assert.rejects(saveProfileAnswers(deps, userId, answers({ goals: ["shine"] })), {
    code: "temporarily_unavailable",
  })
  assert.equal(calls.door.length + calls.publish.length, 0)
})

test("a door failure other than a conflict is temporarily_unavailable", async () => {
  const { deps } = makeDeps({
    prepareScannerContext: () => null,
    saveUserFacts: async () => ({ status: "draft_conflict", reason: "not_found" }),
  })
  await assert.rejects(saveProfileAnswers(deps, userId, answers({ goals: ["shine"] })), {
    code: "temporarily_unavailable",
  })
})

// ---------------------------------------------------------------------------
// Fix round 2 (7): the HTTP handler itself
// ---------------------------------------------------------------------------

function handler(overrides: { userId?: string | null; save?: () => Promise<never> } = {}) {
  const saves: unknown[] = []
  const POST = createProfileAnswersPost({
    getUserId: async () => ("userId" in overrides ? overrides.userId! : userId),
    save: async (owner, body) => {
      saves.push({ owner, body })
      if (overrides.save) return overrides.save()
      return { kind: "saved", profile: { user_id: owner } }
    },
  })
  return { POST, saves }
}

const request = (body: unknown) =>
  new Request("http://localhost/api/profile/answers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })

test("fix round 2 (7) adversarial: a legacy-vocabulary payload is a 400 at the route, nothing is read or saved", async () => {
  for (const body of [
    { goals: ["volume"] },
    { goals: ["less_volume", "healthier_hair"] },
    { currentConcerns: ["dryness"] },
    { hair_texture: "wavy" },
    { concerns: ["frizz"] },
    { hairSurface: "slightly_rough" },
    { chemicalTreatments: ["bleached"] },
    { scalpConcerns: ["dandruff"] },
    { goals: ["shine"], desired_volume: "more" },
    {},
  ]) {
    const { POST, saves } = handler()
    const response = await POST(request(body))
    assert.equal(response.status, 400, JSON.stringify(body))
    assert.deepEqual(await response.json(), { error: ERR_INVALID_DATA })
    assert.equal(saves.length, 0, JSON.stringify(body))
  }
  const { POST, saves } = handler()
  assert.equal((await POST(request("{not json"))).status, 400)
  assert.equal(saves.length, 0)
})

test("fix round 2 (7): the route answers 401 without a session, 409 on a conflict, 503 otherwise", async () => {
  const anonymous = handler({ userId: null })
  assert.equal((await anonymous.POST(request({ goals: ["shine"] }))).status, 401)
  assert.equal(anonymous.saves.length, 0)

  const conflict = handler({
    save: async () => {
      throw new ProfileEditError("profile_conflict")
    },
  })
  const conflicted = await conflict.POST(request({ goals: ["shine"] }))
  assert.equal(conflicted.status, 409)
  assert.deepEqual(await conflicted.json(), { error: "profile_conflict" })

  const outage = handler({
    save: async () => {
      throw new Error("boom")
    },
  })
  assert.equal((await outage.POST(request({ goals: ["shine"] }))).status, 503)

  const ok = handler()
  const saved = await ok.POST(request({ goals: ["shine"] }))
  assert.equal(saved.status, 200)
  assert.deepEqual(await saved.json(), { hairProfile: { user_id: userId } })
  assert.deepEqual(ok.saves, [{ owner: userId, body: { goals: ["shine"] } }])
})

// ---------------------------------------------------------------------------
// Central profile PR2 task 5(a): a saved profile moves the plan
// (plans/2026-10-03-central-user-profile-pr2.md §4a "Profile route response")
// ---------------------------------------------------------------------------

type RoutineInput = { userId: string; personalPlanId: string; refinedVersionId: string }
type RoutineResult = { status: "applied" | "unchanged" | "unavailable" }

function planDeps(
  lane: SyncPlanWithFactsResult | (() => Promise<SyncPlanWithFactsResult>),
  routine?: RoutineResult | (() => Promise<RoutineResult>),
  overrides: Partial<ProfileAnswersSaveDeps> = {},
) {
  const calls = { lane: [] as unknown[], routine: [] as RoutineInput[] }
  const syncPlanWithFacts: SyncPlanWithFacts = async (input) => {
    calls.lane.push(input)
    return typeof lane === "function" ? lane() : lane
  }
  const recomputeRoutine = async (input: RoutineInput): Promise<RoutineResult> => {
    calls.routine.push(input)
    if (routine === undefined) throw new Error("recompute not expected")
    return typeof routine === "function" ? routine() : routine
  }
  const { deps } = makeDeps({ syncPlanWithFacts, recomputeRoutine, ...overrides })
  return { deps, calls }
}

const rebased = (
  overrides: Partial<Extract<SyncPlanWithFactsResult, { status: "rebased" }>> = {},
): SyncPlanWithFactsResult => ({
  status: "rebased",
  personalPlanId: "plan-1",
  initialNeedVersionId: "initial-2",
  refinedVersionId: "refined-2",
  activeRoutineVersionId: "routine-1",
  ...overrides,
})

/** Both save paths: the scanner publish path (default) and the facts door path. */
const SAVE_PATHS = [
  { name: "publish path", overrides: {} as Partial<ProfileAnswersSaveDeps>, kind: "published" },
  {
    name: "door path",
    overrides: { prepareScannerContext: () => null } as Partial<ProfileAnswersSaveDeps>,
    kind: "saved",
  },
] as const

test("plan sync: without the dep the result carries no plan field (today's behaviour)", async () => {
  for (const path of SAVE_PATHS) {
    const { deps } = makeDeps(path.overrides)
    const result = await saveProfileAnswers(deps, userId, answers({ goals: ["shine"] }))
    assert.equal(result.kind, path.kind)
    assert.equal("plan" in result, false, path.name)
  }
})

test("plan sync: both save paths call the lane exactly once, after the save", async () => {
  for (const path of SAVE_PATHS) {
    const order: string[] = []
    const { deps, calls } = planDeps({ status: "no_plan" }, undefined, {
      ...path.overrides,
      publishProfileEdit: async (...args) => {
        order.push("save")
        return makeDeps().deps.publishProfileEdit(...args)
      },
      saveUserFacts: async () => {
        order.push("save")
        return { status: "ok", revision: 5, changed: true, diagnosticsHash: null }
      },
      syncPlanWithFacts: async () => {
        order.push("lane")
        return { status: "no_plan" }
      },
    })
    await saveProfileAnswers(deps, userId, answers({ goals: ["shine"] }))
    assert.deepEqual(order, ["save", "lane"], path.name)
    assert.equal(calls.routine.length, 0)
  }
})

test("plan sync: the lane is called with the session user", async () => {
  const { deps, calls } = planDeps({ status: "no_plan" })
  await saveProfileAnswers(deps, userId, answers({ goals: ["shine"] }))
  assert.deepEqual(calls.lane, [{ userId }])
})

test("plan sync: no_plan leaves the plan field out", async () => {
  for (const path of SAVE_PATHS) {
    const { deps } = planDeps({ status: "no_plan" }, undefined, path.overrides)
    const result = await saveProfileAnswers(deps, userId, answers({ goals: ["shine"] }))
    assert.equal("plan" in result, false, path.name)
  }
})

test("plan sync: a save that changes no value never calls the lane and has no plan field", async () => {
  for (const prepare of [() => ({}) as never, () => null]) {
    const { deps, calls } = planDeps(
      rebased(),
      { status: "applied" },
      {
        prepareScannerContext: prepare,
      },
    )
    const result = await saveProfileAnswers(deps, userId, answers({ goals: ["moisture"] }))
    assert.deepEqual(result, { kind: "saved", profile: completeRow })
    assert.equal(calls.lane.length, 0)
    assert.equal(calls.routine.length, 0)
  }
})

test("plan sync: unchanged lane result -> outcome unchanged, no routine recompute", async () => {
  for (const path of SAVE_PATHS) {
    const { deps, calls } = planDeps(
      { status: "unchanged", personalPlanId: "plan-1" },
      undefined,
      path.overrides,
    )
    const result = await saveProfileAnswers(deps, userId, answers({ goals: ["shine"] }))
    assert.deepEqual(result.plan, { outcome: "unchanged" }, path.name)
    assert.equal(calls.routine.length, 0)
  }
})

test("plan sync: rebased without an active routine -> applied, recompute not called", async () => {
  const { deps, calls } = planDeps(rebased({ activeRoutineVersionId: null }))
  const result = await saveProfileAnswers(deps, userId, answers({ goals: ["shine"] }))
  assert.deepEqual(result.plan, { outcome: "applied" })
  assert.equal(calls.routine.length, 0)
})

test("plan sync: rebased without a refined version -> applied, recompute not called", async () => {
  const { deps, calls } = planDeps(rebased({ refinedVersionId: null }))
  const result = await saveProfileAnswers(deps, userId, answers({ goals: ["shine"] }))
  assert.deepEqual(result.plan, { outcome: "applied" })
  assert.equal(calls.routine.length, 0)
})

test("plan sync: rebased with an active routine recomputes it on the new refined version", async () => {
  for (const [routine, outcome] of [
    ["applied", "applied"],
    ["unchanged", "unchanged"],
    ["unavailable", "unavailable"],
  ] as const) {
    for (const path of SAVE_PATHS) {
      const { deps, calls } = planDeps(rebased(), { status: routine }, path.overrides)
      const result = await saveProfileAnswers(deps, userId, answers({ goals: ["shine"] }))
      assert.deepEqual(result.plan, { outcome }, `${path.name} / ${routine}`)
      assert.deepEqual(calls.routine, [
        { userId, personalPlanId: "plan-1", refinedVersionId: "refined-2" },
      ])
    }
  }
})

test("plan sync: rebased with an active routine but no recompute dep is unavailable", async () => {
  const { deps } = makeDeps({ syncPlanWithFacts: async () => rebased() })
  const result = await saveProfileAnswers(deps, userId, answers({ goals: ["shine"] }))
  assert.deepEqual(result.plan, { outcome: "unavailable" })
})

test("plan sync: an unavailable lane result -> unavailable, no recompute, reason never leaks", async () => {
  const { deps, calls } = planDeps({
    status: "unavailable",
    reason: "facts_not_computable",
    retryable: false,
  })
  const result = await saveProfileAnswers(deps, userId, answers({ goals: ["shine"] }))
  assert.deepEqual(result.plan, { outcome: "unavailable" })
  assert.equal(calls.routine.length, 0)
})

test("plan sync: a throwing lane never fails the save", async () => {
  for (const path of SAVE_PATHS) {
    const { deps } = planDeps(
      async () => {
        throw new Error("lane boom")
      },
      undefined,
      path.overrides,
    )
    const result = await saveProfileAnswers(deps, userId, answers({ goals: ["shine"] }))
    assert.equal(result.kind, path.kind)
    assert.deepEqual(result.plan, { outcome: "unavailable" }, path.name)
  }
})

test("plan sync: a throwing routine recompute never fails the save", async () => {
  const { deps } = planDeps(rebased(), async () => {
    throw new Error("routine boom")
  })
  const result = await saveProfileAnswers(deps, userId, answers({ goals: ["shine"] }))
  assert.equal(result.kind, "published")
  assert.deepEqual(result.plan, { outcome: "unavailable" })
})

test("plan sync: a failed save never calls the lane", async () => {
  const lane = { calls: 0 }
  const syncPlanWithFacts: SyncPlanWithFacts = async () => {
    lane.calls += 1
    return rebased()
  }
  const failures: Array<[Partial<ProfileAnswersSaveDeps>, string]> = [
    [
      {
        prepareScannerContext: () => null,
        saveUserFacts: async () => ({ status: "revision_conflict", revision: 9 }),
      },
      "profile_conflict",
    ],
    [
      {
        prepareScannerContext: () => null,
        saveUserFacts: async () => ({ status: "draft_conflict", reason: "not_found" }),
      },
      "temporarily_unavailable",
    ],
    [
      {
        publishProfileEdit: async () => {
          throw new ProfileEditError("profile_conflict")
        },
      },
      "profile_conflict",
    ],
    [
      {
        readScannerProfileSource: async () => {
          throw new Error("database unavailable")
        },
      },
      "temporarily_unavailable",
    ],
    [
      {
        prepareScannerContext: () => null,
        loadProfileRow: async () => {
          throw new Error("read back failed")
        },
      },
      "temporarily_unavailable",
    ],
  ]
  for (const [overrides, code] of failures) {
    const { deps } = makeDeps({ ...overrides, syncPlanWithFacts })
    await assert.rejects(saveProfileAnswers(deps, userId, answers({ goals: ["shine"] })), { code })
  }
  assert.equal(lane.calls, 0)
})

test("plan sync: the lane and routine outcome are logged without user data", async () => {
  const originalInfo = console.info
  const infos: Array<[string, Record<string, unknown>]> = []
  console.info = ((event: string, details: Record<string, unknown>) => {
    infos.push([event, details])
  }) as typeof console.info
  try {
    const { deps } = planDeps(rebased(), { status: "unavailable" })
    await saveProfileAnswers(deps, userId, answers({ goals: ["shine"] }))
  } finally {
    console.info = originalInfo
  }
  const timing = infos.find(([event]) => event === "personal_plan_transition_performance")
  assert.equal(timing?.[1].operation, "profile_answers_plan_sync")
  assert.equal(timing?.[1].outcome, "unavailable")
  const log = infos.find(([event]) => event === "profile_answers_api")
  assert.deepEqual(log?.[1], {
    event: "plan_sync",
    lane: "rebased",
    routine: "unavailable",
    outcome: "unavailable",
  })
  assert.equal(JSON.stringify(infos).includes(userId), false)
})

test("plan sync: the 200 body carries plan on both response shapes and omits it otherwise", async () => {
  const saved = createProfileAnswersPost({
    getUserId: async () => userId,
    save: async () => ({
      kind: "saved",
      profile: { user_id: userId },
      plan: { outcome: "applied" },
    }),
  })
  const savedResponse = await saved(request({ goals: ["shine"] }))
  assert.equal(savedResponse.status, 200)
  assert.deepEqual(await savedResponse.json(), {
    hairProfile: { user_id: userId },
    plan: { outcome: "applied" },
  })

  const published = createProfileAnswersPost({
    getUserId: async () => userId,
    save: async () => ({
      kind: "published",
      profile: { user_id: userId },
      profileRevision: "8",
      contextRevision: "ctx-9",
      plan: { outcome: "unavailable" },
    }),
  })
  assert.deepEqual(await (await published(request({ goals: ["shine"] }))).json(), {
    hairProfile: { user_id: userId },
    profileRevision: "8",
    contextRevision: "ctx-9",
    plan: { outcome: "unavailable" },
  })

  const without = createProfileAnswersPost({
    getUserId: async () => userId,
    save: async () => ({ kind: "saved", profile: { user_id: userId } }),
  })
  assert.deepEqual(await (await without(request({ goals: ["shine"] }))).json(), {
    hairProfile: { user_id: userId },
  })
})
