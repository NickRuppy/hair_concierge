import assert from "node:assert/strict"
import test from "node:test"

import { createRefinementBannerDismissRouteHandlers } from "../src/app/api/personal-plan/refinement-status/dismiss/route"
import { PERSONAL_PLAN_UI_LIFECYCLE_MARKS_TABLE } from "../src/lib/personal-plan/lifecycle/repository"

const USER = "11111111-1111-4111-8111-111111111111"
const NOW = "2026-08-25T12:00:00.000Z"

type StoredRow = { user_id: string; kind: string; subject: string; marked_at: string }

/**
 * Mirrors tests/personal-plan-lifecycle-marks.test.ts's in-memory stand-in:
 * `.from(table)` returns a thenable `.select().eq().eq()` chain plus
 * `.upsert()`, keyed on the table's real primary key so a repeat dismissal
 * overwrites rather than duplicates.
 */
function createInMemoryClient(): { client: unknown; rows: () => StoredRow[] } {
  const rows = new Map<string, StoredRow>()
  const client = {
    from(table: string) {
      assert.equal(table, PERSONAL_PLAN_UI_LIFECYCLE_MARKS_TABLE)
      return {
        select: () => client.from(table),
        eq: () => client.from(table),
        async upsert(row: Record<string, unknown>) {
          const key = `${row.user_id}|${row.kind}|${row.subject}`
          rows.set(key, row as StoredRow)
          return { error: null }
        },
      }
    },
  }
  return { client, rows: () => [...rows.values()] }
}

function createFailingClient(): unknown {
  return {
    from(table: string) {
      assert.equal(table, PERSONAL_PLAN_UI_LIFECYCLE_MARKS_TABLE)
      return {
        select() {
          return this
        },
        eq() {
          return this
        },
        async upsert() {
          return { error: { code: "42P01", message: "relation does not exist" } }
        },
      }
    },
  }
}

function handlersFor(input: { userId?: string | null; client?: unknown }) {
  const { client } = createInMemoryClient()
  return createRefinementBannerDismissRouteHandlers({
    getUserId: async () => (input.userId === undefined ? USER : input.userId),
    client: () => (input.client ?? client) as never,
    now: () => NOW,
  })
}

function postRequest(body: unknown): Request {
  return new Request("https://chaarlie.de/api/personal-plan/refinement-status/dismiss", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

test("rejects an unauthenticated dismissal", async () => {
  const res = await handlersFor({ userId: null }).POST(postRequest({ module: "products" }))
  assert.equal(res.status, 401)
  assert.equal(res.headers.get("Cache-Control"), "no-store")
})

test("rejects a body missing the module field", async () => {
  const res = await handlersFor({}).POST(postRequest({}))
  assert.equal(res.status, 400)
  const body = await res.json()
  assert.equal(body.error, "invalid_body")
})

test("rejects an unknown module value", async () => {
  const res = await handlersFor({}).POST(postRequest({ module: "not_a_module" }))
  assert.equal(res.status, 400)
})

test("rejects a body with extra keys (zod-strict)", async () => {
  const res = await handlersFor({}).POST(postRequest({ module: "products", extra: true }))
  assert.equal(res.status, 400)
})

test("rejects malformed JSON", async () => {
  const request = new Request("https://chaarlie.de/api/personal-plan/refinement-status/dismiss", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "not json",
  })
  const res = await handlersFor({}).POST(request)
  assert.equal(res.status, 400)
})

test("records a dismissal for the given module and returns it", async () => {
  const { client, rows } = createInMemoryClient()
  const handlers = createRefinementBannerDismissRouteHandlers({
    getUserId: async () => USER,
    client: () => client as never,
    now: () => NOW,
  })

  const res = await handlers.POST(postRequest({ module: "habits" }))
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.deepEqual(body, { status: "dismissed", module: "habits" })

  const stored = rows()
  assert.equal(stored.length, 1)
  assert.deepEqual(stored[0], {
    user_id: USER,
    kind: "module_banner_dismissed",
    subject: "habits",
    marked_at: NOW,
  })
})

test("dismissing the same module twice is idempotent", async () => {
  const { client, rows } = createInMemoryClient()
  const handlers = createRefinementBannerDismissRouteHandlers({
    getUserId: async () => USER,
    client: () => client as never,
    now: () => NOW,
  })

  await handlers.POST(postRequest({ module: "products" }))
  const second = await handlers.POST(postRequest({ module: "products" }))

  assert.equal(second.status, 200)
  assert.equal(rows().length, 1)
})

test("a write failure (e.g. pre-migration undefined_table) degrades to a typed 503", async () => {
  const handlers = createRefinementBannerDismissRouteHandlers({
    getUserId: async () => USER,
    client: () => createFailingClient() as never,
    now: () => NOW,
  })

  const res = await handlers.POST(postRequest({ module: "products" }))
  assert.equal(res.status, 503)
  const body = await res.json()
  assert.equal(body.error, "temporarily_unavailable")
})
