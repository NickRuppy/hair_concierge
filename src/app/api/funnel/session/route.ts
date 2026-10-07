import { NextResponse, type NextRequest } from "next/server"
import { FUNNEL_TOUCH_COOKIE } from "@/lib/funnel/cookie"
import { isFunnelAttributionEnabled } from "@/lib/funnel/flags"
import {
  recordFunnelEvent,
  resolveFunnelRequestContext,
  resolvePendingFunnelTouch,
} from "@/lib/funnel/server"
import { buildScannerAnalyticsContext } from "@/lib/funnel/analytics-context"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit, FUNNEL_EVENT_RATE_LIMIT } from "@/lib/rate-limit"
import { FUNNEL_EVENT_MAX_BODY_BYTES, parseFunnelEventPayload } from "@/lib/funnel/api"

export async function GET(request: NextRequest) {
  const context = await resolveFunnelRequestContext(request)
  let analytics: Record<string, unknown> = {}
  if (context?.packageKey === "scan_v1") {
    try {
      const { data, error } = await createAdminClient()
        .from("funnel_sessions")
        .select("entry_path,first_touch,is_internal_test,test_kind")
        .eq("id", context.sessionId)
        .maybeSingle()
      const touch = error ? null : await resolvePendingFunnelTouch(request, context)
      analytics = buildScannerAnalyticsContext(context, data, touch, Boolean(error))
    } catch {
      analytics = buildScannerAnalyticsContext(context, null, null, true)
    }
  }
  return NextResponse.json(
    {
      enabled: isFunnelAttributionEnabled(),
      funnelSessionId: context?.sessionId ?? null,
      funnelPackageKey: context?.packageKey ?? null,
      ...analytics,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  )
}

export async function POST(request: NextRequest) {
  const context = await resolveFunnelRequestContext(request)
  if (!context) return NextResponse.json({ enabled: false }, { status: 202 })

  const declaredLength = Number(request.headers.get("content-length") ?? 0)
  if (declaredLength > FUNNEL_EVENT_MAX_BODY_BYTES)
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 })

  const parsed = parseFunnelEventPayload(await request.text())
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status })

  const rateLimit = await checkRateLimit(context.sessionId, FUNNEL_EVENT_RATE_LIMIT)
  if (rateLimit.error) return NextResponse.json({ error: rateLimit.error }, { status: 503 })
  if (!rateLimit.allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 })

  const touch = await resolvePendingFunnelTouch(request, context)
  try {
    await recordFunnelEvent({
      context,
      eventId: parsed.value.eventId,
      milestone: parsed.value.milestone,
      touch,
      properties: {
        ...parsed.value.properties,
        ...(touch ? { entry_path: touch.entryPath } : {}),
      },
    })
    const response = NextResponse.json({
      funnelSessionId: context.sessionId,
      funnelPackageKey: context.packageKey,
    })
    if (touch) response.cookies.set(FUNNEL_TOUCH_COOKIE, "", { path: "/", maxAge: 0 })
    return response
  } catch (error) {
    console.error("[funnel] event recording failed", error)
    return NextResponse.json({ error: "recording_failed" }, { status: 503 })
  }
}
