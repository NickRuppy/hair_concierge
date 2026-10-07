import assert from "node:assert/strict"
import test from "node:test"

import {
  BEGIN_PERSONAL_PLAN_MIGRATION_RPC,
  RESOLVE_PERSONAL_PLAN_MIGRATION_RPC,
  beginOrBindPersonalPlanMigration,
  isPersonalPlanLegacyMigrationEnabled,
  resolvePersonalPlanMigrationAdmission,
} from "../src/lib/personal-plan/migration-admission"

type RpcCall = { name: string; args: Record<string, unknown> | undefined }

function rpcClient(responses: Record<string, unknown>, errors: Record<string, unknown> = {}) {
  const calls: RpcCall[] = []
  return {
    calls,
    async rpc(name: string, args?: Record<string, unknown>) {
      calls.push({ name, args })
      return { data: responses[name] ?? null, error: errors[name] ?? null }
    },
  }
}

const authorityDto = {
  admission_kind: "billing_subscription",
  admission_source_id: "22222222-2222-4222-8222-222222222222",
}

test("legacy migration admission is default-off for new candidate starts", async () => {
  assert.equal(isPersonalPlanLegacyMigrationEnabled({}), false)
  assert.equal(
    isPersonalPlanLegacyMigrationEnabled({ PERSONAL_PLAN_LEGACY_MIGRATION_ENABLED: "true" }),
    true,
  )
  assert.equal(
    isPersonalPlanLegacyMigrationEnabled({ PERSONAL_PLAN_LEGACY_MIGRATION_ENABLED: "TRUE" }),
    false,
  )

  const client = rpcClient({
    [RESOLVE_PERSONAL_PLAN_MIGRATION_RPC]: {
      status: "candidate",
      ...authorityDto,
    },
  })

  assert.deepEqual(
    await resolvePersonalPlanMigrationAdmission({
      client,
      userId: "user-1",
    }),
    { status: "ineligible" },
  )
  assert.deepEqual(client.calls, [
    {
      name: RESOLVE_PERSONAL_PLAN_MIGRATION_RPC,
      args: { p_user_id: "user-1" },
    },
  ])
})

test("resolve normalizes SQL snake_case admission rows when the gate is enabled", async () => {
  const client = rpcClient({
    [RESOLVE_PERSONAL_PLAN_MIGRATION_RPC]: {
      status: "ready",
      enrollment_id: "33333333-3333-4333-8333-333333333333",
      admitted_at: "2026-08-28T12:00:00.000Z",
      lead_id: "44444444-4444-4444-8444-444444444444",
      quiz_source_kind: "personal_plan",
      ...authorityDto,
    },
  })

  assert.deepEqual(
    await resolvePersonalPlanMigrationAdmission({
      client,
      userId: "user-1",
      release: { legacyMigrationEnabled: () => true },
    }),
    {
      status: "ready",
      enrollmentId: "33333333-3333-4333-8333-333333333333",
      admittedAt: "2026-08-28T12:00:00.000Z",
      authority: {
        kind: "billing_subscription",
        sourceId: "22222222-2222-4222-8222-222222222222",
      },
      leadId: "44444444-4444-4444-8444-444444444444",
      quizSourceKind: "personal_plan",
    },
  )
})

test("existing migration bindings remain readable while new starts are paused", async () => {
  const client = rpcClient({
    [RESOLVE_PERSONAL_PLAN_MIGRATION_RPC]: {
      status: "pending_source",
      enrollment_id: "33333333-3333-4333-8333-333333333333",
      admitted_at: "2026-08-28T12:00:00.000Z",
      lead_id: null,
      quiz_source_kind: null,
      admission_kind: "legacy_profile",
      admission_source_id: "user-1",
    },
  })

  assert.deepEqual(
    await beginOrBindPersonalPlanMigration({
      client,
      userId: "user-1",
      ownedLeadId: "44444444-4444-4444-8444-444444444444",
    }),
    {
      status: "pending_source",
      enrollmentId: "33333333-3333-4333-8333-333333333333",
      admittedAt: "2026-08-28T12:00:00.000Z",
      authority: { kind: "legacy_profile", sourceId: "user-1" },
      leadId: null,
      quizSourceKind: null,
    },
  )
  assert.deepEqual(
    client.calls.map((call) => call.name),
    [RESOLVE_PERSONAL_PLAN_MIGRATION_RPC],
  )
})

