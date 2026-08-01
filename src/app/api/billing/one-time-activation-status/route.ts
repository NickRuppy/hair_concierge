import { after, NextResponse } from "next/server"
import { createHash } from "node:crypto"
import type Stripe from "stripe"
import type { SupabaseClient } from "@supabase/supabase-js"

import { getPremiumTierId } from "@/lib/billing/tier-ids"
import { checkRateLimit, type RateLimitConfig } from "@/lib/rate-limit"
import { linkQuizToProfile } from "@/lib/quiz/link-to-profile"
import { createAdminClient } from "@/lib/supabase/admin"
import { getStripe } from "@/lib/stripe/client"
import {
  CheckoutActivationError,
  ensureOneTimeCheckoutAccount,
  verifyCheckoutSessionForActivation,
} from "@/lib/stripe/checkout-activation"
import { PayPalCheckoutActivationError } from "@/lib/paypal/checkout-activation"
import {
  activateVerifiedPayPalOrderIntent,
  tryMarkPayPalOrderIntentCaptured,
  verifyPayPalOneTimePaymentForRecovery,
} from "@/lib/paypal/order-activation"

export const runtime = "nodejs"

// The pending client polls at most 15 times, every two seconds. This leaves
// normal retries comfortably below the shared-window limit while bounding a
// public endpoint before it reaches either payment provider.
export const ONE_TIME_ACTIVATION_STATUS_RATE_LIMIT = {
  prefix: "one-time-activation-status",
  limit: 30,
  windowMs: 60_000,
} satisfies RateLimitConfig

type RateLimitResult = { allowed: boolean; error?: string }

export type OneTimeActivationStatusResponse =
  | { status: "active" }
  | { status: "paid_pending" }
  | { status: "pending" }
  | { status: "revoked" }
  | { status: "failed_permanent" }

export interface OneTimeActivationStatusDeps {
  supabase: SupabaseClient
  stripe: Stripe
  verifyCheckoutSessionForActivation?: typeof verifyCheckoutSessionForActivation
  ensureOneTimeCheckoutAccount?: typeof ensureOneTimeCheckoutAccount
  verifyPayPalOneTimePaymentForRecovery?: typeof verifyPayPalOneTimePaymentForRecovery
  tryMarkPayPalOrderIntentCaptured?: typeof tryMarkPayPalOrderIntentCaptured
  activateVerifiedPayPalOrderIntent?: typeof activateVerifiedPayPalOrderIntent
  getPremiumTierId?: typeof getPremiumTierId
  linkQuizToProfile?: typeof linkQuizToProfile
  checkRateLimit?: (identifier: string, config: RateLimitConfig) => Promise<RateLimitResult>
  defer?: (work: () => void | Promise<void>) => void
}

export async function GET(request: Request) {
  const supabase = createAdminClient()
  return handleOneTimeActivationStatus(request, {
    supabase,
    stripe: getStripe(),
    linkQuizToProfile,
    checkRateLimit,
    defer: after,
  })
}

