import assert from "node:assert/strict"
import test from "node:test"

import {
  buildProductIntakeSentryPayload,
  captureProductIntakeException,
  flushProductIntakeSentry,
  initProductIntakeScriptSentry,
} from "../src/lib/observability/product-intake"

test("product intake Sentry payload keeps searchable tags without product prose", () => {
  const payload = buildProductIntakeSentryPayload({
    stage: "send_review_notification",
    submissionId: "submission-1",
    approvedProductId: "product-1",
    userId: "user-1",
    source: "chat",
    sourceConversationId: "conversation-1",
    category: "shampoo",
    intakeMethod: "photo",
    status: "approved",
    reason: "message_insert_failed",
    notificationResult: "failed",
    committed: true,
  })

  assert.deepEqual(payload.tags, {
    "product_intake.stage": "send_review_notification",
    "product_intake.source": "chat",
    "product_intake.category": "shampoo",
    "product_intake.intake_method": "photo",
    "product_intake.status": "approved",
    "product_intake.reason": "message_insert_failed",
    "product_intake.notification_result": "failed",
  })
  assert.equal(payload.context.submission_id, "submission-1")
  assert.equal(payload.context.approved_product_id, "product-1")
  assert.equal(payload.context.user_hash, "c6c289e49e")
  assert.equal("user_id" in payload.context, false)
  assert.equal(payload.context.source_conversation_hash, "413055e0cb")
  assert.equal(payload.context.source_conversation_present, true)
  assert.equal("source_conversation_id" in payload.context, false)
  assert.equal("brand_text" in payload.context, false)
  assert.equal("product_name_text" in payload.context, false)
  assert.equal("review_notes" in payload.context, false)
})

test("captureProductIntakeException scopes tags and context", () => {
  const tags: Record<string, string> = {}
  const contexts: Record<string, Record<string, unknown>> = {}
  const captured: unknown[] = []
  const sink = {
    captureException: (error: unknown) => captured.push(error),
    withScope: (callback: {
      (scope: {
        setContext: (name: string, context: Record<string, unknown>) => void
        setLevel: (level: string) => void
        setTag: (key: string, value: string) => void
      }): void
    }) =>
      callback({
        setContext: (name, context) => {
          contexts[name] = context
        },
        setLevel: (level) => {
          tags.level = level
        },
        setTag: (key, value) => {
          tags[key] = value
        },
      }),
  }
  const error = new Error("notification failed")

  captureProductIntakeException(
    error,
    {
      stage: "send_review_notification",
      submissionId: "submission-1",
      status: "approved",
      notificationResult: "failed",
    },
    sink,
  )

  assert.equal(captured[0], error)
  assert.equal(tags["product_intake.stage"], "send_review_notification")
  assert.equal(tags["product_intake.status"], "approved")
  assert.equal(tags["product_intake.notification_result"], "failed")
  assert.equal(tags.level, "error")
  assert.equal(contexts.product_intake.submission_id, "submission-1")
})

test("product intake script Sentry init is skipped without a DSN", () => {
  const previousDsn = process.env.NEXT_PUBLIC_SENTRY_DSN
  delete process.env.NEXT_PUBLIC_SENTRY_DSN
  let initCalls = 0

  initProductIntakeScriptSentry({
    captureException: () => {},
    init: () => {
      initCalls += 1
    },
    withScope: () => {},
  })

  assert.equal(initCalls, 0)
  if (previousDsn) {
    process.env.NEXT_PUBLIC_SENTRY_DSN = previousDsn
  }
})

test("flushProductIntakeSentry flushes short-lived script captures", async () => {
  const timeouts: number[] = []
  const flushed = await flushProductIntakeSentry(2000, {
    captureException: () => {},
    flush: async (timeout) => {
      timeouts.push(timeout ?? 0)
      return true
    },
    withScope: () => {},
  })

  assert.equal(flushed, true)
  assert.deepEqual(timeouts, [2000])
})