test("enabled begin binds only user and optional lead through the database RPC", async () => {
  const client = rpcClient({
    [BEGIN_PERSONAL_PLAN_MIGRATION_RPC]: {
      status: "ready",
      enrollment_id: "33333333-3333-4333-8333-333333333333",
      admitted_at: "2026-08-28T12:00:00.000Z",
      lead_id: "44444444-4444-4444-8444-444444444444",
      quiz_source_kind: "legacy",
      admission_kind: "one_time_purchase",
      admission_source_id: "55555555-5555-4555-8555-555555555555",
    },
  })

  assert.deepEqual(
    await beginOrBindPersonalPlanMigration({
      client,
      userId: "user-1",
      ownedLeadId: "44444444-4444-4444-8444-444444444444",
      release: { legacyMigrationEnabled: () => true },
    }),
    {
      status: "ready",
      enrollmentId: "33333333-3333-4333-8333-333333333333",
      admittedAt: "2026-08-28T12:00:00.000Z",
      authority: {
        kind: "one_time_purchase",
        sourceId: "55555555-5555-4555-8555-555555555555",
      },
      leadId: "44444444-4444-4444-8444-444444444444",
      quizSourceKind: "legacy",
    },
  )
  assert.deepEqual(client.calls, [
    {
      name: BEGIN_PERSONAL_PLAN_MIGRATION_RPC,
      args: {
        p_user_id: "user-1",
        p_requested_lead_id: "44444444-4444-4444-8444-444444444444",
      },
    },
  ])
  assert.equal(Object.hasOwn(client.calls[0]?.args ?? {}, "admission_kind"), false)
  assert.equal(Object.hasOwn(client.calls[0]?.args ?? {}, "admission_source_id"), false)
})

test("begin sends a null lead when the user still needs source recovery", async () => {
  const client = rpcClient({
    [BEGIN_PERSONAL_PLAN_MIGRATION_RPC]: {
      status: "pending_source",
      enrollment_id: "33333333-3333-4333-8333-333333333333",
      admitted_at: "2026-08-28T12:00:00.000Z",
      lead_id: null,
      quiz_source_kind: null,
      ...authorityDto,
    },
  })

  assert.deepEqual(
    await beginOrBindPersonalPlanMigration({
      client,
      userId: "user-1",
      release: { legacyMigrationEnabled: () => true },
    }),
    {
      status: "pending_source",
      enrollmentId: "33333333-3333-4333-8333-333333333333",
      admittedAt: "2026-08-28T12:00:00.000Z",
      authority: {
        kind: "billing_subscription",
        sourceId: "22222222-2222-4222-8222-222222222222",
      },
      leadId: null,
      quizSourceKind: null,
    },
  )
  assert.deepEqual(client.calls[0], {
    name: BEGIN_PERSONAL_PLAN_MIGRATION_RPC,
    args: { p_user_id: "user-1", p_requested_lead_id: null },
  })
})

test("malformed RPC payloads fail loudly instead of silently changing admission", async () => {
  const client = rpcClient({
    [RESOLVE_PERSONAL_PLAN_MIGRATION_RPC]: {
      status: "ready",
      enrollment_id: "33333333-3333-4333-8333-333333333333",
      admitted_at: "not-a-date",
      lead_id: null,
      quiz_source_kind: "legacy",
      admission_kind: "manual_access_grant",
      admission_source_id: "grant-1",
    },
  })

  await assert.rejects(
    resolvePersonalPlanMigrationAdmission({
      client,
      userId: "user-1",
      release: { legacyMigrationEnabled: () => true },
    }),
    /Invalid Personal Plan migration admission RPC payload/,
  )
})
