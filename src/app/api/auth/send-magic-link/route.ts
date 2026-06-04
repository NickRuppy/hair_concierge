import { NextResponse } from "next/server"
import type Stripe from "stripe"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"
import { captureCheckoutException, getCheckoutRateLimitReason } from "@/lib/observability/checkout"
import {
  checkoutSessionHash,
  claimCheckoutActivation,
  releaseCheckoutActivationClaim,
} from "@/lib/auth/checkout-activation-claim"
import { linkQuizToProfile } from "@/lib/quiz/link-to-profile"
import { checkRateLimit, SEND_AUTH_LINK_RATE_LIMIT } from "@/lib/rate-limit"
import {
  CheckoutActivationError,
  ensureCheckoutAccount,
  verifyCheckoutSessionForActivation,
} from "@/lib/stripe/checkout-activation"
import {
  PayPalCheckoutActivationError,
  ensurePayPalCheckoutAccountForToken,
  paypalCheckoutActivationId,
  type PayPalCheckoutAccountResult,
} from "@/lib/paypal/checkout-activation"
import { getPremiumTierId } from "@/lib/billing/tier-ids"

export const runtime = "nodejs"

const INVALID_REQUEST_ERROR = "Bitte öffne den Aktivierungslink erneut."
const RATE_LIMIT_ERROR = "Zu viele Anfragen. Bitte warte kurz."
const RATE_LIMIT_UNAVAILABLE_ERROR =
  "Login-Link kann gerade nicht gesendet werden. Bitte versuche es gleich erneut."
const INCOMPLETE_PAYMENT_ERROR =
  "Deine Zahlung ist noch nicht abgeschlossen. Bitte schließe den Checkout zuerst ab."
const INVALID_SESSION_ERROR =
  "Checkout konnte nicht bestätigt werden. Bitte öffne den Link aus deiner Bestellbestätigung erneut."
const SEND_ERROR = "Login-Link konnte nicht gesendet werden. Bitte versuche es erneut."
const EXPIRED_ACTIVATION_ERROR =
  "Diese Kontoaktivierung ist nicht mehr gültig. Bitte melde dich an oder nutze den Login-Link."
const SERVER_ERROR = "Kontoaktivierung konnte nicht abgeschlossen werden. Bitte versuche es erneut."

type RateLimitResult = { allowed: boolean; error?: string }

export interface SendMagicLinkDeps {
  stripe: Stripe
  supabase: SupabaseClient
  siteUrl: string
  checkRateLimit: (
    identifier: string,
    config: typeof SEND_AUTH_LINK_RATE_LIMIT,
  ) => Promise<RateLimitResult>
  verifyCheckoutSessionForActivation: (
    sessionId: string,
    stripe?: Stripe,
  ) => Promise<Stripe.Checkout.Session>
  ensureCheckoutAccount: typeof ensureCheckoutAccount
  ensurePayPalCheckoutAccountForToken?: typeof ensurePayPalCheckoutAccountForToken
  claimCheckoutActivation?: typeof claimCheckoutActivation
  releaseCheckoutActivationClaim?: typeof releaseCheckoutActivationClaim
  linkQuizToProfile?: (userId: string, email: string | undefined, leadId?: string) => Promise<void>
  getPremiumTierId?: (supabase: SupabaseClient) => Promise<string>
  captureCheckoutException?: typeof captureCheckoutException
  now?: () => Date
}

type RouteResult = {
  status: number
  body: Record<string, unknown>
}

type CheckoutActivationTarget =
  | { provider: "stripe"; sessionId: string; activationId: string }
  | { provider: "paypal"; token: string; activationId: string }

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return toNextResponse({ status: 400, body: { error: INVALID_REQUEST_ERROR } })
  }

  return toNextResponse(await handleSendMagicLink(body, await createSendMagicLinkDeps()))
}

