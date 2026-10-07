import "server-only"
import type Stripe from "stripe"
import { readTrialRuntime, type TrialRuntime } from "../billing/trial-runtime"
import {
  loadTrialPaidRecoveryOperation,
  guardTrialPaidRecoveryOperation,
  commitTrialPaidRecoveryOperation,
  abandonTrialPaidRecoveryOperation,
  type TrialPaidRecoveryOperation,
} from "../billing/trial-paid-recovery-operations"
import type { TrialManagementClient } from "../billing/trial-management-operations"
import { recordTrialPaymentEvent, type TrialPaymentEvent } from "../billing/trial-payment-events"
import type { TrialInvoiceResult } from "./trial-invoice"
import { attestStripeTrialCatalog } from "./trial-catalog"

type Deps = { client: TrialManagementClient; stripe: Stripe; runtime?: TrialRuntime | null }
type Input = Deps & { operationId: string; authenticatedUserId: string }
export type StripeTrialPaidRecoveryResult = {
  status: "approval_required" | "pending" | "committed" | "abandoned"
  operationId: string
  approvalUrl?: string
  invoice?: TrialInvoiceResult
}
type Request = {
  operation_id: string
  user_id: string
  session_params: Stripe.Checkout.SessionCreateParams
  session_id: string | null
  session_create_started_at: string
  subscription_id: string | null
  subscription_params: Stripe.SubscriptionCreateParams | null
  subscription_create_started_at: string | null
  status: string
}
function id(v: string | { id: string } | null | undefined) {
  return typeof v === "string" ? v : (v?.id ?? null)
}
function fact(v: unknown): asserts v {
  if (!v) throw new Error("Stripe paid recovery requires reconciliation")
}
function instant(v: number | null | undefined) {
  fact(Number.isSafeInteger(v) && v! > 0)
  return new Date(v! * 1000).toISOString()
}
async function load(input: Deps, operationId: string) {
  const r = await input.client.rpc("load_stripe_trial_paid_recovery_request", {
    p_operation_id: operationId,
  })
  fact(!r.error)
  return r.data as Request | null
}
async function checkpoint(
  input: Deps,
  operationId: string,
  action: string,
  providerId: string | null = null,
  params: unknown = null,
) {
  const r = await input.client.rpc("checkpoint_stripe_trial_paid_recovery_request", {
    p_operation_id: operationId,
    p_action: action,
    p_provider_id: providerId,
    p_params: params,
  })
  fact(!r.error && r.data === true)
}
function owned(s: Stripe.Subscription, op: TrialPaidRecoveryOperation, runtime: TrialRuntime) {
  return (
    s.livemode === runtime.livemode &&
    id(s.customer) === op.providerCustomerId &&
    s.metadata.trial_cohort === "trial_v1" &&
    s.metadata.trial_enrollment_id === op.enrollmentId
  )
}
function targetOwned(
  s: Stripe.Subscription,
  op: TrialPaidRecoveryOperation,
  runtime: TrialRuntime,
) {
  return (
    owned(s, op, runtime) &&
    s.id !== op.sourceAgreementId &&
    s.id !== op.originalAgreementId &&
    s.metadata.trial_paid_recovery_operation_id === op.id &&
    s.metadata.trial_original_agreement_id === op.originalAgreementId &&
    s.metadata.trial_paid_recovery_role === "candidate"
  )
}
function terms(s: Stripe.Subscription, op: TrialPaidRecoveryOperation) {
  const item = s.items.data[0]
  return (
    !s.items.has_more &&
    s.items.data.length === 1 &&
    item.quantity === 1 &&
    item.discounts.length === 0 &&
    item.price.id === op.offer.stripePriceId &&
    item.price.unit_amount === op.offer.renewalAmountMinor &&
    item.price.currency === "eur" &&
    item.price.tax_behavior === "inclusive" &&
    item.price.billing_scheme === "per_unit" &&
    item.price.recurring?.interval === op.offer.interval &&
    item.price.recurring.interval_count === 1 &&
    item.price.recurring.usage_type === "licensed" &&
    s.collection_method === "charge_automatically" &&
    s.automatic_tax.enabled &&
    !s.schedule &&
    !s.pending_update &&
    !s.pause_collection &&
    !s.transfer_data &&
    !s.on_behalf_of &&
    !s.application_fee_percent
  )
}
async function allInvoices(input: Deps, agreementId: string) {
  const result = await input.stripe.invoices.list({ subscription: agreementId, limit: 100 })
  fact(!result.has_more)
  return result.data
}
/** Canonical invoice payment time, never Checkout or webhook arrival time. */
export async function verifyStripeTrialRecoveryPayment(
  input: Deps,
  op: TrialPaidRecoveryOperation,
  subscription: Stripe.Subscription,
  invoiceId: string,
  runtime: TrialRuntime,
): Promise<TrialPaymentEvent> {
  const invoice = await input.stripe.invoices.retrieve(invoiceId)
  fact(
    invoice.id === invoiceId &&
      invoice.livemode === runtime.livemode &&
      id(invoice.customer) === op.providerCustomerId &&
      id(invoice.parent?.subscription_details?.subscription) === subscription.id &&
      invoice.currency === "eur" &&
      invoice.collection_method === "charge_automatically" &&
      invoice.status === "paid" &&
      invoice.amount_paid === op.offer.firstAmountMinor &&
      invoice.amount_due === invoice.amount_paid &&
      invoice.amount_remaining === 0 &&
      invoice.lines.has_more === false &&
      invoice.lines.data.length === 1 &&
      terms(subscription, op),
  )
  const line = invoice.lines.data[0],
    item = subscription.items.data[0],
    details = line.parent?.subscription_item_details
  fact(
    details?.subscription === subscription.id &&
      details.subscription_item === item.id &&
      !details.proration &&
      line.quantity === 1 &&
      id(line.pricing?.price_details?.price) === op.offer.stripePriceId &&
      line.period.end > line.period.start &&
      line.period.end <= item.current_period_end,
  )
  const payments = await input.stripe.invoicePayments.list({
    invoice: invoiceId,
    status: "paid",
    limit: 2,
  })
  fact(!payments.has_more && payments.data.length === 1)
  const payment = payments.data[0],
    intentId = id(payment.payment.payment_intent)
  fact(
    payment.status === "paid" &&
      payment.livemode === runtime.livemode &&
      id(payment.invoice) === invoiceId &&
      payment.currency === "eur" &&
      payment.amount_paid === invoice.amount_paid &&
      payment.payment.type === "payment_intent" &&
      intentId,
  )
  const intent = await input.stripe.paymentIntents.retrieve(intentId, {
      expand: ["latest_charge"],
    }),
    charge = intent.latest_charge
  fact(
    intent.status === "succeeded" &&
      intent.livemode === runtime.livemode &&
      id(intent.customer) === op.providerCustomerId &&
      intent.currency === "eur" &&
      intent.amount_received === invoice.amount_paid &&
      charge &&
      typeof charge !== "string" &&
      charge.paid &&
      charge.captured &&
      !charge.disputed &&
      charge.amount_refunded === 0 &&
      charge.amount_captured === invoice.amount_paid,
  )
  return {
    provider: "stripe",
    enrollmentId: op.enrollmentId,
    agreementId: subscription.id,
    sourceEventId: `stripe-recovery:${op.id}:${invoice.id}`,
    sourceObjectId: invoice.id,
    outcome: "succeeded",
    occurredAt: instant(payment.status_transitions.paid_at),
    amountMinor: invoice.amount_paid,
    currency: "EUR",
    periodStartAt: instant(line.period.start),
    periodEndAt: instant(line.period.end),
  }
}
/** Stop old collection first. A processing payment is never treated as a failure. */
async function neutralizeSource(
  input: Input,
  op: TrialPaidRecoveryOperation,
  runtime: TrialRuntime,
): Promise<"neutralized" | "paid"> {
  let source = await input.stripe.subscriptions.retrieve(op.sourceAgreementId)
  fact(source.id === op.sourceAgreementId && owned(source, op, runtime) && terms(source, op))
  const invoices = await allInvoices(input, source.id)
  const positive = invoices.filter((i) => i.amount_paid > 0)
  if (op.kind === "recover_unpaid" && positive.length) {
    fact(positive.length === 1)
    const payment = await verifyStripeTrialRecoveryPayment(
      input,
      op,
      source,
      positive[0].id,
      runtime,
    )
    const result = await recordTrialPaymentEvent(input.client, payment)
    fact(result.outcome !== "reconciliation_required")
    return "paid"
  }
  fact(positive.every((i) => op.kind === "repair_paid" && i.id === op.sourceObjectId))
  if (op.kind === "repair_paid") {
    fact(op.sourceObjectId && positive.length === 1)
    const paid = await verifyStripeTrialRecoveryPayment(
      input,
      op,
      source,
      op.sourceObjectId,
      runtime,
    )
    fact(Date.parse(paid.occurredAt) === Date.parse(op.firstPaymentSucceededAt!))
  }
  for (const invoice of invoices) {
    if (invoice.amount_paid > 0 || (invoice.status === "paid" && invoice.amount_due === 0)) continue
    const payments = await input.stripe.invoicePayments.list({ invoice: invoice.id, limit: 100 })
    fact(!payments.has_more)
    for (const payment of payments.data) {
      const intentId = id(payment.payment.payment_intent)
      fact(payment.payment.type === "payment_intent" && intentId)
      const intent = await input.stripe.paymentIntents.retrieve(intentId)
      fact(
        id(intent.customer) === op.providerCustomerId &&
          intent.livemode === runtime.livemode &&
          intent.amount_received === 0 &&
          [
            "requires_payment_method",
            "requires_action",
            "requires_confirmation",
            "canceled",
          ].includes(intent.status),
      )
    }
    if (["open", "uncollectible"].includes(invoice.status ?? "")) {
      fact(await guardTrialPaidRecoveryOperation(input.client, input))
      await input.stripe.invoices.voidInvoice(
        invoice.id,
        {},
        { idempotencyKey: `trial-recovery:${op.id}:void:${invoice.id}` },
      )
    }
    // Drafts and unknown states retain debt. Never delete a possibly payable invoice blindly.
    const after = await input.stripe.invoices.retrieve(invoice.id)
    fact(after.status === "void" && after.amount_paid === 0 && after.amount_remaining === 0)
    for (const payment of payments.data) {
      const intent = await input.stripe.paymentIntents.retrieve(id(payment.payment.payment_intent)!)
      fact(intent.status === "canceled" && intent.amount_received === 0)
    }
  }
  if (source.status !== "canceled") {
    fact(await guardTrialPaidRecoveryOperation(input.client, input))
    await input.stripe.subscriptions.update(
      source.id,
      { metadata: { trial_paid_recovery_operation_id: op.id } },
      { idempotencyKey: `trial-recovery:${op.id}:mark-source` },
    )
    source = await input.stripe.subscriptions.retrieve(source.id)
    fact(
      source.metadata.trial_paid_recovery_operation_id === op.id &&
        (await guardTrialPaidRecoveryOperation(input.client, input)),
    )
    await input.stripe.subscriptions.cancel(source.id, {
      invoice_now: false,
      prorate: false,
      cancellation_details: { comment: `trial-paid-recovery:${op.id}` },
    })
  }
  source = await input.stripe.subscriptions.retrieve(source.id)
  fact(source.status === "canceled" && owned(source, op, runtime))
  const after = await allInvoices(input, source.id)
  fact(
    after.every(
      (i) =>
        (op.kind === "repair_paid" && i.id === op.sourceObjectId && i.status === "paid") ||
        (i.amount_paid === 0 &&
          i.amount_remaining === 0 &&
          ["paid", "void"].includes(i.status ?? "")),
    ),
  )
  return "neutralized"
}
async function findSession(input: Deps, op: TrialPaidRecoveryOperation, request: Request) {
  if (request.session_id) return input.stripe.checkout.sessions.retrieve(request.session_id)
  const matches: Stripe.Checkout.Session[] = []
  let cursor: string | undefined
  for (let page = 0; ; page++) {
    fact(page < 20)
    const list = await input.stripe.checkout.sessions.list({
      customer: op.providerCustomerId,
      limit: 100,
      ...(cursor ? { starting_after: cursor } : {}),
    })
    matches.push(
      ...list.data.filter(
        (s) =>
          s.client_reference_id === op.id && s.metadata?.trial_paid_recovery_operation_id === op.id,
      ),
    )
    if (!list.has_more) break
    const next = list.data.at(-1)?.id
    fact(next && next !== cursor)
    cursor = next
  }
  fact(matches.length <= 1)
  return matches[0] ?? null
}
function sessionMatches(
  s: Stripe.Checkout.Session,
  op: TrialPaidRecoveryOperation,
  runtime: TrialRuntime,
) {
  return (
    s.mode === (op.kind === "recover_unpaid" ? "subscription" : "setup") &&
    s.livemode === runtime.livemode &&
    id(s.customer) === op.providerCustomerId &&
    s.client_reference_id === op.id &&
    s.metadata?.trial_paid_recovery_operation_id === op.id &&
    s.metadata.trial_enrollment_id === op.enrollmentId
  )
}
async function candidates(input: Deps, op: TrialPaidRecoveryOperation) {
  const found: Stripe.Subscription[] = []
  let cursor: string | undefined
  for (let page = 0; ; page++) {
    fact(page < 20)
    const list = await input.stripe.subscriptions.list({
      customer: op.providerCustomerId,
      status: "all",
      limit: 100,
      ...(cursor ? { starting_after: cursor } : {}),
    })
    found.push(
      ...list.data.filter(
        (s) =>
          s.id !== op.sourceAgreementId &&
          s.metadata.trial_paid_recovery_operation_id === op.id &&
          s.metadata.trial_paid_recovery_role === "candidate",
      ),
    )
    if (!list.has_more) break
    const next = list.data.at(-1)?.id
    fact(next && next !== cursor)
    cursor = next
  }
  fact(found.length <= 1)
  return found[0] ?? null
}
function metadata(op: TrialPaidRecoveryOperation) {
  return {
    trial_cohort: "trial_v1",
    trial_enrollment_id: op.enrollmentId,
    trial_paid_recovery_operation_id: op.id,
    trial_original_agreement_id: op.originalAgreementId,
    trial_paid_recovery_role: "candidate",
  }
}

