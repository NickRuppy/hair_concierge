import "server-only"
import type Stripe from "stripe"
import { readTrialRuntime, type TrialRuntime } from "../billing/trial-runtime"
import {
  loadTrialManagementOperation,
  guardTrialManagementOperation,
  commitTrialManagementOperation,
  abandonTrialManagementOperation,
  type TrialManagementClient,
  type TrialManagementOperation,
} from "../billing/trial-management-operations"
import { attestStripeTrialCatalog } from "./trial-catalog"

type Deps = { client: TrialManagementClient; stripe: Stripe; runtime?: TrialRuntime | null }
type Input = Deps & { operationId: string; authenticatedUserId: string }
type Result = {
  status: "approval_required" | "pending" | "committed" | "abandoned"
  operationId: string
  approvalUrl?: string
}
type Approval = {
  operation_id: string
  user_id: string
  session_params: Stripe.Checkout.SessionCreateParams
  session_id: string | null
  session_create_started_at: string
  subscription_params: Stripe.SubscriptionCreateParams | null
  subscription_id: string | null
  subscription_create_started_at: string | null
  status: "pending" | "resolved" | "canceled"
}
function id(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : (value?.id ?? null)
}
function requireFact(value: unknown): asserts value {
  if (!value) throw new Error("Stripe restoration requires reconciliation")
}
async function load(input: Deps, operationId: string): Promise<Approval | null> {
  const result = await input.client.rpc("load_stripe_trial_management_approval", {
    p_operation_id: operationId,
  })
  requireFact(!result.error)
  return result.data as Approval | null
}
async function checkpoint(
  input: Deps,
  operationId: string,
  action: string,
  providerId: string | null = null,
  params: unknown = null,
) {
  const result = await input.client.rpc("checkpoint_stripe_trial_management_approval", {
    p_operation_id: operationId,
    p_action: action,
    p_provider_id: providerId,
    p_params: params,
  })
  requireFact(!result.error && result.data === true)
}
function sessionMatches(
  session: Stripe.Checkout.Session,
  op: TrialManagementOperation,
  runtime: TrialRuntime,
) {
  return (
    session.mode === "setup" &&
    session.livemode === runtime.livemode &&
    id(session.customer) === op.providerCustomerId &&
    session.client_reference_id === op.id &&
    session.metadata?.trial_management_operation_id === op.id &&
    session.metadata.trial_management_purpose === "restore_authorization" &&
    session.metadata.trial_enrollment_id === op.enrollmentId
  )
}
async function sourceCanceled(input: Deps, op: TrialManagementOperation, runtime: TrialRuntime) {
  const source = await input.stripe.subscriptions.retrieve(op.sourceAgreementId)
  requireFact(
    source.id === op.sourceAgreementId &&
      source.status === "canceled" &&
      source.livemode === runtime.livemode &&
      id(source.customer) === op.providerCustomerId &&
      source.metadata.trial_enrollment_id === op.enrollmentId &&
      source.metadata.trial_cohort === "trial_v1",
  )
  const invoices = await input.stripe.invoices.list({ subscription: source.id, limit: 100 })
  requireFact(
    !invoices.has_more &&
      invoices.data.every(
        (i) =>
          i.amount_paid === 0 &&
          i.amount_remaining === 0 &&
          ["paid", "void"].includes(i.status ?? ""),
      ),
  )
}
async function findSession(input: Deps, op: TrialManagementOperation, approval: Approval) {
  if (approval.session_id) return input.stripe.checkout.sessions.retrieve(approval.session_id)
  let cursor: string | undefined
  const matches: Stripe.Checkout.Session[] = []
  for (let page = 0; ; page++) {
    requireFact(page < 20)
    const list = await input.stripe.checkout.sessions.list({
      customer: op.providerCustomerId,
      limit: 100,
      ...(cursor ? { starting_after: cursor } : {}),
    })
    matches.push(
      ...list.data.filter(
        (s) =>
          s.client_reference_id === op.id &&
          s.metadata?.trial_management_purpose === "restore_authorization",
      ),
    )
    if (!list.has_more) break
    const next = list.data.at(-1)?.id
    requireFact(next && next !== cursor)
    cursor = next
  }
  requireFact(matches.length <= 1)
  return matches[0] ?? null
}

