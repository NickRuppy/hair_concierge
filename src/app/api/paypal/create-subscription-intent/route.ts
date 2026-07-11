import { NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { assertCanStartCheckout, assertCanStartCheckoutForEmail } from "@/lib/billing/subscriptions"
import { captureCheckoutException } from "@/lib/observability/checkout"
import {
  createPayPalCheckoutIntent,
  type PayPalCheckoutSource,
} from "@/lib/paypal/checkout-intents"
import type { BillingInterval } from "@/lib/billing/types"
import { getPayPalPlanId } from "@/lib/paypal/plans"
import { cookies } from "next/headers"
import { FUNNEL_SESSION_COOKIE, FUNNEL_TOUCH_COOKIE } from "@/lib/funnel/cookie"
import {
  recordFunnelEvent,
  resolveFunnelCookieContext,
  resolveFunnelContextForLead,
  resolvePendingFunnelTouchValue,
} from "@/lib/funnel/server"

export const runtime = "nodejs"

const BodySchema = z.object({
  interval: z.enum(["month", "quarter", "year"]),
  leadId: z.string().uuid().nullable().optional(),
  source: z.enum(["pricing_page", "quiz_result_offer"]),
  funnelEventId: z.string().uuid().optional(),
})

const ACCESS_CONFLICT_ERROR = "checkout_access_already_exists"

export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_PAYPAL_ENABLED !== "true") {
    return NextResponse.json({ error: "paypal disabled" }, { status: 404 })
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "bad request" }, { status: 400 })
  }

  const { interval, leadId, source, funnelEventId } = parsed.data
  let planId: string
  try {
    planId = getPayPalPlanId(interval)
  } catch {
    captureCheckoutException(new Error("PayPal plan not configured"), {
      provider: "paypal",
      stage: "paypal_create_subscription_intent",
      source,
      interval,
      leadId,
      status: 500,
      reason: "plan_not_configured",
    })
    return NextResponse.json({ error: "paypal plan not configured" }, { status: 500 })
  }

  try {
    const admin = createAdminClient()
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user?.id) {
      const conflict = await toConflictResponse(assertCanStartCheckout(admin, user.id), user.email)
      if (conflict) return conflict
    }

    let email = user?.email ?? null
    let resolvedLeadId: string | null = null
    let canExposeConflictEmail = Boolean(user?.email)
    if (leadId) {
      const { data, error } = await admin
        .from("leads")
        .select("email")
        .eq("id", leadId)
        .maybeSingle()
      if (error) throw error
      if (typeof data?.email === "string") {
        email = data.email
        resolvedLeadId = leadId
      }
      canExposeConflictEmail = false
    }

    if (email) {
      const conflict = await toConflictResponse(
        assertCanStartCheckoutForEmail(admin, email),
        canExposeConflictEmail ? email : null,
      )
      if (conflict) return conflict
    }

    const cookieStore = await cookies()
    const funnelContext =
      (await resolveFunnelCookieContext(cookieStore.get(FUNNEL_SESSION_COOKIE)?.value)) ??
      (await resolveFunnelContextForLead(resolvedLeadId))
    const funnelTouch = funnelContext
      ? await resolvePendingFunnelTouchValue(
          cookieStore.get(FUNNEL_TOUCH_COOKIE)?.value,
          funnelContext,
        )
      : null
    const intent = await createPayPalCheckoutIntent(admin, {
      interval: interval as BillingInterval,
      source: source as PayPalCheckoutSource,
      leadId: resolvedLeadId,
      email,
      userId: user?.id ?? null,
      metadata: funnelContext
        ? {
            funnel_session_id: funnelContext.sessionId,
            funnel_package_key: funnelContext.packageKey,
          }
        : {},
    })

    const funnelRecorded = funnelContext
      ? await recordFunnelEvent({
          context: funnelContext,
          eventId: funnelEventId ?? crypto.randomUUID(),
          milestone: "checkout_started",
          leadId: resolvedLeadId,
          userId: user?.id,
          checkoutProvider: "paypal",
          checkoutReference: intent.token,
          touch: funnelTouch,
          properties: { source, interval },
        })
          .then(() => true)
          .catch((error) => {
            console.warn("[funnel] PayPal checkout tracking failed", error)
            return false
          })
      : false

    const response = NextResponse.json({ token: intent.token, planId })
    if (funnelTouch && funnelRecorded) {
      response.cookies.set(FUNNEL_TOUCH_COOKIE, "", { path: "/", maxAge: 0 })
    }
    return response
  } catch (error) {
    captureCheckoutException(error, {
      provider: "paypal",
      stage: "paypal_create_subscription_intent",
      source,
      interval,
      leadId,
    })
    throw error
  }
}

async function toConflictResponse(
  promise: Promise<void>,
  email?: string | null,
): Promise<NextResponse<{ error: typeof ACCESS_CONFLICT_ERROR; email?: string }> | null> {
  try {
    await promise
    return null
  } catch (error) {
    if (error instanceof Error && error.message.includes("already has access")) {
      return NextResponse.json(
        { error: ACCESS_CONFLICT_ERROR, ...(email ? { email } : {}) },
        { status: 409 },
      )
    }
    throw error
  }
}
