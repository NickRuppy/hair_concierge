import {
  freezeTrialManagementCatalog,
  loadFrozenTrialManagementCatalog,
} from "../billing/trial-management-operations"
import "server-only"
import {
  freezeTrialAnalyticsContext,
  type TrialAnalyticsContextInput,
} from "../billing/trial-analytics-context"

import type { SupabaseClient } from "@supabase/supabase-js"

import { reserveTrialAdmission } from "../billing/trial-admission"
import type { TrialCheckoutScope } from "../billing/trial-checkout-attempt"
import type { TrialIdentityClaim } from "../billing/trial-eligibility"
import { createTrialOfferSnapshot, type TrialOfferSnapshot } from "../billing/trial-offer"
import { isTrialEnrollmentAllowed, type TrialRuntime } from "../billing/trial-runtime"
import type { PayPalCheckoutSource } from "./checkout-intents"
import {
  bindPayPalTrialCheckoutReference,
  payPalTrialCheckoutSchedule,
  createPayPalTrialCheckoutAttempt,
  freezePayPalTrialCheckoutAttempt,
  findPayPalTrialCheckoutAttemptByScope,
  loadPayPalTrialPlanCatalog,
  freezePayPalTrialPlanCatalog,
} from "./trial-checkout-attempt"

export type PayPalTrialRuntime = Readonly<{
  trial: TrialRuntime
  appId: string
  productId: string
  monthPlanId: string
  yearPlanId: string
}>

type Input = {
  scope: TrialCheckoutScope
  clientAttemptId: string
  interval: "month" | "year"
  serverVerifiedEmail: string
  claims: readonly TrialIdentityClaim[]
  email: string | null
  leadId: string | null
  analyticsContext?: TrialAnalyticsContextInput
  source: PayPalCheckoutSource
}

type Subscription = { id?: string; plan_id?: string; custom_id?: string; start_time?: string }
type Deps = {
  supabase: SupabaseClient
  runtime: PayPalTrialRuntime | null
  /** Returns the OAuth-attested app id used for the following provider request. */
  attestApp: () => Promise<string>
  getPlan: (id: string) => Promise<unknown>
  createSubscription: (input: {
    planId: string
    customId: string
    requestId: string
    startTime: string
    offer: TrialOfferSnapshot
  }) => Promise<Subscription>
  retrieveSubscription: (id: string) => Promise<Subscription>
}

