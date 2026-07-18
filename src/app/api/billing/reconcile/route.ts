import { NextResponse } from "next/server"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { dispatchBillingAnalyticsDueWithStats } from "@/lib/billing/analytics-outbox"
import { reconcileExpiredBillingEntitlements } from "@/lib/billing/entitlements"
import type { BillingAnalyticsDestination } from "@/lib/billing/types"
import { getStripeTierIds } from "@/lib/stripe/tier-ids"

export const runtime = "nodejs"
export const maxDuration = 60

const ANALYTICS_DESTINATIONS: BillingAnalyticsDestination[] = [
  "customerio",
  "posthog",
  "meta",
  "funnel",
]

type ReconcileDeps = {
  supabase: SupabaseClient
  getFreeTierId: (supabase: SupabaseClient) => Promise<string>
  cronSecret?: string
  now?: Date
  reconcileEntitlements?: typeof reconcileExpiredBillingEntitlements
  analyticsRetryEnabled?: boolean
  dispatchAnalyticsDue?: typeof dispatchBillingAnalyticsDueWithStats
}

export async function GET(request: Request) {
  const supabase: SupabaseClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  return toNextResponse(
    await handleBillingReconcile(request, {
      supabase,
      getFreeTierId,
      cronSecret: process.env.CRON_SECRET,
      analyticsRetryEnabled: process.env.BILLING_ANALYTICS_RETRY_ENABLED === "true",
      dispatchAnalyticsDue: dispatchBillingAnalyticsDueWithStats,
    }),
  )
}

export async function handleBillingReconcile(request: Request, deps: ReconcileDeps) {
  const secret = deps.cronSecret
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return { status: 401, body: { error: "unauthorized" } }
  }

  const freeTierId = await deps.getFreeTierId(deps.supabase)
  const reconcileEntitlements = deps.reconcileEntitlements ?? reconcileExpiredBillingEntitlements
  const result = await reconcileEntitlements(deps.supabase, {
    freeTierId,
    now: deps.now,
  })

  if (deps.analyticsRetryEnabled !== true) return { status: 200, body: result }

  const dispatchAnalyticsDue = deps.dispatchAnalyticsDue ?? dispatchBillingAnalyticsDueWithStats
  const settled = await Promise.allSettled(
    ANALYTICS_DESTINATIONS.map((destination) =>
      dispatchAnalyticsDue(deps.supabase, { destination, limit: 10 }),
    ),
  )
  const analyticsRetry = Object.fromEntries(
    ANALYTICS_DESTINATIONS.map((destination, index) => {
      const destinationResult = settled[index]
      return [
        destination,
        destinationResult.status === "fulfilled"
          ? destinationResult.value
          : {
              processed: 0,
              delivered: 0,
              failed: 0,
              error: errorMessage(destinationResult.reason),
            },
      ]
    }),
  )

  return { status: 200, body: { ...result, analyticsRetry } }
}

async function getFreeTierId(supabase: SupabaseClient): Promise<string> {
  return (await getStripeTierIds(supabase)).freeTierId
}

function toNextResponse(result: { status: number; body: Record<string, unknown> }) {
  return NextResponse.json(result.body, { status: result.status })
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
