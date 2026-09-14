import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"

type RpcResult = { data: unknown; error: unknown }

export type TrialCancellationDeclaration = Readonly<{
  declarationId: string
  submittedAt: string
  effectiveEndAt: string
}>

export type SubmitTrialCancellationInput = Readonly<{
  requestId: string
  authenticatedUserId: string
  enrollmentId: string
}>

export type TrialCancellationDeclarationClient = Readonly<{
  rpc: (name: string, args: Record<string, string>) => PromiseLike<RpcResult>
}>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function validUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value)
}

function validTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T/.test(value) &&
    Number.isFinite(Date.parse(value))
  )
}

function parseResult(value: unknown): TrialCancellationDeclaration | null {
  if (!value || typeof value !== "object") return null
  const row = Array.isArray(value) ? value[0] : ((value as { 0?: unknown })[0] ?? value)
  if (!row || typeof row !== "object") return null
  const fields = row as Record<string, unknown>
  if (
    !validUuid(fields.declaration_id) ||
    !validTimestamp(fields.submitted_at) ||
    !validTimestamp(fields.effective_end_at)
  )
    return null
  return {
    declarationId: fields.declaration_id,
    submittedAt: fields.submitted_at,
    effectiveEndAt: fields.effective_end_at,
  }
}

function defaultClient(): TrialCancellationDeclarationClient {
  return createAdminClient()
}

/**
 * Persists the statutory declaration and both durable work items before any
 * provider request. This service intentionally neither calls a provider nor
 * sends a receipt; those later workers reconcile their declaration-bound rows.
 */
export async function submitTrialCancellationDeclaration(
  input: SubmitTrialCancellationInput,
  client: TrialCancellationDeclarationClient = defaultClient(),
): Promise<TrialCancellationDeclaration> {
  if (
    !validUuid(input.requestId) ||
    !validUuid(input.authenticatedUserId) ||
    !validUuid(input.enrollmentId)
  ) {
    throw new Error("Invalid trial cancellation declaration")
  }
  const { data, error } = await client.rpc("submit_trial_cancellation_declaration", {
    p_request_id: input.requestId,
    p_authenticated_user_id: input.authenticatedUserId,
    p_enrollment_id: input.enrollmentId,
  })
  const result = error ? null : parseResult(data)
  if (!result) throw new Error("Trial cancellation declaration could not be accepted")
  return result
}
