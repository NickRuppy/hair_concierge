"use client"

// Fictional browser-local state only. The Lab never invokes an Admin mutation API.
import type { ReviewPublicationPreflight } from "@/lib/product-intake/review-publication"
import type { ReviewPublicationReceipt } from "@chaarlie/product-intake-core"

const states = new Map<string, ReviewPublicationPreflight>()
export async function runLabReviewAction(
  id: string,
  body: Record<string, unknown>,
  initial: ReviewPublicationPreflight | null,
): Promise<Response> {
  if (process.env.NODE_ENV !== "development" || !initial)
    return Response.json({ error: "Vorschau nicht verfügbar." }, { status: 404 })
  const state = states.get(id) ?? structuredClone(initial)
  states.set(id, state)
  if (body.action === "preflight") return Response.json(state)
  if (body.action === "retry_publication_notification") {
    if (state.publication) state.publication.notification_status = "sent"
    return Response.json({ notification_status: "sent" })
  }
  if (body.action === "retry_decision_notification")
    return Response.json({ notification_status: "sent" })
  if (
    body.payload_revision !== state.payload_revision ||
    body.payload_sha256 !== state.payload_sha256
  )
    return Response.json(
      { error: "Die Recherche hat sich geändert. Bitte lade den Eintrag neu." },
      { status: 409 },
    )
  if (body.action === "approve_data")
    state.data_decision_id = "66666666-6666-4666-8666-666666666666"
  if (body.action === "approve_image" || body.action === "approve_no_image")
    state.image_decision_id = "55555555-5555-4555-8555-555555555555"
  if (body.action === "reject_image") state.image_decision_id = null
  state.blockers = [
    ...(!state.data_decision_id ? ["data_approval_missing"] : []),
    ...(!state.image_decision_id ? ["image_approval_missing"] : []),
  ]
  state.ok = state.blockers.length === 0
  if (body.action === "publish") {
    if (!state.ok || body.confirm !== true)
      return Response.json({ error: "Die beiden Freigaben fehlen." }, { status: 409 })
    state.publication ??= {
      submission_id: id,
      job_id: state.job_id,
      review_cycle_id: state.review_cycle_id,
      payload_revision: state.payload_revision,
      payload_sha256: state.payload_sha256,
      id: "88888888-8888-4888-8888-888888888888",
      request_id: String(body.request_id),
      product_id: "99999999-9999-4999-8999-999999999999",
      brand_id: id,
      product_line_id: null,
      persisted_payload_revision: 4,
      persisted_payload_sha256: "b".repeat(64),
      data_decision_id: state.data_decision_id!,
      image_decision_id: state.image_decision_id!,
      approved_asset_sha256: "a".repeat(64),
      reviewed_by: "Lokale Vorschau",
      created_at: "2026-10-16T12:00:00Z",
      notification_status: "failed",
      notification_message_id: null,
      notification_error_code: "fictional_delivery_failure",
    } satisfies ReviewPublicationReceipt
    return Response.json({ publication: state.publication })
  }
  if (["answer", "rework", "approve_raw"].includes(String(body.action))) {
    state.data_decision_id = null
    state.image_decision_id = null
    state.ok = false
    state.blockers = ["job_not_reviewable"]
  }
  return Response.json({
    decision: {
      id: crypto.randomUUID(),
      notification_status: ["request_info", "reject", "link_existing"].includes(String(body.action))
        ? "sent"
        : "not_required",
    },
  })
}