export async function beginStripeTrialPaidRecovery(
  input: Input & { successUrl: string; cancelUrl: string },
): Promise<StripeTrialPaidRecoveryResult> {
  const pending: StripeTrialPaidRecoveryResult = {
    status: "pending",
    operationId: input.operationId,
  }
  try {
    const runtime = input.runtime === undefined ? readTrialRuntime() : input.runtime
    fact(runtime)
    const op = await loadTrialPaidRecoveryOperation(input.client, input)
    fact(op.provider === "stripe" && op.userId === input.authenticatedUserId)
    if (op.status !== "pending") return { ...pending, status: op.status }
    if (await load(input, op.id)) return reconcileStripeTrialPaidRecovery(input)
    fact(
      (await guardTrialPaidRecoveryOperation(input.client, input)) &&
        (await input.stripe.accounts.retrieve(null)).id === runtime.stripeAccountId,
    )
    const success = new URL(input.successUrl),
      cancel = new URL(input.cancelUrl)
    fact(
      success.origin === cancel.origin &&
        (success.protocol === "https:" || ["localhost", "127.0.0.1"].includes(success.hostname)),
    )
    const recovered = await neutralizeSource(input, op, runtime)
    if (recovered === "paid") {
      fact(
        await abandonTrialPaidRecoveryOperation(input.client, {
          ...input,
          reconciliationReference: `stripe-source-paid:${op.id}`,
        }),
      )
      return { ...pending, status: "abandoned" }
    }
    await attestStripeTrialCatalog({
      stripe: input.stripe,
      offer: op.offer,
      expectedAccountId: runtime.stripeAccountId,
      expectedLivemode: runtime.livemode,
    })
    const customer = await input.stripe.customers.retrieve(op.providerCustomerId)
    fact(!customer.deleted && !customer.discount)
    const meta = metadata(op)
    const params: Stripe.Checkout.SessionCreateParams = {
      customer: op.providerCustomerId,
      ui_mode: "hosted_page",
      locale: "de",
      payment_method_types: ["card"],
      client_reference_id: op.id,
      metadata: meta,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      ...(op.kind === "recover_unpaid"
        ? {
            mode: "subscription",
            payment_method_collection: "always",
            automatic_tax: { enabled: true },
            customer_update: { address: "auto" },
            line_items: [{ price: op.offer.stripePriceId, quantity: 1 }],
            ...(op.offer.stripeCouponId
              ? { discounts: [{ coupon: op.offer.stripeCouponId }] }
              : {}),
            subscription_data: { billing_mode: { type: "flexible" }, metadata: meta },
          }
        : {
            mode: "setup",
            setup_intent_data: { metadata: meta },
            custom_text: {
              submit: {
                message: `Zahlungsart für deine bereits bezahlte Mitgliedschaft bestätigen. Jetzt erfolgt keine weitere Zahlung. Nächste Zahlung am ${new Date(op.paidThroughAt!).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}: ${(op.offer.renewalAmountMinor / 100).toFixed(2).replace(".", ",")} € inkl. MwSt., danach pro ${op.offer.interval === "year" ? "Jahr" : "Monat"}. Du erlaubst diese wiederkehrenden Zahlungen.`,
              },
            },
          }),
    }
    const frozen = await input.client.rpc("freeze_stripe_trial_paid_recovery_request", {
      p_operation_id: op.id,
      p_user_id: op.userId,
      p_session_params: params,
    })
    fact(!frozen.error && frozen.data)
    return reconcileStripeTrialPaidRecovery(input)
  } catch {
    return pending
  }
}