export async function handleOneTimeActivationStatus(
  request: Request,
  deps: OneTimeActivationStatusDeps,
) {
  const parsed = parseOneTimeActivationStatusRequest(request)
  if (!parsed) return statusJson({ status: "failed_permanent" }, 400)

  const rateCheck = await (deps.checkRateLimit ?? checkRateLimit)(
    activationStatusRateLimitKey(request, parsed),
    ONE_TIME_ACTIVATION_STATUS_RATE_LIMIT,
  ).catch(() => ({ allowed: false, error: "service_unavailable" }))
  if (!rateCheck.allowed) {
    return statusJson({ status: "pending" }, rateCheck.error === "service_unavailable" ? 503 : 429)
  }

  try {
    if (parsed.provider === "stripe") {
      const verify = deps.verifyCheckoutSessionForActivation ?? verifyCheckoutSessionForActivation
      const ensure = deps.ensureOneTimeCheckoutAccount ?? ensureOneTimeCheckoutAccount
      const session = await verify(parsed.sessionId, deps.stripe)
      if (session.metadata?.product_kind !== "personal_plan_once") {
        return statusJson({ status: "failed_permanent" }, 400)
      }
      const activation = await ensure(session, {
        supabase: deps.supabase,
        stripe: deps.stripe,
        premiumTierId: await (deps.getPremiumTierId ?? getPremiumTierId)(deps.supabase),
        linkQuizToProfile: deps.linkQuizToProfile,
        defer: deps.defer,
      })
      return statusJson({
        status: accessStateToStatus(activation.state),
      })
    }

    // This endpoint is polled from the pending screen. It may retrieve an
    // already-captured order, but it must never initiate or capture a payment.
    const verification = await (
      deps.verifyPayPalOneTimePaymentForRecovery ?? verifyPayPalOneTimePaymentForRecovery
    )({
      supabase: deps.supabase,
      token: parsed.token,
    })
    const capturedIntent = verification.intent.provider_capture_id
      ? verification.intent
      : await (deps.tryMarkPayPalOrderIntentCaptured ?? tryMarkPayPalOrderIntentCaptured)(
          deps.supabase,
          parsed.token,
          verification.payment.providerOrderId,
          verification.payment.providerTransactionId,
        )
    const activation = await (
      deps.activateVerifiedPayPalOrderIntent ?? activateVerifiedPayPalOrderIntent
    )(
      capturedIntent,
      {
        captureId: verification.payment.providerTransactionId,
        orderId: verification.payment.providerOrderId ?? verification.intent.provider_order_id!,
        paidAt: verification.payment.paidAt,
      },
      {
        supabase: deps.supabase,
        linkQuizToProfile: deps.linkQuizToProfile,
        defer: deps.defer,
      },
    )
    return statusJson({
      status: accessStateToStatus(activation.status),
    })
  } catch (error) {
    if (error instanceof CheckoutActivationError) {
      return statusJson({ status: stripeActivationErrorStatus(error.code) }, 400)
    }
    if (error instanceof PayPalCheckoutActivationError) {
      return statusJson(
        {
          status: error.code === "paypal_order_capture_pending" ? "pending" : "failed_permanent",
        },
        error.code === "paypal_order_capture_pending" ? 200 : 400,
      )
    }

    console.error("[one-time-activation-status] failed", { reason: "unexpected" })
    return statusJson({ status: "pending" }, 500)
  }
}

function accessStateToStatus(
  state: "active" | "paid_pending" | "revoked" | "none" | "pending",
): OneTimeActivationStatusResponse["status"] {
  if (state === "active" || state === "revoked") return state
  return "paid_pending"
}

function parseOneTimeActivationStatusRequest(
  request: Request,
): { provider: "stripe"; sessionId: string } | { provider: "paypal"; token: string } | null {
  const url = new URL(request.url)
  const provider = url.searchParams.get("provider")
  const keys = Array.from(url.searchParams.keys())

  if (provider === "stripe") {
    const sessionId = url.searchParams.get("session_id")?.trim()
    if (!sessionId || url.searchParams.has("token")) return null
    if (!keys.every((key) => key === "provider" || key === "session_id")) return null
    return { provider, sessionId }
  }

  if (provider === "paypal") {
    const token = url.searchParams.get("token")?.trim()
    if (!token || url.searchParams.has("session_id")) return null
    if (!keys.every((key) => key === "provider" || key === "token")) return null
    return { provider, token }
  }

  return null
}

function activationStatusRateLimitKey(
  request: Request,
  parsed: { provider: "stripe"; sessionId: string } | { provider: "paypal"; token: string },
): string {
  const requestIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  const reference = parsed.provider === "stripe" ? parsed.sessionId : parsed.token
  return createHash("sha256").update(`${parsed.provider}:${reference}:${requestIp}`).digest("hex")
}

function stripeActivationErrorStatus(
  code: CheckoutActivationError["code"],
): OneTimeActivationStatusResponse["status"] {
  if (code === "checkout_session_incomplete" || code === "checkout_session_unpaid") {
    return "pending"
  }
  return "failed_permanent"
}

function statusJson(body: OneTimeActivationStatusResponse, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  })
}
