import "server-only"

import { parseTrialOfferSnapshot, type TrialOfferSnapshot } from "./trial-offer"

export type TrialManagementClient = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>
}
export type TrialManagementCatalog = Readonly<{
  month: TrialOfferSnapshot
  year: TrialOfferSnapshot
}>
export type TrialManagementOperation = Readonly<{
  id: string
  enrollmentId: string
  userId: string
  kind: "switch" | "restore"
  status: "pending" | "committed" | "abandoned"
  expectedRevision: number
  cancellationVersion: number
  provider: "stripe" | "paypal"
  providerCustomerId: string
  originalAgreementId: string
  sourceAgreementId: string
  originalTrialEndAt: string
  sourceOffer: TrialOfferSnapshot
  targetOffer: TrialOfferSnapshot
  cancelAtPeriodEnd: boolean
  targetAgreementId: string | null
}>
export type TrialManagementState = Readonly<{
  enrollmentId: string
  revision: number
  effectiveOffer: TrialOfferSnapshot
  originalAgreementId: string | null
  currentAgreementId: string | null
}>
/** The adapter must retrieve the provider object and validate these facts. Browser approval is insufficient. */
export type TrialManagementProviderEvidence = Readonly<{
  provider: "stripe" | "paypal"
  providerCustomerId: string
  sourceAgreementId: string
  targetAgreementId: string
  originalTrialEndAt: string
  offer: TrialOfferSnapshot
  cancelAtPeriodEnd: boolean
  noImmediatePayment: true
  sourceAgreementNeutralized: boolean
  reference: string
}>

async function rpc(client: TrialManagementClient, name: string, args: Record<string, unknown>) {
  const { data, error } = await client.rpc(name, args)
  if (error || data == null) throw new Error("Trial management reconciliation required")
  return data
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid trial management result")
  return value as Record<string, unknown>
}
function offer(value: unknown) {
  const parsed = parseTrialOfferSnapshot(value)
  if (!parsed) throw new Error("Invalid frozen trial management offer")
  return parsed
}
function operation(value: unknown): TrialManagementOperation {
  const row = object(value)
  const result = {
    ...row,
    sourceOffer: offer(row.sourceOffer),
    targetOffer: offer(row.targetOffer),
  }
  for (const key of [
    "id",
    "enrollmentId",
    "userId",
    "providerCustomerId",
    "originalAgreementId",
    "sourceAgreementId",
    "originalTrialEndAt",
  ])
    if (typeof row[key] !== "string" || !row[key])
      throw new Error("Invalid trial management result")
  if (
    !["switch", "restore"].includes(String(row.kind)) ||
    !["pending", "committed", "abandoned"].includes(String(row.status)) ||
    !["stripe", "paypal"].includes(String(row.provider)) ||
    !Number.isSafeInteger(row.expectedRevision) ||
    Number(row.expectedRevision) < 0 ||
    !Number.isSafeInteger(row.cancellationVersion) ||
    Number(row.cancellationVersion) < 0 ||
    typeof row.cancelAtPeriodEnd !== "boolean" ||
    !(row.targetAgreementId === null || typeof row.targetAgreementId === "string")
  )
    throw new Error("Invalid trial management result")
  return result as TrialManagementOperation
}

/** Freeze at original enrollment creation, before authorization, from the attested original catalog. */
export async function freezeTrialManagementCatalog(
  client: TrialManagementClient,
  input: {
    enrollmentId: string
    catalog: TrialManagementCatalog
  },
): Promise<void> {
  const month = offer(input.catalog.month),
    year = offer(input.catalog.year)
  if (
    month.interval !== "month" ||
    year.interval !== "year" ||
    month.stripePriceId === year.stripePriceId
  )
    throw new Error("Invalid frozen trial management catalog")
  if (
    (await rpc(client, "freeze_trial_management_catalog", {
      p_enrollment_id: input.enrollmentId,
      p_catalog: { month, year },
    })) !== true
  )
    throw new Error("Trial management catalog could not be frozen")
}

