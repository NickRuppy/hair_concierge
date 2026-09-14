import { readTrialEffectiveContract } from "../billing/trial-effective-contract"
import {
  findBillingSubscriptionByProviderId,
  upsertBillingSubscription,
} from "../billing/subscriptions"
import { mirrorBillingSubscriptionToProfile } from "../billing/entitlements"
import { getPremiumTierId } from "../billing/tier-ids"
import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  loadTrialManagementOperation,
  guardTrialManagementOperation,
  commitTrialManagementOperation,
  abandonTrialManagementOperation,
  type TrialManagementOperation,
} from "../billing/trial-management-operations"
import { getPayPalAppId, paypalRequest } from "./client"
import { retrievePayPalPlan, cancelPayPalSubscription } from "./subscriptions"
import { assertPlanMatchesAcceptedOffer } from "./trial-checkout"
import { loadPayPalTrialPlanCatalog } from "./trial-checkout-attempt"
import {
  paypalTrialPriceOverrides,
  retrievePayPalTrialSubscription,
  listPayPalTrialTransactions,
} from "./trial-runtime"
import type { PayPalSubscription } from "./subscription-shapes"

export type PayPalTrialManagementResult =
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

type FrozenRequest = {
  operationId: string
  enrollmentId: string
  appId: string
  productId: string
  sourcePlanId: string
  targetPlanId: string
  requestId: string
  requestExpiresAt: string
  returnUrl: string
  cancelUrl: string
  requestSentAt: string | null
  targetAgreementId: string | null
  approvalUrl: string | null
}
export type PayPalTrialManagementDeps = {
  supabase: SupabaseClient
  premiumTierId?: string
  attestApp?: typeof getPayPalAppId
  retrieve?: typeof retrievePayPalTrialSubscription
  getPlan?: typeof retrievePayPalPlan
  transactions?: typeof listPayPalTrialTransactions
  cancel?: typeof cancelPayPalSubscription
  request?: typeof paypalRequest
}

