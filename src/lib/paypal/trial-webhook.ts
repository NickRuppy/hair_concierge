import { reconcilePayPalTrialPaidRecovery } from "./trial-paid-recovery"
import { readTrialEffectiveContract } from "../billing/trial-effective-contract"
import { reconcilePayPalTrialManagement } from "./trial-management"
import type { PayPalCheckoutIntentRow } from "./checkout-intents"
import { dispatchBillingAnalyticsDue } from "../billing/analytics-outbox"
import "server-only"
import {
  findPayPalCheckoutIntentByProviderSubscriptionId,
  findPayPalCheckoutIntentByToken,
} from "./checkout-intents"
import {
  ensurePayPalTrialCheckoutAccount,
  hasPayPalTrialMarker,
  pinVerifiedPayPalTrialActivation,
  type PayPalTrialActivationDeps,
} from "./trial-account-admission"
import {
  findBillingSubscriptionByProviderId,
  upsertBillingSubscription,
} from "../billing/subscriptions"
import { hasTrialBillingContract } from "../billing/trial-access-projection"
import { recordTrialPaymentEvent } from "../billing/trial-payment-events"
import { listPayPalTrialTransactions, retrievePayPalTrialSubscription } from "./trial-runtime"
import { mirrorBillingSubscriptionToProfile } from "../billing/entitlements"
import type { PayPalWebhookEvent } from "./webhook-handlers"
import type { PayPalSubscription } from "./subscription-shapes"

