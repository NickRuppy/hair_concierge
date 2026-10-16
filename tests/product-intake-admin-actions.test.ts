import assert from "node:assert/strict"
import test from "node:test"
import { NextResponse } from "next/server"
import { ProductIntakeReviewError } from "@chaarlie/product-intake-core"
import type { ReviewPublicationReceipt } from "@chaarlie/product-intake-core"
import type { ReviewPublicationPreflight } from "../src/lib/product-intake/review-publication"
import { createProductReviewActionHandler } from "../src/lib/product-intake/admin-review-actions"

const submission = "11111111-1111-4111-8111-111111111111"
const actor = "22222222-2222-4222-8222-222222222222"
const job = "33333333-3333-4333-8333-333333333333"
const requestId = "44444444-4444-4444-8444-444444444444"
const cycle = "55555555-5555-4555-8555-555555555555"
const decision = "66666666-6666-4666-8666-666666666666"
const receipt = "77777777-7777-4777-8777-777777777777"
const common = {
  request_id: requestId,
  job_id: job,
  review_cycle_id: cycle,
  payload_revision: 3,
  payload_sha256: "a".repeat(64),
}
const context = { params: Promise.resolve({ submissionId: submission }) }
const publication: ReviewPublicationReceipt = {
  ...common,
  submission_id: submission,
  id: receipt,
  product_id: decision,
  brand_id: actor,
  product_line_id: null,
  persisted_payload_revision: 4,
  persisted_payload_sha256: "b".repeat(64),
  data_decision_id: decision,
  image_decision_id: receipt,
  approved_asset_sha256: "c".repeat(64),
  reviewed_by: actor,
  created_at: "2026-10-16T12:00:00Z",
  notification_status: "failed",
  notification_message_id: null,
  notification_error_code: "delivery_failed",
}
const preflight: ReviewPublicationPreflight = {
  ...common,
  submission_id: submission,
  ok: false,
  blockers: ["data_approval_missing"],
  data_decision_id: null,
  image_decision_id: null,
  approved_asset_sha256: null,
  no_image: false,
  legacy_package: false,
  publication: null,
  proposed_final: null,
  validation_blockers: [],
  can_approve_no_image: false,
}
type Overrides = NonNullable<Parameters<typeof createProductReviewActionHandler>[0]>
function post(body: unknown, origin: string | null = "https://chaarlie.test") {
  return new Request(`https://chaarlie.test/api/admin/produkt-intake/${submission}/actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) },
    body: JSON.stringify(body),
  })
}
function handler(overrides: Overrides = {}) {
  return createProductReviewActionHandler({
    requireAdmin: async () => ({ userId: actor }),
    createAdminClient: (() => ({})) as Overrides["createAdminClient"],
    executeReviewAction: async (_client, request) => ({
      decision: { id: decision, action: request.action, notification_status: "not_required" },
      job: null,
    }),
    ...overrides,
  })
}

for (const status of [401, 403])
  test(`mutation refuses ${status} before body reading or service-role creation`, async () => {
    let read = false
    const request = post({ action: "approve_data", ...common })
    request.text = async () => {
      read = true
      throw new Error("must not read")
    }
    const response = await handler({
      requireAdmin: async () => ({ response: NextResponse.json({ error: "denied" }, { status }) }),
      createAdminClient: () => {
        throw new Error("must not create")
      },
    })(request, context)
    assert.equal(response.status, status)
    assert.equal(read, false)
    assert.equal(response.headers.get("cache-control"), "private, no-store")
  })

test("cross-origin and missing-origin requests stop before service access", async () => {
  const run = handler({
    createAdminClient: () => {
      throw new Error("must not create")
    },
  })
  for (const origin of [null, "https://evil.test"])
    assert.equal(
      (await run(post({ action: "approve_data", ...common }, origin), context)).status,
      403,
    )
})

test("explicit confirmation and server-owned actor cannot be overridden", async () => {
  let calls = 0
  const run = handler({
    createAdminClient: () => {
      calls++
      throw new Error("must not create")
    },
  })
  for (const body of [
    { action: "publish", ...common, data_decision_id: decision, image_decision_id: decision },
    { action: "link_existing", ...common, product_id: decision, confirm: false },
    {
      action: "request_info",
      ...common,
      reason: "Foto fehlt",
      next_step: "Bitte Foto senden",
      missing_fields: [],
    },
    { action: "approve_data", ...common, reviewed_by: "forged" },
    { action: "approve_data", ...common, submission_id: decision },
    { action: "approve_data", ...common, payload_revision: 0 },
    { action: "approve_data", ...common, payload_sha256: "invalid" },
  ])
    assert.equal((await run(post(body), context)).status, 400)
  assert.equal(calls, 0)
})

test("data approval and publication carry exact client tokens plus authenticated actor", async () => {
  const calls: unknown[] = []
  const run = handler({
    executeReviewAction: (async (_client, body) => {
      calls.push(body)
      return {
        decision: { id: decision, action: body.action, notification_status: "not_required" },
        job: null,
      }
    }) as Overrides["executeReviewAction"],
    publishReviewedProduct: (async (_client, body) => {
      calls.push(body)
      return { publication }
    }) as Overrides["publishReviewedProduct"],
  })
  const approval = await run(post({ action: "approve_data", ...common }), context)
  assert.equal(approval.status, 200)
  assert.deepEqual(calls[0], {
    ...common,
    submission_id: submission,
    reviewed_by: actor,
    action: "approve_data",
  })
  const published = await run(
    post({
      action: "publish",
      ...common,
      data_decision_id: decision,
      image_decision_id: receipt,
      confirm: true,
    }),
    context,
  )
  assert.equal(published.status, 200)
  assert.deepEqual(calls[1], {
    ...common,
    submission_id: submission,
    reviewed_by: actor,
    data_decision_id: decision,
    image_decision_id: receipt,
    confirm: true,
  })
})

test("stale preflight revision, job or cycle returns reload-required 409", async () => {
  for (const changed of [
    { payload_revision: 4 },
    { job_id: decision },
    { review_cycle_id: decision },
    { payload_sha256: "b".repeat(64) },
  ]) {
    const response = await handler({
      loadReviewPublicationPreflight: (async () => ({
        ...preflight,
        ...changed,
      })) as Overrides["loadReviewPublicationPreflight"],
    })(post({ action: "preflight", ...common }), context)
    assert.equal(response.status, 409)
    assert.match((await response.json()).error, /lade den Eintrag neu/)
  }
})

test("notification recovery refuses a receipt from another submission without sending", async () => {
  let sent = 0
  const response = await handler({
    loadReviewPublicationPreflight: (async () => ({
      ...preflight,
      publication: { ...publication, id: decision },
    })) as Overrides["loadReviewPublicationPreflight"],
    retryReviewNotification: (async () => {
      sent++
      return { notification_status: "failed" }
    }) as Overrides["retryReviewNotification"],
  })(
    post({ action: "retry_publication_notification", publication_id: receipt, confirm: true }),
    context,
  )
  assert.equal(response.status, 409)
  assert.equal(sent, 0)
})

test("matching publication recovery calls only notification service", async () => {
  const calls: unknown[] = []
  const response = await handler({
    loadReviewPublicationPreflight: (async () => ({
      ...preflight,
      publication,
    })) as Overrides["loadReviewPublicationPreflight"],
    publishReviewedProduct: async () => {
      throw new Error("must not publish again")
    },
    retryReviewNotification: (async (_client, body) => {
      calls.push(body)
      return { notification_status: "sent" }
    }) as Overrides["retryReviewNotification"],
  })(
    post({ action: "retry_publication_notification", publication_id: receipt, confirm: true }),
    context,
  )
  assert.equal(response.status, 200)
  assert.deepEqual(calls, [{ publicationId: receipt }])
})

test("known stale errors and unexpected failures hide private server detail", async () => {
  for (const failure of [
    new ProductIntakeReviewError("review_stale_revision"),
    new Error("postgres://private-secret"),
  ]) {
    const response = await handler({
      executeReviewAction: async () => {
        throw failure
      },
    })(post({ action: "approve_data", ...common }), context)
    assert.equal(response.status, failure instanceof ProductIntakeReviewError ? 409 : 503)
    assert.equal(response.headers.get("cache-control"), "private, no-store")
    assert.ok(!(await response.text()).includes("private-secret"))
  }
})

test("oversized and malformed requests refuse before creating a service client", async () => {
  const run = handler({
    createAdminClient: () => {
      throw new Error("must not create")
    },
  })
  assert.equal((await run(post({ value: "x".repeat(17_000) }), context)).status, 413)
  const request = post({})
  request.text = async () => "{broken"
  assert.equal((await run(request, context)).status, 400)
})

test("identity and deep-cleansing answers map only exact selected fields", async () => {
  const calls: unknown[] = []
  const run = handler({
    executeReviewAction: (async (_client, body) => {
      calls.push(body)
      return {
        decision: { id: decision, action: body.action, notification_status: "not_required" },
        job: null,
      }
    }) as Overrides["executeReviewAction"],
  })
  for (const [field_path, value, expected] of [
    ["product.canonical_brand", "CARE", { canonical_brand: "CARE" }],
    [
      "research.separate_deep_cleanser_listing",
      "keep_regular_only",
      { choice: "keep_regular_only" },
    ],
  ] as const) {
    assert.equal(
      (await run(post({ action: "answer", ...common, field_path, value }), context)).status,
      200,
    )
    assert.deepEqual((calls.at(-1) as { reviewer_value: unknown }).reviewer_value, expected)
  }
  assert.equal(
    (
      await run(
        post({
          action: "answer",
          ...common,
          field_path: "research.separate_deep_cleanser_listing",
          value: "auto_create",
        }),
        context,
      )
    ).status,
    400,
  )
})
