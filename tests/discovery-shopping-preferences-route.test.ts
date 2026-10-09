import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest, NextResponse } from "next/server"

import { createDiscoveryShoppingPreferencesHandler } from "../src/app/api/admin/beratung/[enrollmentId]/shopping-preferences/route"
import type { DiscoveryCallIntake } from "../src/lib/discovery/cockpit"
import type { ShoppingBudget } from "../src/lib/user-facts/schema"
import { saveUserFacts } from "../src/lib/user-facts/save"

/**
 * `PUT /api/admin/beratung/<id>/shopping-preferences`, driven through its REAL guard and the
 * REAL facts-door client (`saveUserFacts` validates the patch and the provenance; only the
 * Supabase RPC is faked): same-origin, kill switch, admin, intake, budget flag, freeze, body,
 * then a compare-and-set write for the CUSTOMER with provenance `consultation_staff`.
 */

const ids = {
  enrollment: "3f1a6f2e-2b44-4a1e-9a1a-6f2e2b444a1e",
  intake: "40000000-0000-4000-8000-000000000001",
  customer: "20000000-0000-4000-8000-000000000002",
}

const intake: DiscoveryCallIntake = {
  id: ids.intake,
  enrollmentId: ids.enrollment,
  userId: ids.customer,
  state: "submitted",
  submittedAt: "2026-09-20T18:41:00.000Z",
  callFinalizedAt: null,
  finalizedSourceHash: null,
}

const CAPPED: ShoppingBudget = { kind: "capped", limitEur: 5, allowExceptions: false }
const REQUEST_URL = `https://chaarlie.de/api/admin/beratung/${ids.enrollment}/shopping-preferences`
const params = { params: Promise.resolve({ enrollmentId: ids.enrollment }) }

function put(body: unknown, headers: Record<string, string> = { origin: "https://chaarlie.de" }) {
  return new NextRequest(REQUEST_URL, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

type RpcCall = { fn: string; args: Record<string, unknown> }

function setup(
  options: {
    rpcResult?: unknown
    rpcError?: boolean
    storedRevision?: number | null
    overrides?: Record<string, unknown>
  } = {},
) {
  const rpcCalls: RpcCall[] = []
  const loads: string[] = []
  const admin = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args })
      return options.rpcError
        ? { data: null, error: { message: "db down" } }
        : {
            data: options.rpcResult ?? {
              status: "ok",
              revision: 8,
              changed: true,
              diagnosticsHash: null,
            },
            error: null,
          }
    },
  }
  const handler = createDiscoveryShoppingPreferencesHandler({
    flagEnabled: () => true,
    requireAdmin: async () => ({ userId: "admin-1" }),
    createAdminClient: () => admin as never,
    loadIntake: async () => intake,
    isBudgetEnabled: () => true,
    loadFacts: (async (_client: unknown, userId: string) => {
      loads.push(userId)
      return options.storedRevision === null ? null : { revision: options.storedRevision ?? 7 }
    }) as never,
    saveFacts: saveUserFacts,
    now: () => "2026-10-09T10:00:00.000Z",
    ...options.overrides,
  })
  return { handler, rpcCalls, loads }
}

async function code(response: Response): Promise<string | undefined> {
  return ((await response.json()) as { code?: string }).code
}

test("saves the budget for the customer through the facts door with consultation_staff provenance and a CAS on the read revision", async () => {
  const { handler, rpcCalls, loads } = setup()
  const response = await handler(put({ budget: CAPPED }), params)

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { budget: CAPPED, revision: 8 })
  assert.equal(response.headers.get("cache-control"), "private, no-store")
  assert.deepEqual(loads, [ids.customer])
  assert.equal(rpcCalls.length, 1)
  assert.equal(rpcCalls[0].fn, "user_facts_save_v1")
  assert.equal(rpcCalls[0].args.p_user_id, ids.customer)
  assert.equal(rpcCalls[0].args.p_domain, "shopping_preferences")
  assert.deepEqual(rpcCalls[0].args.p_patch, { budget: CAPPED })
  assert.equal(rpcCalls[0].args.p_expected_revision, 7)
  assert.deepEqual(rpcCalls[0].args.p_provenance, {
    source: { kind: "consultation_staff", id: ids.enrollment },
    schemaVersion: 1,
    at: "2026-10-09T10:00:00.000Z",
    fields: { budget: "user" },
  })
})

test("uncapped is stored whole; a customer without a facts row counts as revision 0", async () => {
  const { handler, rpcCalls } = setup({ storedRevision: null })
  const response = await handler(put({ budget: { kind: "uncapped" } }), params)
  assert.equal(response.status, 200)
  assert.deepEqual(rpcCalls[0].args.p_patch, { budget: { kind: "uncapped" } })
  assert.equal(rpcCalls[0].args.p_expected_revision, 0)
})

