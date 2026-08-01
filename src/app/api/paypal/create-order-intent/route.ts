import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { z } from "zod"

import { PERSONAL_PLAN_ONCE_PRODUCT } from "@/lib/billing/offer-products"
import { assertCanStartCheckout, assertCanStartCheckoutForEmail } from "@/lib/billing/subscriptions"
import { FUNNEL_SESSION_COOKIE, FUNNEL_TOUCH_COOKIE } from "@/lib/funnel/cookie"
import { assertPersonalPlanOneTimeCheckoutAuthorized } from "@/lib/funnel/server"
import {
  createPersonalPlanOneTimeCheckoutConsent,
  bindPersonalPlanOneTimeConsentProviderReference,
  findPersonalPlanOneTimeConsentByLeadSession,
  PERSONAL_PLAN_ONE_TIME_CONSENT_COPY_VERSION,
  type PersonalPlanOneTimeCheckoutConsentRow,
} from "@/lib/billing/personal-plan-one-time-consents"
import {
  recordFunnelEvent,
  resolveFunnelCookieContext,
  resolveFunnelContextForLead,
  resolvePendingFunnelTouchValue,
} from "@/lib/funnel/server"
import {
  bindPayPalOrderIntentToOrder,
  createPayPalOrderIntent,
  createProviderPayPalOrder,
} from "@/lib/paypal/order-intents"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

const PayPalOrderIntentRequestSchema = z
  .object({
    purchaseKind: z.literal("personal_plan_once"),
    leadId: z.string().uuid(),
    funnelSessionId: z.string().uuid(),
    checkoutAttemptId: z.string().uuid(),
    funnelEventId: z.string().uuid().optional(),
    consentAccepted: z.literal(true),
    consentCopyVersion: z.literal(PERSONAL_PLAN_ONE_TIME_CONSENT_COPY_VERSION),
  })
  .strict()
const ACCESS_CONFLICT_ERROR = "checkout_access_already_exists"

export function personalPlanOneTimeConsentBlocksPayPalOrder(
  consent: Pick<PersonalPlanOneTimeCheckoutConsentRow, "stripe_checkout_session_id">,
): boolean {
  return Boolean(consent.stripe_checkout_session_id)
}

export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_PAYPAL_ENABLED !== "true") {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }

  const parsed = PayPalOrderIntentRequestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 })

  const admin = createAdminClient()
  const session = await createClient()
  const {
    data: { user },
  } = await session.auth.getUser()

  if (user) {
    const conflict = await toConflictResponse(assertCanStartCheckout(admin, user.id), user.email)
    if (conflict) return conflict
  }
  let email = user?.email?.trim().toLowerCase() ?? null
  let canExposeConflictEmail = Boolean(user?.email)
  const leadId = parsed.data.leadId
  let authorization
  try {
    authorization = await assertPersonalPlanOneTimeCheckoutAuthorized({
      leadId,
      funnelSessionId: parsed.data.funnelSessionId,
    })
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }
  if (leadId) {
    const { data, error } = await admin.from("leads").select("email").eq("id", leadId).maybeSingle()
    if (error) return NextResponse.json({ error: "lead lookup failed" }, { status: 500 })
    if (typeof data?.email === "string") email = data.email.trim().toLowerCase()
    canExposeConflictEmail = false
  }
  if (!email) return NextResponse.json({ error: "identity required" }, { status: 400 })
  const emailConflict = await toConflictResponse(
    assertCanStartCheckoutForEmail(admin, email),
    canExposeConflictEmail ? email : null,
  )
  if (emailConflict) return emailConflict

  const cookieStore = await cookies()
  const funnelContext =
    (await resolveFunnelCookieContext(cookieStore.get(FUNNEL_SESSION_COOKIE)?.value)) ??
    (await resolveFunnelContextForLead(leadId))
  const funnelTouch = funnelContext
    ? await resolvePendingFunnelTouchValue(
        cookieStore.get(FUNNEL_TOUCH_COOKIE)?.value,
        funnelContext,
      )
    : null
  let consent = await findPersonalPlanOneTimeConsentByLeadSession(admin, {
    leadId: authorization.leadId,
    funnelSessionId: authorization.sessionId,
  })
  if (!consent) {
    try {
      consent = await createPersonalPlanOneTimeCheckoutConsent(admin, {
        leadId: authorization.leadId,
        funnelSessionId: authorization.sessionId,
        userId: user?.id,
        offerVariant: authorization.offerVariant,
      })
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "23505"))
        throw error
      consent = await findPersonalPlanOneTimeConsentByLeadSession(admin, {
        leadId: authorization.leadId,
        funnelSessionId: authorization.sessionId,
      })
      if (!consent) throw error
    }
  }
  if (personalPlanOneTimeConsentBlocksPayPalOrder(consent)) {
    return NextResponse.json({ error: "payment provider already selected" }, { status: 409 })
  }
  const intent = await createPayPalOrderIntent(admin, {
    checkoutAttemptId: parsed.data.checkoutAttemptId,
    userId: user?.id,
    leadId,
    funnelSessionId: authorization.sessionId,
    consentId: consent.id,
    email,
    metadata: {
      checkout_attempt_id: parsed.data.checkoutAttemptId,
      funnel_event_id: parsed.data.funnelEventId,
      is_internal_test: authorization.isInternalTest,
      ...(funnelContext
        ? {
            funnel_session_id: funnelContext.sessionId,
            funnel_package_key: funnelContext.packageKey,
          }
        : {}),
    },
  })
  const orderId = intent.provider_order_id ?? (await createProviderPayPalOrder(intent))
  if (!intent.provider_order_id) {
    await bindPayPalOrderIntentToOrder(admin, intent.token, orderId)
    await bindPersonalPlanOneTimeConsentProviderReference(admin, consent.id, {
      paypalOrderId: orderId,
    })
  }

  const funnelRecorded =
    funnelContext && parsed.data.funnelEventId
      ? await recordFunnelEvent({
          context: funnelContext,
          eventId: parsed.data.funnelEventId,
          milestone: "checkout_started",
          leadId,
          userId: user?.id,
          checkoutProvider: "paypal",
          checkoutReference: orderId,
          touch: funnelTouch,
          properties: {
            source: "quiz_result_offer",
            interval: "one_time",
            checkout_attempt_id: parsed.data.checkoutAttemptId,
            currency: PERSONAL_PLAN_ONCE_PRODUCT.currency,
            plan_id: PERSONAL_PLAN_ONCE_PRODUCT.analyticsId,
            value: PERSONAL_PLAN_ONCE_PRODUCT.amount,
          },
        })
          .then(() => true)
          .catch((error) => {
            console.warn("[funnel] PayPal one-time checkout tracking failed", error)
            return false
          })
      : false

  const response = NextResponse.json({ token: intent.token, orderId })
  if (funnelTouch && funnelRecorded) {
    response.cookies.set(FUNNEL_TOUCH_COOKIE, "", { path: "/", maxAge: 0 })
  }
  return response
}

async function toConflictResponse(promise: Promise<void>, email?: string | null) {
  try {
    await promise
    return null
  } catch (error) {
    if (error instanceof Error && error.message.includes("already has access")) {
      return NextResponse.json(
        {
          error: ACCESS_CONFLICT_ERROR,
          ...(email?.trim() ? { email: email.trim().toLowerCase() } : {}),
        },
        { status: 409 },
      )
    }
    throw error
  }
}
