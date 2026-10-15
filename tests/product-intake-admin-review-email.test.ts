import assert from "node:assert/strict"
import test from "node:test"
import {
  buildAdminReviewEmail,
  buildAdminReviewSnapshot,
  validateAdminReviewSnapshot,
} from "../src/lib/product-intake/admin-review-email"
import { drainAdminReviewOutbox } from "../src/lib/product-intake/admin-review-outbox"

const submissionId = "11111111-1111-4111-8111-111111111111"
const savedEnvironment = {
  recipient: process.env.PRODUCT_INTAKE_REVIEW_ALERT_EMAIL,
  messageId: process.env.CUSTOMERIO_PRODUCT_INTAKE_REVIEW_TRANSACTIONAL_MESSAGE_ID,
  apiKey: process.env.CUSTOMERIO_APP_API_KEY,
  enabled: process.env.PRODUCT_INTAKE_REVIEW_EMAILS,
}

function configured() {
  process.env.PRODUCT_INTAKE_REVIEW_ALERT_EMAIL = "reviewer@example.test"
  process.env.CUSTOMERIO_PRODUCT_INTAKE_REVIEW_TRANSACTIONAL_MESSAGE_ID =
    "product_intake_admin_review_v1"
  process.env.CUSTOMERIO_APP_API_KEY = "test-app-key"
  process.env.PRODUCT_INTAKE_REVIEW_EMAILS = "true"
}

function restore() {
  for (const [key, value] of Object.entries({
    PRODUCT_INTAKE_REVIEW_ALERT_EMAIL: savedEnvironment.recipient,
    CUSTOMERIO_PRODUCT_INTAKE_REVIEW_TRANSACTIONAL_MESSAGE_ID: savedEnvironment.messageId,
    CUSTOMERIO_APP_API_KEY: savedEnvironment.apiKey,
    PRODUCT_INTAKE_REVIEW_EMAILS: savedEnvironment.enabled,
  })) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

test.after(restore)

function snapshot() {
  return buildAdminReviewSnapshot({
    submissionId,
    category: "mask",
    outcome: "needs_nick",
    questionCodes: ["research_gaps", "image_review"],
    researchedPayload: {
      final: { product: { canonical_brand: "Chaarlie", clean_name: "Repair Mask" } },
    },
  })
}

test("snapshot has only provider-safe public fields and fixed question copy", () => {
  const value = snapshot()
  assert.deepEqual(Object.keys(value).sort(), [
    "category_label",
    "is_test",
    "outcome_label",
    "product_name",
    "question_1",
    "question_2",
    "question_3",
    "review_url",
  ])
  assert.equal(value.product_name, "Chaarlie Repair Mask")
  assert.equal(value.category_label, "Haarmaske")
  assert.equal(value.outcome_label, "Entscheidung nötig")
  assert.match(value.question_1, /fehlenden Rechercheangaben/)
  assert.match(value.question_2, /Produktbilder/)
  assert.equal(value.question_3, "")
  assert.equal(value.review_url, `https://chaarlie.de/admin/produkt-intake/${submissionId}`)
  assert.equal(value.is_test, false)
  assert.doesNotMatch(JSON.stringify(value), /user|conversation|email/i)
})

test("identity injection or an incomplete final identity falls back without leaking source input", () => {
  const value = buildAdminReviewSnapshot({
    submissionId,
    category: "shampoo",
    outcome: "ready_for_review",
    researchedPayload: {
      final: {
        product: { canonical_brand: "owner@example.test", clean_name: "https://private.test/name" },
      },
      user_email: "owner@example.test",
    },
  })
  assert.equal(value.product_name, "Produkt zur Prüfung")
  assert.doesNotMatch(JSON.stringify(value), /owner@example|private\.test/)
})

test("missing category context uses the server-owned neutral label", () => {
  const value = buildAdminReviewSnapshot({
    submissionId,
    category: undefined,
    outcome: "ready_for_review",
    researchedPayload: {},
  })
  assert.equal(value.category_label, "Produkt")
})

test("strict snapshot validation refuses extra, control, URL and test-mode data", () => {
  const value = snapshot()
  assert.throws(() => validateAdminReviewSnapshot({ ...value, unexpected: "x" }))
  assert.throws(() => validateAdminReviewSnapshot({ ...value, product_name: "a\nb" }))
  assert.throws(() => validateAdminReviewSnapshot({ ...value, question_1: "https://bad.test" }))
  assert.throws(() => validateAdminReviewSnapshot({ ...value, is_test: true }))
  assert.throws(() =>
    validateAdminReviewSnapshot({ ...value, review_url: "https://chaarlie.de/admin/other" }),
  )
  assert.equal(
    validateAdminReviewSnapshot(
      { ...value, is_test: true, review_url: "https://chaarlie.de/admin" },
      { test: true },
    ).review_url,
    "https://chaarlie.de/admin",
  )
})

test("email payload has one configured recipient and no inline fallback", () => {
  configured()
  const message = buildAdminReviewEmail(snapshot())
  assert.equal(message.to, "reviewer@example.test")
  assert.equal(message.transactionalMessageId, "product_intake_admin_review_v1")
  assert.equal(message.inlineContent, undefined)
  assert.deepEqual(message.messageData, snapshot())
})

function outboxClient(rows: unknown[], settlements: Array<{ args: Record<string, unknown> }> = []) {
  return {
    async rpc(name: string, args: Record<string, unknown>) {
      if (name === "product_intake_claim_admin_notification") return { data: rows, error: null }
      if (name === "product_intake_settle_admin_notification") {
        settlements.push({ args })
        return { data: true, error: null }
      }
      throw new Error(`unexpected rpc ${name}`)
    },
  } as never
}

function claim(payload: unknown) {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    submission_id: submissionId,
    kind: "needs_nick",
    payload,
    lease_token: "lease-1",
  }
}