export async function handleSendMagicLink(
  body: unknown,
  deps: SendMagicLinkDeps,
): Promise<RouteResult> {
  const parsed = parseBody(body)
  if (!parsed.ok) return { status: 400, body: { error: INVALID_REQUEST_ERROR } }

  const rateCheck = await deps.checkRateLimit(parsed.target.activationId, SEND_AUTH_LINK_RATE_LIMIT)
  if (!rateCheck.allowed) {
    const status = rateCheck.error === "service_unavailable" ? 503 : 429
    ;(deps.captureCheckoutException ?? captureCheckoutException)(
      new Error(
        rateCheck.error === "service_unavailable"
          ? "Checkout auth-link rate limit unavailable"
          : "Checkout auth-link rate limited",
      ),
      {
        ...checkoutActivationTargetSentryDetails(parsed.target, "checkout_magic_link_activation"),
        status,
        reason:
          rateCheck.error === "service_unavailable"
            ? "send_auth_link_rate_limit_unavailable"
            : "send_auth_link_rate_limited",
        rateLimitSource: "app",
      },
    )
    return {
      status,
      body: {
        error:
          rateCheck.error === "service_unavailable"
            ? RATE_LIMIT_UNAVAILABLE_ERROR
            : RATE_LIMIT_ERROR,
      },
    }
  }

  try {
    const account = await ensureActiveCheckoutAccount(parsed.target, deps)

    const claimed = await (deps.claimCheckoutActivation ?? claimCheckoutActivation)(
      deps.supabase,
      parsed.target.activationId,
      account.userId,
      "passwordless",
    )
    if (!claimed) {
      return { status: 409, body: { error: EXPIRED_ACTIVATION_ERROR } }
    }

    const { error } = await deps.supabase.auth.signInWithOtp({
      email: account.email,
      options: {
        emailRedirectTo: `${deps.siteUrl}/auth/confirm?next=/onboarding`,
        shouldCreateUser: false,
      },
    })

    if (error) {
      console.error("[send-magic-link] signInWithOtp failed:", error.message)
      const rateLimitReason = getCheckoutRateLimitReason(error)
      ;(deps.captureCheckoutException ?? captureCheckoutException)(error, {
        ...checkoutActivationTargetSentryDetails(parsed.target, "checkout_magic_link_activation"),
        // The route still returns 500, but this tags the upstream Supabase Auth throttle.
        status: rateLimitReason ? 429 : 500,
        reason: rateLimitReason ?? "sign_in_with_otp_failed",
        rateLimitSource: rateLimitReason ? "supabase_auth" : undefined,
      })
      await (deps.releaseCheckoutActivationClaim ?? releaseCheckoutActivationClaim)(
        deps.supabase,
        parsed.target.activationId,
      )
      return { status: 500, body: { error: SEND_ERROR } }
    }

    await consumeCheckoutPasswordMarker(deps, account.userId, parsed.target.activationId)

    return { status: 200, body: { ok: true, email: account.email } }
  } catch (err) {
    if (err instanceof CheckoutActivationError || err instanceof PayPalCheckoutActivationError) {
      return {
        status: isPaymentIncompleteError(err.code) ? 403 : 400,
        body: {
          error: isPaymentIncompleteError(err.code)
            ? INCOMPLETE_PAYMENT_ERROR
            : INVALID_SESSION_ERROR,
        },
      }
    }

    console.error("[send-magic-link] failed:", err)
    ;(deps.captureCheckoutException ?? captureCheckoutException)(err, {
      ...checkoutActivationTargetSentryDetails(parsed.target, "checkout_magic_link_activation"),
      status: 500,
    })
    return { status: 500, body: { error: SERVER_ERROR } }
  }
}

async function createSendMagicLinkDeps(): Promise<SendMagicLinkDeps> {
  const { getStripe } = await import("@/lib/stripe/client")

  return {
    stripe: getStripe(),
    supabase: createAdminClient(),
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    checkRateLimit,
    verifyCheckoutSessionForActivation,
    ensureCheckoutAccount,
    ensurePayPalCheckoutAccountForToken,
    linkQuizToProfile,
  }
}