function parseRequest(value: unknown): FrozenRequest {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("PayPal trial management request unavailable")
  const row = value as Record<string, unknown>
  for (const key of [
    "operation_id",
    "enrollment_id",
    "app_id",
    "product_id",
    "source_plan_id",
    "target_plan_id",
    "request_id",
    "request_expires_at",
    "return_url",
    "cancel_url",
  ])
    if (typeof row[key] !== "string" || !row[key])
      throw new Error("PayPal trial management request unavailable")
  return {
    operationId: row.operation_id as string,
    enrollmentId: row.enrollment_id as string,
    appId: row.app_id as string,
    productId: row.product_id as string,
    sourcePlanId: row.source_plan_id as string,
    targetPlanId: row.target_plan_id as string,
    requestId: row.request_id as string,
    requestExpiresAt: row.request_expires_at as string,
    returnUrl: row.return_url as string,
    cancelUrl: row.cancel_url as string,
    requestSentAt: typeof row.request_sent_at === "string" ? row.request_sent_at : null,
    targetAgreementId: typeof row.target_agreement_id === "string" ? row.target_agreement_id : null,
    approvalUrl: typeof row.approval_url === "string" ? row.approval_url : null,
  }
}
async function providerRpc(
  deps: PayPalTrialManagementDeps,
  name: string,
  args: Record<string, unknown>,
) {
  const { data, error } = await deps.supabase.rpc(name, args)
  if (error) throw new Error("PayPal trial management persistence failed")
  return data
}
async function loadRequest(deps: PayPalTrialManagementDeps, operationId: string, userId: string) {
  const row = await providerRpc(deps, "get_paypal_trial_management_request", {
    p_operation_id: operationId,
    p_user_id: userId,
  })
  return row ? parseRequest(row) : null
}
const pending = (operation: TrialManagementOperation): PayPalTrialManagementResult => ({
  status: "pending",
  operationId: operation.id,
})
function terminal(operation: TrialManagementOperation): PayPalTrialManagementResult | null {
  return operation.status === "pending"
    ? null
    : { status: operation.status, operationId: operation.id }
}
function checkOperation(operation: TrialManagementOperation, userId: string) {
  if (
    operation.provider !== "paypal" ||
    operation.userId !== userId ||
    !Number.isFinite(Date.parse(operation.originalTrialEndAt))
  )
    throw new Error("PayPal trial management ownership mismatch")
}
function sameTime(a: string | undefined, b: string) {
  return typeof a === "string" && Number.isFinite(Date.parse(a)) && Date.parse(a) === Date.parse(b)
}
function approvalLink(subscription: PayPalSubscription): string | null {
  const href = subscription.links?.find((link) => link.rel === "approve")?.href
  if (!href) return null
  const url = new URL(href)
  if (
    url.protocol !== "https:" ||
    !["www.paypal.com", "www.sandbox.paypal.com"].includes(url.hostname)
  )
    throw new Error("PayPal approval URL invalid")
  return url.href
}
function returnUrl(value: string): string {
  const url = new URL(value)
  if (
    url.protocol !== "https:" &&
    !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))
  )
    throw new Error("PayPal trial management return URL invalid")
  return url.href
}
async function assertAttested(request: FrozenRequest, deps: PayPalTrialManagementDeps) {
  if ((await (deps.attestApp ?? getPayPalAppId)()) !== request.appId)
    throw new Error("PayPal trial management app mismatch")
}
function assertOwned(
  subscription: PayPalSubscription,
  operation: TrialManagementOperation,
  id: string,
) {
  if (subscription.id !== id || subscription.subscriber?.payer_id !== operation.providerCustomerId)
    throw new Error("PayPal trial management payer mismatch")
}
function assertFutureTrial(
  subscription: PayPalSubscription,
  operation: TrialManagementOperation,
  requireActive = true,
) {
  if (
    Date.parse(operation.originalTrialEndAt) <= Date.now() ||
    !sameTime(subscription.start_time, operation.originalTrialEndAt) ||
    (requireActive &&
      (subscription.status !== "ACTIVE" ||
        !sameTime(subscription.billing_info?.next_billing_time, operation.originalTrialEndAt)))
  )
    throw new Error("PayPal trial management original deadline is not verified")
}
function assertEffectivePlan(
  subscription: PayPalSubscription,
  operation: TrialManagementOperation,
  request: FrozenRequest,
  target: boolean,
) {
  if (subscription.plan_id !== (target ? request.targetPlanId : request.sourcePlanId))
    throw new Error("PayPal trial management plan mismatch")
  assertPlanMatchesAcceptedOffer(
    subscription.plan ? { ...subscription.plan, status: "ACTIVE" } : null,
    { offer: target ? operation.targetOffer : operation.sourceOffer, productId: request.productId },
  )
}
async function assertNoPayment(
  id: string,
  operation: TrialManagementOperation,
  deps: PayPalTrialManagementDeps,
) {
  const transactions = await (deps.transactions ?? listPayPalTrialTransactions)(
    id,
    new Date(Date.parse(operation.originalTrialEndAt) - 7 * 86400000).toISOString(),
    new Date().toISOString(),
  )
  if (transactions.length)
    throw new Error("PayPal trial management payment reconciliation required")
}