/** Fresh hosted consent saves the card; it cannot take money or restart a trial. */
export async function startStripeTrialManagementApproval(
  input: Input & { successUrl: string; cancelUrl: string },
): Promise<Result> {
  const pending: Result = { status: "pending", operationId: input.operationId }
  try {
    const runtime = input.runtime === undefined ? readTrialRuntime() : input.runtime
    requireFact(runtime)
    const op = await loadTrialManagementOperation(input.client, input)
    requireFact(op.provider === "stripe" && op.userId === input.authenticatedUserId)
    if (op.status === "committed") return { ...pending, status: "committed" }
    requireFact(await guardTrialManagementOperation(input.client, input))
    requireFact((await input.stripe.accounts.retrieve(null)).id === runtime.stripeAccountId)
    await sourceCanceled(input, op, runtime)
    const success = new URL(input.successUrl),
      cancel = new URL(input.cancelUrl)
    requireFact(
      success.origin === cancel.origin &&
        (success.protocol === "https:" || ["localhost", "127.0.0.1"].includes(success.hostname)),
    )
    const metadata = {
      trial_management_purpose: "restore_authorization",
      trial_management_operation_id: op.id,
      trial_enrollment_id: op.enrollmentId,
      trial_cohort: "trial_v1",
    }
    const end = new Date(op.originalTrialEndAt).toLocaleString("de-DE", {
      timeZone: "Europe/Berlin",
      dateStyle: "medium",
      timeStyle: "short",
    })
    const amount = (op.targetOffer.firstAmountMinor / 100).toFixed(2).replace(".", ",")
    const renewal = (op.targetOffer.renewalAmountMinor / 100).toFixed(2).replace(".", ",")
    const interval = op.targetOffer.interval === "year" ? "Jahr" : "Monat"
    const frozen = await input.client.rpc("freeze_stripe_trial_management_approval", {
      p_operation_id: op.id,
      p_user_id: op.userId,
      p_session_params: {
        mode: "setup",
        ui_mode: "hosted_page",
        customer: op.providerCustomerId,
        payment_method_types: ["card"],
        client_reference_id: op.id,
        metadata,
        setup_intent_data: { metadata },
        locale: "de",
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        custom_text: {
          submit: {
            message: `Mitgliedschaft fortsetzen: Dein Test endet unverändert am ${end}. Danach ${amount} € für den ersten ${interval}, anschließend ${renewal} € pro ${interval}, jeweils inkl. MwSt. Du erlaubst die wiederkehrende Belastung dieser Zahlungsart. Bis zum Testende kannst du kündigen.`,
          },
        },
      } satisfies Stripe.Checkout.SessionCreateParams,
    })
    requireFact(!frozen.error && frozen.data)
    const approval = frozen.data as Approval
    let session = await findSession(input, op, approval)
    if (!session) {
      requireFact(
        Date.now() - Date.parse(approval.session_create_started_at) < 23 * 60 * 60 * 1000 &&
          (await guardTrialManagementOperation(input.client, input)),
      )
      session = await input.stripe.checkout.sessions.create(approval.session_params, {
        idempotencyKey: `trial-management:${op.id}:setup:v1`,
      })
    }
    requireFact(sessionMatches(session, op, runtime))
    await checkpoint(input, op.id, "session", session.id)
    if (session.status === "complete" || session.status === "expired")
      return reconcileStripeTrialManagementApproval(input)
    requireFact(session.status === "open" && session.url)
    return { ...pending, status: "approval_required", approvalUrl: session.url }
  } catch {
    return pending
  }
}

