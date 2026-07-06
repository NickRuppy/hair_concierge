import { createHash } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"

import {
  loadAgentV2ConversationStateForUser,
  persistConversationStateTransition,
} from "@/lib/chat-runtime/conversation-state-store"
import {
  AGENT_V2_PRODUCTION_ENGINE,
  type AgentV2ConversationStateTransition,
  type AgentV2ConversationStateV2,
} from "@/lib/agent-v2/production/persisted-session-state"
import {
  buildPrimaryResolvedProductContext,
  mergeActiveProductContexts,
  type AgentV2ActiveProductContext,
} from "@/lib/agent-v2/resolved-product-selection-adapter"
import type { MessageRagContext, ProductIntakeOffer, ProductSubmission } from "@/lib/types"

const ONBOARDING_REVIEW_CONVERSATION_TITLE = "Produktprüfung"

export type ProductSubmissionForNotification = Pick<
  ProductSubmission,
  | "id"
  | "user_id"
  | "source"
  | "source_conversation_id"
  | "user_product_usage_id"
  | "intake_method"
  | "category"
  | "frequency_range"
  | "front_image_path"
  | "barcode_image_path"
  | "status"
  | "brand_text"
  | "product_name_text"
  | "approved_product_id"
  | "user_facing_resolution_reason"
  | "user_facing_next_step"
  | "user_facing_missing_fields"
  | "notification_sent_at"
>

export type ProductIntakeNotificationResult =
  | { sent: true; conversationId: string; messageId: string }
  | { sent: false; reason: "already_sent" | "no_message_needed" }

export type ProductIntakeReviewRagContext = Partial<MessageRagContext> & {
  product_intake_review: {
    submission_id: string
    status: ProductSubmissionForNotification["status"]
    approved_product_id: string | null
  }
  product_intake_offer?: ProductIntakeOffer
}

function productLabel(submission: ProductSubmissionForNotification): string {
  return [submission.brand_text, submission.product_name_text].filter(Boolean).join(" ").trim()
}

function sanitizeMissingFields(fields: unknown): string[] {
  return (Array.isArray(fields) ? fields : [])
    .filter((field): field is string => typeof field === "string")
    .map((field) => field.trim())
    .filter(Boolean)
}

function isDuplicateKeyError(
  error: { code?: string | null; message?: string | null } | null | undefined,
) {
  if (!error) return false
  return error.code === "23505" || /duplicate key|unique constraint/i.test(error.message ?? "")
}

