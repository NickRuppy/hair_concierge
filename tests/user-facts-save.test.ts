import assert from "node:assert/strict"
import test from "node:test"

import {
  UserFactsValidationError,
  UserFactsWriteError,
  saveUserFacts,
} from "../src/lib/user-facts/save"
import type { CareHabitsPatch, DiagnosticsPatch } from "../src/lib/user-facts/schema"

type RpcCall = { fn: string; args: Record<string, unknown> }
type RpcResult = { data: unknown; error: { message: string } | null }

class FakeSupabase {
  readonly rpcCalls: RpcCall[] = []

  constructor(private readonly result: RpcResult) {}

  rpc(fn: string, args: Record<string, unknown>) {
    this.rpcCalls.push({ fn, args })
    return Promise.resolve(this.result)
  }
}

const VALID_PROVENANCE = {
  source: { kind: "personal_plan_artifact" as const, id: "artifact-1" },
  schemaVersion: 1,
  at: "2026-09-15T10:00:00.000Z",
}

const VALID_DIAGNOSTICS_PATCH: DiagnosticsPatch = {
  texture: "wavy",
  goals: ["moisture"],
}

test("saveUserFacts maps every input field to the exact RPC param names, defaulting omitted optionals", async () => {
  const db = new FakeSupabase({
    data: { status: "ok", revision: 1, changed: true, diagnosticsHash: "abc" },
    error: null,
  })

  const result = await saveUserFacts(db as never, {
    userId: "user-1",
    domain: "diagnostics",
    patch: VALID_DIAGNOSTICS_PATCH,
    provenance: VALID_PROVENANCE,
  })

  assert.deepEqual(db.rpcCalls, [
    {
      fn: "user_facts_save_v1",
      args: {
        p_user_id: "user-1",
        p_domain: "diagnostics",
        p_patch: VALID_DIAGNOSTICS_PATCH,
        p_provenance: VALID_PROVENANCE,
        p_expected_revision: null,
        p_mode: "upsert",
        p_source_draft_id: null,
        p_expected_draft_revision: null,
        p_expected_initial_version_id: null,
      },
    },
  ])
  assert.deepEqual(result, { status: "ok", revision: 1, changed: true, diagnosticsHash: "abc" })
})

test("saveUserFacts maps mode + draftBinding to p_mode:create_only and the three draft params", async () => {
  const db = new FakeSupabase({
    data: { status: "ok", revision: 2, changed: true, diagnosticsHash: null },
    error: null,
  })

  await saveUserFacts(db as never, {
    userId: "user-1",
    domain: "care_habits",
    patch: { wetWashFrequency: "weekly_2x" },
    provenance: VALID_PROVENANCE,
    mode: "create_only",
    draftBinding: {
      sourceDraftId: "draft-1",
      expectedDraftRevision: 3,
      expectedInitialVersionId: "version-1",
    },
  })

  assert.deepEqual(db.rpcCalls[0], {
    fn: "user_facts_save_v1",
    args: {
      p_user_id: "user-1",
      p_domain: "care_habits",
      p_patch: { wetWashFrequency: "weekly_2x" },
      p_provenance: VALID_PROVENANCE,
      p_expected_revision: null,
      p_mode: "create_only",
      p_source_draft_id: "draft-1",
      p_expected_draft_revision: 3,
      p_expected_initial_version_id: "version-1",
    },
  })
})

test("saveUserFacts returns each RPC status shape verbatim", async () => {
  const canned = [
    { status: "ok", revision: 5, changed: true, diagnosticsHash: "hash-1" },
    { status: "preserved", revision: 5, changed: false, diagnosticsHash: null },
    { status: "revision_conflict", revision: 7 },
    { status: "draft_conflict", reason: "not_found" },
  ]

  for (const data of canned) {
    const db = new FakeSupabase({ data, error: null })
    const result = await saveUserFacts(db as never, {
      userId: "user-1",
      domain: "quiz_context",
      patch: {},
      provenance: VALID_PROVENANCE,
    })
    assert.deepEqual(result, data)
  }
})

