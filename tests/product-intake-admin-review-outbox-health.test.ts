import assert from "node:assert/strict"
import test from "node:test"
import { createClient } from "@supabase/supabase-js"
import {
  createAdminReviewOutboxHealthObserver,
  readAdminReviewOutboxHealth,
  type AdminReviewOutboxHealthRow,
} from "../src/lib/product-intake/admin-review-outbox-health"

const createdAt = "2026-10-16T10:00:00.000Z"
const now = new Date("2026-10-16T10:05:00.000Z")

function row(overrides: Partial<AdminReviewOutboxHealthRow> = {}): AdminReviewOutboxHealthRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    status: "needs_reconciliation",
    created_at: createdAt,
    locked_at: null,
    ...overrides,
  }
}

function readClient(pages: unknown[][], calls: URL[] = []) {
  let page = 0
  return createClient("https://example.supabase.co", "test-service-key", {
    global: {
      fetch: (async (input: string | URL | Request) => {
        calls.push(new URL(typeof input === "string" || input instanceof URL ? input : input.url))
        return Response.json(pages[page++] ?? [])
      }) as typeof fetch,
    },
  })
}

test("reads every risk-status page using narrow columns and excludes successful history", async () => {
  const calls: URL[] = []
  const client = readClient(
    [
      [row({ id: "11111111-1111-4111-8111-111111111111" })],
      [row({ id: "22222222-2222-4222-8222-222222222222", status: "failed" })],
      [],
    ],
    calls,
  )

  const report = await readAdminReviewOutboxHealth(client, {
    now,
    pageSize: 1,
  })

  assert.deepEqual(report, {
    heldCount: 1,
    expiredSendingCount: 0,
    failedCount: 1,
    oldestReconciliationAgeMs: 5 * 60_000,
    ids: ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"],
  })
  assert.equal(calls.length, 3)
  assert.match(calls[0]!.searchParams.get("select") ?? "", /^id,status,created_at,locked_at$/)
  assert.equal(calls[0]!.searchParams.get("status"), "in.(needs_reconciliation,sending,failed)")
  assert.equal(calls[0]!.searchParams.get("order"), "created_at.asc,id.asc")
  assert.equal(calls[0]!.searchParams.get("offset"), "0")
  assert.equal(calls[1]!.searchParams.get("offset"), "1")
})

test("counts only sending rows whose five-minute lease has expired", async () => {
  const client = readClient([
    [
      row({
        id: "11111111-1111-4111-8111-111111111111",
        status: "sending",
        locked_at: "2026-10-16T10:00:00.000Z",
      }),
      row({
        id: "22222222-2222-4222-8222-222222222222",
        status: "sending",
        locked_at: "2026-10-16T10:00:00.001Z",
      }),
    ],
  ])

  const report = await readAdminReviewOutboxHealth(client, { now, pageSize: 100 })

  assert.equal(report.expiredSendingCount, 1)
  assert.deepEqual(report.ids, ["11111111-1111-4111-8111-111111111111"])
})

test("reports the oldest affected alert age when only a sending lease has expired", async () => {
  const client = readClient([
    [
      row({
        status: "sending",
        created_at: "2026-10-16T09:00:00.000Z",
        locked_at: "2026-10-16T10:00:00.000Z",
      }),
    ],
  ])

  const report = await readAdminReviewOutboxHealth(client, { now, pageSize: 100 })

  assert.equal(report.heldCount, 0)
  assert.equal(report.expiredSendingCount, 1)
  assert.equal(report.oldestReconciliationAgeMs, 65 * 60_000)
})

test("storage failure and invalid rows fail closed rather than looking empty", async () => {
  const failedClient = createClient("https://example.supabase.co", "test-service-key", {
    global: {
      fetch: (async () =>
        Response.json({ message: "private provider failure" }, { status: 500 })) as typeof fetch,
    },
  })
  await assert.rejects(readAdminReviewOutboxHealth(failedClient, { now }), /health read failed/)

  const invalidClient = readClient([[{ ...row(), status: "sent" }]])
  await assert.rejects(readAdminReviewOutboxHealth(invalidClient, { now }), /health read failed/)
})

test("observer reports changes, reset resolution, deduplicated failures, and recovery", async () => {
  const observations = [[row()], null, [row()], [row()], [], null, null, []]
  const client = {
    from() {
      return {
        select() {
          return {
            in() {
              return {
                order() {
                  return {
                    order() {
                      return {
                        range: async () => {
                          const next = observations.shift()
                          if (next === null) return { data: null, error: { message: "private" } }
                          return { data: next, error: null }
                        },
                      }
                    },
                  }
                },
              }
            },
          }
        },
      }
    },
  } as never
  let tick = 0
  const observer = createAdminReviewOutboxHealthObserver(client, {
    now: () => new Date(now.getTime() + tick++ * 60_000),
    pageSize: 100,
  })

  assert.equal((await observer.poll()).kind, "issue")
  assert.equal((await observer.poll()).kind, "read_failure")
  const recoveredIssue = await observer.poll()
  assert.equal(recoveredIssue.kind, "issue")
  assert.equal(recoveredIssue.recovered, true)
  assert.equal((await observer.poll()).kind, "quiet")
  assert.equal((await observer.poll()).kind, "resolved")
  assert.equal((await observer.poll()).kind, "read_failure")
  assert.equal((await observer.poll()).kind, "quiet")
  assert.equal((await observer.poll()).kind, "recovered")
})