export async function reconcileStripeTrialPaidRecovery(
  input: Input,
): Promise<StripeTrialPaidRecoveryResult> {
  const pending: StripeTrialPaidRecoveryResult = {
    status: "pending",
    operationId: input.operationId,
  }
  try {
    const runtime = input.runtime === undefined ? readTrialRuntime() : input.runtime
    fact(runtime)
    const op = await loadTrialPaidRecoveryOperation(input.client, input),
      request = await load(input, op.id)
    fact(op.provider === "stripe" && request?.user_id === input.authenticatedUserId)
    if (op.status === "committed") {
      await checkpoint(input, op.id, "resolved")
      return { ...pending, status: "committed" }
    }
    if (op.status === "abandoned") return { ...pending, status: "abandoned" }
    fact((await input.stripe.accounts.retrieve(null)).id === runtime.stripeAccountId)
    let target = await candidates(input, op),
      session = await findSession(input, op, request)
    if (target) fact(targetOwned(target, op, runtime))
    if (session) fact(sessionMatches(session, op, runtime))
    const abort = async () => {
      if (session?.status === "open") {
        await input.stripe.checkout.sessions.expire(session.id)
        fact((await input.stripe.checkout.sessions.retrieve(session.id)).status === "expired")
      }
      if (target) {
        const received = (await allInvoices(input, target.id)).filter((i) => i.amount_paid > 0)
        if (received.length) {
          fact(op.kind === "recover_unpaid" && received.length === 1)
          const verified = await verifyStripeTrialRecoveryPayment(
            input,
            op,
            target,
            received[0].id,
            runtime,
          )
          // A cancellation which won the race stays authoritative. The ledger
          // retains this unbound candidate payment as reconciliation_required
          // for refund assessment; this is not a completed recovery.
          await recordTrialPaymentEvent(input.client, verified)
        }
        if (target.status !== "canceled")
          await input.stripe.subscriptions.cancel(target.id, {
            invoice_now: false,
            prorate: false,
            cancellation_details: { comment: `trial-paid-recovery-rejected:${op.id}` },
          })
        fact((await input.stripe.subscriptions.retrieve(target.id)).status === "canceled")
        // A paid or processing candidate is never discarded. Keep it durable for reconciliation.
        const invoices = await allInvoices(input, target.id)
        fact(
          invoices.every(
            (i) =>
              i.amount_paid === 0 &&
              i.amount_remaining === 0 &&
              ["paid", "void"].includes(i.status ?? ""),
          ),
        )
      }
      // Missing response can hide a create. Never abandon until its canonical session is terminal.
      fact(
        session?.status === "expired" ||
          (op.kind === "repair_paid" && session?.status === "complete" && target),
      )
      fact(
        await abandonTrialPaidRecoveryOperation(input.client, {
          ...input,
          reconciliationReference: `stripe-recovery-aborted:${op.id}`,
        }),
      )
      await checkpoint(input, op.id, "canceled")
      return { ...pending, status: "abandoned" as const }
    }
    if (!(await guardTrialPaidRecoveryOperation(input.client, input))) return await abort()
    fact((await neutralizeSource(input, op, runtime)) === "neutralized")
    if (!session) {
      fact(
        !target &&
          Date.now() - Date.parse(request.session_create_started_at) < 23 * 60 * 60 * 1000 &&
          (await guardTrialPaidRecoveryOperation(input.client, input)),
      )
      session = await input.stripe.checkout.sessions.create(request.session_params, {
        idempotencyKey: `trial-paid-recovery:${op.id}:checkout:v1`,
      })
      fact(sessionMatches(session, op, runtime))
    }
    await checkpoint(input, op.id, "session", session.id)
    if (session.status === "open") {
      fact(session.url)
      return { ...pending, status: "approval_required", approvalUrl: session.url }
    }
    if (session.status === "expired") return await abort()
    fact(session.status === "complete")
    let payment: TrialPaymentEvent | null = null,
      firstBillingAt: string
    if (op.kind === "recover_unpaid") {
      fact(
        target &&
          id(session.subscription) === target.id &&
          session.payment_status === "paid" &&
          session.currency === "eur" &&
          session.amount_total === op.offer.firstAmountMinor &&
          targetOwned(target, op, runtime) &&
          terms(target, op) &&
          target.status === "active" &&
          !target.cancel_at_period_end &&
          target.cancel_at == null &&
          target.trial_end == null &&
          target.trial_start == null,
      )
      const invoiceId = id(session.invoice)
      fact(invoiceId)
      payment = await verifyStripeTrialRecoveryPayment(input, op, target, invoiceId, runtime)
      firstBillingAt = payment.occurredAt
    } else {
      const setupId = id(session.setup_intent)
      fact(setupId)
      const setup = await input.stripe.setupIntents.retrieve(setupId),
        methodId = id(setup.payment_method)
      fact(
        setup.status === "succeeded" &&
          setup.livemode === runtime.livemode &&
          id(setup.customer) === op.providerCustomerId &&
          setup.usage === "off_session" &&
          setup.metadata?.trial_paid_recovery_operation_id === op.id &&
          methodId,
      )
      const method = await input.stripe.paymentMethods.retrieve(methodId)
      fact(
        method.type === "card" &&
          method.livemode === runtime.livemode &&
          id(method.customer) === op.providerCustomerId,
      )
      const anchor = Date.parse(op.paidThroughAt!) / 1000
      firstBillingAt = instant(anchor)
      if (!target) {
        fact(Number.isSafeInteger(anchor) && anchor > Date.now() / 1000 + 60)
        fact(
          !request.subscription_create_started_at ||
            Date.now() - Date.parse(request.subscription_create_started_at) < 23 * 60 * 60 * 1000,
        )
        const customer = await input.stripe.customers.retrieve(op.providerCustomerId)
        fact(!customer.deleted && !customer.discount)
        const params: Stripe.SubscriptionCreateParams = {
          customer: op.providerCustomerId,
          items: [{ price: op.offer.stripePriceId, quantity: 1 }],
          billing_mode: { type: "flexible" },
          billing_cycle_anchor: anchor,
          proration_behavior: "none",
          automatic_tax: { enabled: true },
          collection_method: "charge_automatically",
          default_payment_method: methodId,
          metadata: metadata(op),
        }
        await checkpoint(input, op.id, "begin_subscription", null, params)
        target = await input.stripe.subscriptions.create(params, {
          idempotencyKey: `trial-paid-recovery:${op.id}:continuation:v1`,
        })
      }
      fact(
        targetOwned(target, op, runtime) &&
          terms(target, op) &&
          target.status === "active" &&
          target.billing_mode.type === "flexible" &&
          target.billing_cycle_anchor === anchor &&
          target.items.data[0].current_period_end === anchor &&
          target.trial_end == null &&
          target.trial_start == null &&
          target.discounts.length === 0 &&
          !target.cancel_at_period_end &&
          target.cancel_at == null &&
          id(target.default_payment_method) === methodId &&
          (await allInvoices(input, target.id)).length === 0,
      )
    }
    await checkpoint(input, op.id, "subscription", target.id)
    if (!(await guardTrialPaidRecoveryOperation(input.client, input))) return await abort()
    // RPC transport failures are ambiguous: it may already have granted access. Do not compensate that case.
    const committed = await commitTrialPaidRecoveryOperation(input.client, {
      ...input,
      payment,
      evidence: {
        provider: "stripe",
        providerCustomerId: op.providerCustomerId,
        sourceAgreementId: op.sourceAgreementId,
        targetAgreementId: target.id,
        offer: op.offer,
        sourceAgreementNeutralized: true,
        noInFlightSourcePayment: true,
        noAdditionalCharge: op.kind === "repair_paid",
        firstBillingAt,
        reference: `stripe-recovery:${session.id}:${op.id}`,
      },
    })
    if (!committed) return await abort()
    await checkpoint(input, op.id, "resolved")
    return { ...pending, status: "committed" }
  } catch {
    return pending
  }
}

