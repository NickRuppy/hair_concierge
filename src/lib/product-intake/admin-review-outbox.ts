import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  CustomerIoAmbiguousDeliveryError,
  CustomerIoHttpError,
  sendCustomerIoTransactionalEmailWithReceipt,
  type CustomerIoTransactionalDeliveryReceipt,
} from "@/lib/customerio/transactional"
import {
  adminReviewURL,
  buildAdminReviewEmail,
  validateAdminReviewSnapshot,
  type AdminReviewEmailSnapshot,
} from "./admin-review-email"

export type AdminReviewOutboxClient = Pick<SupabaseClient, "rpc">
export type AdminReviewOutboxClaim = {
  id: string
  submission_id: string
  kind: string
  payload: unknown
  lease_token: string
}
export type AdminReviewOutboxResult =
  | { status: "disabled" | "empty" }
  | { status: "sent"; notificationId: string; deliveryId: string }
  | {
      status: "retry_recorded" | "failed" | "needs_reconciliation"
      notificationId: string
      errorCode: string
    }

type Mode = "automatic" | "test"

function errorCode(error: unknown): {
  result: "definite_transient" | "ambiguous" | "permanent"
  code: string
} {
  if (error instanceof CustomerIoAmbiguousDeliveryError)
    return { result: "ambiguous", code: "provider_ambiguous" }
  if (error instanceof CustomerIoHttpError) {
    if (error.status === 429) return { result: "definite_transient", code: "provider_http_429" }
    // Server/gateway failures do not prove the provider rejected the send before
    // accepting it. Hold them like transport timeouts rather than risk duplicates.
    if (error.status >= 500) return { result: "ambiguous", code: "provider_http_5xx" }
    if (error.status === 408) return { result: "ambiguous", code: "provider_http_408" }
    return { result: "permanent", code: "provider_http_4xx" }
  }
  return { result: "ambiguous", code: "provider_ambiguous" }
}

function validClaim(value: unknown): value is AdminReviewOutboxClaim {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const row = value as Record<string, unknown>
  return (
    ["id", "submission_id", "kind", "lease_token"].every(
      (key) => typeof row[key] === "string" && row[key].trim().length > 0,
    ) && "payload" in row
  )
}

async function invoke(
  client: AdminReviewOutboxClient,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const { data, error } = await client.rpc(name, args)
  if (error) throw new Error("Product Intake admin notification storage operation failed")
  return data
}

async function settle(
  client: AdminReviewOutboxClient,
  claim: AdminReviewOutboxClaim,
  result: "sent" | "definite_transient" | "ambiguous" | "permanent",
  input: { deliveryId?: string; queuedAt?: string | number; errorCode?: string } = {},
) {
  const settled = await invoke(client, "product_intake_settle_admin_notification", {
    target_id: claim.id,
    expected_lease_token: claim.lease_token,
    result,
    delivery_id: input.deliveryId ?? null,
    queued_at: input.queuedAt === undefined ? null : String(input.queuedAt),
    error_code: input.errorCode ?? null,
  })
  if (settled !== true) throw new Error("Product Intake admin notification lease lost")
}

/** Drain exactly one leased notification. The scheduler owns repeat polling and retry cadence. */
export async function drainAdminReviewOutbox(
  client: AdminReviewOutboxClient,
  options: { mode?: Mode } = {},
): Promise<AdminReviewOutboxResult> {
  const mode = options.mode ?? "automatic"
  // The guard deliberately happens before configuration or provider credential reads.
  if (mode === "automatic" && process.env.PRODUCT_INTAKE_REVIEW_EMAILS !== "true")
    return { status: "disabled" }
  if (mode === "test" && process.env.PRODUCT_INTAKE_REVIEW_EMAILS === "true")
    throw new Error(
      "Product Intake review test delivery requires automatic alerts to stay disabled",
    )

  let build: (snapshot: AdminReviewEmailSnapshot) => ReturnType<typeof buildAdminReviewEmail>
  try {
    // Validate the private recipient/template/key before leasing a durable row.
    const probe = buildAdminReviewEmail(
      {
        product_name: "Produkt zur Prüfung",
        category_label: "Shampoo",
        outcome_label: "Bereit zur Prüfung",
        question_1: "",
        question_2: "",
        question_3: "",
        review_url:
          mode === "test"
            ? "https://chaarlie.de/admin"
            : "https://chaarlie.de/admin/produkt-intake/11111111-1111-4111-8111-111111111111",
        is_test: mode === "test",
      },
      undefined,
      undefined,
      { test: mode === "test" },
    )
    if (!process.env.CUSTOMERIO_APP_API_KEY?.trim())
      throw new Error("Product Intake admin review delivery is not configured")
    // `probe` only validates the private transport configuration. Each claimed
    // snapshot is rebuilt below so trigger data cannot cross notification rows.
    void probe
    build = (snapshot) =>
      buildAdminReviewEmail(snapshot, undefined, undefined, { test: mode === "test" })
  } catch {
    throw new Error("Product Intake admin review delivery is not configured")
  }

  const claimed = await invoke(client, "product_intake_claim_admin_notification", {})
  if (!Array.isArray(claimed) || claimed.length === 0) return { status: "empty" }
  const claim = claimed[0]
  if (!validClaim(claim)) throw new Error("Invalid Product Intake admin notification claim")

  let snapshot: AdminReviewEmailSnapshot
  try {
    snapshot = validateAdminReviewSnapshot(claim.payload, { test: mode === "test" })
    if (
      (claim.kind !== "ready_for_review" && claim.kind !== "needs_nick") ||
      snapshot.outcome_label !==
        (claim.kind === "ready_for_review" ? "Bereit zur Prüfung" : "Entscheidung nötig") ||
      (mode === "automatic" && snapshot.review_url !== adminReviewURL(claim.submission_id))
    )
      throw new Error("Invalid admin review claim")
    // Rebuild after validation so the provider receives this claim's exact snapshot.
    build(snapshot)
  } catch {
    await settle(client, claim, "permanent", { errorCode: "invalid_snapshot" })
    return { status: "failed", notificationId: claim.id, errorCode: "invalid_snapshot" }
  }

  let receipt: CustomerIoTransactionalDeliveryReceipt
  try {
    receipt = await sendCustomerIoTransactionalEmailWithReceipt(build(snapshot))
  } catch (error) {
    const classified = errorCode(error)
    await settle(client, claim, classified.result, { errorCode: classified.code })
    return {
      status:
        classified.result === "permanent"
          ? "failed"
          : classified.result === "ambiguous"
            ? "needs_reconciliation"
            : "retry_recorded",
      notificationId: claim.id,
      errorCode: classified.code,
    }
  }
  // Keep settlement outside the provider try/catch. A fence/storage failure must
  // be visible to the caller, never rewritten as a provider retry outcome.
  await settle(client, claim, "sent", {
    deliveryId: receipt.deliveryId,
    queuedAt: receipt.queuedAt,
  })
  return { status: "sent", notificationId: claim.id, deliveryId: receipt.deliveryId }
}