export async function reconcileStripeTrialManagementApproval(input: Input): Promise<Result> {
  const pending: Result = { status: "pending", operationId: input.operationId }
  try {
    const runtime = input.runtime === undefined ? readTrialRuntime() : input.runtime
    requireFact(runtime)
    const op = await loadTrialManagementOperation(input.client, input)
    const approval = await load(input, op.id)
    requireFact(
      approval && approval.user_id === input.authenticatedUserId && op.provider === "stripe",
    )
    if (op.status === "abandoned") return { ...pending, status: "abandoned" }
    if (op.status === "committed") {
      requireFact(op.targetAgreementId === approval.subscription_id)
      await checkpoint(input, op.id, "resolved")
      return { ...pending, status: "committed" }
    }
    requireFact(
      approval.status === "pending" &&
        (await input.stripe.accounts.retrieve(null)).id === runtime.stripeAccountId,
    )
    const candidates: Stripe.Subscription[] = []
    let cursor: string | undefined
    for (let page = 0; ; page++) {
      requireFact(page < 20)
      const list = await input.stripe.subscriptions.list({
        customer: op.providerCustomerId,
        status: "all",
        limit: 100,
        ...(cursor ? { starting_after: cursor } : {}),
      })
      candidates.push(
        ...list.data.filter(
          (s) =>
            s.id !== op.sourceAgreementId &&
            s.metadata.trial_management_operation_id === op.id &&
            s.metadata.trial_management_role === "restored",
        ),
      )
      if (!list.has_more) break
      const next = list.data.at(-1)?.id
      requireFact(next && next !== cursor)
      cursor = next
    }
    requireFact(candidates.length <= 1)
    let target = candidates[0] ?? null
    const owned = (s: Stripe.Subscription) =>
      s.id !== op.sourceAgreementId &&
      s.livemode === runtime.livemode &&
      id(s.customer) === op.providerCustomerId &&
      s.metadata.trial_management_operation_id === op.id &&
      s.metadata.trial_enrollment_id === op.enrollmentId &&
      s.metadata.trial_original_agreement_id === op.originalAgreementId &&
      s.metadata.trial_management_role === "restored"
    const neutralize = async (s: Stripe.Subscription) => {
      requireFact(owned(s))
      if (s.status !== "canceled")
        await input.stripe.subscriptions.cancel(s.id, {
          invoice_now: false,
          prorate: false,
          cancellation_details: { comment: `trial-management-rejected:${op.id}` },
        })
      requireFact((await input.stripe.subscriptions.retrieve(s.id)).status === "canceled")
    }
    if (target) requireFact(owned(target))
    if (!(await guardTrialManagementOperation(input.client, input))) {
      if (target) {
        await neutralize(target)
        await checkpoint(input, op.id, "canceled")
      }
      if (!target && !approval.subscription_create_started_at) {
        await sourceCanceled(input, op, runtime)
        if (
          await abandonTrialManagementOperation(input.client, {
            operationId: op.id,
            authenticatedUserId: op.userId,
            reconciliationReference: `stripe-setup-abandoned:${op.id}`,
          })
        ) {
          await checkpoint(input, op.id, "canceled")
          return { ...pending, status: "abandoned" }
        }
      }
      return pending
    }
    const session = await findSession(input, op, approval)
    if (!session) return pending
    requireFact(sessionMatches(session, op, runtime))
    await checkpoint(input, op.id, "session", session.id)
    if (session.status === "expired" && !target && !approval.subscription_create_started_at) {
      await sourceCanceled(input, op, runtime)
      if (
        await abandonTrialManagementOperation(input.client, {
          operationId: op.id,
          authenticatedUserId: op.userId,
          reconciliationReference: `stripe-setup-abandoned:${op.id}`,
        })
      ) {
        await checkpoint(input, op.id, "canceled")
        return { ...pending, status: "abandoned" }
      }
    }
    if (session.status !== "complete") return pending
    const setupId = id(session.setup_intent)
    requireFact(setupId)
    const setup = await input.stripe.setupIntents.retrieve(setupId)
    const methodId = id(setup.payment_method)
    requireFact(
      setup.status === "succeeded" &&
        setup.livemode === runtime.livemode &&
        id(setup.customer) === op.providerCustomerId &&
        setup.usage === "off_session" &&
        setup.metadata?.trial_management_operation_id === op.id &&
        methodId,
    )
    const method = await input.stripe.paymentMethods.retrieve(methodId)
    requireFact(
      method.type === "card" &&
        method.livemode === runtime.livemode &&
        id(method.customer) === op.providerCustomerId,
    )
    await sourceCanceled(input, op, runtime)
    const anchor = Date.parse(op.originalTrialEndAt) / 1000
    if (!target) {
      requireFact(Number.isSafeInteger(anchor) && anchor > Math.floor(Date.now() / 1000) + 60)
      if (approval.subscription_create_started_at)
        requireFact(
          Date.now() - Date.parse(approval.subscription_create_started_at) < 23 * 60 * 60 * 1000,
        )
      await attestStripeTrialCatalog({
        stripe: input.stripe,
        offer: op.targetOffer,
        expectedAccountId: runtime.stripeAccountId,
        expectedLivemode: runtime.livemode,
      })
      const customer = await input.stripe.customers.retrieve(op.providerCustomerId)
      requireFact(!customer.deleted && !customer.discount)
      const params: Stripe.SubscriptionCreateParams = {
        customer: op.providerCustomerId,
        default_payment_method: methodId,
        billing_cycle_anchor: anchor,
        billing_mode: { type: "flexible" },
        proration_behavior: "none",
        automatic_tax: { enabled: true },
        collection_method: "charge_automatically",
        items: [{ price: op.targetOffer.stripePriceId, quantity: 1 }],
        ...(op.targetOffer.stripeCouponId
          ? { discounts: [{ coupon: op.targetOffer.stripeCouponId }] }
          : {}),
        ...(op.cancelAtPeriodEnd ? { cancel_at: anchor } : {}),
        metadata: {
          trial_cohort: "trial_v1",
          trial_enrollment_id: op.enrollmentId,
          trial_management_operation_id: op.id,
          trial_management_role: "restored",
          trial_original_agreement_id: op.originalAgreementId,
        },
      }
      await checkpoint(input, op.id, "begin_subscription", null, params)
      target = await input.stripe.subscriptions.create(params, {
        idempotencyKey: `trial-management:${op.id}:subscription:v1`,
      })
    }
    requireFact(owned(target))
    await checkpoint(input, op.id, "subscription", target.id)
    target = await input.stripe.subscriptions.retrieve(target.id, { expand: ["discounts"] })
    const item = target.items.data[0],
      discount = target.discounts[0]
    const correctDiscount = op.targetOffer.stripeCouponId
      ? target.discounts.length === 1 &&
        typeof discount !== "string" &&
        id(discount.source.coupon) === op.targetOffer.stripeCouponId
      : target.discounts.length === 0
    const correct =
      owned(target) &&
      target.status === "active" &&
      target.billing_mode.type === "flexible" &&
      target.billing_cycle_anchor === anchor &&
      target.trial_end == null &&
      target.trial_start == null &&
      target.automatic_tax.enabled &&
      !target.items.has_more &&
      target.items.data.length === 1 &&
      item.quantity === 1 &&
      item.discounts.length === 0 &&
      item.current_period_end === anchor &&
      item.price.id === op.targetOffer.stripePriceId &&
      item.price.currency === "eur" &&
      item.price.tax_behavior === "inclusive" &&
      item.price.unit_amount === op.targetOffer.renewalAmountMinor &&
      item.price.recurring?.interval === op.targetOffer.interval &&
      item.price.recurring.interval_count === 1 &&
      id(target.default_payment_method) === methodId &&
      correctDiscount &&
      (op.cancelAtPeriodEnd
        ? target.cancel_at === anchor
        : !target.cancel_at_period_end && target.cancel_at == null)
    const invoices = await input.stripe.invoices.list({ subscription: target.id, limit: 100 })
    if (
      !correct ||
      invoices.has_more ||
      invoices.data.length !== 0 ||
      !(await guardTrialManagementOperation(input.client, input))
    ) {
      await neutralize(target)
      return pending
    }
    if (!op.cancelAtPeriodEnd) {
      const preview = await input.stripe.invoices.createPreview({ subscription: target.id })
      if (
        preview.currency !== "eur" ||
        preview.total !== op.targetOffer.firstAmountMinor ||
        preview.amount_due !== op.targetOffer.firstAmountMinor
      ) {
        await neutralize(target)
        return pending
      }
    }
    let committed: boolean
    try {
      committed = await commitTrialManagementOperation(input.client, {
        operationId: op.id,
        authenticatedUserId: op.userId,
        evidence: {
          provider: "stripe",
          providerCustomerId: op.providerCustomerId,
          sourceAgreementId: op.sourceAgreementId,
          targetAgreementId: target.id,
          originalTrialEndAt: op.originalTrialEndAt,
          offer: op.targetOffer,
          cancelAtPeriodEnd: op.cancelAtPeriodEnd,
          noImmediatePayment: true,
          sourceAgreementNeutralized: true,
          reference: `stripe-setup:${setup.id}:management:${op.id}`,
        },
      })
    } catch {
      return pending
    }
    if (!committed) {
      await neutralize(target)
      return pending
    }
    await checkpoint(input, op.id, "resolved")
    return { ...pending, status: "committed" }
  } catch {
    return pending
  }
}