export async function handleStripeTrialPaidRecoveryCompleted(
  input: Deps & { sessionId: string },
): Promise<StripeTrialPaidRecoveryResult | null> {
  const session = await input.stripe.checkout.sessions.retrieve(input.sessionId),
    operationId = session.metadata?.trial_paid_recovery_operation_id
  if (!operationId) return null
  const request = await load(input, operationId)
  fact(request)
  return reconcileStripeTrialPaidRecovery({
    ...input,
    operationId,
    authenticatedUserId: request.user_id,
  })
}
/** Invoice delivery may beat checkout.session.completed. Resolve only our durable candidate. */
export async function handleStripeTrialPaidRecoveryInvoice(
  input: Deps & { subscriptionId: string; invoiceId?: string },
): Promise<StripeTrialPaidRecoveryResult | null> {
  const subscription = await input.stripe.subscriptions.retrieve(input.subscriptionId)
  if (subscription.metadata.trial_paid_recovery_role !== "candidate") return null
  const operationId = subscription.metadata.trial_paid_recovery_operation_id
  fact(operationId)
  const request = await load(input, operationId)
  fact(request)
  const op = await loadTrialPaidRecoveryOperation(input.client, {
    operationId,
    authenticatedUserId: request.user_id,
  })
  if (op.status === "committed" && input.invoiceId) {
    const session = await findSession(input, op, request)
    fact(session)
    if (id(session.invoice) !== input.invoiceId) return null
  }
  const result = await reconcileStripeTrialPaidRecovery({
    ...input,
    operationId,
    authenticatedUserId: request.user_id,
  })
  if (result.status === "committed" && input.invoiceId && op.kind === "recover_unpaid") {
    const runtime = input.runtime === undefined ? readTrialRuntime() : input.runtime
    fact(runtime)
    const payment = await verifyStripeTrialRecoveryPayment(
      input,
      op,
      subscription,
      input.invoiceId,
      runtime,
    )
    return {
      ...result,
      invoice: {
        enrollmentId: op.enrollmentId,
        userId: op.userId,
        customerId: op.providerCustomerId,
        subscriptionId: subscription.id,
        invoiceId: input.invoiceId,
        interval: op.offer.interval,
        payment: {
          amountMinor: payment.amountMinor,
          occurredAt: payment.occurredAt,
          result: { outcome: "duplicate", phase: "first_paid" },
        },
      },
    }
  }
  return result
}
export async function reconcileStripeTrialPaidRecoveries(input: Deps) {
  const result = await input.client.rpc("list_stripe_trial_paid_recovery_requests", { p_limit: 2 })
  fact(!result.error && Array.isArray(result.data))
  const counts = { processed: 0, committed: 0, pending: 0, abandoned: 0 }
  for (const row of result.data as Array<{ operation_id: string; user_id: string }>) {
    const r = await reconcileStripeTrialPaidRecovery({
      ...input,
      operationId: row.operation_id,
      authenticatedUserId: row.user_id,
    })
    counts.processed++
    if (r.status === "committed") counts.committed++
    else if (r.status === "abandoned") counts.abandoned++
    else {
      counts.pending++
      await checkpoint(input, row.operation_id, "retry")
    }
  }
  return counts
}