async function consumeCheckoutPasswordMarker(
  deps: SendMagicLinkDeps,
  userId: string,
  activationId: string,
) {
  const { data, error } = await deps.supabase.auth.admin.getUserById(userId)
  if (error) throw new Error(`getUserById failed: ${error.message}`)

  const metadata = data.user?.app_metadata
  const appMetadata = isRecord(metadata) ? { ...metadata } : {}
  if (appMetadata.checkout_activation_session_hash !== checkoutSessionHash(activationId)) return

  appMetadata.checkout_activation_session_hash = null
  appMetadata.activation_method = "passwordless"
  appMetadata.passwordless_login_sent_at = (deps.now ?? (() => new Date()))().toISOString()

  const { error: updateError } = await deps.supabase.auth.admin.updateUserById(userId, {
    app_metadata: appMetadata,
  })
  if (updateError) {
    console.error("[send-magic-link] activation marker cleanup failed:", updateError.message)
    ;(deps.captureCheckoutException ?? captureCheckoutException)(updateError, {
      provider: activationId.startsWith("paypal:") ? "paypal" : "stripe",
      stage: "checkout_magic_link_activation",
      source: "welcome",
      stripeSessionId: activationId.startsWith("paypal:") ? undefined : activationId,
      paypalTokenPresent: activationId.startsWith("paypal:"),
      status: 500,
      reason: "activation_marker_cleanup_failed",
    })
  }
}

async function ensureActiveCheckoutAccount(
  target: CheckoutActivationTarget,
  deps: SendMagicLinkDeps,
) {
  const premiumTierId = await (deps.getPremiumTierId ?? getPremiumTierId)(deps.supabase)

  if (target.provider === "stripe") {
    const session = await deps.verifyCheckoutSessionForActivation(target.sessionId, deps.stripe)
    return deps.ensureCheckoutAccount(session, {
      supabase: deps.supabase,
      stripe: deps.stripe,
      premiumTierId,
      linkQuizToProfile: deps.linkQuizToProfile,
    })
  }

  const ensurePayPal =
    deps.ensurePayPalCheckoutAccountForToken ?? ensurePayPalCheckoutAccountForToken
  const account: PayPalCheckoutAccountResult = await ensurePayPal(target.token, {
    supabase: deps.supabase,
    premiumTierId,
    linkQuizToProfile: deps.linkQuizToProfile,
  })
  if (account.status === "pending" || account.status === "duplicate") {
    throw new PayPalCheckoutActivationError(
      "paypal_subscription_inactive",
      "PayPal subscription is not ready for activation",
    )
  }
  return account
}

function parseBody(body: unknown): { ok: true; target: CheckoutActivationTarget } | { ok: false } {
  if (!isRecord(body)) return { ok: false }
  const target = parseActivationTarget(body)
  if (!target) return { ok: false }
  return { ok: true, target }
}

function parseActivationTarget(body: Record<string, unknown>): CheckoutActivationTarget | null {
  const sessionId = body.session_id
  if (typeof sessionId === "string" && sessionId.trim() !== "") {
    return { provider: "stripe", sessionId: sessionId.trim(), activationId: sessionId.trim() }
  }

  if (body.provider === "paypal") {
    const token = body.token
    if (typeof token !== "string" || token.trim() === "") return null
    return {
      provider: "paypal",
      token: token.trim(),
      activationId: paypalCheckoutActivationId(token.trim()),
    }
  }

  return null
}

function isPaymentIncompleteError(
  code: CheckoutActivationError["code"] | PayPalCheckoutActivationError["code"],
): boolean {
  return (
    code === "checkout_session_incomplete" ||
    code === "checkout_session_unpaid" ||
    code === "paypal_subscription_inactive"
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function checkoutActivationTargetSentryDetails(
  target: CheckoutActivationTarget,
  stage: "checkout_magic_link_activation",
) {
  if (target.provider === "paypal") {
    return {
      provider: "paypal" as const,
      stage,
      source: "welcome" as const,
      paypalTokenPresent: true,
    }
  }
  return {
    provider: "stripe" as const,
    stage,
    source: "welcome" as const,
    stripeSessionId: target.sessionId,
  }
}

function toNextResponse(result: RouteResult) {
  return NextResponse.json(result.body, { status: result.status })
}
