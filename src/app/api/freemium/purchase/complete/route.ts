import { NextResponse } from "next/server"
import { z } from "zod"
import type Stripe from "stripe"

import { getPremiumTierId } from "@/lib/billing/tier-ids"
import { isFreemiumScannerFirstEnabled } from "@/lib/entitlements/flag"
import { freemiumCheckoutUserId, isFreemiumCheckoutSession } from "@/lib/freemium/checkout-metadata"
import { createFreemiumProvisioningService } from "@/lib/freemium/plan-provisioning"
import type { FreemiumProvisioningResult } from "@/lib/freemium/plan-provisioning"
import { createFreemiumProvisioningSupabaseDependencies } from "@/lib/freemium/plan-provisioning-supabase"
import { captureCheckoutException } from "@/lib/observability/checkout"
import { linkQuizToProfile } from "@/lib/quiz/link-to-profile"
import {
  checkRateLimit,
  fixedWindowRetryAfterSeconds,
  type RateLimitConfig,
} from "@/lib/rate-limit"
import {
  assertCheckoutSessionActivatable,
  CheckoutActivationError,
  ensureCheckoutAccount,
  retrieveCheckoutSessionForActivation,
  type CheckoutAccountResult,
} from "@/lib/stripe/checkout-activation"
import { getStripe } from "@/lib/stripe/client"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

/**
 * Contextual purchase completion for the Premium sheet (freemium-scanner-first T14).
 *
 * Stripe's embedded `onComplete` callback is a CLIENT signal — it says the payment form
 * finished, not that money moved, and a determined browser can call it whenever it likes.
 * So the sheet does not unlock anything on that callback; it calls this endpoint, which
 * re-reads the Checkout Session from Stripe and decides.
 *
 * Three outcomes the sheet can act on:
 *   - `complete` — payment verified, account activated, plan admitted and provisioned. The
 *     sheet closes into the unlocked surface.
 *   - `pending`  — an asynchronous payment method is still settling (or the Session has no
 *     subscription yet). The sheet shows its processing state; the webhook lane finishes
 *     the same work when the payment lands, and a later poll flips to `complete`.
 *   - `failed`   — the Session is terminally unusable (expired, wrong owner shape). The
 *     sheet returns to plan selection with the free session untouched.
 *
 * Ownership: the Session must carry this program's marker AND this user's id, and the
 * activation result must resolve to the same user. Anything else is a 403 — a completion
 * callback must never be able to admit somebody else's purchase.
 *
 * Everything after the payment check is idempotent (see `plan-provisioning.ts`), so a
 * double callback, a refresh mid-payment and the webhook all converge on one admission,
 * one plan pin and one Routine.
 */

export const runtime = "nodejs"
export const maxDuration = 60

const rate: RateLimitConfig = {
  prefix: "freemium-purchase-complete",
  limit: 20,
  windowMs: 60_000,
}

const bodySchema = z.object({ sessionId: z.string().startsWith("cs_").max(200) }).strict()

/** Session states that mean "not settled yet", as opposed to "will never settle". */
const PENDING_ACTIVATION_CODES = new Set([
  "checkout_session_unpaid",
  "checkout_session_incomplete",
  "checkout_session_subscription_missing",
])

export type FreemiumPurchaseCompletionResponse =
  | { status: "complete"; routineReady: boolean }
  | { status: "pending" }
  | { status: "failed"; reason: string }

export type FreemiumPurchaseCompletionDeps = {
  enabled: () => boolean
  getUser: () => Promise<{ id: string } | null>
  checkRateLimit: typeof checkRateLimit
  /** Raw retrieve — no payment-state assertions, so ownership can be checked first (F6). */
  retrieveSession: (sessionId: string) => Promise<Stripe.Checkout.Session>
  /** The assertion half: throws `CheckoutActivationError` for a Session that cannot activate. */
  assertActivatable: (session: Stripe.Checkout.Session) => void
  activate: (session: Stripe.Checkout.Session) => Promise<CheckoutAccountResult>
  provision: (input: {
    userId: string
    providerReference: string
  }) => Promise<FreemiumProvisioningResult>
  captureException?: typeof captureCheckoutException
}

function json(
  body: FreemiumPurchaseCompletionResponse | { error: string },
  status = 200,
  headers?: HeadersInit,
) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } })
}