/** Verified webhook entry; owner identity is read from the durable server record. */
export async function handleStripeTrialManagementApprovalCompleted(
  input: Deps & { sessionId: string },
): Promise<Result | null> {
  const session = await input.stripe.checkout.sessions.retrieve(input.sessionId)
  if (session.metadata?.trial_management_purpose !== "restore_authorization") return null
  const operationId = session.metadata.trial_management_operation_id
  requireFact(operationId)
  const approval = await load(input, operationId)
  requireFact(approval)
  const op = await loadTrialManagementOperation(input.client, {
    operationId,
    authenticatedUserId: approval.user_id,
  })
  const runtime = input.runtime === undefined ? readTrialRuntime() : input.runtime
  requireFact(runtime && sessionMatches(session, op, runtime))
  await checkpoint(input, op.id, "session", session.id)
  return reconcileStripeTrialManagementApproval({
    ...input,
    operationId,
    authenticatedUserId: approval.user_id,
  })
}

export async function reconcileStripeTrialManagementApprovals(input: Deps) {
  const listed = await input.client.rpc("list_stripe_trial_management_approvals", { p_limit: 2 })
  requireFact(!listed.error && Array.isArray(listed.data))
  const counts = { checked: listed.data.length, committed: 0, pending: 0 }
  for (const row of listed.data as Array<{ operation_id: string; user_id: string }>) {
    const result = await reconcileStripeTrialManagementApproval({
      ...input,
      operationId: row.operation_id,
      authenticatedUserId: row.user_id,
    })
    if (result.status === "committed") counts.committed++
    else {
      counts.pending++
      await checkpoint(input, row.operation_id, "retry")
    }
  }
  return counts
}
