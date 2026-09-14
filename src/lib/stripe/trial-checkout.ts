import "server-only"

import type Stripe from "stripe"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  createTrialCheckoutAttempt,
  freezeTrialStripeCheckoutAttempt,
  bindTrialStripeCheckoutReference,
  type TrialCheckoutScope,
} from "../billing/trial-checkout-attempt"
import { reserveTrialAdmission, releaseTrialAdmission } from "../billing/trial-admission"
import type { TrialIdentityClaim } from "../billing/trial-eligibility"
import { createTrialOfferSnapshot } from "../billing/trial-offer"
import {
  freezeTrialManagementCatalog,
  loadFrozenTrialManagementCatalog,
} from "../billing/trial-management-operations"
import { isTrialEnrollmentAllowed, type TrialRuntime } from "../billing/trial-runtime"
import { attestStripeTrialCatalog } from "./trial-catalog"
import {
  buildTrialStripeCheckoutSessionParams,
  type BuildTrialStripeCheckoutSessionParamsInput,
} from "./trial-checkout-session-params"

const store = {
  create: createTrialCheckoutAttempt,
  freeze: freezeTrialStripeCheckoutAttempt,
  bind: bindTrialStripeCheckoutReference,
  reserve: reserveTrialAdmission,
  release: releaseTrialAdmission,
  freezeManagementCatalog: freezeTrialManagementCatalog,
  loadManagementCatalog: loadFrozenTrialManagementCatalog,
}

type Input = {
  /** Resolved by the server using the existing authenticated-account / lead flow. */
  scope: TrialCheckoutScope
  clientAttemptId: string
  interval: "month" | "year"
  serverVerifiedEmail: string
  claims: readonly TrialIdentityClaim[]
  checkout: Omit<BuildTrialStripeCheckoutSessionParamsInput, "offer">
}

type Deps = {
  supabase: SupabaseClient
  stripe: Stripe
  runtime: TrialRuntime | null
  now?: () => Date
  store?: typeof store
  attest?: typeof attestStripeTrialCatalog
}