/** Called only after the route verifies PayPal's webhook signature and claims the event. */
export async function handlePayPalTrialWebhook(
  event: PayPalWebhookEvent,
  subscription: PayPalSubscription,
  deps: PayPalTrialActivationDeps,
): Promise<boolean> {
  if (!subscription.id) throw new Error("PayPal subscription missing id")
  if (subscription.custom_id?.startsWith("trial-paid-recovery:")) {
    const callback = await deps.supabase.rpc("find_paypal_trial_paid_recovery_callback", {
      p_agreement_id: subscription.id,
    })
    if (callback.error || !callback.data)
      throw new Error("PayPal paid recovery callback binding missing")
    if (callback.data.status === "pending") {
      const result = await reconcilePayPalTrialPaidRecovery(callback.data, {
        supabase: deps.supabase,
        premiumTierId: deps.premiumTierId,
        attestApp: deps.attestPayPalApp,
        retrieve: deps.retrievePayPalSubscription,
        transactions: deps.listPayPalTrialTransactions,
        patchStart: deps.patchPayPalTrialStart,
        cancel: deps.cancelPayPalSubscription,
      })
      if (result.status !== "committed")
        throw new Error("PayPal paid recovery callback requires reconciliation")
    }
    // The setup collection was atomically written at commit; normal renewals continue into the payment ledger below.
    if (event.event_type === "BILLING.SUBSCRIPTION.ACTIVATED") return true
  }
  let intent =
    (await findPayPalCheckoutIntentByProviderSubscriptionId(deps.supabase, subscription.id)) ??
    (subscription.custom_id
      ? await findPayPalCheckoutIntentByToken(deps.supabase, subscription.custom_id)
      : null)
  const existing = await findBillingSubscriptionByProviderId(
    deps.supabase,
    "paypal",
    subscription.id,
  )
  const managementCandidate =
    subscription.custom_id?.startsWith("trial-management:") ||
    subscription.custom_id?.startsWith("trial-paid-recovery:") ||
    (existing && hasTrialBillingContract(existing)) ||
    (intent && hasPayPalTrialMarker(intent))
  if (
    managementCandidate &&
    [
      "BILLING.SUBSCRIPTION.ACTIVATED",
      "BILLING.SUBSCRIPTION.UPDATED",
      "PAYMENT.SALE.COMPLETED",
    ].includes(event.event_type ?? "")
  ) {
    const callback = await deps.supabase.rpc("find_paypal_trial_management_callback", {
      p_agreement_id: subscription.id,
    })
    if (callback.error) throw new Error("PayPal management callback lookup failed")
    if (callback.data) {
      const result = await reconcilePayPalTrialManagement(callback.data, {
        supabase: deps.supabase,
        premiumTierId: deps.premiumTierId,
        attestApp: deps.attestPayPalApp,
        retrieve: deps.retrievePayPalSubscription,
        transactions: deps.listPayPalTrialTransactions,
        cancel: deps.cancelPayPalSubscription,
      })
      if (
        result.status === "reconciliation_required" ||
        (event.event_type !== "PAYMENT.SALE.COMPLETED" && result.status !== "committed")
      )
        throw new Error("PayPal management callback requires reconciliation")
    }
  }
  if (!intent && managementCandidate) {
    const linked = await deps.supabase.rpc("find_paypal_trial_checkout_intent_for_agreement", {
      p_agreement_id: subscription.id,
    })
    if (linked.error) throw new Error("PayPal managed intent lookup failed")
    intent = linked.data as PayPalCheckoutIntentRow | null
  }
  if (!intent || !hasPayPalTrialMarker(intent)) {
    if (existing && hasTrialBillingContract(existing))
      throw new Error("PayPal trial callback lost its accepted contract")
    return false
  }
  const effective = await readTrialEffectiveContract(
    deps.supabase,
    String(intent.metadata.trial_enrollment_id),
  )
  if (effective.agreementId && effective.agreementId !== subscription.id) {
    if (event.event_type?.startsWith("PAYMENT."))
      throw new Error("PayPal superseded agreement payment requires reconciliation")
    return true
  }
  if (effective.revision > 0 && event.event_type === "BILLING.SUBSCRIPTION.ACTIVATED") return true
  if (event.event_type === "BILLING.SUBSCRIPTION.ACTIVATED") {
    await pinVerifiedPayPalTrialActivation(
      { intent, subscription, eventId: event.id!, resource: event.resource as PayPalSubscription },
      deps,
    )
    const activation = await ensurePayPalTrialCheckoutAccount(intent, deps)
    if (activation.status === "pending")
      throw new Error("PayPal trial activation is pending reconciliation")
    if (activation.status === "active" && deps.recordBillingAnalytics) {
      const dispatch = async () => {
        await dispatchBillingAnalyticsDue(deps.supabase, {
          eventKey: `paypal:trial_started:${activation.trialEnrollmentId}`,
        })
      }
      if (deps.defer) deps.defer(dispatch)
      else await dispatch()
    }
    return true
  }
  if (event.event_type === "PAYMENT.SALE.COMPLETED") {
    const activation = await ensurePayPalTrialCheckoutAccount(intent, deps)
    if (activation.status !== "active")
      throw new Error("PayPal trial payment arrived before admission")
    await recordVerifiedPayPalTrialSale(event, subscription, deps)
    return true
  }
  if (event.event_type === "BILLING.SUBSCRIPTION.PAYMENT.FAILED") {
    await recordVerifiedPayPalTrialFailure(event, subscription, deps)
    return true
  }
  if (
    [
      "BILLING.SUBSCRIPTION.CANCELLED",
      "BILLING.SUBSCRIPTION.EXPIRED",
      "BILLING.SUBSCRIPTION.SUSPENDED",
    ].includes(event.event_type ?? "")
  ) {
    // A delayed lifecycle webhook cannot turn ACTIVE into a cancellation or revive access.
    const expected = event.event_type!.split(".").at(-1)
    if (subscription.status !== expected) return true
    if (!existing) return true // An unadmitted agreement never granted access.
    if (!hasTrialBillingContract(existing)) throw new Error("PayPal trial billing link missing")
    if (subscription.status === "CANCELLED" || subscription.status === "EXPIRED") {
      const { data: applied, error } = await deps.supabase.rpc("record_paypal_trial_cancellation", {
        p_enrollment_id: existing.trial_enrollment_id!,
        p_agreement_id: subscription.id,
      })
      if (error) throw error
      if (applied !== true) return true
    }
    const updated = await upsertBillingSubscription(deps.supabase, {
      ...existing,
      provider_status: subscription.status!,
      entitlement_status: subscription.status === "SUSPENDED" ? "past_due" : "canceled",
      cancel_at_period_end:
        subscription.status === "SUSPENDED" ? existing.cancel_at_period_end : true,
    })
    await mirrorBillingSubscriptionToProfile(deps.supabase, updated, deps.premiumTierId)
    return true
  }
  return true
}

