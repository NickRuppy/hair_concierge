import assert from "node:assert/strict"
import test from "node:test"
import { createPlanBereitStatusHandlers } from "../src/app/plan-bereit/status/route"

const userId = "10000000-0000-4000-8000-000000000001"
const leadId = "20000000-0000-4000-8000-000000000002"
const empty = {
  accessState: "none" as const,
  sourceId: null,
  paidAt: null,
  qualifiedAt: null,
  artifactLeadId: null,
  quizSourceKind: null,
  sourceKind: null,
}

function fixture() {
  const calls: string[] = []
  let bound = false
  const ready = {
    ...empty,
    accessState: "active" as const,
    sourceId: "migration",
    qualifiedAt: "2026-08-28T00:00:00Z",
    artifactLeadId: leadId,
    quizSourceKind: "legacy" as const,
    sourceKind: "migration" as const,
  }
  const deps = {
    createClient: async () =>
      ({
        auth: {
          getUser: async () => ({ data: { user: { id: userId, email: "test@example.invalid" } } }),
        },
      }) as never,
    createAdminClient: () => ({}) as never,
    hasCurrentAppAccess: async () => true,
    appAllowedForUser: async () => true,
    resolveOneTimeAccessState: async () => "none" as const,
    findEnrollment: async () => (bound ? ready : empty),
    resolveMigration: async () => {
      calls.push("read")
      return {
        status: "candidate" as const,
        authority: { kind: "legacy_profile" as const, sourceId: userId },
      }
    },
    beginMigration: async (input: { userId: string; ownedLeadId?: string | null }) => {
      calls.push("bind")
      assert.equal(input.userId, userId)
      assert.equal(input.ownedLeadId, leadId)
      bound = true
      return {
        status: "ready" as const,
        authority: { kind: "legacy_profile" as const, sourceId: userId },
        enrollmentId: "migration",
        leadId,
        admittedAt: ready.qualifiedAt,
        quizSourceKind: "legacy" as const,
      }
    },
    linkSource: async () => {
      calls.push("link")
      return {
        status: "ready" as const,
        leadId,
        quizSourceKind: "legacy" as const,
        sourceVersion: "v1",
        missingFacts: [],
      }
    },
    loadReadiness: async () => {
      calls.push("load")
      return {
        status: "ready" as const,
        leadId,
        quizSourceKind: "legacy" as const,
        sourceVersion: "v1",
        missingFacts: [],
        initialAction: "none" as const,
      }
    },
  }
  return { calls, deps }
}

test("readiness GET only discovers migration; POST binds the validated source before projection", async () => {
  const { calls, deps } = fixture()
  const handlers = createPlanBereitStatusHandlers(deps)
  const url = `http://localhost/plan-bereit/status?lead=${leadId}`
  const read = await handlers.GET(new Request(url))
  assert.deepEqual(await read.json(), { status: "source_pending", initialAction: "link" })
  assert.deepEqual(calls, ["read"])
  assert.equal(read.headers.get("Cache-Control"), "private, no-store")
  const write = await handlers.POST(
    new Request(url, { method: "POST", headers: { origin: "http://localhost" } }),
  )
  assert.equal((await write.json()).status, "ready")
  assert.deepEqual(calls, ["read", "bind", "link"])
})

test("migration preparation rejects cross-origin and expired-access requests before source writes", async () => {
  const { calls, deps } = fixture()
  const crossOrigin = await createPlanBereitStatusHandlers(deps).POST(
    new Request("http://localhost/plan-bereit/status", {
      method: "POST",
      headers: { origin: "https://elsewhere.example" },
    }),
  )
  assert.equal(crossOrigin.status, 403)
  const expired = await createPlanBereitStatusHandlers({
    ...deps,
    hasCurrentAppAccess: async () => false,
  }).POST(new Request("http://localhost/plan-bereit/status", { method: "POST" }))
  assert.equal(expired.status, 403)
  assert.deepEqual(calls, [])
})

test("paid-pending access returns its recovery status before migration discovery", async () => {
  const { calls, deps } = fixture()
  const response = await createPlanBereitStatusHandlers({
    ...deps,
    hasCurrentAppAccess: async () => false,
    resolveOneTimeAccessState: async () => "paid_pending" as const,
  }).GET(new Request("http://localhost/plan-bereit/status"))

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: "paid_pending" })
  assert.equal(response.headers.get("Cache-Control"), "private, no-store")
  assert.deepEqual(calls, [])
})

test("the app rollout cannot be bypassed by posting migration preparation directly", async () => {
  const { calls, deps } = fixture()
  const response = await createPlanBereitStatusHandlers({
    ...deps,
    appAllowedForUser: async () => false,
  } as never).POST(
    new Request(`http://localhost/plan-bereit/status?lead=${leadId}`, { method: "POST" }),
  )
  assert.equal(response.status, 403)
  assert.deepEqual(calls, [])
})