function createStableUuidFromParts(parts: readonly string[]): string {
  const hash = createHash("sha256").update(parts.join("\u001f")).digest()
  hash[6] = (hash[6] & 0x0f) | 0x50
  hash[8] = (hash[8] & 0x3f) | 0x80
  const hex = hash.subarray(0, 16).toString("hex")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function productIntakeReviewMessageId(submission: ProductSubmissionForNotification): string {
  return createStableUuidFromParts(["product-intake-review", submission.id, submission.status])
}

async function bumpConversationUpdatedAtBestEffort(params: {
  supabase: SupabaseClient
  conversationId: string
  updatedAt: string
}): Promise<void> {
  try {
    await bumpConversationUpdatedAt(params)
  } catch (error) {
    console.warn("[product-intake] notification conversation bump failed", error)
  }
}

export function buildProductIntakeReviewMessage(
  submission: ProductSubmissionForNotification,
): string | null {
  const label = productLabel(submission) || "dein Produkt"

  if (submission.status === "approved" || submission.status === "matched_existing") {
    return [
      `Gute Nachrichten: Wir haben **${label}** geprüft und in deiner Routine verknüpft.`,
      "Du kannst mich jetzt konkret dazu fragen, und ich berücksichtige es bei passenden Empfehlungen.",
    ].join("\n\n")
  }

  if (submission.status === "needs_more_info") {
    return [
      `Danke für die Produktangaben zu **${label}**. Wir brauchen noch eine kleine Ergänzung, bevor wir es sauber prüfen können.`,
      submission.user_facing_resolution_reason,
      submission.user_facing_next_step,
    ]
      .filter(Boolean)
      .join("\n\n")
  }

  if (submission.status === "rejected") {
    return [
      `Danke fürs Einreichen von **${label}**. Wir konnten das Produkt so leider nicht sicher in unsere Datenbank aufnehmen.`,
      submission.user_facing_resolution_reason,
      submission.user_facing_next_step,
    ]
      .filter(Boolean)
      .join("\n\n")
  }

  return null
}

export function buildProductIntakeReviewRagContext(
  submission: ProductSubmissionForNotification,
): ProductIntakeReviewRagContext {
  const context: ProductIntakeReviewRagContext = {
    product_intake_review: {
      submission_id: submission.id,
      status: submission.status,
      approved_product_id: submission.approved_product_id,
    },
  }

  if (submission.status === "needs_more_info") {
    context.product_intake_offer = {
      id: `product-intake-follow-up-${submission.id}`,
      source: "chat",
      reason: "needs_more_info",
      category: submission.category,
      frequency_range: submission.frequency_range,
      intake_method: submission.intake_method,
      submission_id: submission.id,
      existing_usage_id: submission.user_product_usage_id,
      committed_front_image_path: submission.front_image_path,
      committed_barcode_image_path: submission.barcode_image_path,
      missing_fields: sanitizeMissingFields(submission.user_facing_missing_fields),
      extracted_identity: {
        ...(submission.brand_text ? { brand_text: submission.brand_text } : {}),
        ...(submission.product_name_text
          ? { product_name_text: submission.product_name_text }
          : {}),
      },
    }
  }

  return context
}

export function buildProductIntakeReviewConversationStateTransition(params: {
  previousState: AgentV2ConversationStateV2
  submission: ProductSubmissionForNotification
  nowIso?: string
}): AgentV2ConversationStateTransition | null {
  if (params.submission.status !== "approved" && params.submission.status !== "matched_existing") {
    return null
  }
  if (!params.submission.approved_product_id) return null

  const nowIso = params.nowIso ?? new Date().toISOString()
  const label = productLabel(params.submission) || "dein Produkt"
  const previousContexts = params.previousState.agent_v2.active_product_contexts.filter(
    (context) => context.submission_id !== params.submission.id,
  )
  const resolvedContext: AgentV2ActiveProductContext = {
    status: "resolved",
    product_id: params.submission.approved_product_id,
    submission_id: params.submission.id,
    category: params.submission.category,
    brand_text: params.submission.brand_text,
    product_name_text: params.submission.product_name_text,
    display_name: label,
    original_user_message: `Wir haben ${label} geprüft und in deiner Routine verknüpft.`,
    source: "product_intake_submission",
    updated_at: nowIso,
  }
  const activeProductContexts = mergeActiveProductContexts({
    previous: previousContexts,
    next: [resolvedContext],
    latestMessageNamesActionableProduct: false,
  })
  const nextState: AgentV2ConversationStateV2 = {
    ...params.previousState,
    agent_v2: {
      ...params.previousState.agent_v2,
      active_product_contexts: activeProductContexts,
      active_resolved_product_context: buildPrimaryResolvedProductContext(activeProductContexts),
    },
  }

  return {
    previous_state: params.previousState,
    next_state: nextState,
    reason: "product_intake_review_resolved",
    changed_fields: [
      "agent_v2.active_product_contexts",
      "agent_v2.active_resolved_product_context",
    ],
    classifier_override: null,
    updated_by_engine: AGENT_V2_PRODUCTION_ENGINE,
  }
}

async function persistProductIntakeReviewConversationStateBestEffort(params: {
  supabase: SupabaseClient
  conversationId: string
  submission: ProductSubmissionForNotification
  updatedAt: string
}): Promise<void> {
  try {
    const previousState = await loadAgentV2ConversationStateForUser(params.supabase, {
      conversationId: params.conversationId,
      userId: params.submission.user_id,
    })
    const transition = buildProductIntakeReviewConversationStateTransition({
      previousState,
      submission: params.submission,
      nowIso: params.updatedAt,
    })
    if (!transition) return

    await persistConversationStateTransition(params.supabase, {
      conversationId: params.conversationId,
      userId: params.submission.user_id,
      transition,
    })
  } catch (error) {
    console.warn("[product-intake] notification conversation state update failed", error)
  }
}

async function findOrCreateOnboardingReviewConversation(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data: existing, error: loadError } = await supabase
    .from("conversations")
    .select("id")
    .eq("user_id", userId)
    .eq("title", ONBOARDING_REVIEW_CONVERSATION_TITLE)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (loadError && loadError.code !== "PGRST116") {
    throw new Error(`load product review conversation: ${loadError.message}`)
  }

  if (existing?.id) return existing.id

  const { data: created, error: createError } = await supabase
    .from("conversations")
    .insert({
      user_id: userId,
      title: ONBOARDING_REVIEW_CONVERSATION_TITLE,
      is_active: true,
    })
    .select("id")
    .single()

  if (createError || !created?.id) {
    throw new Error(`create product review conversation: ${createError?.message ?? "no id"}`)
  }

  return created.id
}

async function conversationIdForSubmission(
  supabase: SupabaseClient,
  submission: ProductSubmissionForNotification,
): Promise<string> {
  if (submission.source === "chat" && submission.source_conversation_id) {
    return submission.source_conversation_id
  }

  return findOrCreateOnboardingReviewConversation(supabase, submission.user_id)
}

