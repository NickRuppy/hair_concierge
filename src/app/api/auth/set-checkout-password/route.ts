import { NextResponse } from "next/server"
import type Stripe from "stripe"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"
import { captureCheckoutException } from "@/lib/observability/checkout"
import {
  checkoutSessionHash,
  claimCheckoutActivation,
  releaseCheckoutActivationClaim,
} from "@/lib/auth/checkout-activation-claim"
import { checkRateLimit, SET_CHECKOUT_PASSWORD_RATE_LIMIT } from "@/lib/rate-limit"
import { validatePasswordDraft } from "@/lib/auth/password-policy"
import { linkQuizToProfile } from "@/lib/quiz/link-to-profile"
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

const INVALID_REQUEST_ERROR = "Bitte sende eine gültige Checkout-Session und ein Passwort."
const WEAK_PASSWORD_ERROR = "Das Passwort muss mindestens 8 Zeichen lang sein."
const RATE_LIMIT_ERROR = "Zu viele Versuche. Bitte warte kurz und versuche es erneut."
const RATE_LIMIT_UNAVAILABLE_ERROR =
  "Passwort kann gerade nicht gesetzt werden. Bitte versuche es gleich erneut."
const EXISTING_ACCOUNT_ERROR =
  "Für diese E-Mail gibt es bereits ein Konto. Bitte melde dich an oder nutze den Login-Link."
const EXPIRED_ACTIVATION_ERROR =
  "Diese Passwort-Aktivierung ist nicht mehr gültig. Bitte melde dich an oder nutze den Login-Link."
const INVALID_SESSION_ERROR =
  "Checkout konnte nicht bestätigt werden. Bitte öffne den Link aus deiner Bestellbestätigung erneut."
const INCOMPLETE_PAYMENT_ERROR =
  "Deine Zahlung ist noch nicht abgeschlossen. Bitte schließe den Checkout zuerst ab."
const SERVER_ERROR = "Passwort konnte nicht gesetzt werden. Bitte versuche es später erneut."

type RateLimitResult = { allowed: boolean; error?: string }

export interface SetCheckoutPasswordDeps {
  stripe: Stripe
  supabase: SupabaseClient
  checkRateLimit: (
    identifier: string,
    config: typeof SET_CHECKOUT_PASSWORD_RATE_LIMIT,
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

  return toNextResponse(
    await handleSetCheckoutPassword(body, await createSetCheckoutPasswordDeps()),
  )
}

export async function handleSetCheckoutPassword(
  body: unknown,
  deps: SetCheckoutPasswordDeps,
): Promise<RouteResult> {
  const parsed = parseBody(body)
  if (!parsed.ok) return { status: 400, body: { error: INVALID_REQUEST_ERROR } }

  const { target, password } = parsed
  const passwordValidation = validatePasswordDraft(password, password)
  if (!passwordValidation.ok) return { status: 400, body: { error: WEAK_PASSWORD_ERROR } }

  const rateCheck = await deps.checkRateLimit(target.activationId, SET_CHECKOUT_PASSWORD_RATE_LIMIT)
  if (!rateCheck.allowed) {
    const status = rateCheck.error === "service_unavailable" ? 503 : 429
    ;(deps.captureCheckoutException ?? captureCheckoutException)(
      new Error(
        rateCheck.error === "service_unavailable"
          ? "Checkout password rate limit unavailable"
          : "Checkout password rate limited",
      ),
      {
        ...checkoutActivationTargetSentryDetails(target, "checkout_password_activation"),
        status,
        reason:
          rateCheck.error === "service_unavailable"
            ? "set_checkout_password_rate_limit_unavailable"
            : "set_checkout_password_rate_limited",
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
    const account = await ensureActiveCheckoutAccount(target, deps)

    if (!account.canSetInitialPassword) {
      return { status: 409, body: { error: EXISTING_ACCOUNT_ERROR } }
    }

    const metadata = await loadCurrentAppMetadata(deps.supabase, account.userId)
    if (!isActivationStillValid(metadata, target.activationId)) {
      return { status: 409, body: { error: EXPIRED_ACTIVATION_ERROR } }
    }

    const claimed = await (deps.claimCheckoutActivation ?? claimCheckoutActivation)(
      deps.supabase,
      target.activationId,
      account.userId,
      "password",
    )
    if (!claimed) {
      return { status: 409, body: { error: EXPIRED_ACTIVATION_ERROR } }
    }

    const mergedMetadata: Record<string, unknown> = {
      ...metadata,
      checkout_activation_session_hash: null,
      password_initialized_at: (deps.now ?? (() => new Date()))().toISOString(),
    }

    const { error: updateError } = await deps.supabase.auth.admin.updateUserById(account.userId, {
      password,
      email_confirm: true,
      app_metadata: mergedMetadata,
    })

    if (updateError) {
      console.error("[set-checkout-password] updateUserById failed:", updateError.message)
      ;(deps.captureCheckoutException ?? captureCheckoutException)(updateError, {
        ...checkoutActivationTargetSentryDetails(target, "checkout_password_activation"),
        status: 500,
        reason: "update_user_failed",
      })
      await (deps.releaseCheckoutActivationClaim ?? releaseCheckoutActivationClaim)(
        deps.supabase,
        target.activationId,
      )
      return { status: 500, body: { error: SERVER_ERROR } }
    }

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

    console.error("[set-checkout-password] failed:", err)
    ;(deps.captureCheckoutException ?? captureCheckoutException)(err, {
      ...checkoutActivationTargetSentryDetails(target, "checkout_password_activation"),
      status: 500,
    })
    return { status: 500, body: { error: SERVER_ERROR } }
  }
}

async function createSetCheckoutPasswordDeps(): Promise<SetCheckoutPasswordDeps> {
  const { getStripe } = await import("@/lib/stripe/client")

  return {
    stripe: getStripe(),
    supabase: createAdminClient(),
    checkRateLimit,
    verifyCheckoutSessionForActivation,
    ensureCheckoutAccount,
    ensurePayPalCheckoutAccountForToken,
    linkQuizToProfile,
  }
}

async function loadCurrentAppMetadata(
  supabase: SupabaseClient,
  userId: string,
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.auth.admin.getUserById(userId)
  if (error) throw new Error(`getUserById failed: ${error.message}`)

  const metadata = data.user?.app_metadata
  return isRecord(metadata) ? { ...metadata } : {}
}

async function ensureActiveCheckoutAccount(
  target: CheckoutActivationTarget,
  deps: SetCheckoutPasswordDeps,
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

function isActivationStillValid(metadata: Record<string, unknown>, activationId: string): boolean {
  if (Object.prototype.hasOwnProperty.call(metadata, "password_initialized_at")) return false
  return metadata.checkout_activation_session_hash === checkoutSessionHash(activationId)
}

function parseBody(
  body: unknown,
): { ok: true; target: CheckoutActivationTarget; password: string } | { ok: false } {
  if (!isRecord(body)) return { ok: false }

  const password = body.password
  if (typeof password !== "string") return { ok: false }

  const target = parseActivationTarget(body)
  if (!target) return { ok: false }

  return { ok: true, target, password }
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
  stage: "checkout_password_activation",
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
