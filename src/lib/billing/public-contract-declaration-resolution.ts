import "server-only"
import type { PublicDeclarationClient } from "./public-contract-declarations"
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function id(value: string) {
  if (!UUID.test(value)) throw new Error("Invalid declaration resolution identifier")
  return value
}
function reference(value: string) {
  if (typeof value !== "string" || !value.trim() || value.length > 200 || /[\r\n]/.test(value))
    throw new Error("Invalid verification reference")
  return value
}
async function rpc(client: PublicDeclarationClient, name: string, args: Record<string, unknown>) {
  const { data, error } = await client.rpc(name, args)
  if (error)
    throw new Error(
      "Declaration resolution operation rejected; inspect the exact case and evidence",
    )
  return data
}
export async function inspectPublicContractDeclarationResolution(
  client: PublicDeclarationClient,
  declarationId: string,
) {
  const data = await rpc(client, "inspect_public_contract_declaration_resolution", {
    p_declaration_id: id(declarationId),
  })
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("Declaration resolution unavailable")
  return data as Record<string, unknown>
}
/** Reference attests an independent ownership/contract check, not submitted-email matching. */
export async function matchPublicContractDeclaration(
  client: PublicDeclarationClient,
  input: {
    declarationId: string
    verifiedUserId: string
    enrollmentId: string
    verificationReference: string
  },
) {
  const data = await rpc(client, "match_public_contract_declaration", {
    p_declaration_id: id(input.declarationId),
    p_verified_user_id: id(input.verifiedUserId),
    p_enrollment_id: id(input.enrollmentId),
    p_verification_reference: reference(input.verificationReference),
  })
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("Invalid declaration match result")
  return data as Record<string, unknown>
}
export type PublicTrialCancellationApplication =
  | { outcome: "provider_operation_queued"; trialDeclarationId: string }
  | { outcome: "payment_review_required" | "external_review_required" }
export async function applyMatchedPublicTrialCancellation(
  client: PublicDeclarationClient,
  input: { declarationId: string; interpretationReference: string },
): Promise<PublicTrialCancellationApplication> {
  const data = await rpc(client, "apply_public_trial_cancellation", {
    p_declaration_id: id(input.declarationId),
    p_interpretation_reference: reference(input.interpretationReference),
  })
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("Invalid declaration application result")
  const result = data as Record<string, unknown>
  if (result.outcome === "payment_review_required" || result.outcome === "external_review_required")
    return { outcome: result.outcome }
  if (
    result.outcome === "provider_operation_queued" &&
    typeof result.trialDeclarationId === "string"
  )
    return { outcome: result.outcome, trialDeclarationId: id(result.trialDeclarationId) }
  throw new Error("Invalid declaration application result")
}
export type PublicDeclarationCompletionEvidence = {
  completionReference: string
  providerTerminationReference: string
  effectiveEndAt: string
  refundDisposition: "not_due" | "completed"
  refundReference: string | null
  refundAssessmentReference: string
}
export function parsePublicDeclarationCompletionEvidence(
  value: unknown,
): PublicDeclarationCompletionEvidence {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Completion evidence required")
  const e = value as Record<string, unknown>
  const keys = [
    "completionReference",
    "providerTerminationReference",
    "effectiveEndAt",
    "refundDisposition",
    "refundReference",
    "refundAssessmentReference",
  ]
  if (
    Object.keys(e).length !== keys.length ||
    !keys.every((k) => Object.hasOwn(e, k)) ||
    typeof e.effectiveEndAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T/.test(e.effectiveEndAt) ||
    !Number.isFinite(Date.parse(e.effectiveEndAt)) ||
    !(e.refundDisposition === "not_due" || e.refundDisposition === "completed") ||
    !(e.refundDisposition === "not_due"
      ? e.refundReference === null
      : typeof e.refundReference === "string")
  )
    throw new Error("Invalid completion evidence")
  return {
    completionReference: reference(e.completionReference as string),
    providerTerminationReference: reference(e.providerTerminationReference as string),
    effectiveEndAt: e.effectiveEndAt,
    refundDisposition: e.refundDisposition,
    refundReference:
      e.refundDisposition === "completed" ? reference(e.refundReference as string) : null,
    refundAssessmentReference: reference(e.refundAssessmentReference as string),
  }
}
/** Records externally verified completion only. Does not cancel, refund or send. */
export async function completePublicContractDeclarationResolution(
  client: PublicDeclarationClient,
  input: { declarationId: string; evidence: unknown },
) {
  const result = await rpc(client, "complete_public_contract_declaration_resolution", {
    p_declaration_id: id(input.declarationId),
    p_evidence: parsePublicDeclarationCompletionEvidence(input.evidence),
  })
  if (result !== true) throw new Error("Declaration resolution was not completed")
  return { declarationId: input.declarationId, status: "resolved" as const }
}
