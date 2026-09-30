import assert from "node:assert/strict"
import test from "node:test"

import * as answersRoute from "../src/app/api/profile/answers/route"
import { saveProfileAnswers, type ProfileAnswersSaveDeps } from "../src/lib/hair-profile/edit-route"
import { profileAnswersSchema, type ProfileAnswers } from "../src/lib/hair-profile/profile-answers"
import { deriveDiagnosticsColumns } from "../src/lib/user-facts/derive-legacy-columns"
import { diagnosticsV1Schema } from "../src/lib/user-facts/schema"

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

test("the answers route exposes only POST", () => {
  assert.deepEqual(Object.keys(answersRoute), ["POST"])
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
