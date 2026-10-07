import "server-only"
import { createTrialIdentityClaims, type TrialIdentityInput } from "./trial-identity-claims"
import type { TrialRuntime } from "./trial-runtime"

type Client = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>
}
/** Caller supplies a provider-verified successful, nonzero subscription payment and canonical ownership. */
export async function recordPriorPaidMembershipHistory(
  client: Client,
  input: {
    source: { provider: "stripe" | "paypal"; agreementId: string }
    runtime: TrialRuntime
    userId: string
    verifiedEmail?: string | null
    paidAt: Date
    amountMinor: number
    paymentIdentity?: { kind: "stripe_card" | "paypal_payer"; namespace: string; value: string }
  },
) {
  if (
    !/^[0-9a-f-]{36}$/i.test(input.userId) ||
    !Number.isSafeInteger(input.amountMinor) ||
    input.amountMinor <= 0 ||
    !Number.isFinite(input.paidAt.getTime()) ||
    input.paidAt.getTime() > Date.now() ||
    !["stripe", "paypal"].includes(input.source?.provider) ||
    !input.source.agreementId.trim() ||
    input.source.agreementId.length > 255
  )
    throw new Error("Invalid verified paid membership history")
  const identities: TrialIdentityInput[] = [
    { kind: "account", namespace: "chaarlie", normalizedIdentity: input.userId },
  ]
  if (input.verifiedEmail) {
    const email = input.verifiedEmail.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid verified owner email")
    identities.push({ kind: "verified_email", namespace: "chaarlie", normalizedIdentity: email })
  }
  if (input.paymentIdentity)
    identities.push({
      kind: input.paymentIdentity.kind,
      namespace: input.paymentIdentity.namespace,
      normalizedIdentity: input.paymentIdentity.value,
    })
  const { data, error } = await client.rpc("record_prior_paid_trial_claims", {
    p_claims: createTrialIdentityClaims(identities, input.runtime.identityKeys),
    p_paid_at: input.paidAt.toISOString(),
    p_provider: input.source.provider,
    p_agreement_id: input.source.agreementId,
  })
  if (error || !Number.isSafeInteger(data) || Number(data) < 0)
    throw new Error("Paid membership history reconciliation required")
}
