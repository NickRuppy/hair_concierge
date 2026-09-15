import type { SupabaseBillingAnalyticsClient } from "./types"

/** Gate before claiming: a paused integration must not consume delivery attempts. */
export async function canDispatchSlackGrowth(
  supabase: SupabaseBillingAnalyticsClient,
): Promise<boolean> {
  if (process.env.SLACK_GROWTH_ENABLED !== "true" || process.env.VERCEL_ENV !== "production")
    return false
  if (!process.env.SLACK_GROWTH_WEBHOOK_URL?.trim()) return false
  const { data, error } = await supabase.rpc("read_slack_growth_notification_state")
  if (error) throw new Error("slack_state_unavailable")
  const state = data as { enabled?: unknown; enabled_at?: unknown } | null
  return (
    state?.enabled === true &&
    typeof state.enabled_at === "string" &&
    Number.isFinite(Date.parse(state.enabled_at))
  )
}