async function existingProductIntakeReviewMessageId(params: {
  supabase: SupabaseClient
  conversationId: string
  submissionId: string
  status: ProductSubmissionForNotification["status"]
}): Promise<string | null> {
  const { data, error } = await params.supabase
    .from("messages")
    .select("id")
    .eq("conversation_id", params.conversationId)
    .eq("role", "assistant")
    .contains("rag_context", {
      product_intake_review: {
        submission_id: params.submissionId,
        status: params.status,
      },
    })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error && error.code !== "PGRST116") {
    throw new Error(`load existing product intake notification: ${error.message}`)
  }

  return data?.id ?? null
}

async function markNotificationSent(params: {
  supabase: SupabaseClient
  submissionId: string
  status: ProductSubmissionForNotification["status"]
  sentAt?: string
}): Promise<boolean> {
  const { data, error } = await params.supabase
    .from("product_submissions")
    .update({ notification_sent_at: params.sentAt ?? new Date().toISOString() })
    .eq("id", params.submissionId)
    .eq("status", params.status)
    .is("notification_sent_at", null)
    .select("id")
    .maybeSingle()

  if (error) {
    throw new Error(`mark product intake notification sent: ${error.message}`)
  }

  return Boolean(data?.id)
}

async function releaseNotificationSentClaim(params: {
  supabase: SupabaseClient
  submissionId: string
  status: ProductSubmissionForNotification["status"]
  sentAt: string
}): Promise<void> {
  const { error } = await params.supabase
    .from("product_submissions")
    .update({ notification_sent_at: null })
    .eq("id", params.submissionId)
    .eq("status", params.status)
    .eq("notification_sent_at", params.sentAt)

  if (error) {
    throw new Error(`release product intake notification claim: ${error.message}`)
  }
}

async function bumpConversationUpdatedAt(params: {
  supabase: SupabaseClient
  conversationId: string
  updatedAt: string
}): Promise<void> {
  const { error } = await params.supabase
    .from("conversations")
    .update({ updated_at: params.updatedAt })
    .eq("id", params.conversationId)

  if (error) {
    throw new Error(`bump product intake notification conversation: ${error.message}`)
  }
}

export async function sendProductIntakeReviewNotification(
  supabase: SupabaseClient,
  submission: ProductSubmissionForNotification,
): Promise<ProductIntakeNotificationResult> {
  const content = buildProductIntakeReviewMessage(submission)
  if (!content) {
    return { sent: false, reason: "no_message_needed" }
  }

  const sentAt = submission.notification_sent_at ?? new Date().toISOString()
  const shouldClaimNotification = !submission.notification_sent_at

  if (shouldClaimNotification) {
    const marked = await markNotificationSent({
      supabase,
      submissionId: submission.id,
      status: submission.status,
      sentAt,
    })

    if (!marked) {
      return { sent: false, reason: "already_sent" }
    }
  }

  let notificationMaterialized = false

  try {
    const conversationId = await conversationIdForSubmission(supabase, submission)
    const existingMessageId = await existingProductIntakeReviewMessageId({
      supabase,
      conversationId,
      submissionId: submission.id,
      status: submission.status,
    })

    if (existingMessageId) {
      notificationMaterialized = true
      await bumpConversationUpdatedAtBestEffort({ supabase, conversationId, updatedAt: sentAt })
      await persistProductIntakeReviewConversationStateBestEffort({
        supabase,
        conversationId,
        submission,
        updatedAt: sentAt,
      })
      return { sent: false, reason: "already_sent" }
    }

    const messageId = productIntakeReviewMessageId(submission)
    const { data: message, error: messageError } = await supabase
      .from("messages")
      .insert({
        id: messageId,
        conversation_id: conversationId,
        role: "assistant",
        content,
        rag_context: buildProductIntakeReviewRagContext(submission),
      })
      .select("id")
      .single()

    if (isDuplicateKeyError(messageError)) {
      notificationMaterialized = true
      await bumpConversationUpdatedAtBestEffort({ supabase, conversationId, updatedAt: sentAt })
      await persistProductIntakeReviewConversationStateBestEffort({
        supabase,
        conversationId,
        submission,
        updatedAt: sentAt,
      })
      return { sent: false, reason: "already_sent" }
    }

    if (messageError || !message?.id) {
      throw new Error(
        `send product intake review notification: ${messageError?.message ?? "no id"}`,
      )
    }

    notificationMaterialized = true
    await bumpConversationUpdatedAtBestEffort({ supabase, conversationId, updatedAt: sentAt })
    await persistProductIntakeReviewConversationStateBestEffort({
      supabase,
      conversationId,
      submission,
      updatedAt: sentAt,
    })

    return { sent: true, conversationId, messageId: message.id }
  } catch (error) {
    if (shouldClaimNotification && !notificationMaterialized) {
      try {
        await releaseNotificationSentClaim({
          supabase,
          submissionId: submission.id,
          status: submission.status,
          sentAt,
        })
      } catch (releaseError) {
        console.warn("[product-intake] notification claim rollback failed", releaseError)
      }
    }

    throw error
  }
}