export function paypalTransactionMinor(value: unknown): number | null {
  if (typeof value !== "string" || !/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(value)) return null
  const [whole, fractional = ""] = value.split(".")
  const result = Number(whole) * 100 + Number(fractional.padEnd(2, "0"))
  return Number.isSafeInteger(result) ? result : null
}

export async function recordVerifiedPayPalTrialSale(
  event: PayPalWebhookEvent,
  subscription: PayPalSubscription,
  deps: PayPalTrialActivationDeps,
) {
  const billing = await findBillingSubscriptionByProviderId(
    deps.supabase,
    "paypal",
    subscription.id!,
  )
  if (!billing?.trial_enrollment_id || !hasTrialBillingContract(billing))
    throw new Error("PayPal trial payment enrollment missing")
  const { data: enrollment, error } = await deps.supabase
    .from("trial_enrollments")
    .select("*")
    .eq("id", billing.trial_enrollment_id)
    .maybeSingle()
  const effective = enrollment
    ? await readTrialEffectiveContract(deps.supabase, enrollment.id)
    : null
  if (error || !enrollment || effective?.agreementId !== subscription.id)
    throw new Error("PayPal trial payment ownership mismatch")
  const saleId = event.resource?.id
  const resourceAt = event.resource?.create_time
  if (!saleId || !resourceAt || !Number.isFinite(Date.parse(resourceAt)))
    throw new Error("PayPal completed sale identity missing")
  const transactions = await (deps.listPayPalTrialTransactions ?? listPayPalTrialTransactions)(
    subscription.id!,
    new Date(Date.parse(resourceAt) - 24 * 60 * 60 * 1000).toISOString(),
    new Date().toISOString(),
  )
  const transaction = transactions.find((item) => item.id === saleId)
  const amount = transaction?.amount_with_breakdown?.gross_amount
  const amountMinor = paypalTransactionMinor(amount?.value)
  const occurredAt = transaction?.time
  if (
    !transaction ||
    transaction.status !== "COMPLETED" ||
    !occurredAt ||
    !Number.isFinite(Date.parse(occurredAt)) ||
    amount?.currency_code !== "EUR" ||
    amountMinor === null ||
    amountMinor <= 0
  )
    throw new Error("PayPal nonzero successful transaction is not verified")
  const recovery = subscription.custom_id?.startsWith("trial-paid-recovery:")
    ? await deps.supabase.rpc("find_paypal_trial_paid_recovery_callback", {
        p_agreement_id: subscription.id,
      })
    : null
  if (recovery?.error) throw new Error("PayPal paid recovery payment lookup failed")
  const setupPayment =
    recovery?.data?.status === "committed" && recovery.data.payment?.sourceObjectId === saleId
      ? recovery.data.payment
      : null
  if (
    setupPayment &&
    (Date.parse(setupPayment.occurredAt) !== Date.parse(occurredAt) ||
      setupPayment.amountMinor !== amountMinor)
  )
    throw new Error("PayPal paid recovery payment identity mismatch")
  const live = await (deps.retrievePayPalSubscription ?? retrievePayPalTrialSubscription)(
    subscription.id!,
  )
  if (
    live.id !== subscription.id ||
    live.subscriber?.payer_id !== billing.provider_customer_id ||
    (!setupPayment &&
      Date.parse(live.billing_info?.last_payment?.time ?? "") !== Date.parse(occurredAt))
  )
    throw new Error("PayPal sale period requires historical reconciliation")
  const isReplay = billing.metadata?.paypal_last_sale_id === saleId
  const periodStartAt =
    setupPayment?.periodStartAt ??
    (isReplay && typeof billing.metadata.paypal_sale_period_start === "string"
      ? billing.metadata.paypal_sale_period_start
      : enrollment.first_payment_succeeded_at
        ? billing.current_period_end
        : // The first paid period begins with the actual payment success (the
          // provider's batch), matching the ledger's paid-through contract.
          occurredAt)
  const periodEndAt = setupPayment?.periodEndAt ?? live.billing_info?.next_billing_time
  if (
    !periodStartAt ||
    !periodEndAt ||
    !Number.isFinite(Date.parse(periodStartAt)) ||
    Date.parse(periodEndAt) <= Date.parse(periodStartAt)
  )
    throw new Error("PayPal paid billing period unavailable")
  const result = await recordTrialPaymentEvent(deps.supabase, {
    provider: "paypal",
    enrollmentId: enrollment.id,
    agreementId: subscription.id!,
    sourceEventId: event.id!,
    sourceObjectId: saleId,
    outcome: "succeeded",
    occurredAt,
    amountMinor,
    currency: "EUR",
    periodStartAt,
    periodEndAt,
  })
  if (result.outcome === "reconciliation_required")
    throw new Error("PayPal trial payment reconciliation required")
  if (result.outcome === "applied") {
    const updated = await upsertBillingSubscription(deps.supabase, {
      ...billing,
      provider_status: live.status ?? billing.provider_status,
      current_period_end: periodEndAt,
      entitlement_status: "active",
      metadata: {
        ...billing.metadata,
        paypal_last_sale_id: saleId,
        paypal_sale_period_start: periodStartAt,
        paypal_sale_period_end: periodEndAt,
      },
    })
    await mirrorBillingSubscriptionToProfile(deps.supabase, updated, deps.premiumTierId)
  }
  if (
    deps.recordBillingAnalytics &&
    ["applied", "duplicate"].includes(result.outcome) &&
    result.phase !== "none"
  ) {
    const name = result.phase === "first_paid" ? "purchase_completed" : "payment_completed"
    const anchor = result.phase === "first_paid" ? subscription.id! : saleId
    const dispatch = async () => {
      await dispatchBillingAnalyticsDue(deps.supabase, { eventKey: `paypal:${name}:${anchor}` })
    }
    if (deps.defer) deps.defer(dispatch)
    else await dispatch()
  }
  return result
}

