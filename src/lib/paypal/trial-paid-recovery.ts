import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  loadTrialPaidRecoveryOperation,
  guardTrialPaidRecoveryOperation,
  commitTrialPaidRecoveryOperation,
  abandonTrialPaidRecoveryOperation,
  type TrialPaidRecoveryOperation,
} from "../billing/trial-paid-recovery-operations"
import type { TrialOfferSnapshot } from "../billing/trial-offer"
import type { TrialPaymentEvent } from "../billing/trial-payment-events"
import {
  findBillingSubscriptionByProviderId,
  upsertBillingSubscription,
} from "../billing/subscriptions"
import { mirrorBillingSubscriptionToProfile } from "../billing/entitlements"
import { getPremiumTierId } from "../billing/tier-ids"
import { getPayPalAppId, paypalRequest } from "./client"
import { cancelPayPalSubscription, retrievePayPalPlan } from "./subscriptions"
import { loadPayPalTrialPlanCatalog } from "./trial-checkout-attempt"
import {
  retrievePayPalTrialSubscription,
  listPayPalTrialTransactions,
  patchPayPalTrialStart,
} from "./trial-runtime"
import type { PayPalSubscription } from "./subscription-shapes"

export type PayPalTrialPaidRecoveryDeps = {
  supabase: SupabaseClient
  premiumTierId?: string
  renewalAnnualPlanId?: string
  attestApp?: typeof getPayPalAppId
  retrieve?: typeof retrievePayPalTrialSubscription
  transactions?: typeof listPayPalTrialTransactions
  patchStart?: typeof patchPayPalTrialStart
  getPlan?: typeof retrievePayPalPlan
  cancel?: typeof cancelPayPalSubscription
  request?: typeof paypalRequest
}
export type PayPalTrialPaidRecoveryResult =
  | {
      status: "approval_required"
      operationId: string
      approvalUrl: string
      subscriptionId: string
    }
  | {
      status: "pending" | "committed" | "abandoned" | "reconciliation_required"
      operationId: string
    }