export async function loadTrialManagementState(
  client: TrialManagementClient,
  input: {
    enrollmentId: string
    authenticatedUserId: string
  },
): Promise<TrialManagementState> {
  const row = object(
    await rpc(client, "load_trial_management_state", {
      p_enrollment_id: input.enrollmentId,
      p_authenticated_user_id: input.authenticatedUserId,
    }),
  )
  if (
    typeof row.enrollmentId !== "string" ||
    !Number.isSafeInteger(row.revision) ||
    Number(row.revision) < 0 ||
    !(row.originalAgreementId === null || typeof row.originalAgreementId === "string") ||
    !(row.currentAgreementId === null || typeof row.currentAgreementId === "string")
  )
    throw new Error("Invalid trial management state")
  return { ...row, effectiveOffer: offer(row.effectiveOffer) } as TrialManagementState
}

/** Durable reservation only. Does not clear cancellation, change selected terms or call a provider. */
export async function beginTrialManagementOperation(
  client: TrialManagementClient,
  input: {
    operationId: string
    enrollmentId: string
    authenticatedUserId: string
    kind: "switch" | "restore"
    expectedRevision: number
    targetInterval: "month" | "year"
  },
): Promise<TrialManagementOperation> {
  return operation(
    await rpc(client, "begin_trial_management_operation", {
      p_operation_id: input.operationId,
      p_enrollment_id: input.enrollmentId,
      p_authenticated_user_id: input.authenticatedUserId,
      p_kind: input.kind,
      p_expected_revision: input.expectedRevision,
      p_target_interval: input.targetInterval,
    }),
  )
}
export async function loadTrialManagementOperation(
  client: TrialManagementClient,
  input: {
    operationId: string
    authenticatedUserId: string
  },
): Promise<TrialManagementOperation> {
  return operation(
    await rpc(client, "load_trial_management_operation", {
      p_operation_id: input.operationId,
      p_authenticated_user_id: input.authenticatedUserId,
    }),
  )
}
/** False means no local commit: provider effects must be reconciled/neutralized, never treated as success. */
export async function commitTrialManagementOperation(
  client: TrialManagementClient,
  input: {
    operationId: string
    authenticatedUserId: string
    evidence: TrialManagementProviderEvidence
  },
): Promise<boolean> {
  const result = await rpc(client, "commit_trial_management_operation", {
    p_operation_id: input.operationId,
    p_authenticated_user_id: input.authenticatedUserId,
    p_evidence: { ...input.evidence, offer: offer(input.evidence.offer) },
  })
  if (typeof result !== "boolean") throw new Error("Invalid trial management commit result")
  return result
}
/** Call only after verifying old agreement/plan/cancellation remain effective and candidate cannot collect. */
export async function abandonTrialManagementOperation(
  client: TrialManagementClient,
  input: {
    operationId: string
    authenticatedUserId: string
    reconciliationReference: string
  },
): Promise<boolean> {
  const result = await rpc(client, "abandon_trial_management_operation", {
    p_operation_id: input.operationId,
    p_authenticated_user_id: input.authenticatedUserId,
    p_reconciliation_reference: input.reconciliationReference,
  })
  if (typeof result !== "boolean") throw new Error("Invalid trial management abandonment result")
  return result
}

/** Recheck immediately before provider effects; commit still repeats the CAS after retrieval. */
export async function guardTrialManagementOperation(
  client: TrialManagementClient,
  input: {
    operationId: string
    authenticatedUserId: string
  },
): Promise<boolean> {
  const result = await rpc(client, "guard_trial_management_operation", {
    p_operation_id: input.operationId,
    p_authenticated_user_id: input.authenticatedUserId,
  })
  if (typeof result !== "boolean") throw new Error("Invalid trial management guard result")
  return result
}

export async function loadFrozenTrialManagementCatalog(
  client: TrialManagementClient,
  enrollmentId: string,
): Promise<TrialManagementCatalog | null> {
  const { data, error } = await client.rpc("load_frozen_trial_management_catalog", {
    p_enrollment_id: enrollmentId,
  })
  if (error) throw new Error("Frozen trial management catalog unavailable")
  if (data === null) return null
  const row = object(data)
  const month = offer(row.month),
    year = offer(row.year)
  if (month.interval !== "month" || year.interval !== "year")
    throw new Error("Invalid frozen trial management catalog")
  return { month, year }
}
