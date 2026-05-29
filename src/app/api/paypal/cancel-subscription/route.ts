import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"
import { mirrorBillingSubscriptionToProfile } from "@/lib/billing/entitlements"
import {
  findCurrentBillingSubscriptionForUser,
  upsertBillingSubscription,
} from "@/lib/billing/subscriptions"
import type { BillingSubscriptionRow } from "@/lib/billing/types"
import { getBillingTierIds } from "@/lib/billing/tier-ids"

export const runtime = "nodejs"

const CANCEL_REASON = "User requested cancellation in Chaarlie"

type RouteResult = {
  status: number
  body: Record<string, unknown>
}

type PayPalCancelDeps = {
  authSupabase: SupabaseClient
  billingSupabase: SupabaseClient
  cancelPayPalSubscription: (subscriptionId: string, reason: string) => Promise<void>
  getTierIds: (supabase: SupabaseClient) => Promise<{ premiumTierId: string; freeTierId: string }>
  now?: () => Date
}

export async function POST() {
  const cookieStore = await cookies()
  const authSupabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    },
  )
  const { cancelPayPalSubscription } = await import("@/lib/paypal/subscriptions")

  return toNextResponse(
    await handleCancelPayPalSubscription({
      authSupabase,
      billingSupabase: createAdminClient(),
      cancelPayPalSubscription,
      getTierIds: getBillingTierIds,
    }),
  )
}

export async function handleCancelPayPalSubscription(deps: PayPalCancelDeps): Promise<RouteResult> {
  const {
    data: { user },
  } = await deps.authSupabase.auth.getUser()
  if (!user) return { status: 401, body: { error: "unauthenticated" } }

  const current = await findCurrentBillingSubscriptionForUser(deps.billingSupabase, user.id)
  if (!current) return { status: 404, body: { error: "no_subscription" } }
  if (current.provider !== "paypal") {
    return { status: 409, body: { error: "not_paypal_subscription" } }
  }

  await deps.cancelPayPalSubscription(current.provider_subscription_id, CANCEL_REASON)
  const { premiumTierId, freeTierId } = await deps.getTierIds(deps.billingSupabase)
  const row = await markPayPalSubscriptionCanceled(deps.billingSupabase, current, deps.now)
  await mirrorBillingSubscriptionToProfile(deps.billingSupabase, row, premiumTierId, { freeTierId })

  return { status: 200, body: { ok: true, current_period_end: row.current_period_end } }
}

async function markPayPalSubscriptionCanceled(
  supabase: SupabaseClient,
  current: BillingSubscriptionRow,
  now: (() => Date) | undefined,
): Promise<BillingSubscriptionRow> {
  return upsertBillingSubscription(supabase, {
    user_id: current.user_id,
    provider: "paypal",
    provider_customer_id: current.provider_customer_id,
    provider_subscription_id: current.provider_subscription_id,
    provider_status: "CANCELLED",
    entitlement_status: "canceled",
    interval: current.interval,
    current_period_end: current.current_period_end,
    cancel_at_period_end: true,
    cancelled_at: (now ?? (() => new Date()))().toISOString(),
    metadata: current.metadata,
  })
}

function toNextResponse(result: RouteResult) {
  return NextResponse.json(result.body, { status: result.status })
}