async function recordVerifiedPayPalTrialFailure(
  event: PayPalWebhookEvent,
  subscription: PayPalSubscription,
  deps: PayPalTrialActivationDeps,
) {
  const billing = await findBillingSubscriptionByProviderId(
    deps.supabase,
    "paypal",
    subscription.id!,
  )
  if (!billing?.trial_enrollment_id)
    throw new Error("PayPal failed trial payment enrollment missing")
  const { data: enrollment, error } = await deps.supabase
    .from("trial_enrollments")
    .select("*")
    .eq("id", billing.trial_enrollment_id)
    .maybeSingle()
  const effective = enrollment
    ? await readTrialEffectiveContract(deps.supabase, enrollment.id)
    : null
  const offer = effective?.offer
  if (error || !enrollment || !offer || effective?.agreementId !== subscription.id)
    throw new Error("PayPal failed payment ownership mismatch")
  const live = await (deps.retrievePayPalSubscription ?? retrievePayPalTrialSubscription)(
    subscription.id!,
  )
  const failed = live.billing_info?.last_failed_payment
  if (
    live.id !== subscription.id ||
    live.subscriber?.payer_id !== billing.provider_customer_id ||
    !failed?.time ||
    !Number.isFinite(Date.parse(failed.time))
  )
    throw new Error("PayPal failed transaction is not verified")
  const amountMinor = paypalTransactionMinor(failed.amount?.value)
  const start = enrollment.paid_through_at ?? enrollment.original_trial_end_at
  const end = live.billing_info?.next_billing_time
  if (
    failed.amount?.currency_code !== "EUR" ||
    amountMinor === null ||
    amountMinor <= 0 ||
    !start ||
    !end ||
    Date.parse(end) <= Date.parse(start)
  )
    throw new Error("PayPal failed payment period requires reconciliation")
  const result = await recordTrialPaymentEvent(deps.supabase, {
    provider: "paypal",
    enrollmentId: enrollment.id,
    agreementId: subscription.id!,
    sourceEventId: event.id!,
    sourceObjectId: `${subscription.id}:failed:${failed.time}`,
    outcome: "failed",
    occurredAt: failed.time,
    amountMinor,
    currency: "EUR",
    periodStartAt: start,
    periodEndAt: end,
  })
  if (result.outcome === "reconciliation_required")
    throw new Error("PayPal failed payment reconciliation required")
}