export function createFreemiumPurchaseCompletionHandler(deps: FreemiumPurchaseCompletionDeps) {
  return async function POST(request: Request): Promise<NextResponse> {
    if (!deps.enabled()) return json({ error: "not_found" }, 404)
    const user = await deps.getUser()
    if (!user) return json({ error: "unauthorized" }, 401)

    const limited = await deps.checkRateLimit(user.id, rate)
    if (!limited.allowed) {
      const unavailable = limited.error === "service_unavailable"
      return json(
        { error: unavailable ? "temporarily_unavailable" : "rate_limited" },
        unavailable ? 503 : 429,
        unavailable ? undefined : { "Retry-After": String(fixedWindowRetryAfterSeconds(rate)) },
      )
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return json({ error: "invalid_request" }, 400)
    const { sessionId } = parsed.data

    let session: Stripe.Checkout.Session
    try {
      session = await deps.retrieveSession(sessionId)
    } catch (error) {
      deps.captureException?.(error, {
        provider: "stripe",
        stage: "checkout_return",
        source: "premium_sheet",
        stripeSessionId: sessionId,
        reason: "freemium_completion_session_unreadable",
      })
      return json({ error: "temporarily_unavailable" }, 503)
    }

    // Ownership FIRST, before the Session's payment state is classified (fix round 1, F6).
    // Both halves matter: the marker proves THIS app created the Session for the sheet, the
    // user id proves it was created for THIS user. Running the classification first would
    // turn this endpoint into an oracle — an authenticated caller could tell an unpaid
    // Session from a terminally unusable one for any `cs_…` id they can guess.
    if (!isFreemiumCheckoutSession(session) || freemiumCheckoutUserId(session) !== user.id) {
      return json({ error: "forbidden" }, 403)
    }

    try {
      deps.assertActivatable(session)
    } catch (error) {
      if (error instanceof CheckoutActivationError) {
        if (PENDING_ACTIVATION_CODES.has(error.code)) return json({ status: "pending" })
        return json({ status: "failed", reason: error.code })
      }
      deps.captureException?.(error, {
        provider: "stripe",
        stage: "checkout_return",
        source: "premium_sheet",
        stripeSessionId: sessionId,
        reason: "freemium_completion_session_unreadable",
      })
      return json({ error: "temporarily_unavailable" }, 503)
    }

    let account: CheckoutAccountResult
    try {
      account = await deps.activate(session)
    } catch (error) {
      if (error instanceof CheckoutActivationError) {
        if (PENDING_ACTIVATION_CODES.has(error.code)) return json({ status: "pending" })
        deps.captureException?.(error, {
          provider: "stripe",
          stage: "stripe_webhook_activation",
          source: "premium_sheet",
          stripeSessionId: sessionId,
          reason: error.code,
        })
        return json({ status: "failed", reason: error.code })
      }
      deps.captureException?.(error, {
        provider: "stripe",
        stage: "stripe_webhook_activation",
        source: "premium_sheet",
        stripeSessionId: sessionId,
        reason: "freemium_completion_activation_failed",
      })
      return json({ error: "temporarily_unavailable" }, 503)
    }

    // Activation resolves the account by Stripe customer/email, independently of the
    // metadata. If it lands on a different account than the caller, the two identities
    // disagree and nothing may be unlocked for either.
    if (account.userId !== user.id) return json({ error: "forbidden" }, 403)

    const provisioning = await deps
      .provision({ userId: user.id, providerReference: session.id })
      .catch((error: unknown) => {
        deps.captureException?.(error, {
          provider: "stripe",
          stage: "stripe_webhook_activation",
          source: "premium_sheet",
          stripeSessionId: sessionId,
          reason: "freemium_provisioning_failed",
        })
        return { outcome: "temporarily_unavailable" as const, stage: "admission" as const }
      })

    // The payment is real and the entitlement is live either way — a degraded provisioning
    // outcome must never present as a failed purchase. It only means the Routine is not
    // ready yet; the webhook lane retries, and the client says so.
    console.info("[freemium] purchase completion", {
      outcome: provisioning.outcome,
      routineAccepted:
        provisioning.outcome === "provisioned" ? provisioning.routineAccepted : false,
    })

    return json({
      status: "complete",
      routineReady: provisioning.outcome === "provisioned" && provisioning.routineAccepted,
    })
  }
}

export const POST = createFreemiumPurchaseCompletionHandler({
  enabled: isFreemiumScannerFirstEnabled,
  getUser: async () => {
    const { data } = await (await createClient()).auth.getUser()
    return data.user ? { id: data.user.id } : null
  },
  checkRateLimit,
  retrieveSession: (sessionId) => retrieveCheckoutSessionForActivation(sessionId, getStripe()),
  assertActivatable: assertCheckoutSessionActivatable,
  activate: async (session) => {
    const admin = createAdminClient()
    return ensureCheckoutAccount(session, {
      supabase: admin,
      stripe: getStripe(),
      premiumTierId: await getPremiumTierId(admin),
      linkQuizToProfile,
    })
  },
  provision: ({ userId, providerReference }) =>
    createFreemiumProvisioningService(
      createFreemiumProvisioningSupabaseDependencies(createAdminClient() as never),
    ).provisionAfterPurchase({ userId, provider: "stripe", providerReference }),
  captureException: captureCheckoutException,
})
