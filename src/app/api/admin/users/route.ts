import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { hasCurrentBillingAccess } from "@/lib/billing/subscriptions"
import { summarizeAdminUserBilling } from "@/lib/billing/admin-user-summary"
import { resolveIntakeState } from "@/lib/auth/intake-state"
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
  const admin = createAdminClient()

  let billingByUserId: Map<string, BillingSubscriptionRow>
  try {
    billingByUserId = await loadRelevantBillingByUserId(
      admin,
      userRows.map((row) => row.id),
    )
  } catch (billingError) {
    console.error("[admin.users] billing lookup failed:", billingError)
    return NextResponse.json({ error: fehler("Laden", "der Abo-Daten") }, { status: 500 })
  }

  let leadNameByEmail: Map<string, string>
  try {
    leadNameByEmail = await loadLeadNamesByEmail(
      admin,
      userRows
        .filter((row) => !hasText(row.full_name))
        .map((row) => normalizeEmail(row.email))
        .filter((email): email is string => email !== null),
    )
  } catch (leadError) {
    // Lead names are a best-effort display fallback; never fail the listing over them.
    console.error("[admin.users] lead name lookup failed:", leadError)
    leadNameByEmail = new Map()
  }

  return NextResponse.json({
    users: userRows.map((row) => {
      const billingRow = billingByUserId.get(row.id) ?? null
      const leadName = hasText(row.full_name)
        ? null
        : (leadNameByEmail.get(normalizeEmail(row.email) ?? "") ?? null)
      return {
        ...row,
        display_name: hasText(row.full_name) ? row.full_name : leadName,
        display_name_source: hasText(row.full_name) ? "profile" : leadName ? "quiz_lead" : null,
        intake_state: resolveIntakeState(row, row.hair_profiles?.[0] ?? null),
        current_billing_subscription: billingRow,
        billing_summary: summarizeAdminUserBilling(billingRow),
      }
    }),
    total: count || 0,
  })
}

type AdminSupabaseClient = ReturnType<typeof createAdminClient>

/**
 * Picks one subscription row per user: the row with current access when one
 * exists, otherwise the most recently updated row so lapsed/canceled
 * memberships stay visible in the admin listing.
 */
async function loadRelevantBillingByUserId(admin: AdminSupabaseClient, userIds: string[]) {
  const billingByUserId = new Map<string, BillingSubscriptionRow>()
  if (userIds.length === 0) return billingByUserId

  const { data, error } = await admin
    .from("billing_subscriptions")
    .select("*")
    .in("user_id", userIds)
    .in("entitlement_status", ["active", "past_due", "canceled"])
    .order("current_period_end", { ascending: false })

  if (error) throw error

  const rows = (data as BillingSubscriptionRow[] | null) ?? []
  for (const row of rows) {
    const existing = billingByUserId.get(row.user_id)
    if (!existing) {
      billingByUserId.set(row.user_id, row)
      continue
    }
    const existingHasAccess = hasCurrentBillingAccess(existing)
    if (existingHasAccess) continue
    if (hasCurrentBillingAccess(row) || row.updated_at > existing.updated_at) {
      billingByUserId.set(row.user_id, row)
    }
  }

  return billingByUserId
}

/** Latest quiz-lead first name per normalized email, for accounts without a profile name. */
async function loadLeadNamesByEmail(admin: AdminSupabaseClient, emails: string[]) {
  const leadNameByEmail = new Map<string, string>()
  if (emails.length === 0) return leadNameByEmail

  const { data, error } = await admin
    .from("leads")
    .select("email, name, created_at")
    .in("email", Array.from(new Set(emails)))
    .order("created_at", { ascending: false })

  if (error) throw error

  for (const lead of (data as { email: string | null; name: string | null }[] | null) ?? []) {
    const email = normalizeEmail(lead.email)
    if (!email || !hasText(lead.name) || leadNameByEmail.has(email)) continue
    leadNameByEmail.set(email, lead.name!.trim())
  }

  return leadNameByEmail
}

function normalizeEmail(email: string | null | undefined): string | null {
  const normalized = email?.trim().toLowerCase()
  return normalized ? normalized : null
}

function hasText(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0
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
