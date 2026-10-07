import "server-only"
import { parseTrialOfferSnapshot, type TrialOfferSnapshot } from "./trial-offer"

type Client = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>
}
export type TrialEffectiveContract = {
  offer: TrialOfferSnapshot
  provider: "stripe" | "paypal"
  agreementId: string | null
  revision: number
}

/** The original enrollment remains immutable; provider-verified changes select an append-only revision. */
export async function readTrialEffectiveContract(
  client: Client,
  enrollmentId: string,
): Promise<TrialEffectiveContract> {
  const { data, error } = await client.rpc("read_trial_effective_contract", {
    p_enrollment_id: enrollmentId,
  })
  if (error || !data || typeof data !== "object" || Array.isArray(data))
    throw new Error("Trial contract unavailable")
  const row = data as Record<string, unknown>
  const offer = parseTrialOfferSnapshot(row.accepted_offer)
  if (
    !offer ||
    (row.provider !== "stripe" && row.provider !== "paypal") ||
    !(
      row.provider_agreement_id === null ||
      (typeof row.provider_agreement_id === "string" && row.provider_agreement_id.length > 0)
    ) ||
    !Number.isSafeInteger(row.revision) ||
    Number(row.revision) < 0
  )
    throw new Error("Trial contract unavailable")
  return {
    offer,
    provider: row.provider,
    agreementId: row.provider_agreement_id as string | null,
    revision: Number(row.revision),
  }
}
