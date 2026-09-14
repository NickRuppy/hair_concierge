import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { TrialIdentityClaim } from "./trial-eligibility"
import { parseTrialOfferSnapshot, type TrialOfferSnapshot } from "./trial-offer"

type TrialAdmissionClient = Pick<SupabaseClient, "from" | "rpc">
export type TrialAdmissionResult =
  | "reserved"
  | "active"
  | "trial_used"
  | "claim_reserved"
  | "invalid_state"

const RESULTS = new Set<TrialAdmissionResult>([
  "reserved",
  "active",
  "trial_used",
  "claim_reserved",
  "invalid_state",
])

export type TrialEnrollmentInput = {
  /** Stable server-issued checkout attempt UUID, reused after transport failures. */
  id: string
  userId: string | null
  provider: "stripe" | "paypal"
  offer: TrialOfferSnapshot
}

function uuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  )
}

/**
 * Persistence only, with no callers enabled yet. Privacy clearance must precede
 * every real write. Callers verify account/lead ownership and existing access,
 * and attest the live provider catalog before constructing an accepted offer.
 * Creation alone grants no entitlement and consumes no identity.
 */
export async function createTrialEnrollment(
  client: TrialAdmissionClient,
  input: TrialEnrollmentInput,
): Promise<string> {
  const offer = parseTrialOfferSnapshot(input.offer)
  if (
    !uuid(input.id) ||
    (input.userId !== null && !uuid(input.userId)) ||
    !["stripe", "paypal"].includes(input.provider) ||
    !offer
  ) {
    throw new Error("Invalid trial enrollment")
  }
  const row = {
    id: input.id,
    user_id: input.userId,
    provider: input.provider,
    cohort: offer.cohort,
    accepted_offer: offer,
  }
  const inserted = await client
    .from("trial_enrollments")
    .upsert(row, { onConflict: "id", ignoreDuplicates: true })
  if (inserted.error) throw new Error("Trial enrollment persistence failed")

  // A retry must match the original attempt; it must never rewrite accepted terms.
  const existing = await client
    .from("trial_enrollments")
    .select("id,user_id,provider,accepted_offer")
    .eq("id", input.id)
    .single()
  if (existing.error || !existing.data) throw new Error("Trial enrollment lookup failed")
  const accepted = parseTrialOfferSnapshot(existing.data.accepted_offer)
  if (
    !accepted ||
    existing.data.user_id !== input.userId ||
    existing.data.provider !== input.provider ||
    JSON.stringify(accepted) !== JSON.stringify(offer)
  ) {
    throw new Error("Trial enrollment attempt does not match accepted terms")
  }
  return input.id
}

/** No access or history consumption until the activation RPC succeeds. */
export async function reserveTrialAdmission(
  client: TrialAdmissionClient,
  enrollmentId: string,
  claims: readonly TrialIdentityClaim[],
): Promise<TrialAdmissionResult> {
  return admit(client, enrollmentId, claims, null, null)
}

/**
 * Requires retrieved, reconciled provider evidence, never browser-return fields.
 * Include every reliable known identity, including all retained HMAC key versions.
 * A denial after authorization requires provider neutralization before any retry;
 * the database records that debt but does not perform the provider operation.
 */
export async function activateTrialAdmission(
  client: TrialAdmissionClient,
  input: {
    enrollmentId: string
    claims: readonly TrialIdentityClaim[]
    authorizationSucceededAt: Date
    providerAgreementId: string
  },
): Promise<TrialAdmissionResult> {
  if (
    !(input.authorizationSucceededAt instanceof Date) ||
    !Number.isFinite(input.authorizationSucceededAt.getTime()) ||
    typeof input.providerAgreementId !== "string" ||
    !input.providerAgreementId.trim() ||
    input.providerAgreementId.length > 255
  ) {
    throw new Error("Invalid verified trial authorization")
  }
  return admit(
    client,
    input.enrollmentId,
    input.claims,
    input.authorizationSucceededAt.toISOString(),
    input.providerAgreementId,
  )
}

async function admit(
  client: TrialAdmissionClient,
  enrollmentId: string,
  claims: readonly TrialIdentityClaim[],
  authorizedAt: string | null,
  agreementId: string | null,
): Promise<TrialAdmissionResult> {
  if (!uuid(enrollmentId)) throw new Error("Invalid trial enrollment")
  const { data, error } = await client.rpc("admit_trial_enrollment", {
    p_enrollment_id: enrollmentId,
    p_claims: claims,
    p_authorized_at: authorizedAt,
    p_provider_agreement_id: agreementId,
  })
  if (error || !RESULTS.has(data as TrialAdmissionResult)) {
    throw new Error("Trial admission reconciliation required")
  }
  return data as TrialAdmissionResult
}

/** Only after the provider has confirmed no remaining authorization/collection. */
export async function releaseTrialAdmission(
  client: TrialAdmissionClient,
  enrollmentId: string,
  reconciliationReference: string,
): Promise<boolean> {
  if (
    !uuid(enrollmentId) ||
    typeof reconciliationReference !== "string" ||
    !reconciliationReference.trim() ||
    reconciliationReference.length > 255
  ) {
    throw new Error("Invalid trial reconciliation reference")
  }
  const { data, error } = await client.rpc("release_trial_enrollment", {
    p_enrollment_id: enrollmentId,
    p_neutralization_evidence: reconciliationReference,
  })
  if (error || typeof data !== "boolean") throw new Error("Trial release reconciliation required")
  return data
}
