import type { BillingAnalyticsOutboxRow } from "@/lib/billing/types"
import { sendOpenAIConversion } from "@/lib/openai-ads/server/capi"
import type { BillingAnalyticsDeliveryInput, BillingAnalyticsDeliveryResult } from "./types"

export function isOpenAIBillingEvent(event: BillingAnalyticsOutboxRow) {
  const p = event.payload
  if (p.is_internal_test === true || p.test_kind === "field_test" || p.test_kind === "partner")
    return false
  if (
    typeof p.funnel_session_id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      p.funnel_session_id,
    )
  )
    return false
  if (event.event_name === "trial_started")
    return (
      p.trial_analytics_version === 1 && p.value === 0 && typeof p.trial_authorized_at === "string"
    )
  return (
    event.event_name === "purchase_completed" &&
    p.attempt_phase !== "renewal" &&
    (p.trial_analytics_version !== 1 || p.attempt_phase === "first_paid")
  )
}

export async function deliverBillingAnalyticsToOpenAI(
  input: BillingAnalyticsDeliveryInput,
): Promise<BillingAnalyticsDeliveryResult> {
  if (!isOpenAIBillingEvent(input.event))
    return { ok: false, skipped: true, error: "invalid_event" }
  const result = await sendOpenAIConversion(input.event, {
    resolveContext: async (event) => {
      const { resolveOpenAIContext } = await import("@/lib/openai-ads/server/context")
      return resolveOpenAIContext(input.supabase, event)
    },
  })
  if (result.outcome === "accepted") return { ok: true, status: result.status }
  if (result.outcome === "skipped") return { ok: false, skipped: true, error: result.reason }
  return { ok: false, permanent: !result.retryable, error: result.reason, status: result.status }
}