/** Creates a frozen PayPal subscription request; it does not activate trial access. */
export async function createDurablePayPalTrialCheckout(input: Input, deps: Deps) {
  const runtime = deps.runtime
  if (!runtime || !isTrialEnrollmentAllowed(runtime.trial, input.serverVerifiedEmail)) {
    throw new Error("Trial checkout is unavailable")
  }
  if (!isCheckoutInput(input)) throw new Error("PayPal trial checkout is unavailable")
  if (input.scope.kind === "user" && input.claims.length === 0) {
    throw new Error("Trial account identity is required")
  }

  const currentOffer = createTrialOfferSnapshot(input.interval, runtime.trial.catalog)
  let attempt =
    (await findPayPalTrialCheckoutAttemptByScope(
      deps.supabase,
      input.scope,
      input.clientAttemptId,
    )) ??
    (await createPayPalTrialCheckoutAttempt(deps.supabase, {
      scope: input.scope,
      clientAttemptId: input.clientAttemptId,
      offer: currentOffer,
      email: input.email,
      leadId: input.leadId,
      source: input.source,
    }))

  if (
    attempt.scope.kind !== input.scope.kind ||
    attempt.scope.id !== input.scope.id ||
    attempt.clientAttemptId !== input.clientAttemptId ||
    attempt.offer.interval !== input.interval
  ) {
    throw new Error("PayPal trial checkout attempt does not match")
  }

  await freezeTrialAnalyticsContext(deps.supabase, attempt.enrollmentId, input.analyticsContext)

  if (input.claims.length && !attempt.providerReference) {
    const admission = await reserveTrialAdmission(deps.supabase, attempt.enrollmentId, input.claims)
    if (admission !== "reserved" && admission !== "active") {
      throw new Error("Trial checkout eligibility denied")
    }
  }

  const frozenOffers = await loadFrozenTrialManagementCatalog(deps.supabase, attempt.enrollmentId)
  const managementCatalog = frozenOffers ?? {
    month: createTrialOfferSnapshot("month", runtime.trial.catalog),
    year: createTrialOfferSnapshot("year", runtime.trial.catalog),
  }
  if (JSON.stringify(managementCatalog[input.interval]) !== JSON.stringify(attempt.offer))
    throw new Error("PayPal frozen trial offers conflict")
  if (!frozenOffers)
    await freezeTrialManagementCatalog(deps.supabase, {
      enrollmentId: attempt.enrollmentId,
      catalog: managementCatalog,
    })
  let planCatalog = await loadPayPalTrialPlanCatalog(deps.supabase, attempt.enrollmentId)
  if (!planCatalog) {
    await assertAttestedApp(deps, runtime.appId)
    for (const interval of ["month", "year"] as const) {
      const plan = await deps.getPlan(
        interval === "month" ? runtime.monthPlanId : runtime.yearPlanId,
      )
      assertPlanMatchesAcceptedOffer(plan, {
        offer: managementCatalog[interval],
        productId: runtime.productId,
      })
    }
    planCatalog = await freezePayPalTrialPlanCatalog(deps.supabase, {
      enrollmentId: attempt.enrollmentId,
      appId: runtime.appId,
      productId: runtime.productId,
      monthPlanId: runtime.monthPlanId,
      yearPlanId: runtime.yearPlanId,
    })
  }
  const frozenPlanId = input.interval === "month" ? planCatalog.monthPlanId : planCatalog.yearPlanId

  if (!attempt.requestId) {
    await assertAttestedApp(deps, runtime.appId)
    const plan = await deps.getPlan(frozenPlanId)
    assertPlanMatchesAcceptedOffer(plan, {
      offer: attempt.offer,
      productId: planCatalog.productId,
    })
    attempt = await freezePayPalTrialCheckoutAttempt(deps.supabase, {
      attemptId: attempt.id,
      appId: planCatalog.appId,
      productId: planCatalog.productId,
      planId: frozenPlanId,
      requestId: `paypal-trial:${attempt.id}:v2`,
    })
  }

  if (
    attempt.status === "reconciliation_required" ||
    attempt.paypalAppId !== runtime.appId ||
    attempt.paypalProductId !== runtime.productId ||
    !attempt.paypalPlanId ||
    !attempt.requestId ||
    !isFutureTimestamp(attempt.requestExpiresAt)
  ) {
    throw new Error("PayPal trial checkout provider mismatch")
  }

  await assertAttestedApp(deps, attempt.paypalAppId)
  const boundReference = attempt.providerReference
  const subscription = boundReference
    ? await deps.retrieveSubscription(boundReference)
    : await deps.createSubscription({
        planId: attempt.paypalPlanId,
        customId: attempt.intentToken,
        requestId: attempt.requestId,
        startTime: payPalTrialCheckoutSchedule(attempt).providerStartTime,
        offer: attempt.offer,
      })
  if (
    typeof subscription.id !== "string" ||
    subscription.id.trim() === "" ||
    (boundReference !== null && subscription.id !== boundReference) ||
    subscription.plan_id !== attempt.paypalPlanId ||
    subscription.custom_id !== attempt.intentToken ||
    Date.parse(subscription.start_time ?? "") !==
      Date.parse(payPalTrialCheckoutSchedule(attempt).providerStartTime)
  ) {
    throw new Error("PayPal trial subscription mismatch")
  }

  if (!boundReference) {
    attempt = await bindPayPalTrialCheckoutReference(deps.supabase, {
      attemptId: attempt.id,
      providerReference: subscription.id,
    })
    if (attempt.providerReference !== subscription.id) {
      throw new Error("PayPal trial checkout binding reconciliation required")
    }
  }

  return {
    subscription,
    offer: attempt.offer,
    enrollmentId: attempt.enrollmentId,
    token: attempt.intentToken,
  }
}

