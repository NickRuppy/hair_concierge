import { after, NextResponse } from "next/server"
import type Stripe from "stripe"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"
import { captureCheckoutException } from "@/lib/observability/checkout"
import {
  checkoutSessionHash,
  claimCheckoutActivation,
  releaseCheckoutActivationClaim,
} from "@/lib/auth/checkout-activation-claim"
import {
  CheckoutRecoveryError,
  checkoutRecoveryResponse,
} from "@/lib/auth/checkout-activation-outcome"
import { classifyCheckoutRecoveryError } from "@/lib/auth/checkout-recovery-classification"
import { checkRateLimit, SET_CHECKOUT_PASSWORD_RATE_LIMIT } from "@/lib/rate-limit"
import { validatePasswordDraft } from "@/lib/auth/password-policy"
import { linkQuizToProfile } from "@/lib/quiz/link-to-profile"
import {
  CheckoutActivationError,
  ensureCheckoutAccount,
  ensureOneTimeCheckoutAccount,
  verifyCheckoutSessionForActivation,
} from "@/lib/stripe/checkout-activation"
import {
  PayPalCheckoutActivationError,
  ensurePayPalCheckoutAccountForToken,
  paypalCheckoutActivationId,
  type PayPalCheckoutAccountResult,
} from "@/lib/paypal/checkout-activation"
import { getPremiumTierId } from "@/lib/billing/tier-ids"
import {
  getCheckoutFirstTimeDestinationOptionsFromAccount,
  resolveCheckoutFirstTimeDestination,
} from "@/lib/billing/checkout-success-redirect"
import { recoverPayPalOrderActivation } from "@/lib/paypal/order-activation"

export const runtime = "nodejs"

const INVALID_REQUEST_ERROR = "Bitte sende eine gültige Checkout-Session und ein Passwort."
const WEAK_PASSWORD_ERROR = "Das Passwort muss mindestens 8 Zeichen lang sein."
const RATE_LIMIT_ERROR = "Zu viele Versuche. Bitte warte kurz und versuche es erneut."
const RATE_LIMIT_UNAVAILABLE_ERROR =
  "Passwort kann gerade nicht gesetzt werden. Bitte versuche es gleich erneut."
const INCOMPLETE_PAYMENT_ERROR =
  "Deine Zahlung ist noch nicht abgeschlossen. Bitte schließe den Checkout zuerst ab."

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
  ensureOneTimeCheckoutAccount?: typeof ensureOneTimeCheckoutAccount
  ensurePayPalCheckoutAccountForToken?: typeof ensurePayPalCheckoutAccountForToken
  recoverPayPalOrderActivation?: typeof recoverPayPalOrderActivation
  claimCheckoutActivation?: typeof claimCheckoutActivation
  releaseCheckoutActivationClaim?: typeof releaseCheckoutActivationClaim
  linkQuizToProfile?: (userId: string, email: string | undefined, leadId?: string) => Promise<void>
  getPremiumTierId?: (supabase: SupabaseClient) => Promise<string>
  captureCheckoutException?: typeof captureCheckoutException
  now?: () => Date
  defer?: (work: () => void | Promise<void>) => void
}

type RouteResult = {
  status: number
  body: Record<string, unknown>
}