/** Called after the authenticated route reserves the frozen shared operation. */
export async function beginPayPalTrialManagement(
  input: { operationId: string; authenticatedUserId: string; returnUrl: string; cancelUrl: string },
  deps: PayPalTrialManagementDeps,
): Promise<PayPalTrialManagementResult> {
  const operation = await loadTrialManagementOperation(deps.supabase, input)
  checkOperation(operation, input.authenticatedUserId)
  const completed = terminal(operation)
  if (completed) {
    if (operation.status === "committed") await projectPayPalTrialManagement(operation, deps)
    return completed
  }
  if (!(await guardTrialManagementOperation(deps.supabase, input)))
    return { status: "reconciliation_required", operationId: operation.id }
  let frozen = await loadRequest(deps, operation.id, operation.userId)
  if (!frozen) {
    const catalog = await loadPayPalTrialPlanCatalog(deps.supabase, operation.enrollmentId)
    if (!catalog || (await (deps.attestApp ?? getPayPalAppId)()) !== catalog.appId)
      throw new Error("PayPal trial management catalog unavailable")
    const source = await (deps.retrieve ?? retrievePayPalTrialSubscription)(
      operation.sourceAgreementId,
    )
    assertOwned(source, operation, operation.sourceAgreementId)
    const sourcePlanId = source.plan_id
    const targetPlanId =
      operation.targetOffer.interval === "month" ? catalog.monthPlanId : catalog.yearPlanId
    if (!sourcePlanId) throw new Error("PayPal trial management source plan unavailable")
    const targetPlan = await (deps.getPlan ?? retrievePayPalPlan)(targetPlanId)
    assertPlanMatchesAcceptedOffer(targetPlan, {
      offer: operation.targetOffer,
      productId: catalog.productId,
    })
    frozen = parseRequest(
      await providerRpc(deps, "freeze_paypal_trial_management_request", {
        p_operation_id: operation.id,
        p_user_id: operation.userId,
        p_source_plan_id: sourcePlanId,
        p_target_plan_id: targetPlanId,
        p_return_url: returnUrl(input.returnUrl),
        p_cancel_url: returnUrl(input.cancelUrl),
      }),
    )
  }
  await assertAttested(frozen, deps)
  if (frozen.targetAgreementId) return reconcilePayPalTrialManagement(input, deps)
  const source = await (deps.retrieve ?? retrievePayPalTrialSubscription)(
    operation.sourceAgreementId,
  )
  assertOwned(source, operation, operation.sourceAgreementId)
  if (operation.kind === "switch" && source.plan_id === frozen.targetPlanId && frozen.requestSentAt)
    return reconcilePayPalTrialManagement(input, deps)
  assertEffectivePlan(source, operation, frozen, false)
  assertFutureTrial(source, operation, operation.kind === "switch")
  if (operation.kind === "restore" && source.status !== "CANCELLED")
    throw new Error("PayPal trial restore source remains collectible")
  await assertNoPayment(source.id!, operation, deps)
  if (Date.parse(frozen.requestExpiresAt) <= Date.now())
    return { status: "reconciliation_required", operationId: operation.id }
  const claimed = await providerRpc(deps, "claim_paypal_trial_management_request", {
    p_operation_id: operation.id,
    p_user_id: operation.userId,
  })
  // Create has a documented 72h request-id guarantee. /revise does not: do not resend an ambiguous issued revision.
  if (claimed !== true && (operation.kind === "switch" || !frozen.requestSentAt))
    return reconcilePayPalTrialManagement(input, deps)
  if (!(await guardTrialManagementOperation(deps.supabase, input)))
    return { status: "reconciliation_required", operationId: operation.id }
  const body = {
    plan_id: frozen.targetPlanId,
    plan: paypalTrialPriceOverrides(operation.targetOffer),
    application_context: {
      brand_name: "Chaarlie",
      user_action: "CONTINUE",
      shipping_preference: "NO_SHIPPING",
      return_url: frozen.returnUrl,
      cancel_url: frozen.cancelUrl,
    },
    ...(operation.kind === "restore"
      ? { start_time: operation.originalTrialEndAt, custom_id: `trial-management:${operation.id}` }
      : {}),
  }
  const response = await (deps.request ?? paypalRequest)<PayPalSubscription>(
    operation.kind === "restore"
      ? "/v1/billing/subscriptions"
      : `/v1/billing/subscriptions/${encodeURIComponent(operation.sourceAgreementId)}/revise`,
    {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
      headers: { "PayPal-Request-Id": frozen.requestId, Prefer: "return=representation" },
      body: JSON.stringify(body),
    },
  )
  const id = operation.kind === "restore" ? response.id : operation.sourceAgreementId
  if (
    !id ||
    (operation.kind === "restore" &&
      (response.plan_id !== frozen.targetPlanId ||
        response.custom_id !== `trial-management:${operation.id}`))
  )
    throw new Error("PayPal trial management response binding mismatch")
  const url = approvalLink(response)
  await providerRpc(deps, "bind_paypal_trial_management_response", {
    p_operation_id: operation.id,
    p_user_id: operation.userId,
    p_target_agreement_id: id,
    p_approval_url: url,
  })
  return url
    ? {
        status: "approval_required",
        operationId: operation.id,
        approvalUrl: url,
        subscriptionId: id,
      }
    : reconcilePayPalTrialManagement(input, deps)
}

