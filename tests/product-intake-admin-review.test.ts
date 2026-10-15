import assert from "node:assert/strict"
import test from "node:test"
import { NextResponse } from "next/server"
import type { ProductIntakeResearchJob } from "@chaarlie/product-intake-core"
import { createAdminClient } from "../src/lib/supabase/admin"
import { createProductReviewReadHandlers } from "../src/lib/product-intake/admin-review-http"
import {
  loadAdminProductReviewDetail,
  loadAdminProductReviewQueue,
  type ProductReviewReadClient,
} from "../src/lib/product-intake/admin-review-repository"
import {
  latestProductReviewJob,
  productReviewGroup,
  productReviewSourceUrl,
  productReviewValues,
} from "../src/lib/product-intake/admin-review-model"

type Row = Record<string, unknown>
function clientFor(tables: Record<string, Row[]>, failure?: string): ProductReviewReadClient {
  return {
    from(table: string) {
      let rows = [...(tables[table] ?? [])]
      let size = Infinity
      let single = false
      const query = {
        select() {
          return query
        },
        in(key: string, values: unknown[]) {
          rows = rows.filter((row) => values.includes(row[key]))
          return query
        },
        eq(key: string, value: unknown) {
          rows = rows.filter((row) => row[key] === value)
          return query
        },
        gt(key: string, value: string) {
          rows = rows.filter((row) => String(row[key]) > value)
          return query
        },
        order(key: string) {
          rows.sort((a, b) => String(a[key]).localeCompare(String(b[key])))
          return query
        },
        limit(value: number) {
          size = value
          return query
        },
        maybeSingle() {
          single = true
          return query
        },
        then(resolve: (value: unknown) => unknown) {
          return Promise.resolve({
            data: table === failure ? null : single ? (rows[0] ?? null) : rows.slice(0, size),
            error: table === failure ? { message: "private database error" } : null,
          }).then(resolve)
        },
      }
      return query
    },
  } as unknown as ProductReviewReadClient
}

function job(
  id: string,
  status: ProductIntakeResearchJob["status"],
  created = "2026-10-15T10:00:00Z",
): ProductIntakeResearchJob {
  return {
    id,
    submission_id: "submission",
    status,
    stage: "preview_build",
    priority: 0,
    attempt_count: 0,
    max_attempts: 3,
    locked_by: null,
    locked_at: null,
    started_at: null,
    completed_at: null,
    next_run_at: created,
    last_error: null,
    progress: {},
    created_at: created,
    updated_at: created,
  }
}

test("newest created job wins over a recently updated older blocked job, including terminal outcomes", () => {
  const old = {
    ...job("old", "blocked", "2026-10-01T10:00:00Z"),
    updated_at: "2026-10-16T10:00:00Z",
  }
  const latest = job("new", "done")
  assert.equal(latestProductReviewJob([old, latest])?.id, "new")
  assert.equal(productReviewGroup("ready_for_review", latest), "decisions")
  assert.equal(productReviewGroup("ready_for_review", job("active", "running")), "processing")
  assert.equal(productReviewGroup("ready_for_review", job("ready", "waiting_for_review")), "ready")
  assert.equal(productReviewGroup("researching", job("failed", "failed")), "errors")
})

test("queue reads beyond both submission and job API pages without dropping or duplicating rows", async () => {
  const submissions = Array.from({ length: 205 }, (_, index) => ({
    id: `s-${String(index).padStart(4, "0")}`,
    status: "ready_for_review",
    category: "conditioner",
    brand_text: "Beispiel",
    product_name_text: `Produkt ${index}`,
    created_at: "2026-10-15T10:00:00Z",
    updated_at: "2026-10-15T10:00:00Z",
  }))
  const jobs = submissions.flatMap((submission) => [
    {
      ...job(`a-${submission.id}`, "blocked", "2026-10-01T10:00:00Z"),
      submission_id: submission.id,
    },
    { ...job(`b-${submission.id}`, "waiting_for_review"), submission_id: submission.id },
    {
      ...job(`c-${submission.id}`, "blocked", "2026-10-02T10:00:00Z"),
      submission_id: submission.id,
    },
  ])
  const entries = await loadAdminProductReviewQueue(
    clientFor({ product_submissions: submissions, product_intake_research_jobs: jobs }),
  )
  assert.equal(entries.length, 205)
  assert.equal(new Set(entries.map((entry) => entry.id)).size, 205)
  assert.ok(entries.every((entry) => entry.group === "ready" && entry.job?.id === `b-${entry.id}`))
})

test("a failed later read refuses a partial queue", async () => {
  const client = clientFor(
    {
      product_submissions: [
        { id: "submission", status: "pending_review", created_at: "2026-10-15" },
      ],
    },
    "product_intake_research_jobs",
  )
  await assert.rejects(loadAdminProductReviewQueue(client))
})

test("detail is nullable and excludes unrelated submission personal identifiers", async () => {
  const client = clientFor({
    product_submissions: [
      {
        id: "submission",
        user_id: "private-user",
        source_conversation_id: "private-conversation",
        category: "mask",
        status: "ready_for_review",
        researched_payload: { final: {} },
        created_at: "2026-10-15",
        updated_at: "2026-10-15",
      },
    ],
  })
  const detail = await loadAdminProductReviewDetail(client, "submission")
  assert.ok(detail)
  assert.equal("user_id" in detail.submission, false)
  assert.equal("source_conversation_id" in detail.submission, false)
  assert.equal(await loadAdminProductReviewDetail(client, "missing"), null)
})

for (const status of [401, 403])
  test(`admin reads refuse ${status} before creating a service client`, async () => {
    const handlers = createProductReviewReadHandlers({
      requireAdmin: async () => ({ response: NextResponse.json({ error: "denied" }, { status }) }),
      createAdminClient: () => {
        throw new Error("must not create service client")
      },
    })
    const queue = await handlers.queue()
    const detail = await handlers.detail(new Request("https://example.test"), {
      params: Promise.resolve({ submissionId: "invalid" }),
    })
    assert.equal(queue.status, status)
    assert.equal(detail.status, status)
    assert.equal(queue.headers.get("cache-control"), "private, no-store")
  })

test("authenticated read reports missing detail and hides database failure details", async () => {
  const handlers = createProductReviewReadHandlers({
    requireAdmin: async () => ({ userId: "admin" }),
    createAdminClient: () => clientFor({}) as ReturnType<typeof createAdminClient>,
    loadAdminProductReviewDetail: async () => null,
    loadAdminProductReviewQueue: async () => {
      throw new Error("secret connection details")
    },
  })
  const detail = await handlers.detail(new Request("https://example.test"), {
    params: Promise.resolve({ submissionId: "11111111-1111-4111-8111-111111111111" }),
  })
  assert.equal(detail.status, 404)
  const response = await handlers.queue()
  assert.equal(response.status, 503)
  assert.equal(response.headers.get("cache-control"), "private, no-store")
  assert.ok(!(await response.text()).includes("secret"))
})

test("review navigation refuses executable and credential-bearing links; exact values retain empty/null fields", () => {
  for (const value of [
    "javascript:alert(1)",
    "data:text/html,hi",
    "file:///tmp/image.png",
    "https://user:secret@example.test/",
  ])
    assert.equal(productReviewSourceUrl(value), null)
  assert.equal(
    productReviewSourceUrl("https://example.test/product"),
    "https://example.test/product",
  )
  assert.deepEqual(productReviewValues({ missing: null, empty: {}, list: [] }), [
    { path: "final.missing", value: "null" },
    { path: "final.empty", value: "{}" },
    { path: "final.list", value: "[]" },
  ])
})
