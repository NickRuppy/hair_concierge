import type { SupabaseClient } from "@supabase/supabase-js"

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
  if (submission.notification_sent_at) {
    return { sent: false, reason: "already_sent" }
  }

  const content = buildProductIntakeReviewMessage(submission)
  if (!content) {
    return { sent: false, reason: "no_message_needed" }
  }

  const conversationId = await conversationIdForSubmission(supabase, submission)
  const existingMessageId = await existingProductIntakeReviewMessageId({
    supabase,
    conversationId,
    submissionId: submission.id,
    status: submission.status,
  })

  if (existingMessageId) {
    const sentAt = new Date().toISOString()
    const marked = await markNotificationSent({
      supabase,
      submissionId: submission.id,
      status: submission.status,
      sentAt,
    })
    if (marked) {
      await bumpConversationUpdatedAt({ supabase, conversationId, updatedAt: sentAt })
    }
    return { sent: false, reason: "already_sent" }
  }

  const sentAt = new Date().toISOString()
  const { data: message, error: messageError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      role: "assistant",
      content,
      rag_context: buildProductIntakeReviewRagContext(submission),
    })
    .select("id")
    .single()

  if (messageError || !message?.id) {
    throw new Error(`send product intake review notification: ${messageError?.message ?? "no id"}`)
  }

  const marked = await markNotificationSent({
    supabase,
    submissionId: submission.id,
    status: submission.status,
    sentAt,
  })

  if (!marked) {
    return { sent: false, reason: "already_sent" }
  }

  await bumpConversationUpdatedAt({ supabase, conversationId, updatedAt: sentAt })

  return { sent: true, conversationId, messageId: message.id }
}