/** Browser-return fields never enter this function; it retrieves the frozen provider reference. */
export async function reconcilePayPalTrialManagement(
  input: { operationId: string; authenticatedUserId: string },
  deps: PayPalTrialManagementDeps,
): Promise<PayPalTrialManagementResult> {
  const operation = await loadTrialManagementOperation(deps.supabase, input)
  checkOperation(operation, input.authenticatedUserId)
  const completed = terminal(operation)
  if (completed) {
    if (operation.status === "committed") await projectPayPalTrialManagement(operation, deps)
    return completed
  }
  const frozen = await loadRequest(deps, operation.id, operation.userId)
  if (!frozen) return pending(operation)
  await assertAttested(frozen, deps)
  const targetId =
    frozen.targetAgreementId ?? (operation.kind === "switch" ? operation.sourceAgreementId : null)
  if (!targetId) return { status: "reconciliation_required", operationId: operation.id }
  const target = await (deps.retrieve ?? retrievePayPalTrialSubscription)(targetId)
  // An unapproved replacement does not have a payer yet. Its exact custom/plan binding still must match.
  if (
    operation.kind === "restore" &&
    (target.id !== targetId ||
      target.custom_id !== `trial-management:${operation.id}` ||
      target.plan_id !== frozen.targetPlanId)
  )
    throw new Error("PayPal trial restoration binding mismatch")
  if (target.status !== "ACTIVE" || target.plan_id !== frozen.targetPlanId) {
    const url = approvalLink(target) ?? frozen.approvalUrl
    return url
      ? {
          status: "approval_required",
          operationId: operation.id,
          approvalUrl: url,
          subscriptionId: targetId,
        }
      : pending(operation)
  }
  if (
    operation.kind === "restore" &&
    target.subscriber?.payer_id !== operation.providerCustomerId
  ) {
    await neutralizeRestoreCandidate(targetId, operation, deps)
    throw new Error("PayPal trial management payer mismatch")
  }
  assertOwned(target, operation, targetId)
  assertEffectivePlan(target, operation, frozen, true)
  assertFutureTrial(target, operation)
  await assertNoPayment(targetId, operation, deps)
  if (operation.kind === "restore") {
    const source = await (deps.retrieve ?? retrievePayPalTrialSubscription)(
      operation.sourceAgreementId,
    )
    assertOwned(source, operation, operation.sourceAgreementId)
    if (source.status !== "CANCELLED")
      throw new Error("PayPal trial restoration source remains collectible")
    await assertNoPayment(source.id!, operation, deps)
  }
  const committed = await commitTrialManagementOperation(deps.supabase, {
    ...input,
    evidence: {
      provider: "paypal",
      providerCustomerId: operation.providerCustomerId,
      sourceAgreementId: operation.sourceAgreementId,
      targetAgreementId: targetId,
      originalTrialEndAt: operation.originalTrialEndAt,
      offer: operation.targetOffer,
      cancelAtPeriodEnd: operation.cancelAtPeriodEnd,
      noImmediatePayment: true,
      sourceAgreementNeutralized: operation.kind === "restore",
      reference: `paypal:verified:${operation.id}:${targetId}`,
    },
  })
  if (!committed) {
    // A fresh cancellation/withdrawal won the compare-and-set. The replacement must not collect.
    if (operation.kind === "restore") await neutralizeRestoreCandidate(targetId, operation, deps)
    return { status: "reconciliation_required", operationId: operation.id }
  }
  await projectPayPalTrialManagement(
    { ...operation, status: "committed", targetAgreementId: targetId },
    deps,
  )
  return { status: "committed", operationId: operation.id }
}

/** Explicit abandonment is safe only after the replacement is conclusively noncollectible. */
export async function abandonPayPalTrialManagement(
  input: { operationId: string; authenticatedUserId: string },
  deps: PayPalTrialManagementDeps,
): Promise<PayPalTrialManagementResult> {
  const operation = await loadTrialManagementOperation(deps.supabase, input)
  checkOperation(operation, input.authenticatedUserId)
  const completed = terminal(operation)
  if (completed) {
    if (operation.status === "committed") await projectPayPalTrialManagement(operation, deps)
    return completed
  }
  const frozen = await loadRequest(deps, operation.id, operation.userId)
  if (frozen) {
    await assertAttested(frozen, deps)
    // There is no documented cancel-pending-revision API. An old approval link could still apply later.
    if (operation.kind === "switch" && frozen.requestSentAt) return pending(operation)
    if (operation.kind === "restore" && frozen.requestSentAt && !frozen.targetAgreementId)
      return { status: "reconciliation_required", operationId: operation.id }
    if (frozen.targetAgreementId)
      await neutralizeRestoreCandidate(frozen.targetAgreementId, operation, deps)
  }
  const source = await (deps.retrieve ?? retrievePayPalTrialSubscription)(
    operation.sourceAgreementId,
  )
  assertOwned(source, operation, operation.sourceAgreementId)
  if (operation.kind === "restore" && source.status !== "CANCELLED")
    throw new Error("PayPal restoration cancellation no longer effective")
  if (operation.kind === "switch") {
    if (!frozen) return pending(operation)
    assertEffectivePlan(source, operation, frozen, false)
    assertFutureTrial(source, operation)
  }
  const abandoned = await abandonTrialManagementOperation(deps.supabase, {
    ...input,
    reconciliationReference: `paypal:abandoned:${operation.id}`,
  })
  return { status: abandoned ? "abandoned" : "reconciliation_required", operationId: operation.id }
}
async function neutralizeRestoreCandidate(
  id: string,
  operation: TrialManagementOperation,
  deps: PayPalTrialManagementDeps,
) {
  const retrieve = deps.retrieve ?? retrievePayPalTrialSubscription
  let candidate = await retrieve(id)
  if (candidate.id !== id || candidate.custom_id !== `trial-management:${operation.id}`)
    throw new Error("PayPal restore candidate mismatch")
  if (!["CANCELLED", "EXPIRED"].includes(candidate.status ?? "")) {
    await (deps.cancel ?? cancelPayPalSubscription)(
      id,
      "Trial restoration no longer approved; do not collect",
    )
    candidate = await retrieve(id)
  }
  if (!["CANCELLED", "EXPIRED"].includes(candidate.status ?? ""))
    throw new Error("PayPal restoration neutralization unconfirmed")
  await assertNoPayment(id, operation, deps)
}

