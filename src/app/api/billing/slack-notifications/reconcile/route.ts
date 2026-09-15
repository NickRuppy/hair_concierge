import { NextResponse } from "next/server"

import { safeBearerTokenMatches } from "@/app/api/billing/payment-monitor/route"
import { dispatchBillingAnalyticsDueWithStats } from "@/lib/billing/analytics-outbox"
import { canDispatchSlackGrowth } from "@/lib/billing/slack-growth-state"
import { createAdminClient } from "@/lib/supabase/admin"
import type { SupabaseBillingAnalyticsClient } from "@/lib/billing/types"

export const runtime = "nodejs"
export const maxDuration = 60

type SlackGrowthReconcileDeps = {
  supabase: SupabaseBillingAnalyticsClient
  cronSecret?: string
  env?: Record<string, string | undefined>
  canDispatch?: typeof canDispatchSlackGrowth
  reconcile?: (supabase: SupabaseBillingAnalyticsClient) => Promise<unknown>
  dispatch?: typeof dispatchBillingAnalyticsDueWithStats
}

function isEnvironmentPaused(env: Record<string, string | undefined>) {
  return env.SLACK_GROWTH_ENABLED !== "true" || env.VERCEL_ENV !== "production"
}

function hasWebhookConfiguration(env: Record<string, string | undefined>) {
  return Boolean(env.SLACK_GROWTH_WEBHOOK_URL?.trim())
}

async function reconcileSlackGrowthDeliveries(supabase: SupabaseBillingAnalyticsClient) {
  const { data, error } = await supabase.rpc("reconcile_slack_growth_deliveries", { p_limit: 100 })
  if (error) throw error
  return data
}

/**
 * The scheduled catch-up runs before delivery so events created while the
 * integration was paused are inserted only after its database activation cutoff.
 */
export async function handleSlackGrowthNotificationReconcile(
  request: Request,
  deps: SlackGrowthReconcileDeps,
) {
  if (!safeBearerTokenMatches(request.headers.get("authorization"), deps.cronSecret)) {
    return { status: 401, body: { error: "unauthorized" } }
  }

  const env = deps.env ?? process.env
  if (isEnvironmentPaused(env)) {
    return { status: 200, body: { slackGrowthNotifications: "paused" } }
  }
  if (!hasWebhookConfiguration(env)) {
    return { status: 503, body: { error: "slack_growth_configuration_unavailable" } }
  }

  try {
    const dispatchAllowed = await (deps.canDispatch ?? canDispatchSlackGrowth)(deps.supabase)
    if (!dispatchAllowed) {
      return { status: 200, body: { slackGrowthNotifications: "paused" } }
    }

    const recovery = await (deps.reconcile ?? reconcileSlackGrowthDeliveries)(deps.supabase)
    const delivery = await (deps.dispatch ?? dispatchBillingAnalyticsDueWithStats)(deps.supabase, {
      destination: "slack",
      limit: 5,
    })
    return { status: 200, body: { slackGrowthRecovery: recovery, slackGrowthDelivery: delivery } }
  } catch {
    return { status: 503, body: { error: "slack_growth_reconcile_unavailable" } }
  }
}

export async function GET(request: Request) {
  const result = await handleSlackGrowthNotificationReconcile(request, {
    supabase: createAdminClient(),
    cronSecret: process.env.CRON_SECRET,
  })
  return NextResponse.json(result.body, { status: result.status })
}