function isFutureTimestamp(value: string | null): boolean {
  const time = value === null ? Number.NaN : Date.parse(value)
  return Number.isFinite(time) && time > Date.now()
}

async function assertAttestedApp(deps: Deps, expectedAppId: string): Promise<void> {
  const actualAppId = await deps.attestApp()
  if (actualAppId !== expectedAppId) throw new Error("PayPal trial checkout provider mismatch")
}

function isCheckoutInput(input: Input): boolean {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return (
    uuid.test(input.scope.id) &&
    uuid.test(input.clientAttemptId) &&
    (input.scope.kind === "user" || input.scope.kind === "lead") &&
    ["pricing_page", "quiz_result_offer", "premium_sheet"].includes(input.source) &&
    ((input.scope.kind === "user" && input.leadId === null) ||
      (input.scope.kind === "lead" && input.leadId === input.scope.id))
  )
}

export function assertPlanMatchesAcceptedOffer(
  plan: unknown,
  input: { offer: TrialOfferSnapshot; productId: string },
): void {
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
    throw new Error("PayPal trial plan is malformed")
  }
  const value = plan as Record<string, unknown>
  if (value.product_id !== input.productId || value.status !== "ACTIVE") {
    throw new Error("PayPal trial plan does not match accepted terms")
  }
  // The accepted prices are final totals. A plan must never add tax on top.
  if (value.taxes !== undefined) {
    const taxes = value.taxes
    if (!taxes || typeof taxes !== "object" || Array.isArray(taxes)) {
      throw new Error("PayPal trial plan does not match accepted terms")
    }
    const tax = taxes as Record<string, unknown>
    const percentage = minorUnits(tax.percentage)
    if (tax.inclusive !== true || percentage === null || percentage > 10_000) {
      throw new Error("PayPal trial plan does not match accepted terms")
    }
  }
  const cycles = value.billing_cycles
  const expected =
    input.offer.interval === "month"
      ? [["REGULAR", 1, "MONTH", 1, input.offer.renewalAmountMinor, 0]]
      : [
          ["TRIAL", 1, "YEAR", 1, input.offer.firstAmountMinor, 1],
          ["REGULAR", 2, "YEAR", 1, input.offer.renewalAmountMinor, 0],
        ]
  if (!Array.isArray(cycles) || cycles.length !== expected.length) {
    throw new Error("PayPal trial plan does not match accepted terms")
  }
  for (const [index, [tenure, sequence, unit, count, amount, total]] of expected.entries()) {
    const cycle = cycles[index]
    if (!cycle || typeof cycle !== "object" || Array.isArray(cycle)) {
      throw new Error("PayPal trial plan does not match accepted terms")
    }
    const item = cycle as Record<string, unknown>
    const frequency = item.frequency as Record<string, unknown> | null
    const scheme = item.pricing_scheme as Record<string, unknown> | null
    const price = scheme?.fixed_price as Record<string, unknown> | null
    if (
      item.tenure_type !== tenure ||
      item.sequence !== sequence ||
      item.total_cycles !== total ||
      frequency?.interval_unit !== unit ||
      frequency?.interval_count !== count ||
      price?.currency_code !== "EUR" ||
      minorUnits(price?.value) !== amount
    ) {
      throw new Error("PayPal trial plan does not match accepted terms")
    }
  }
  const setupFee = (value.payment_preferences as Record<string, unknown> | null)
    ?.setup_fee as Record<string, unknown> | null
  if (setupFee && (setupFee.currency_code !== "EUR" || minorUnits(setupFee.value) !== 0)) {
    throw new Error("PayPal trial plan does not match accepted terms")
  }
}

function minorUnits(value: unknown): number | null {
  if (typeof value !== "string") return null
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(value)
  if (!match) return null
  const minor = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"))
  return Number.isSafeInteger(minor) ? minor : null
}