type Input = { operationId: string; authenticatedUserId: string }
type Frozen = {
  operation_id: string
  enrollment_id: string
  app_id: string
  product_id: string
  source_plan_id: string
  target_plan_id: string
  request_id: string
  request_expires_at: string
  start_time: string
  created_at: string
  return_url: string
  cancel_url: string
  request_sent_at: string | null
  target_agreement_id: string | null
  approval_url: string | null
}
const result = (
  o: TrialPaidRecoveryOperation,
  status: "pending" | "committed" | "abandoned" | "reconciliation_required",
): PayPalTrialPaidRecoveryResult => ({ status, operationId: o.id })
async function rpc(d: PayPalTrialPaidRecoveryDeps, name: string, args: Record<string, unknown>) {
  const { data, error } = await d.supabase.rpc(name, args)
  if (error) throw new Error("PayPal paid recovery persistence failed")
  return data
}
function parse(v: unknown): Frozen {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw new Error("PayPal paid recovery request missing")
  const r = v as Record<string, unknown>
  for (const k of [
    "operation_id",
    "enrollment_id",
    "app_id",
    "product_id",
    "source_plan_id",
    "target_plan_id",
    "request_id",
    "request_expires_at",
    "start_time",
    "created_at",
    "return_url",
    "cancel_url",
  ])
    if (typeof r[k] !== "string" || !r[k]) throw new Error("Invalid PayPal paid recovery request")
  return r as Frozen
}
async function frozen(d: PayPalTrialPaidRecoveryDeps, i: Input) {
  const r = await rpc(d, "get_paypal_trial_paid_recovery_request", {
    p_operation_id: i.operationId,
    p_user_id: i.authenticatedUserId,
  })
  return r ? parse(r) : null
}
function check(o: TrialPaidRecoveryOperation, i: Input) {
  if (o.provider !== "paypal" || o.userId !== i.authenticatedUserId)
    throw new Error("PayPal paid recovery owner mismatch")
}
async function attest(r: Frozen, d: PayPalTrialPaidRecoveryDeps) {
  if ((await (d.attestApp ?? getPayPalAppId)()) !== r.app_id)
    throw new Error("PayPal paid recovery app mismatch")
}
function equalTime(a: string | undefined | null, b: string) {
  return typeof a === "string" && Number.isFinite(Date.parse(a)) && Date.parse(a) === Date.parse(b)
}
function amount(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d+(\.\d{1,2})?$/.test(value)) return null
  return Math.round(Number(value) * 100)
}
/** Matches Postgres UTC calendar intervals, including month-end/leap-day clamping. */
export function paypalPaidPeriodEnd(at: string, interval: "month" | "year"): string {
  const d = new Date(at)
  if (!Number.isFinite(d.getTime())) throw new Error("Invalid PayPal payment time")
  const day = d.getUTCDate()
  d.setUTCDate(1)
  if (interval === "month") d.setUTCMonth(d.getUTCMonth() + 1)
  else d.setUTCFullYear(d.getUTCFullYear() + 1)
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(day, last))
  return d.toISOString()
}
export function paypalPaidRecoveryOverrides(
  offer: TrialOfferSnapshot,
  kind: TrialPaidRecoveryOperation["kind"],
) {
  return {
    billing_cycles: [
      {
        sequence: 1,
        pricing_scheme: {
          fixed_price: { value: (offer.renewalAmountMinor / 100).toFixed(2), currency_code: "EUR" },
        },
      },
    ],
    payment_preferences: {
      setup_fee: {
        value: kind === "recover_unpaid" ? (offer.firstAmountMinor / 100).toFixed(2) : "0.00",
        currency_code: "EUR",
      },
      setup_fee_failure_action: "CANCEL",
      auto_bill_outstanding: false,
    },
  }
}
/** Annual continuation is REGULAR-only: the first paid year's price has already been collected. */
export function assertPayPalPaidRecoveryPlan(
  plan: unknown,
  offer: TrialOfferSnapshot,
  productId: string,
  setupFeeMinor: number,
) {
  if (!plan || typeof plan !== "object" || Array.isArray(plan))
    throw new Error("PayPal paid recovery plan missing")
  const object = (value: unknown): Record<string, unknown> | null =>
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null
  const p = plan as Record<string, unknown>,
    cycles = p.billing_cycles
  const cycle = object(Array.isArray(cycles) ? cycles[0] : null)
  const frequency = object(cycle?.frequency)
  const price = object(object(cycle?.pricing_scheme)?.fixed_price)
  const preferences = object(p.payment_preferences),
    setupFee = object(preferences?.setup_fee)
  const taxes = object(p.taxes),
    taxPercentage = amount(taxes?.percentage)
  if (
    p.product_id !== productId ||
    p.status !== "ACTIVE" ||
    !Array.isArray(cycles) ||
    cycles.length !== 1 ||
    !cycle ||
    cycle.tenure_type !== "REGULAR" ||
    cycle.sequence !== 1 ||
    cycle.total_cycles !== 0 ||
    frequency?.interval_unit !== (offer.interval === "month" ? "MONTH" : "YEAR") ||
    frequency?.interval_count !== 1 ||
    price?.currency_code !== "EUR" ||
    amount(price?.value) !== offer.renewalAmountMinor ||
    setupFee?.currency_code !== "EUR" ||
    amount(setupFee?.value) !== setupFeeMinor ||
    (setupFeeMinor > 0 && preferences?.setup_fee_failure_action !== "CANCEL") ||
    (p.taxes !== undefined &&
      (!taxes || taxes.inclusive !== true || taxPercentage === null || taxPercentage > 10000))
  )
    throw new Error("PayPal paid recovery plan differs from accepted terms")
}
function owned(s: PayPalSubscription, o: TrialPaidRecoveryOperation, id: string) {
  if (s.id !== id || s.subscriber?.payer_id !== o.providerCustomerId)
    throw new Error("PayPal paid recovery payer mismatch")
}
function url(v: string) {
  const u = new URL(v)
  if (
    u.protocol !== "https:" &&
    !(u.protocol === "http:" && ["localhost", "127.0.0.1"].includes(u.hostname))
  )
    throw new Error("Invalid PayPal recovery return URL")
  return u.href
}
function approval(s: PayPalSubscription) {
  const value = s.links?.find((x) => x.rel === "approve")?.href
  if (!value) return null
  const u = new URL(value)
  if (u.protocol !== "https:" || !["www.paypal.com", "www.sandbox.paypal.com"].includes(u.hostname))
    throw new Error("Invalid PayPal recovery approval URL")
  return u.href
}
async function transactions(
  s: PayPalSubscription,
  o: TrialPaidRecoveryOperation,
  d: PayPalTrialPaidRecoveryDeps,
) {
  // Fallback precedes any authorization: the stored end is at most ten days after it.
  const from =
    s.create_time ?? new Date(Date.parse(o.originalTrialEndAt) - 10 * 86400000).toISOString()
  return (d.transactions ?? listPayPalTrialTransactions)(s.id!, from, new Date().toISOString())
}
async function neutralizeSource(
  o: TrialPaidRecoveryOperation,
  r: Frozen,
  d: PayPalTrialPaidRecoveryDeps,
) {
  const retrieve = d.retrieve ?? retrievePayPalTrialSubscription
  let s = await retrieve(o.sourceAgreementId)
  owned(s, o, o.sourceAgreementId)
  if (s.plan_id !== r.source_plan_id) throw new Error("PayPal source plan changed during recovery")
  const verify = async () => {
    if (
      (await rpc(d, "verify_paypal_trial_paid_recovery_source_transactions", {
        p_operation_id: o.id,
        p_user_id: o.userId,
        p_transactions: await transactions(s, o, d),
      })) !== true
    )
      throw new Error("PayPal source payment still requires reconciliation")
  }
  await verify()
  if (!["CANCELLED", "EXPIRED"].includes(s.status ?? "")) {
    if (
      (await rpc(d, "claim_paypal_trial_paid_recovery_source_neutralization", {
        p_operation_id: o.id,
        p_user_id: o.userId,
      })) !== true
    )
      throw new Error("PayPal source neutralization no longer authorized")
    try {
      await (d.cancel ?? cancelPayPalSubscription)(
        s.id!,
        "Replace billing agreement with payer-approved paid continuation",
      )
    } catch {
      /* Retrieve resolves lost cancellation response. */
    }
    s = await retrieve(o.sourceAgreementId)
    owned(s, o, o.sourceAgreementId)
  }
  if (!["CANCELLED", "EXPIRED"].includes(s.status ?? ""))
    throw new Error("PayPal old agreement remains collectible")
  await verify()
}
/** The shared operation freezes explicit paid consent before this creates an approval candidate. */
export async function beginPayPalTrialPaidRecovery(
  i: Input & { returnUrl: string; cancelUrl: string },
  d: PayPalTrialPaidRecoveryDeps,
): Promise<PayPalTrialPaidRecoveryResult> {
  const o = await loadTrialPaidRecoveryOperation(d.supabase, i)
  check(o, i)
  if (o.status !== "pending") {
    if (o.status === "committed") await project(o, d)
    return result(o, o.status)
  }
  if (!(await guardTrialPaidRecoveryOperation(d.supabase, i)))
    return result(o, "reconciliation_required")
  let r = await frozen(d, i)
  if (!r) {
    const catalog = await loadPayPalTrialPlanCatalog(d.supabase, o.enrollmentId)
    if (!catalog || (await (d.attestApp ?? getPayPalAppId)()) !== catalog.appId)
      throw new Error("PayPal recovery catalog unavailable")
    const source = await (d.retrieve ?? retrievePayPalTrialSubscription)(o.sourceAgreementId)
    owned(source, o, o.sourceAgreementId)
    const planId =
      o.offer.interval === "month"
        ? catalog.monthPlanId
        : (d.renewalAnnualPlanId ?? process.env.TRIAL_PAYPAL_RENEWAL_PLAN_ANNUAL)
    if (!planId || !source.plan_id) throw new Error("PayPal renewal-only plan unavailable")
    assertPayPalPaidRecoveryPlan(
      await (d.getPlan ?? retrievePayPalPlan)(planId),
      o.offer,
      catalog.productId,
      0,
    )
    r = parse(
      await rpc(d, "freeze_paypal_trial_paid_recovery_request", {
        p_operation_id: o.id,
        p_user_id: o.userId,
        p_source_plan_id: source.plan_id,
        p_target_plan_id: planId,
        p_return_url: url(i.returnUrl),
        p_cancel_url: url(i.cancelUrl),
      }),
    )
  }
  await attest(r, d)
  if (r.target_agreement_id) return reconcilePayPalTrialPaidRecovery(i, d)
  if (Date.parse(r.request_expires_at) <= Date.now() || Date.parse(r.start_time) <= Date.now())
    return result(o, "reconciliation_required")
  // Neutralize before presenting immediate-payment approval, so old retries cannot race a new setup charge.
  await neutralizeSource(o, r, d)
  await rpc(d, "claim_paypal_trial_paid_recovery_request", {
    p_operation_id: o.id,
    p_user_id: o.userId,
  })
  if (
    !(await guardTrialPaidRecoveryOperation(d.supabase, i)) ||
    Date.parse(r.request_expires_at) <= Date.now() ||
    Date.parse(r.start_time) <= Date.now()
  )
    return result(o, "reconciliation_required")
  const s = await (d.request ?? paypalRequest)<PayPalSubscription>("/v1/billing/subscriptions", {
    method: "POST",
    signal: AbortSignal.timeout(15000),
    headers: { "PayPal-Request-Id": r.request_id, Prefer: "return=representation" },
    body: JSON.stringify({
      plan_id: r.target_plan_id,
      custom_id: `trial-paid-recovery:${o.id}`,
      start_time: r.start_time,
      plan: paypalPaidRecoveryOverrides(o.offer, o.kind),
      application_context: {
        brand_name: "Chaarlie",
        user_action: "SUBSCRIBE_NOW",
        shipping_preference: "NO_SHIPPING",
        return_url: r.return_url,
        cancel_url: r.cancel_url,
      },
    }),
  })
  if (
    !s.id ||
    s.id === o.sourceAgreementId ||
    s.plan_id !== r.target_plan_id ||
    s.custom_id !== `trial-paid-recovery:${o.id}`
  )
    throw new Error("PayPal paid recovery candidate mismatch")
  const link = approval(s)
  await rpc(d, "bind_paypal_trial_paid_recovery_response", {
    p_operation_id: o.id,
    p_user_id: o.userId,
    p_target_agreement_id: s.id,
    p_approval_url: link,
  })
  return link
    ? { status: "approval_required", operationId: o.id, approvalUrl: link, subscriptionId: s.id }
    : reconcilePayPalTrialPaidRecovery(i, d)
}
export async function reconcilePayPalTrialPaidRecovery(
  i: Input,
  d: PayPalTrialPaidRecoveryDeps,
): Promise<PayPalTrialPaidRecoveryResult> {
  const o = await loadTrialPaidRecoveryOperation(d.supabase, i)
  check(o, i)
  if (o.status !== "pending") {
    if (o.status === "committed") await project(o, d)
    return result(o, o.status)
  }
  const r = await frozen(d, i)
  if (!r) return result(o, "pending")
  await attest(r, d)
  if (!r.target_agreement_id) return result(o, "pending")
  const retrieve = d.retrieve ?? retrievePayPalTrialSubscription
  let s = await retrieve(r.target_agreement_id)
  if (
    s.id !== r.target_agreement_id ||
    s.custom_id !== `trial-paid-recovery:${o.id}` ||
    s.plan_id !== r.target_plan_id
  )
    throw new Error("PayPal paid recovery candidate mismatch")
  if (["APPROVAL_PENDING", "APPROVED"].includes(s.status ?? "")) {
    const link = approval(s) ?? r.approval_url
    return link
      ? { status: "approval_required", operationId: o.id, subscriptionId: s.id!, approvalUrl: link }
      : result(o, "pending")
  }
  if (s.status !== "ACTIVE") return result(o, "pending")
  if (s.subscriber?.payer_id !== o.providerCustomerId) {
    await cancelUncommittedCandidate(o, r, d)
    throw new Error("PayPal paid recovery payer mismatch")
  }
  owned(s, o, r.target_agreement_id)
  assertPayPalPaidRecoveryPlan(
    s.plan ? { ...s.plan, status: "ACTIVE" } : null,
    o.offer,
    r.product_id,
    o.kind === "recover_unpaid" ? o.offer.firstAmountMinor : 0,
  )
  const tx = await transactions(s, o, d)
  let payment: TrialPaymentEvent | null = null
  let boundary = o.paidThroughAt
  if (o.kind === "recover_unpaid") {
    if (tx.length === 0) return result(o, "pending")
    const t = tx[0],
      gross = t?.amount_with_breakdown?.gross_amount
    if (
      tx.length !== 1 ||
      t.status !== "COMPLETED" ||
      !t.id ||
      !t.time ||
      !Number.isFinite(Date.parse(t.time)) ||
      Date.parse(t.time) < Math.floor(Date.parse(r.created_at) / 1000) * 1000 ||
      Date.parse(t.time) > Date.now() ||
      Date.parse(t.time) >= Date.parse(r.start_time) ||
      gross?.currency_code !== "EUR" ||
      amount(gross.value) !== o.offer.firstAmountMinor
    )
      throw new Error("PayPal setup payment requires reconciliation")
    boundary = paypalPaidPeriodEnd(t.time, o.offer.interval)
    payment = {
      provider: "paypal",
      enrollmentId: o.enrollmentId,
      agreementId: s.id!,
      sourceEventId: `paypal-recovery:${t.id}`,
      sourceObjectId: t.id,
      outcome: "succeeded",
      occurredAt: t.time,
      amountMinor: o.offer.firstAmountMinor,
      currency: "EUR",
      periodStartAt: t.time,
      periodEndAt: boundary,
    }
  } else if (tx.length) throw new Error("PayPal paid repair unexpectedly collected payment")
  if (!boundary || Date.parse(boundary) <= Date.now()) return result(o, "reconciliation_required")
  if (!equalTime(s.start_time, boundary)) {
    if (
      o.kind !== "recover_unpaid" ||
      !equalTime(s.start_time, r.start_time) ||
      Date.parse(s.start_time!) <= Date.now()
    )
      throw new Error("PayPal paid recovery future boundary mismatch")
    try {
      await (d.patchStart ?? patchPayPalTrialStart)(s.id!, boundary)
    } catch {
      /* Verify the result of an ambiguous PATCH. */
    }
    s = await retrieve(s.id!)
    owned(s, o, r.target_agreement_id)
  }
  if (!equalTime(s.start_time, boundary) || !equalTime(s.billing_info?.next_billing_time, boundary))
    throw new Error("PayPal full paid period is not provider-confirmed")
  await neutralizeSource(o, r, d)
  if (!(await guardTrialPaidRecoveryOperation(d.supabase, i))) {
    await cancelUncommittedCandidate(o, r, d)
    return result(o, "reconciliation_required")
  }
  const committed = await commitTrialPaidRecoveryOperation(d.supabase, {
    ...i,
    evidence: {
      provider: "paypal",
      providerCustomerId: o.providerCustomerId,
      sourceAgreementId: o.sourceAgreementId,
      targetAgreementId: s.id!,
      offer: o.offer,
      sourceAgreementNeutralized: true,
      noInFlightSourcePayment: true,
      noAdditionalCharge: o.kind === "repair_paid",
      firstBillingAt: payment?.occurredAt ?? boundary,
      reference: `paypal:${o.id}:${s.id}:${boundary}`,
    },
    payment,
  })
  if (!committed) {
    await cancelUncommittedCandidate(o, r, d)
    return result(o, "reconciliation_required")
  }
  await project(await loadTrialPaidRecoveryOperation(d.supabase, i), d)
  return result(o, "committed")
}
/** Browser cancellation alone is not proof. Cancel and reconcile the candidate before releasing its operation. */
export async function abandonPayPalTrialPaidRecovery(
  i: Input,
  d: PayPalTrialPaidRecoveryDeps,
): Promise<PayPalTrialPaidRecoveryResult> {
  const o = await loadTrialPaidRecoveryOperation(d.supabase, i)
  check(o, i)
  if (o.status !== "pending") return result(o, o.status)
  const r = await frozen(d, i)
  if (r) {
    await attest(r, d)
    if (r.request_sent_at && !r.target_agreement_id) return result(o, "reconciliation_required")
    if (r.target_agreement_id) {
      const retrieve = d.retrieve ?? retrievePayPalTrialSubscription
      let s = await retrieve(r.target_agreement_id)
      if (s.id !== r.target_agreement_id || s.custom_id !== `trial-paid-recovery:${o.id}`)
        throw new Error("PayPal recovery abandonment binding mismatch")
      if (!["CANCELLED", "EXPIRED"].includes(s.status ?? "")) {
        await (d.cancel ?? cancelPayPalSubscription)(s.id!, "Paid recovery approval abandoned")
        s = await retrieve(s.id!)
      }
      if (!["CANCELLED", "EXPIRED"].includes(s.status ?? ""))
        return result(o, "reconciliation_required")
      if (
        (await transactions(s, o, d)).some(
          (t) => !["FAILED", "DENIED", "DECLINED"].includes(t.status ?? ""),
        )
      )
        return result(o, "reconciliation_required")
    }
  }
  return result(
    o,
    (await abandonTrialPaidRecoveryOperation(d.supabase, {
      ...i,
      reconciliationReference: `paypal:abandoned:${o.id}`,
    }))
      ? "abandoned"
      : "reconciliation_required",
  )
}
async function project(o: TrialPaidRecoveryOperation, d: PayPalTrialPaidRecoveryDeps) {
  const r = await frozen(d, { operationId: o.id, authenticatedUserId: o.userId })
  if (!r || !o.targetAgreementId) throw new Error("PayPal recovery projection binding missing")
  await attest(r, d)
  const source = await findBillingSubscriptionByProviderId(
    d.supabase,
    "paypal",
    o.sourceAgreementId,
  )
  if (
    !source ||
    source.user_id !== o.userId ||
    source.trial_enrollment_id !== o.enrollmentId ||
    source.provider_customer_id !== o.providerCustomerId
  )
    throw new Error("PayPal recovery source billing owner mismatch")
  const target = await (d.retrieve ?? retrievePayPalTrialSubscription)(o.targetAgreementId)
  owned(target, o, o.targetAgreementId)
  const prior = await findBillingSubscriptionByProviderId(d.supabase, "paypal", o.targetAgreementId)
  if (
    prior &&
    (prior.user_id !== o.userId ||
      prior.trial_enrollment_id !== o.enrollmentId ||
      prior.provider_customer_id !== o.providerCustomerId)
  )
    throw new Error("PayPal recovery target billing owner mismatch")
  const { data: e, error } = await d.supabase
    .from("trial_enrollments")
    .select("paid_through_at,first_payment_succeeded_at,cancel_at_period_end")
    .eq("id", o.enrollmentId)
    .eq("user_id", o.userId)
    .single()
  if (error || !e?.paid_through_at || !e.first_payment_succeeded_at)
    throw new Error("PayPal recovery paid ledger missing")
  const billing = await upsertBillingSubscription(d.supabase, {
    user_id: o.userId,
    provider: "paypal",
    provider_customer_id: o.providerCustomerId,
    provider_subscription_id: o.targetAgreementId,
    provider_subscriber_email: target.subscriber?.email_address,
    provider_status: target.status ?? "ACTIVE",
    entitlement_status: e.cancel_at_period_end ? "canceled" : "active",
    interval: o.offer.interval,
    current_period_end: e.paid_through_at,
    cancel_at_period_end: e.cancel_at_period_end,
    trial_enrollment_id: o.enrollmentId,
    metadata: {
      ...source.metadata,
      ...prior?.metadata,
      trial_cohort: "trial_v1",
      paypal_plan_id: r.target_plan_id,
      plan_id: r.target_plan_id,
      trial_paid_recovery_operation_id: o.id,
      paypal_payment_period_start: e.first_payment_succeeded_at,
      trial_management_superseded_by: null,
    },
  })
  await upsertBillingSubscription(d.supabase, {
    ...source,
    provider_status: "CANCELLED",
    entitlement_status: "canceled",
    metadata: { ...source.metadata, trial_management_superseded_by: o.targetAgreementId },
  })
  await mirrorBillingSubscriptionToProfile(
    d.supabase,
    billing,
    d.premiumTierId ?? (await getPremiumTierId(d.supabase)),
  )
}

async function cancelUncommittedCandidate(
  o: TrialPaidRecoveryOperation,
  r: Frozen,
  d: PayPalTrialPaidRecoveryDeps,
) {
  if (!r.target_agreement_id) throw new Error("PayPal paid candidate missing")
  const retrieve = d.retrieve ?? retrievePayPalTrialSubscription
  let candidate = await retrieve(r.target_agreement_id)
  if (
    candidate.id !== r.target_agreement_id ||
    candidate.custom_id !== `trial-paid-recovery:${o.id}`
  )
    throw new Error("PayPal paid candidate binding mismatch")
  if (!["CANCELLED", "EXPIRED"].includes(candidate.status ?? "")) {
    try {
      await (d.cancel ?? cancelPayPalSubscription)(
        candidate.id!,
        "Paid recovery no longer authorized; do not renew",
      )
    } catch {}
    candidate = await retrieve(candidate.id!)
  }
  if (!["CANCELLED", "EXPIRED"].includes(candidate.status ?? ""))
    throw new Error("PayPal paid candidate cancellation unconfirmed")
  // Any collected setup payment remains visible in provider transactions and the durable pending operation for reconciliation.
}