type CheckoutActivationTarget =
  | { provider: "stripe"; sessionId: string; activationId: string }
  | { provider: "paypal"; token: string; activationId: string; purchaseKind?: "one_time" }

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
        ...(status === 429 ? checkoutRecoveryResponse("auth_rate_limited").body : {}),
        error:
          rateCheck.error === "service_unavailable"
            ? RATE_LIMIT_UNAVAILABLE_ERROR
            : RATE_LIMIT_ERROR,
      },
    }
  }

  try {
    const account = await ensureActiveCheckoutAccount(target, deps)
    const next = await resolveCheckoutFirstTimeDestination(
      deps.supabase,
      account.leadId,
      account.checkoutContext,
      getCheckoutFirstTimeDestinationOptionsFromAccount(account),
    )

    if (!account.canSetInitialPassword) {
      throw new CheckoutRecoveryError("activation_login_required")
    }

    const metadata = await loadCurrentAppMetadata(deps.supabase, account.userId)
    if (!isActivationStillValid(metadata, target.activationId)) {
      throw new CheckoutRecoveryError("activation_login_required")
    }

    const claimed = await (deps.claimCheckoutActivation ?? claimCheckoutActivation)(
      deps.supabase,
      target.activationId,
      account.userId,
      "password",
    )
    if (!claimed) {
      throw new CheckoutRecoveryError("activation_login_required")
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
      try {
        await (deps.releaseCheckoutActivationClaim ?? releaseCheckoutActivationClaim)(
          deps.supabase,
          target.activationId,
        )
      } catch (releaseError) {
        ;(deps.captureCheckoutException ?? captureCheckoutException)(releaseError, {
          ...checkoutActivationTargetSentryDetails(target, "checkout_password_activation"),
          status: 500,
          reason: "release_checkout_activation_claim_failed_after_password_error",
        })
        return checkoutRecoveryResponse("activation_login_required")
      }
      return checkoutRecoveryResponse("activation_temporary")
    }

    return { status: 200, body: { ok: true, email: account.email, next } }
  } catch (err) {
    if (err instanceof CheckoutRecoveryError) {
      captureRecoveryCause(err, target, deps)
      return checkoutRecoveryResponse(err.code)
    }

    if (err instanceof CheckoutActivationPendingError) {
      return checkoutRecoveryResponse("activation_pending")
    }

    if (err instanceof CheckoutActivationError || err instanceof PayPalCheckoutActivationError) {
      if (isPaymentIncompleteError(err.code)) {
        return { status: 403, body: { error: INCOMPLETE_PAYMENT_ERROR } }
      }
      const recoveryCode = classifyCheckoutRecoveryError(err)
      if (recoveryCode) {
        if (recoveryCode === "trial_reconciliation_required") {
          ;(deps.captureCheckoutException ?? captureCheckoutException)(err, {
            ...checkoutActivationTargetSentryDetails(target, "checkout_password_activation"),
            status: checkoutRecoveryResponse(recoveryCode).status,
            reason: err.code,
          })
        }
        return checkoutRecoveryResponse(recoveryCode)
      }
      ;(deps.captureCheckoutException ?? captureCheckoutException)(err, {
        ...checkoutActivationTargetSentryDetails(target, "checkout_password_activation"),
        status: 503,
        reason: err.code,
      })
      return checkoutRecoveryResponse("activation_temporary")
    }

    const recoveryCode = classifyCheckoutRecoveryError(err)
    if (recoveryCode) {
      if (recoveryCode === "trial_reconciliation_required") {
        ;(deps.captureCheckoutException ?? captureCheckoutException)(err, {
          ...checkoutActivationTargetSentryDetails(target, "checkout_password_activation"),
          status: checkoutRecoveryResponse(recoveryCode).status,
          reason: "classified_persistent_provider_error",
        })
      }
      return checkoutRecoveryResponse(recoveryCode)
    }

    console.error("[set-checkout-password] failed:", err)
    ;(deps.captureCheckoutException ?? captureCheckoutException)(err, {
      ...checkoutActivationTargetSentryDetails(target, "checkout_password_activation"),
      status: 500,
    })
    return checkoutRecoveryResponse("activation_temporary")
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
    defer: after,
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
    if (session.metadata?.product_kind === "personal_plan_once") {
      const account = await (deps.ensureOneTimeCheckoutAccount ?? ensureOneTimeCheckoutAccount)(
        session,
        {
          supabase: deps.supabase,
          stripe: deps.stripe,
          premiumTierId,
          linkQuizToProfile: deps.linkQuizToProfile,
          defer: deps.defer,
        },
      )
      if (account.state !== "active") throw new CheckoutActivationPendingError()
      return account
    }
    return deps.ensureCheckoutAccount(session, {
      supabase: deps.supabase,
      stripe: deps.stripe,
      premiumTierId,
      linkQuizToProfile: deps.linkQuizToProfile,
    })
  }

  if (target.purchaseKind === "one_time") {
    const activation = await (deps.recoverPayPalOrderActivation ?? recoverPayPalOrderActivation)(
      target.token,
      {
        supabase: deps.supabase,
        linkQuizToProfile: deps.linkQuizToProfile,
        defer: deps.defer,
      },
    )
    if (activation.status !== "active") throw new CheckoutActivationPendingError()
    return activation.account
  }

  const ensurePayPal =
    deps.ensurePayPalCheckoutAccountForToken ?? ensurePayPalCheckoutAccountForToken
  const account: PayPalCheckoutAccountResult = await ensurePayPal(target.token, {
    supabase: deps.supabase,
    premiumTierId,
    linkQuizToProfile: deps.linkQuizToProfile,
  })
  if (account.status === "pending") throw new CheckoutRecoveryError("activation_pending")
  if (account.status === "duplicate") {
    throw new CheckoutRecoveryError(account.recoveryCode ?? "checkout_existing_access")
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
    const purchaseKind = body.purchase === "one_time" ? "one_time" : undefined
    return {
      provider: "paypal",
      token: token.trim(),
      activationId: paypalCheckoutActivationId(token.trim()),
      purchaseKind,
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

function captureRecoveryCause(
  error: CheckoutRecoveryError,
  target: CheckoutActivationTarget,
  deps: SetCheckoutPasswordDeps,
) {
  if (
    error.cause === undefined ||
    (error.code !== "trial_reconciliation_required" && error.code !== "activation_temporary")
  )
    return
  ;(deps.captureCheckoutException ?? captureCheckoutException)(error.cause, {
    ...checkoutActivationTargetSentryDetails(target, "checkout_password_activation"),
    status: checkoutRecoveryResponse(error.code).status,
    reason: error.code,
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

class CheckoutActivationPendingError extends Error {
  constructor() {
    super("Checkout activation is paid but pending")
    this.name = "CheckoutActivationPendingError"
  }
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
