import { NextResponse } from "next/server"
import type Stripe from "stripe"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"
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
  claimCheckoutActivation?: typeof claimCheckoutActivation
  releaseCheckoutActivationClaim?: typeof releaseCheckoutActivationClaim
  linkQuizToProfile?: (userId: string, email: string | undefined, leadId?: string) => Promise<void>
  getPremiumTierId?: (supabase: SupabaseClient) => Promise<string>
  now?: () => Date
}

type RouteResult = {
  status: number
  body: Record<string, unknown>
}

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

  const rateCheck = await deps.checkRateLimit(parsed.sessionId, SEND_AUTH_LINK_RATE_LIMIT)
  if (!rateCheck.allowed) {
    return {
      status: rateCheck.error === "service_unavailable" ? 503 : 429,
      body: {
        error:
          rateCheck.error === "service_unavailable"
            ? RATE_LIMIT_UNAVAILABLE_ERROR
            : RATE_LIMIT_ERROR,
      },
    }
  }

  try {
    const session = await deps.verifyCheckoutSessionForActivation(parsed.sessionId, deps.stripe)
    const premiumTierId = await (deps.getPremiumTierId ?? getPremiumTierId)(deps.supabase)
    const account = await deps.ensureCheckoutAccount(session, {
      supabase: deps.supabase,
      stripe: deps.stripe,
      premiumTierId,
      linkQuizToProfile: deps.linkQuizToProfile,
    })

    const claimed = await (deps.claimCheckoutActivation ?? claimCheckoutActivation)(
      deps.supabase,
      parsed.sessionId,
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
      await (deps.releaseCheckoutActivationClaim ?? releaseCheckoutActivationClaim)(
        deps.supabase,
        parsed.sessionId,
      )
      return { status: 500, body: { error: SEND_ERROR } }
    }

    await consumeCheckoutPasswordMarker(deps, account.userId, parsed.sessionId)

    return { status: 200, body: { ok: true, email: account.email } }
  } catch (err) {
    if (err instanceof CheckoutActivationError) {
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
    linkQuizToProfile,
  }
}

async function getPremiumTierId(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase.from("subscription_tiers").select("id, slug")
  if (error) throw new Error(`failed to load subscription_tiers: ${error.message}`)

  const premium = data?.find((row: { id: string; slug: string }) => row.slug === "premium")?.id
  if (!premium) throw new Error("subscription_tiers premium seed row missing")
  return premium
}

async function consumeCheckoutPasswordMarker(
  deps: SendMagicLinkDeps,
  userId: string,
  sessionId: string,
) {
  const { data, error } = await deps.supabase.auth.admin.getUserById(userId)
  if (error) throw new Error(`getUserById failed: ${error.message}`)

  const metadata = data.user?.app_metadata
  const appMetadata = isRecord(metadata) ? { ...metadata } : {}
  if (appMetadata.checkout_activation_session_hash !== checkoutSessionHash(sessionId)) return

  delete appMetadata.checkout_activation_session_hash
  appMetadata.activation_method = "passwordless"
  appMetadata.passwordless_login_sent_at = (deps.now ?? (() => new Date()))().toISOString()

  const { error: updateError } = await deps.supabase.auth.admin.updateUserById(userId, {
    app_metadata: appMetadata,
  })
  if (updateError) {
    console.error("[send-magic-link] activation marker cleanup failed:", updateError.message)
  }
}

function parseBody(body: unknown): { ok: true; sessionId: string } | { ok: false } {
  if (!isRecord(body)) return { ok: false }
  const sessionId = body.session_id
  if (typeof sessionId !== "string" || sessionId.trim() === "") return { ok: false }
  return { ok: true, sessionId: sessionId.trim() }
}

function isPaymentIncompleteError(code: CheckoutActivationError["code"]): boolean {
  return code === "checkout_session_incomplete" || code === "checkout_session_unpaid"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function toNextResponse(result: RouteResult) {
  return NextResponse.json(result.body, { status: result.status })
}