test("a cross-origin or origin-less request is refused before anything else", async () => {
  let guarded = 0
  const { handler, rpcCalls } = setup({
    overrides: {
      requireAdmin: async () => {
        guarded += 1
        return { userId: "admin-1" }
      },
    },
  })
  for (const headers of [{ origin: "https://evil.example" }, {}] as Array<Record<string, string>>) {
    const response = await handler(put({ budget: CAPPED }, headers), params)
    assert.equal(response.status, 403)
    assert.equal(await code(response), "cross_origin")
  }
  assert.equal(guarded, 0)
  assert.equal(rpcCalls.length, 0)
})

test("the shared guard decides: kill switch 404, admin refusals pass through, no intake 404", async () => {
  const off = await setup({ overrides: { flagEnabled: () => false } }).handler(
    put({ budget: CAPPED }),
    params,
  )
  assert.equal(off.status, 404)

  for (const status of [401, 403]) {
    const { handler, rpcCalls } = setup({
      overrides: {
        requireAdmin: async () => ({
          response: NextResponse.json({ error: "Nicht erlaubt." }, { status }),
        }),
      },
    })
    assert.equal((await handler(put({ budget: CAPPED }), params)).status, status)
    assert.equal(rpcCalls.length, 0)
  }

  const missing = await setup({ overrides: { loadIntake: async () => null } }).handler(
    put({ budget: CAPPED }),
    params,
  )
  assert.equal(missing.status, 404)
  assert.equal(await code(missing), "not_found")
})

test("the budget flag off answers 404 and writes nothing", async () => {
  const { handler, rpcCalls, loads } = setup({ overrides: { isBudgetEnabled: () => false } })
  const response = await handler(put({ budget: CAPPED }), params)
  assert.equal(response.status, 404)
  assert.equal(await code(response), "not_found")
  assert.equal(rpcCalls.length, 0)
  assert.equal(loads.length, 0)
})

test("a finalized call refuses the edit with 409 finalized and writes nothing", async () => {
  const { handler, rpcCalls, loads } = setup({
    overrides: {
      loadIntake: async () => ({ ...intake, callFinalizedAt: "2026-10-09T09:00:00.000Z" }),
    },
  })
  const response = await handler(put({ budget: CAPPED }), params)
  assert.equal(response.status, 409)
  assert.equal(await code(response), "finalized")
  assert.equal(rpcCalls.length, 0)
  assert.equal(loads.length, 0)
})

test("anything but a strict valid { budget } is a 400 before any read or write", async () => {
  const { handler, rpcCalls, loads } = setup()
  for (const body of [
    "not json",
    {},
    { budget: null },
    { budget: { kind: "capped", limitEur: 7, allowExceptions: true } },
    { budget: { kind: "capped", limitEur: 5 } },
    { budget: { kind: "uncapped", limitEur: 5 } },
    { budget: CAPPED, userId: "someone-else" },
  ]) {
    const response = await handler(put(body), params)
    assert.equal(response.status, 400, JSON.stringify(body))
    assert.equal(await code(response), "invalid_body")
  }
  assert.equal(rpcCalls.length, 0)
  assert.equal(loads.length, 0)
})

test("a revision conflict is a 409 profile_conflict", async () => {
  const { handler } = setup({
    rpcResult: { status: "revision_conflict", revision: 9, reason: "revision_mismatch" },
  })
  const response = await handler(put({ budget: CAPPED }), params)
  assert.equal(response.status, 409)
  assert.equal(await code(response), "profile_conflict")
})

test("a failed read, a failed write or an unexpected result is a 503", async () => {
  const originalError = console.error
  console.error = () => {}
  try {
    const failedRead = setup({
      overrides: {
        loadFacts: async () => {
          throw new Error("hair_profiles down")
        },
      },
    })
    assert.equal((await failedRead.handler(put({ budget: CAPPED }), params)).status, 503)
    assert.equal(failedRead.rpcCalls.length, 0)

    const failedWrite = setup({ rpcError: true })
    const response = await failedWrite.handler(put({ budget: CAPPED }), params)
    assert.equal(response.status, 503)
    assert.equal(await code(response), "unavailable")

    const odd = setup({
      rpcResult: { status: "preserved", revision: 7, changed: false, diagnosticsHash: null },
    })
    assert.equal((await odd.handler(put({ budget: CAPPED }), params)).status, 503)
  } finally {
    console.error = originalError
  }
})
