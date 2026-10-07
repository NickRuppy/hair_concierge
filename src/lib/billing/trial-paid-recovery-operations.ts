import "server-only"
import { parseTrialOfferSnapshot, type TrialOfferSnapshot } from "./trial-offer"
import type { TrialPaymentEvent } from "./trial-payment-events"
import type { TrialManagementClient } from "./trial-management-operations"

export type TrialPaidRecoveryOperation = Readonly<{
  id: string
  enrollmentId: string
  userId: string
  kind: "recover_unpaid" | "repair_paid"
  status: "pending" | "committed" | "abandoned"
  provider: "stripe" | "paypal"
  providerCustomerId: string
  originalAgreementId: string
  sourceAgreementId: string
  offer: TrialOfferSnapshot
  originalTrialEndAt: string
  expectedRevision: number
  cancellationVersion: number
  cancelAtPeriodEnd: boolean
  firstPaymentSucceededAt: string | null
  paidThroughAt: string | null
  sourceObjectId: string | null
  targetAgreementId: string | null
}>
export type TrialPaidRecoveryEvidence = Readonly<{
  provider: "stripe" | "paypal"
  providerCustomerId: string
  sourceAgreementId: string
  targetAgreementId: string
  offer: TrialOfferSnapshot
  sourceAgreementNeutralized: true
  noInFlightSourcePayment: true
  /** repair_paid must prove zero extra collection and renewal starts at owed paidThroughAt. */
  noAdditionalCharge: boolean
  firstBillingAt: string
  reference: string
}>
async function call(client: TrialManagementClient, name: string, args: Record<string, unknown>) {
  const { data, error } = await client.rpc(name, args)
  if (error || data == null) throw new Error("Trial paid recovery requires reconciliation")
  return data
}
function parse(value: unknown): TrialPaidRecoveryOperation {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid trial paid recovery operation")
  const v = value as Record<string, unknown>,
    offer = parseTrialOfferSnapshot(v.offer)
  if (
    !offer ||
    !["recover_unpaid", "repair_paid"].includes(String(v.kind)) ||
    !["pending", "committed", "abandoned"].includes(String(v.status)) ||
    !["stripe", "paypal"].includes(String(v.provider)) ||
    !Number.isSafeInteger(v.expectedRevision) ||
    Number(v.expectedRevision) < 0 ||
    !Number.isSafeInteger(v.cancellationVersion) ||
    Number(v.cancellationVersion) < 0 ||
    typeof v.cancelAtPeriodEnd !== "boolean"
  )
    throw new Error("Invalid trial paid recovery operation")
  for (const key of [
    "id",
    "enrollmentId",
    "userId",
    "providerCustomerId",
    "originalAgreementId",
    "sourceAgreementId",
    "originalTrialEndAt",
  ])
    if (typeof v[key] !== "string" || !v[key])
      throw new Error("Invalid trial paid recovery operation")
  for (const key of [
    "firstPaymentSucceededAt",
    "paidThroughAt",
    "sourceObjectId",
    "targetAgreementId",
  ])
    if (v[key] !== null && typeof v[key] !== "string")
      throw new Error("Invalid trial paid recovery operation")
  return { ...v, offer } as TrialPaidRecoveryOperation
}
/** This explicit action is paid consent, never another free trial or automatic trial eligibility grant. */
export async function beginTrialPaidRecoveryOperation(
  client: TrialManagementClient,
  input: {
    operationId: string
    enrollmentId: string
    authenticatedUserId: string
    kind: "recover_unpaid" | "repair_paid"
    expectedRevision: number
  },
): Promise<TrialPaidRecoveryOperation> {
  return parse(
    await call(client, "begin_trial_paid_recovery_operation", {
      p_operation_id: input.operationId,
      p_enrollment_id: input.enrollmentId,
      p_authenticated_user_id: input.authenticatedUserId,
      p_kind: input.kind,
      p_expected_revision: input.expectedRevision,
    }),
  )
}
export async function loadTrialPaidRecoveryOperation(
  client: TrialManagementClient,
  input: { operationId: string; authenticatedUserId: string },
): Promise<TrialPaidRecoveryOperation> {
  return parse(
    await call(client, "load_trial_paid_recovery_operation", {
      p_operation_id: input.operationId,
      p_authenticated_user_id: input.authenticatedUserId,
    }),
  )
}
export async function guardTrialPaidRecoveryOperation(
  client: TrialManagementClient,
  input: { operationId: string; authenticatedUserId: string },
): Promise<boolean> {
  const result = await call(client, "guard_trial_paid_recovery_operation", {
    p_operation_id: input.operationId,
    p_authenticated_user_id: input.authenticatedUserId,
  })
  if (typeof result !== "boolean") throw new Error("Invalid paid recovery guard")
  return result
}
/** Provider retrieval proof only. recover_unpaid requires its exact verified successful payment; repair_paid requires null. */
export async function commitTrialPaidRecoveryOperation(
  client: TrialManagementClient,
  input: {
    operationId: string
    authenticatedUserId: string
    evidence: TrialPaidRecoveryEvidence
    payment: TrialPaymentEvent | null
  },
): Promise<boolean> {
  const offer = parseTrialOfferSnapshot(input.evidence.offer)
  if (!offer) throw new Error("Invalid paid recovery offer")
  const result = await call(client, "commit_trial_paid_recovery_operation", {
    p_operation_id: input.operationId,
    p_authenticated_user_id: input.authenticatedUserId,
    p_evidence: { ...input.evidence, offer },
    p_payment: input.payment,
  })
  if (typeof result !== "boolean") throw new Error("Invalid paid recovery commit")
  return result
}
/** Only after provider reconciliation proves the abandoned candidate cannot collect. */
export async function abandonTrialPaidRecoveryOperation(
  client: TrialManagementClient,
  input: { operationId: string; authenticatedUserId: string; reconciliationReference: string },
): Promise<boolean> {
  const result = await call(client, "abandon_trial_paid_recovery_operation", {
    p_operation_id: input.operationId,
    p_authenticated_user_id: input.authenticatedUserId,
    p_reconciliation_reference: input.reconciliationReference,
  })
  if (typeof result !== "boolean") throw new Error("Invalid paid recovery abandonment")
  return result
}
