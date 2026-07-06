import assert from "node:assert/strict"
import test from "node:test"

import {
  buildProductIntakeReviewConversationStateTransition,
  sendProductIntakeReviewNotification,
  type ProductSubmissionForNotification,
} from "../src/lib/product-intake/notifications"
import { createDefaultAgentV2ConversationState } from "../src/lib/agent-v2/production/persisted-session-state"

function notificationSubmission(
  patch: Partial<ProductSubmissionForNotification> = {},
): ProductSubmissionForNotification {
  return {
    id: "submission-1",
    user_id: "user-1",
    user_product_usage_id: "usage-1",
    source: "chat",
    source_conversation_id: "conversation-1",
    intake_method: "manual",
    category: "mask",
    frequency_range: "weekly_1x",
    front_image_path: null,
    barcode_image_path: null,
    status: "approved",
    brand_text: "Garnier",
    product_name_text: "Hair Food Aloe",
    approved_product_id: "product-1",
    user_facing_resolution_reason: null,
    user_facing_next_step: null,
    user_facing_missing_fields: [],
    notification_sent_at: null,
    ...patch,
  }
}

function createNotificationSupabaseFake(
  options: {
    claimSucceeds?: boolean
    existingMessageId?: string | null
    messageInsertError?: { code?: string; message: string } | null
    messageInsertId?: string | null
    conversationUpdateError?: { message: string } | null
  } = {},
) {
  const calls: string[] = []
  const insertedMessages: Array<Record<string, unknown>> = []

  class Query {
    private readonly table: string
    private operation: "insert" | "select" | "update" | "upsert" | null = null
    private selected = false

    constructor(table: string) {
      this.table = table
    }

    insert(payload?: Record<string, unknown>) {
      this.operation = "insert"
      calls.push(`insert:${this.table}`)
      if (this.table === "messages" && payload) {
        insertedMessages.push(payload)
      }
      return this
    }

    update() {
      this.operation = "update"
      calls.push(`update:${this.table}`)
      return this
    }

    upsert() {
      this.operation = "upsert"
      calls.push(`upsert:${this.table}`)
      return this
    }

    select() {
      this.selected = true
      if (!this.operation) {
        this.operation = "select"
        calls.push(`select:${this.table}`)
      }
      return this
    }

    eq() {
      return this
    }

    is() {
      return this
    }

    contains() {
      return this
    }

    order() {
      return this
    }

    limit() {
      return this
    }

    async maybeSingle() {
      if (this.table === "product_submissions" && this.operation === "update") {
        calls.push("claim:product_submissions")
        return {
          data: options.claimSucceeds === false ? null : { id: "submission-1" },
          error: null,
        }
      }

      if (this.table === "messages" && this.operation === "select") {
        return {
          data: options.existingMessageId ? { id: options.existingMessageId } : null,
          error: null,
        }
      }

      if (this.table === "conversation_states" && this.operation === "select") {
        return {
          data: null,
          error: null,
        }
      }

      return { data: null, error: null }
    }

    async single() {
      if (this.table === "messages" && this.operation === "insert") {
        if (options.messageInsertError) {
          return { data: null, error: options.messageInsertError }
        }
        return { data: { id: options.messageInsertId ?? "message-1" }, error: null }
      }

      return { data: { id: "message-1" }, error: null }
    }

    async then(resolve: (value: { data: unknown; error: { message: string } | null }) => unknown) {
      if (this.table === "product_submissions" && this.operation === "update" && !this.selected) {
        calls.push("release:product_submissions")
        return resolve({ data: null, error: null })
      }

      if (this.table === "conversations" && this.operation === "update" && !this.selected) {
        return resolve({ data: null, error: options.conversationUpdateError ?? null })
      }

      return resolve({ data: null, error: null })
    }
  }

  return {
    calls,
    insertedMessages,
    from(table: string) {
      return new Query(table)
    },
  }
}

test("review notification claims before inserting assistant message", async () => {
  const supabase = createNotificationSupabaseFake({ claimSucceeds: false })

  const result = await sendProductIntakeReviewNotification(
    supabase as never,
    notificationSubmission(),
  )

  assert.deepEqual(result, { sent: false, reason: "already_sent" })
  assert.equal(supabase.calls[0], "update:product_submissions")
  assert.ok(!supabase.calls.includes("insert:messages"))
})

test("review notification retries when sent timestamp exists without matching message", async () => {
  const supabase = createNotificationSupabaseFake()

  const result = await sendProductIntakeReviewNotification(
    supabase as never,
    notificationSubmission({ notification_sent_at: "2026-06-29T08:00:00.000Z" }),
  )

  assert.deepEqual(result, {
    sent: true,
    conversationId: "conversation-1",
    messageId: "message-1",
  })
  assert.ok(supabase.calls.includes("select:messages"))
  assert.ok(supabase.calls.includes("insert:messages"))
  assert.ok(!supabase.calls.includes("claim:product_submissions"))
  assert.match(String(supabase.insertedMessages[0]?.id), /^[0-9a-f-]{36}$/)
})

