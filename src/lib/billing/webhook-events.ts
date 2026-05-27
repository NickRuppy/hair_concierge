import type { BillingProvider, SupabaseBillingClient } from "./types"

export async function claimWebhookEvent(
  supabase: SupabaseBillingClient,
  provider: BillingProvider,
  providerEventId: string,
  eventType: string,
): Promise<boolean> {
  const { error } = await supabase.from("billing_webhook_events").insert({
    provider,
    provider_event_id: providerEventId,
    event_type: eventType,
  })

  if (!error) return true
  if (isDuplicateKeyError(error)) return false
  throw error
}

export async function releaseWebhookEventClaim(
  supabase: SupabaseBillingClient,
  provider: BillingProvider,
  providerEventId: string,
): Promise<void> {
  const { error } = await supabase
    .from("billing_webhook_events")
    .delete()
    .eq("provider", provider)
    .eq("provider_event_id", providerEventId)

  if (error) throw error
}

function isDuplicateKeyError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const candidate = error as { code?: unknown; message?: unknown }
  return candidate.code === "23505" || String(candidate.message ?? "").includes("duplicate key")
}
