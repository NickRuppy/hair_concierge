import type { NextRequest } from "next/server"
import type { SupabaseBillingAnalyticsClient } from "@/lib/billing/types"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  decodeFunnelContext,
  decodeFunnelTouch,
  FUNNEL_SESSION_COOKIE,
  FUNNEL_TOUCH_COOKIE,
  type FunnelCookieContext,
  type FunnelTouch,
} from "./cookie"
import { isFunnelAttributionEnabled } from "./flags"
import { getFunnelPackageByKey } from "./packages"

export const FUNNEL_MILESTONES = [
  "landing_viewed",
  "quiz_started",
  "quiz_completed",
  "lead_captured",
  "offer_viewed",
  "checkout_started",
  "purchase_completed",
] as const

export type FunnelMilestone = (typeof FUNNEL_MILESTONES)[number]
const BROWSER_FUNNEL_MILESTONES: readonly FunnelMilestone[] = [
  "landing_viewed",
  "quiz_started",
  "quiz_completed",
  "offer_viewed",
  "checkout_started",
]

export function isBrowserRecordableFunnelMilestone(value: string): value is FunnelMilestone {
  return BROWSER_FUNNEL_MILESTONES.includes(value as FunnelMilestone)
}

export async function resolveFunnelRequestContext(request: NextRequest) {
  return resolveFunnelCookieContext(request.cookies.get(FUNNEL_SESSION_COOKIE)?.value)
}

export async function resolveFunnelCookieContext(value?: string) {
  if (!isFunnelAttributionEnabled()) return null
  const secret = process.env.FUNNEL_COOKIE_SIGNING_SECRET
  if (!secret) return null
  return value ? decodeFunnelContext(value, secret) : null
}

