import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createTrialIdentityClaims } from "./trial-identity-claims"
import { isTrialEnrollmentAllowed, type TrialRuntime } from "./trial-runtime"
import { evaluateTrialEligibility } from "./trial-eligibility"

/** Read only the authenticated account's lawful, currently matchable history. */
export async function hasConsumedTrialHistory(
  admin: SupabaseClient,
  input: { userId: string; verifiedEmail: string | null; runtime: TrialRuntime },
): Promise<boolean> {
  const claims = createTrialIdentityClaims(
    [
      { kind: "account", namespace: "chaarlie", normalizedIdentity: input.userId },
      ...(input.verifiedEmail
        ? [
            {
              kind: "verified_email" as const,
              namespace: "chaarlie",
              normalizedIdentity: input.verifiedEmail.trim().toLowerCase(),
            },
          ]
        : []),
    ],
    input.runtime.identityKeys,
  )
  const consumed = []
  for (const claim of claims) {
    const result = await admin
      .from("trial_identity_claims")
      .select("consumed_at")
      .eq("kind", claim.kind)
      .eq("key_version", claim.keyVersion)
      .eq("namespace", claim.namespace)
      .eq("claim_digest", claim.value)
      .not("consumed_at", "is", null)
      .limit(1)
    if (result.error) throw new Error("Trial history unavailable")
    if (result.data?.length) consumed.push(claim)
  }
  return (
    evaluateTrialEligibility(
      {
        consumedClaims: consumed,
        currentAccess: "none",
        lookupSucceeded: true,
        reviewRequired: false,
      },
      { claims },
    ).reason === "trial_used"
  )
}

/** Presentation only. Atomic checkout admission remains the eligibility authority. */
export async function trialOfferDestinationForReturningCustomer(
  admin: SupabaseClient,
  input: { userId: string; verifiedEmail: string | null; runtime: TrialRuntime | null },
): Promise<string | null> {
  if (
    !input.runtime ||
    !input.verifiedEmail ||
    !isTrialEnrollmentAllowed(input.runtime, input.verifiedEmail)
  )
    return null
  if (await hasConsumedTrialHistory(admin, { ...input, runtime: input.runtime })) return null
  const lead = await admin
    .from("leads")
    .select("id")
    .eq("user_id", input.userId)
    .eq("quiz_kind", "personal_plan")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (lead.error) throw new Error("Trial offer unavailable")
  return lead.data?.id ? `/result/${encodeURIComponent(lead.data.id)}?focus=unlock-plan` : "/quiz"
}