test("saveUserFacts throws UserFactsValidationError for an invalid patch, without calling the RPC", async () => {
  const unknownKeyDb = new FakeSupabase({ data: null, error: null })
  await assert.rejects(
    () =>
      saveUserFacts(unknownKeyDb as never, {
        userId: "user-1",
        domain: "diagnostics",
        patch: { unexpectedField: "nope" } as never,
        provenance: VALID_PROVENANCE,
      }),
    UserFactsValidationError,
  )
  assert.equal(unknownKeyDb.rpcCalls.length, 0)

  const badEnumDb = new FakeSupabase({ data: null, error: null })
  await assert.rejects(
    () =>
      saveUserFacts(badEnumDb as never, {
        userId: "user-1",
        domain: "diagnostics",
        patch: { texture: "not_a_texture" } as never,
        provenance: VALID_PROVENANCE,
      }),
    UserFactsValidationError,
  )
  assert.equal(badEnumDb.rpcCalls.length, 0)

  const nullSourceDb = new FakeSupabase({ data: null, error: null })
  await assert.rejects(
    () =>
      saveUserFacts(nullSourceDb as never, {
        userId: "user-1",
        domain: "diagnostics",
        patch: { source: null } as never,
        provenance: VALID_PROVENANCE,
      }),
    UserFactsValidationError,
  )
  assert.equal(nullSourceDb.rpcCalls.length, 0)
})

test("saveUserFacts throws UserFactsWriteError on transport error, invalid_input, and an unrecognized payload", async () => {
  const transportErrorDb = new FakeSupabase({ data: null, error: { message: "boom" } })
  await assert.rejects(
    () =>
      saveUserFacts(transportErrorDb as never, {
        userId: "user-1",
        domain: "quiz_context",
        patch: {},
        provenance: VALID_PROVENANCE,
      }),
    UserFactsWriteError,
  )

  const invalidInputDb = new FakeSupabase({
    data: { status: "invalid_input", reason: "unknown_domain" },
    error: null,
  })
  try {
    await saveUserFacts(invalidInputDb as never, {
      userId: "user-1",
      domain: "quiz_context",
      patch: {},
      provenance: VALID_PROVENANCE,
    })
    assert.fail("expected saveUserFacts to throw for invalid_input")
  } catch (thrown) {
    assert.ok(thrown instanceof UserFactsWriteError)
    // Fix round 1: invalid_input carries the RPC's own reason as a structured field.
    assert.equal(thrown.reason, "unknown_domain")
  }

  const unknownStatusDb = new FakeSupabase({ data: { status: "surprising" }, error: null })
  try {
    await saveUserFacts(unknownStatusDb as never, {
      userId: "user-1",
      domain: "quiz_context",
      patch: {},
      provenance: VALID_PROVENANCE,
    })
    assert.fail("expected saveUserFacts to throw for an unrecognised payload")
  } catch (thrown) {
    assert.ok(thrown instanceof UserFactsWriteError)
    // Fix round 1: the raw payload is a structured field, not JSON-stringified into the message.
    assert.deepEqual(thrown.payload, { status: "surprising" })
    assert.equal(thrown.message.includes("surprising"), false)
  }
})

test("saveUserFacts forwards a null-clearing patch unchanged after validation", async () => {
  const db = new FakeSupabase({
    data: { status: "ok", revision: 1, changed: true, diagnosticsHash: null },
    error: null,
  })
  const patch = { concernRecurrence: null }

  await saveUserFacts(db as never, {
    userId: "user-1",
    domain: "diagnostics",
    patch,
    provenance: VALID_PROVENANCE,
  })

  assert.deepEqual(db.rpcCalls[0].args.p_patch, { concernRecurrence: null })
})