test("review notification releases sent claim when message insert fails", async () => {
  const supabase = createNotificationSupabaseFake({
    messageInsertError: { message: "insert failed" },
  })

  await assert.rejects(
    () => sendProductIntakeReviewNotification(supabase as never, notificationSubmission()),
    /insert failed/,
  )

  assert.ok(supabase.calls.includes("claim:product_submissions"))
  assert.ok(supabase.calls.includes("insert:messages"))
  assert.ok(supabase.calls.includes("release:product_submissions"))
})

test("review notification keeps sent claim when existing message is found", async () => {
  const supabase = createNotificationSupabaseFake({ existingMessageId: "message-existing" })

  const result = await sendProductIntakeReviewNotification(
    supabase as never,
    notificationSubmission(),
  )

  assert.deepEqual(result, { sent: false, reason: "already_sent" })
  assert.ok(supabase.calls.includes("claim:product_submissions"))
  assert.ok(!supabase.calls.includes("insert:messages"))
  assert.ok(!supabase.calls.includes("release:product_submissions"))
  assert.ok(supabase.calls.includes("update:conversations"))
})

test("review notification keeps delivery success after message is materialized", async () => {
  const supabase = createNotificationSupabaseFake({
    conversationUpdateError: { message: "conversation bump failed" },
  })

  const result = await sendProductIntakeReviewNotification(
    supabase as never,
    notificationSubmission(),
  )

  assert.deepEqual(result, {
    sent: true,
    conversationId: "conversation-1",
    messageId: "message-1",
  })
  assert.ok(supabase.calls.includes("claim:product_submissions"))
  assert.ok(supabase.calls.includes("insert:messages"))
  assert.ok(!supabase.calls.includes("release:product_submissions"))
})

test("review notification treats duplicate deterministic message id as already sent", async () => {
  const supabase = createNotificationSupabaseFake({
    messageInsertError: {
      code: "23505",
      message: "duplicate key value violates unique constraint",
    },
  })

  const result = await sendProductIntakeReviewNotification(
    supabase as never,
    notificationSubmission({ notification_sent_at: "2026-06-29T08:00:00.000Z" }),
  )

  assert.deepEqual(result, { sent: false, reason: "already_sent" })
  assert.ok(supabase.calls.includes("select:messages"))
  assert.ok(supabase.calls.includes("insert:messages"))
  assert.ok(supabase.calls.includes("update:conversations"))
})

test("approved review notification resolves matching pending active product context", () => {
  const previousState = createDefaultAgentV2ConversationState()
  previousState.agent_v2.active_product_contexts = [
    {
      status: "pending_review",
      product_id: null,
      submission_id: "submission-other",
      category: "oil",
      brand_text: "NEQI",
      product_name_text: "Hair Oil",
      display_name: "NEQI Hair Oil",
      original_user_message: "Ich habe NEQI Hair Oil eingereicht.",
      source: "product_intake_submission",
      updated_at: "2026-07-03T08:00:00.000Z",
    },
    {
      status: "pending_review",
      product_id: null,
      submission_id: "submission-1",
      category: "leave_in",
      brand_text: "AUSSIE",
      product_name_text: "Leave-In Haarserum 100 Hours Hydration",
      display_name: "AUSSIE Leave-In Haarserum 100 Hours Hydration",
      original_user_message: "Ich habe AUSSIE Leave-In Haarserum 100 Hours Hydration eingereicht.",
      source: "product_intake_submission",
      updated_at: "2026-07-03T08:30:00.000Z",
    },
  ]

  const transition = buildProductIntakeReviewConversationStateTransition({
    previousState,
    submission: notificationSubmission({
      id: "submission-1",
      status: "approved",
      category: "leave_in",
      brand_text: "AUSSIE",
      product_name_text: "Leave-In Haarserum 100 Hours Hydration",
      approved_product_id: "product-aussie",
    }),
    nowIso: "2026-07-03T10:24:32.000Z",
  })

  assert.ok(transition)
  assert.equal(transition.reason, "product_intake_review_resolved")
  assert.deepEqual(
    transition.next_state.agent_v2.active_product_contexts.map((context) => ({
      status: context.status,
      product_id: context.product_id,
      submission_id: context.submission_id,
      display_name: context.display_name,
    })),
    [
      {
        status: "pending_review",
        product_id: null,
        submission_id: "submission-other",
        display_name: "NEQI Hair Oil",
      },
      {
        status: "resolved",
        product_id: "product-aussie",
        submission_id: "submission-1",
        display_name: "AUSSIE Leave-In Haarserum 100 Hours Hydration",
      },
    ],
  )
  assert.equal(
    transition.next_state.agent_v2.active_resolved_product_context?.product_id,
    "product-aussie",
  )
})
