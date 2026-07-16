import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { hasCurrentBillingAccess } from "@/lib/billing/subscriptions"
import type { BillingSubscriptionRow } from "@/lib/billing/types"
import { ERR_UNAUTHORIZED, ERR_FORBIDDEN, fehler } from "@/lib/vocabulary"
import { NextResponse } from "next/server"

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: ERR_UNAUTHORIZED }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()

  if (!profile?.is_admin) {
    return NextResponse.json({ error: ERR_FORBIDDEN }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const limit = parseBoundedInteger(searchParams.get("limit"), DEFAULT_LIMIT, 1, MAX_LIMIT)
  const offset = parseBoundedInteger(searchParams.get("offset"), 0, 0)

  const {
    data: users,
    count,
    error,
  } = await supabase
    .from("profiles")
    .select("*, hair_profiles(*)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    return NextResponse.json({ error: fehler("Laden", "der Benutzer") }, { status: 500 })
  }

  const userRows = users || []
  let billingByUserId: Map<string, BillingSubscriptionRow>
  try {
    billingByUserId = await loadVisibleBillingByUserId(userRows.map((row) => row.id))
  } catch (billingError) {
    console.error("[admin.users] billing lookup failed:", billingError)
    return NextResponse.json({ error: fehler("Laden", "der Abo-Daten") }, { status: 500 })
  }

  return NextResponse.json({
    users: userRows.map((row) => ({
      ...row,
      current_billing_subscription: billingByUserId.get(row.id) ?? null,
    })),
    total: count || 0,
  })
}

async function loadVisibleBillingByUserId(userIds: string[]) {
  const billingByUserId = new Map<string, BillingSubscriptionRow>()
  if (userIds.length === 0) return billingByUserId

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("billing_subscriptions")
    .select(
      "id, user_id, provider, provider_customer_id, provider_subscriber_email, provider_subscription_id, provider_status, entitlement_status, interval, current_period_end, cancel_at_period_end, cancel_scheduled_at, cancelled_at, metadata, created_at, updated_at",
    )
    .in("user_id", userIds)
    .in("entitlement_status", ["active", "past_due", "canceled"])
    .order("current_period_end", { ascending: false })

  if (error) throw error

  for (const row of ((data as BillingSubscriptionRow[] | null) ?? []).filter((candidate) =>
    hasCurrentBillingAccess(candidate),
  )) {
    if (!billingByUserId.has(row.user_id)) {
      billingByUserId.set(row.user_id, row)
    }
  }

  return billingByUserId
}

function parseBoundedInteger(
  value: string | null,
  fallback: number,
  min: number,
  max?: number,
): number {
  const parsed = value === null ? fallback : Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(parsed, min), max ?? parsed)
}