/** Creates only an explicitly requested free trial, with no paid fallback. */
export async function createDurableStripeTrialCheckout(input: Input, deps: Deps) {
  const runtime = deps.runtime
  if (!runtime || !isTrialEnrollmentAllowed(runtime, input.serverVerifiedEmail))
    throw new Error("Trial checkout is unavailable")
  if (input.scope.kind === "user" && input.claims.length === 0)
    throw new Error("Trial account identity is required")
  const offer = createTrialOfferSnapshot(input.interval, runtime.catalog)
  const persistence = deps.store ?? store
  const now = (deps.now ?? (() => new Date()))()
  if (!Number.isFinite(now.getTime())) throw new Error("Trial checkout clock is unavailable")

  let attempt = await persistence.create(deps.supabase, {
    scope: input.scope,
    clientAttemptId: input.clientAttemptId,
    offer,
  })
  if (
    attempt.scope.kind !== input.scope.kind ||
    attempt.scope.id !== input.scope.id ||
    attempt.clientAttemptId !== input.clientAttemptId ||
    attempt.offer.interval !== input.interval
  )
    throw new Error("Trial checkout attempt does not match")

  if (input.claims.length && !attempt.providerReference) {
    const admission = await persistence.reserve(deps.supabase, attempt.enrollmentId, input.claims)
    if (admission !== "reserved" && admission !== "active")
      throw new Error("Trial checkout eligibility denied")
  }

  const frozenCatalog = await persistence.loadManagementCatalog(deps.supabase, attempt.enrollmentId)
  if (!frozenCatalog) {
    if (attempt.status !== "reserved" || attempt.stripeParams || attempt.providerReference)
      throw new Error("Trial management catalog reconciliation required")
    const catalog = {
      month: createTrialOfferSnapshot("month", runtime.catalog),
      year: createTrialOfferSnapshot("year", runtime.catalog),
    }
    if (JSON.stringify(catalog[input.interval]) !== JSON.stringify(attempt.offer))
      throw new Error("Trial management catalog does not match accepted terms")
    for (const selectedOffer of [catalog.month, catalog.year]) {
      await (deps.attest ?? attestStripeTrialCatalog)({
        stripe: deps.stripe,
        offer: selectedOffer,
        expectedAccountId: runtime.stripeAccountId,
        expectedLivemode: runtime.livemode,
      })
    }
    await persistence.freezeManagementCatalog(deps.supabase, {
      enrollmentId: attempt.enrollmentId,
      catalog,
    })
  } else if (JSON.stringify(frozenCatalog[input.interval]) !== JSON.stringify(attempt.offer)) {
    throw new Error("Frozen trial management catalog does not match accepted terms")
  }

  if (!attempt.stripeParams) {
    if (attempt.status !== "reserved") throw new Error("Trial checkout reconciliation required")
    const expiresAt = Math.floor(now.getTime() / 1000) + 3600
    const params = buildTrialStripeCheckoutSessionParams({
      ...input.checkout,
      offer: attempt.offer,
      expiresAt,
      metadata: {
        ...input.checkout.metadata,
        checkout_attempt_id: input.checkout.metadata?.checkout_attempt_id ?? input.clientAttemptId,
        trial_enrollment_id: attempt.enrollmentId,
      },
    })
    attempt = await persistence.freeze(deps.supabase, {
      attemptId: attempt.id,
      stripeAccountId: runtime.stripeAccountId,
      livemode: runtime.livemode,
      params: JSON.parse(JSON.stringify(params)),
      expiresAt: new Date(expiresAt * 1000).toISOString(),
    })
  }
  if (
    !attempt.stripeParams ||
    attempt.stripeAccountId !== runtime.stripeAccountId ||
    attempt.stripeLivemode !== runtime.livemode
  )
    throw new Error("Trial checkout provider mismatch")
  // Frozen requests can survive catalog/coupon retirement, but never a change
  // of merchant or mode. Do not re-attest sellability on an accepted retry.
  const account = await deps.stripe.accounts.retrieve(null)
  if (account.id !== attempt.stripeAccountId) throw new Error("Trial checkout provider mismatch")

  let session: Stripe.Checkout.Session
  if (attempt.providerReference) {
    session = await deps.stripe.checkout.sessions.retrieve(attempt.providerReference)
    if (session.id !== attempt.providerReference) throw new Error("Trial checkout session mismatch")
  } else {
    if (
      attempt.status !== "frozen" ||
      !attempt.expiresAt ||
      !Number.isFinite(Date.parse(attempt.expiresAt)) ||
      Date.parse(attempt.expiresAt) <= now.getTime()
    )
      throw new Error("Trial checkout reconciliation required")
    session = await deps.stripe.checkout.sessions.create(
      attempt.stripeParams as unknown as Stripe.Checkout.SessionCreateParams,
      { idempotencyKey: `trial-checkout:${attempt.id}:v1` },
    )
  }
  if (
    session.mode !== "subscription" ||
    session.livemode !== attempt.stripeLivemode ||
    session.metadata?.trial_cohort !== "trial_v1" ||
    session.metadata.trial_enrollment_id !== attempt.enrollmentId ||
    !["open", "complete", "expired"].includes(session.status ?? "") ||
    (session.status === "open" && !session.client_secret)
  )
    throw new Error("Trial checkout session mismatch")
  if (!attempt.providerReference) {
    const bound = await persistence.bind(deps.supabase, {
      attemptId: attempt.id,
      providerReference: session.id,
    })
    if (bound.providerReference !== session.id || bound.status !== "provider_created")
      throw new Error("Trial checkout binding reconciliation required")
  }
  if (session.status === "expired") {
    // Stripe session expiry alone is insufficient if an agreement/payment exists.
    // Only a definitively uncompleted checkout can release an unused identity.
    if (
      session.subscription !== null ||
      session.payment_intent !== null ||
      !(await persistence.release(
        deps.supabase,
        attempt.enrollmentId,
        `stripe:expired:${session.id}`,
      ))
    ) {
      throw new Error("Trial checkout expiry reconciliation required")
    }
  }
  return { session, offer: attempt.offer, enrollmentId: attempt.enrollmentId }
}