test("automatic switch off does not claim a row or read provider configuration", async () => {
  process.env.PRODUCT_INTAKE_REVIEW_EMAILS = "false"
  delete process.env.CUSTOMERIO_APP_API_KEY
  const result = await drainAdminReviewOutbox({
    rpc() {
      throw new Error("must not claim")
    },
  } as never)
  assert.deepEqual(result, { status: "disabled" })
})

test("delivery sends the narrow snapshot to the provider and settles exactly the leased row", async () => {
  configured()
  const settlements: Array<{ args: Record<string, unknown> }> = []
  const originalFetch = globalThis.fetch
  const requests: unknown[] = []
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    requests.push(JSON.parse(String(init?.body)))
    return Response.json({ delivery_id: "delivery-1", queued_at: "2026-10-15T12:00:00Z" })
  }) as typeof fetch
  try {
    const result = await drainAdminReviewOutbox(outboxClient([claim(snapshot())], settlements))
    assert.deepEqual(result, {
      status: "sent",
      notificationId: "22222222-2222-4222-8222-222222222222",
      deliveryId: "delivery-1",
    })
    assert.deepEqual(requests, [
      {
        to: "reviewer@example.test",
        transactional_message_id: "product_intake_admin_review_v1",
        identifiers: { email: "reviewer@example.test" },
        message_data: snapshot(),
        send_to_unsubscribed: true,
        disable_message_retention: true,
        tracked: false,
      },
    ])
    assert.deepEqual(settlements[0]?.args, {
      target_id: "22222222-2222-4222-8222-222222222222",
      expected_lease_token: "lease-1",
      result: "sent",
      delivery_id: "delivery-1",
      queued_at: "2026-10-15T12:00:00Z",
      error_code: null,
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("provider HTTP and ambiguous transport outcomes settle without raw provider detail", async () => {
  configured()
  const originalFetch = globalThis.fetch
  try {
    for (const [response, result, code] of [
      [new Response("secret provider detail", { status: 503 }), "ambiguous", "provider_http_5xx"],
      [new Response("request timeout", { status: 408 }), "ambiguous", "provider_http_408"],
      [new Response("too many", { status: 429 }), "definite_transient", "provider_http_429"],
      [new Response("bad request", { status: 422 }), "permanent", "provider_http_4xx"],
    ] as const) {
      const settlements: Array<{ args: Record<string, unknown> }> = []
      globalThis.fetch = (async () => response) as typeof fetch
      const output = await drainAdminReviewOutbox(outboxClient([claim(snapshot())], settlements))
      assert.equal(
        output.status,
        result === "permanent"
          ? "failed"
          : result === "ambiguous"
            ? "needs_reconciliation"
            : "retry_recorded",
      )
      assert.equal(settlements[0]?.args.result, result)
      assert.equal(settlements[0]?.args.error_code, code)
      assert.doesNotMatch(
        JSON.stringify(settlements),
        /secret provider detail|too many|bad request/,
      )
    }
    for (const response of [
      () => Promise.reject(new TypeError("network reset")),
      () => Promise.resolve(Response.json({ queued_at: "2026-10-15T12:00:00Z" })),
    ]) {
      const settlements: Array<{ args: Record<string, unknown> }> = []
      globalThis.fetch = response as typeof fetch
      const output = await drainAdminReviewOutbox(outboxClient([claim(snapshot())], settlements))
      assert.equal(output.status, "needs_reconciliation")
      assert.equal(settlements[0]?.args.result, "ambiguous")
      assert.equal(settlements[0]?.args.error_code, "provider_ambiguous")
    }
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("a lease fence failure is surfaced and never reclassified as a provider failure", async () => {
  configured()
  const client = {
    async rpc(name: string) {
      if (name === "product_intake_claim_admin_notification")
        return { data: [claim(snapshot())], error: null }
      return { data: false, error: null }
    },
  } as never
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () =>
    Response.json({ delivery_id: "delivery-1", queued_at: "2026-10-15T12:00:00Z" })) as typeof fetch
  try {
    await assert.rejects(drainAdminReviewOutbox(client), /lease lost/)
  } finally {
    globalThis.fetch = originalFetch
  }
})