export async function resolveFunnelContextForLead(leadId?: string | null) {
  if (!isFunnelAttributionEnabled() || !leadId) return null
  const { data } = await createAdminClient()
    .from("funnel_sessions")
    .select("id, visitor_id, package_key, offer_variant, first_seen_at")
    .eq("lead_id", leadId)
    .order("first_seen_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data) return null
  return {
    visitorId: data.visitor_id,
    sessionId: data.id,
    packageKey: data.package_key,
    offerVariant: data.offer_variant,
    issuedAt: Date.parse(data.first_seen_at),
  }
}

export async function resolvePendingFunnelTouch(
  request: NextRequest,
  context: FunnelCookieContext,
): Promise<FunnelTouch | null> {
  const secret = process.env.FUNNEL_COOKIE_SIGNING_SECRET
  const value = request.cookies.get(FUNNEL_TOUCH_COOKIE)?.value
  if (!secret || !value) return null
  const touch = await decodeFunnelTouch(value, secret)
  if (touch?.visitorId !== context.visitorId || touch.sessionId !== context.sessionId) return null
  return touch
}

export async function resolvePendingFunnelTouchValue(
  value: string | undefined,
  context: FunnelCookieContext,
) {
  const secret = process.env.FUNNEL_COOKIE_SIGNING_SECRET
  if (!secret || !value) return null
  const touch = await decodeFunnelTouch(value, secret)
  if (touch?.visitorId !== context.visitorId || touch.sessionId !== context.sessionId) return null
  return touch
}

export async function recordFunnelEvent(input: {
  context: FunnelCookieContext
  eventId: string
  milestone: FunnelMilestone
  touch?: FunnelTouch | null
  leadId?: string | null
  userId?: string | null
  checkoutProvider?: string | null
  checkoutReference?: string | null
  occurredAt?: string
  properties?: Record<string, unknown>
}) {
  return recordFunnelEventWithRpc(
    (args) => createAdminClient().rpc("record_funnel_event", args),
    input,
  )
}

type FunnelRpcResult = {
  data: unknown
  error: unknown
}

export async function recordFunnelEventWithRpc(
  rpc: (args: Record<string, unknown>) => PromiseLike<FunnelRpcResult>,
  input: {
    context: FunnelCookieContext
    eventId: string
    milestone: FunnelMilestone
    touch?: FunnelTouch | null
    leadId?: string | null
    userId?: string | null
    checkoutProvider?: string | null
    checkoutReference?: string | null
    occurredAt?: string
    properties?: Record<string, unknown>
  },
) {
  const funnelPackage = getFunnelPackageByKey(input.context.packageKey)
  if (!funnelPackage) return null

  const { data, error } = await rpc({
    p_event_id: input.eventId,
    p_session_id: input.context.sessionId,
    p_visitor_id: input.context.visitorId,
    p_package_key: funnelPackage.key,
    p_landing_slug: funnelPackage.slug,
    p_channel: funnelPackage.channel,
    p_landing_variant: funnelPackage.landingVariant,
    p_offer_variant: funnelPackage.offerVariant,
    p_event_name: input.milestone,
    p_occurred_at: input.occurredAt ?? new Date().toISOString(),
    p_entry_path: input.touch?.entryPath ?? null,
    p_entry_url: null,
    p_referrer: input.touch?.referrer ?? null,
    p_first_touch: touchToJson(input.touch),
    p_first_seen_at: new Date(input.context.issuedAt).toISOString(),
    p_lead_id: input.leadId ?? null,
    p_user_id: input.userId ?? null,
    p_checkout_provider: input.checkoutProvider ?? null,
    p_checkout_reference: input.checkoutReference ?? null,
    p_properties: input.properties ?? {},
  })
  if (error) throw error
  return data
}

export type FunnelPurchaseRecordResult =
  | { ok: true; data: unknown }
  | { ok: false; kind: "permanent" | "transient"; error: string }

export async function recordFunnelPurchaseFromSession(
  supabase: SupabaseBillingAnalyticsClient,
  input: {
    sessionId: string
    packageKey?: string | null
    eventId: string
    provider: "stripe" | "paypal"
    reference: string
    userId?: string | null
    occurredAt: string
  },
): Promise<FunnelPurchaseRecordResult> {
  const { data, error } = await supabase
    .from("funnel_sessions")
    .select("visitor_id, package_key, first_seen_at")
    .eq("id", input.sessionId)
    .maybeSingle()
  if (error) return { ok: false, kind: "transient", error: errorMessage(error) }
  if (!data) return { ok: false, kind: "permanent", error: "Funnel session does not exist" }
  if (input.packageKey && data.package_key !== input.packageKey) {
    return { ok: false, kind: "permanent", error: "Funnel session package mismatch" }
  }
  if (!getFunnelPackageByKey(data.package_key)) {
    return { ok: false, kind: "permanent", error: "Funnel session package is unknown" }
  }
  const issuedAt = Date.parse(data.first_seen_at)
  if (!Number.isFinite(issuedAt)) {
    return { ok: false, kind: "permanent", error: "Funnel session first_seen_at is invalid" }
  }

  try {
    const rpcData = await recordFunnelEventWithRpc(
      async (args) => {
        const result = await supabase.rpc("record_funnel_event", args)
        return { data: result.data, error: result.error }
      },
      {
        context: {
          visitorId: data.visitor_id,
          sessionId: input.sessionId,
          packageKey: data.package_key,
          issuedAt,
        },
        eventId: input.eventId,
        milestone: "purchase_completed",
        userId: input.userId,
        checkoutProvider: input.provider,
        checkoutReference: input.reference,
        occurredAt: input.occurredAt,
      },
    )
    return { ok: true, data: rpcData }
  } catch (rpcError) {
    return { ok: false, kind: "transient", error: errorMessage(rpcError) }
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function touchToJson(touch?: FunnelTouch | null) {
  if (!touch) return {}
  return Object.fromEntries(
    Object.entries({
      utm_source: touch.utmSource,
      utm_medium: touch.utmMedium,
      utm_campaign: touch.utmCampaign,
      utm_content: touch.utmContent,
      utm_term: touch.utmTerm,
      fbclid: touch.fbclid,
      referrer: touch.referrer,
    }).filter(([, value]) => value !== undefined),
  )
}