async function projectPayPalTrialManagement(
  operation: TrialManagementOperation,
  deps: PayPalTrialManagementDeps,
) {
  const contract = await readTrialEffectiveContract(deps.supabase, operation.enrollmentId)
  if (contract.revision > operation.expectedRevision + 1) return // A later approved operation owns the projection now.
  if (
    contract.revision !== operation.expectedRevision + 1 ||
    contract.agreementId !== operation.targetAgreementId ||
    JSON.stringify(contract.offer) !== JSON.stringify(operation.targetOffer)
  )
    throw new Error("PayPal committed management authority mismatch")
  const frozen = await loadRequest(deps, operation.id, operation.userId)
  if (!frozen || !operation.targetAgreementId)
    throw new Error("PayPal management projection binding unavailable")
  await assertAttested(frozen, deps)
  const source = await findBillingSubscriptionByProviderId(
    deps.supabase,
    "paypal",
    operation.sourceAgreementId,
  )
  if (
    !source ||
    source.user_id !== operation.userId ||
    source.trial_enrollment_id !== operation.enrollmentId ||
    source.provider_customer_id !== operation.providerCustomerId
  )
    throw new Error("PayPal management source billing owner mismatch")
  const target = await (deps.retrieve ?? retrievePayPalTrialSubscription)(
    operation.targetAgreementId,
  )
  assertOwned(target, operation, operation.targetAgreementId)
  const prior = await findBillingSubscriptionByProviderId(
    deps.supabase,
    "paypal",
    operation.targetAgreementId,
  )
  if (
    prior &&
    (prior.user_id !== operation.userId ||
      prior.trial_enrollment_id !== operation.enrollmentId ||
      prior.provider_customer_id !== operation.providerCustomerId)
  )
    throw new Error("PayPal management target billing owner mismatch")
  const { data: enrollment, error } = await deps.supabase
    .from("trial_enrollments")
    .select("cancel_at_period_end,paid_through_at")
    .eq("id", operation.enrollmentId)
    .eq("user_id", operation.userId)
    .single()
  if (error || !enrollment) throw new Error("PayPal trial management enrollment missing")
  const billing = await upsertBillingSubscription(deps.supabase, {
    user_id: operation.userId,
    provider: "paypal",
    provider_customer_id: operation.providerCustomerId,
    provider_subscription_id: operation.targetAgreementId,
    provider_subscriber_email: target.subscriber?.email_address,
    provider_status: target.status ?? "ACTIVE",
    entitlement_status: enrollment.cancel_at_period_end ? "canceled" : "active",
    interval: operation.targetOffer.interval,
    current_period_end: enrollment.paid_through_at ?? operation.originalTrialEndAt,
    cancel_at_period_end: enrollment.cancel_at_period_end,
    trial_enrollment_id: operation.enrollmentId,
    metadata: {
      ...(prior?.metadata ?? {}),
      trial_cohort: "trial_v1",
      trial_offer_version: operation.targetOffer.offerVersion,
      paypal_plan_id: frozen.targetPlanId,
      plan_id: frozen.targetPlanId,
      trial_management_revision: contract.revision,
      trial_management_operation_id: operation.id,
    },
  })
  if (operation.sourceAgreementId !== operation.targetAgreementId)
    await upsertBillingSubscription(deps.supabase, {
      ...source,
      provider_status: "CANCELLED",
      entitlement_status: "canceled",
      metadata: { ...source.metadata, trial_management_superseded_by: operation.targetAgreementId },
    })
  await mirrorBillingSubscriptionToProfile(
    deps.supabase,
    billing,
    deps.premiumTierId ?? (await getPremiumTierId(deps.supabase)),
  )
}
