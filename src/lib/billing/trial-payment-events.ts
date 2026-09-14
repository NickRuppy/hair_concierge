import "server-only"
export type TrialPaymentEvent = Readonly<{
  provider: "stripe" | "paypal"
  enrollmentId: string
  agreementId: string
  sourceEventId: string
  sourceObjectId: string
  outcome: "succeeded" | "failed"
  occurredAt: string
  amountMinor: number
  currency: "EUR"
  periodStartAt: string
  periodEndAt: string
}>
export type TrialPaymentEventResult = Readonly<{
  outcome: "applied" | "duplicate" | "stale" | "reconciliation_required"
  phase: "first_paid" | "renewal" | "none"
}>

const outcomes = new Set<TrialPaymentEventResult["outcome"]>([
  "applied",
  "duplicate",
  "stale",
  "reconciliation_required",
])
const phases = new Set<TrialPaymentEventResult["phase"]>(["first_paid", "renewal", "none"])
type TrialPaymentEventClient = Readonly<{
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: unknown }>
}>

function parseResult(data: unknown): TrialPaymentEventResult | null {
  if (Array.isArray(data) && data.length !== 1) return null
  const row = Array.isArray(data) ? data[0] : data
  if (!row || typeof row !== "object" || Array.isArray(row)) return null
  const value = row as Record<string, unknown>
  if (typeof value.outcome !== "string" || typeof value.phase !== "string") return null
  if (
    !outcomes.has(value.outcome as TrialPaymentEventResult["outcome"]) ||
    !phases.has(value.phase as TrialPaymentEventResult["phase"])
  )
    return null
  return {
    outcome: value.outcome as TrialPaymentEventResult["outcome"],
    phase: value.phase as TrialPaymentEventResult["phase"],
  }
}

export async function recordTrialPaymentEvent(
  client: TrialPaymentEventClient,
  event: TrialPaymentEvent,
): Promise<TrialPaymentEventResult> {
  const { data, error } = await client.rpc("record_trial_payment_event", { p_event: event })
  const result = error ? null : parseResult(data)
  if (!result) throw new Error("trial payment event unavailable")
  return result
}
