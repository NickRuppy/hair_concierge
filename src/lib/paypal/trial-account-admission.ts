import { randomUUID } from "node:crypto"
import { assertPayPalPaidRecoveryPlan } from "./trial-paid-recovery"
import {
  paypalTrialCollectionStart,
  paypalTrialCollectionWindowEnd,
} from "./trial-collection-start"
import { readTrialEffectiveContract } from "../billing/trial-effective-contract"
import { resolveLegacyQuizFuturePurchaseEligibility } from "../personal-plan/legacy-cutover-eligibility"
import { loadPayPalTrialPlanCatalog } from "./trial-checkout-attempt"
import "server-only"
import { activateTrialAdmission, releaseTrialAdmission } from "../billing/trial-admission"
import {
  createTrialIdentityClaims,
  type TrialIdentityInput,
} from "../billing/trial-identity-claims"
import { parseTrialOfferSnapshot } from "../billing/trial-offer"
import {
  assertCanStartCheckout,
  CheckoutAccessAlreadyExistsError,
  findBillingSubscriptionByProviderId,
  upsertBillingSubscription,
} from "../billing/subscriptions"
import { mirrorBillingSubscriptionToProfile } from "../billing/entitlements"
import { getPayPalAppId, PayPalRequestError } from "./client"
import { cancelPayPalSubscription } from "./subscriptions"
import { assertPlanMatchesAcceptedOffer, type PayPalTrialRuntime } from "./trial-checkout"
import {
  findPayPalTrialCheckoutAttempt,
  payPalTrialCheckoutSchedule,
  pinPayPalTrialActivation,
  confirmPayPalTrialActivation,
  PayPalTrialConfirmationUnavailableError,
  type PayPalTrialCheckoutAttempt,
} from "./trial-checkout-attempt"
import {
  readPayPalTrialRuntime,
  retrievePayPalTrialSubscription,
  patchPayPalTrialStart,
  listPayPalTrialTransactions,
} from "./trial-runtime"
import type { PayPalSubscription } from "./subscription-shapes"
import { markPayPalCheckoutIntentActivated, type PayPalCheckoutIntentRow } from "./checkout-intents"
import {
  CheckoutRecoveryError,
  getPersistedTrialRecoveryCode,
  type CheckoutRecoveryCode,
} from "@/lib/auth/checkout-activation-outcome"
import {
  ensurePayPalTrialAccountIdentity,
  type PayPalCheckoutActivationDeps,
  type PayPalCheckoutAccountResult,
} from "./checkout-activation"

export { getPersistedTrialRecoveryCode } from "@/lib/auth/checkout-activation-outcome"

export type PayPalTrialActivationDeps = PayPalCheckoutActivationDeps & {
  apiConfirmationEnabled?: boolean
  recordBillingAnalytics?: boolean
  assertCheckoutAccess?: typeof assertCanStartCheckout
  paypalTrialRuntime?: PayPalTrialRuntime
  attestPayPalApp?: () => Promise<string>
  patchPayPalTrialStart?: typeof patchPayPalTrialStart
  listPayPalTrialTransactions?: typeof listPayPalTrialTransactions
  cancelPayPalSubscription?: typeof cancelPayPalSubscription
}

export function hasPayPalTrialMarker(intent: Pick<PayPalCheckoutIntentRow, "metadata">) {
  return Object.keys(intent.metadata ?? {}).some((key) => key.startsWith("trial_"))
}

export function assertPayPalTrialBinding(
  intent: PayPalCheckoutIntentRow,
  attempt: PayPalTrialCheckoutAttempt,
  subscription: PayPalSubscription,
) {
  if (
    intent.metadata.trial_cohort !== "trial_v1" ||
    intent.metadata.trial_enrollment_id !== attempt.enrollmentId ||
    subscription.id !== intent.provider_subscription_id ||
    subscription.id !== attempt.providerReference ||
    subscription.custom_id !== intent.token ||
    subscription.plan_id !== attempt.paypalPlanId ||
    intent.metadata.paypal_plan_id !== attempt.paypalPlanId ||
    intent.interval !== attempt.offer.interval
  )
    throw new Error("PayPal trial agreement binding mismatch")
}

export async function pinVerifiedPayPalTrialActivation(
  input: {
    intent: PayPalCheckoutIntentRow
    subscription: PayPalSubscription
    eventId: string
    resource: PayPalSubscription
  },
  deps: PayPalTrialActivationDeps,
) {
  const attempt = await findPayPalTrialCheckoutAttempt(deps.supabase, input.intent.token)
  if (!attempt) throw new Error("PayPal trial attempt missing")
  assertPayPalTrialBinding(input.intent, attempt, input.subscription)
  const resource = input.resource
  if (
    resource.id !== input.subscription.id ||
    resource.custom_id !== input.intent.token ||
    resource.plan_id !== attempt.paypalPlanId
  )
    throw new Error("PayPal original activation evidence unavailable")
  // The original authorization clock is immutable. A delayed, otherwise
  // correctly bound activation event may describe the agreement after PayPal
  // has already canceled it. Recovery still checks the fresh provider status
  // and settled enrollment before acknowledging that callback.
  if (attempt.authorizationSucceededAt) {
    if (
      resource.status === "ACTIVE" ||
      (resource.status === "CANCELLED" && input.subscription.status === "CANCELLED")
    )
      return
  }
  if (
    resource.status !== "ACTIVE" ||
    !resource.status_update_time ||
    !Number.isFinite(Date.parse(resource.status_update_time))
  )
    throw new Error("PayPal original activation evidence unavailable")
  // The RPC decides initial late denial under the proof-selection lock. A
  // stale unproven read here must not cancel a concurrently confirmed trial.
  await pinPayPalTrialActivation(deps.supabase, {
    token: input.intent.token,
    agreementId: input.subscription.id!,
    eventId: input.eventId,
    authorizedAt: resource.status_update_time,
  })
}

export async function ensurePayPalTrialCheckoutAccount(
  intent: PayPalCheckoutIntentRow,
  deps: PayPalTrialActivationDeps,
): Promise<PayPalCheckoutAccountResult> {
  // Accepted callbacks deliberately ignore enrollmentMode during rollback.
  const runtime = deps.paypalTrialRuntime ?? readPayPalTrialRuntime()
  if (!runtime) throw new Error("PayPal trial reconciliation is not configured")
  let attempt = await findPayPalTrialCheckoutAttempt(deps.supabase, intent.token)
  if (!attempt) throw new Error("PayPal trial attempt missing")
  if (
    (await (deps.attestPayPalApp ?? getPayPalAppId)()) !== attempt.paypalAppId ||
    runtime.appId !== attempt.paypalAppId
  )
    throw new Error("PayPal trial app mismatch")
  const retrieve = deps.retrievePayPalSubscription ?? retrievePayPalTrialSubscription
  if (!attempt.providerReference) return { status: "pending" }
  const apiConfirmationEnabled =
    deps.apiConfirmationEnabled ?? process.env.PAYPAL_TRIAL_API_CONFIRMATION_ENABLED === "true"
  let subscription: PayPalSubscription
  try {
    subscription = await retrieve(attempt.providerReference)
  } catch (error) {
    if (
      !attempt.authorizationProofKind &&
      apiConfirmationEnabled &&
      isTemporaryPayPalReadFailure(error)
    )
      return { status: "pending" }
    throw error
  }
  const { data: enrollment, error } = await deps.supabase
    .from("trial_enrollments")
    .select("*")
    .eq("id", attempt.enrollmentId)
    .maybeSingle()
  if (error) throw error
  const offer = parseTrialOfferSnapshot(enrollment?.accepted_offer)
  if (
    !enrollment ||
    !offer ||
    enrollment.provider !== "paypal" ||
    JSON.stringify(offer) !== JSON.stringify(attempt.offer) ||
    enrollment.access_revoked
  )
    throw new Error("PayPal trial enrollment unavailable")
  if (enrollment.admission_status !== "active")
    assertPayPalTrialBindingForRecovery(intent, attempt, subscription)
  if (enrollment.admission_status === "blocked" || enrollment.admission_status === "released") {
    if (enrollment.neutralization_required)
      await neutralizePayPalTrialAgreementForRecovery(intent, attempt, deps)
    return duplicateTrialActivation(
      getPersistedTrialRecoveryCode({ ...enrollment, neutralization_required: false }) ??
        "trial_reconciliation_required",
    )
  }
  if (!attempt.authorizationSucceededAt && apiConfirmationEnabled) {
    attempt = await tryConfirmPayPalTrialActivation(intent, attempt, subscription, enrollment, deps)
  }
  if (!attempt.authorizationSucceededAt) return { status: "pending" }
  const authorizationAt = new Date(attempt.authorizationSucceededAt)
  // The PayPal trial ends on the collection midnight frozen at checkout, never
  // on a moment derived from approval: PayPal computed its billing clock once
  // from that start_time and never recomputes it after a patch.
  const { trialEndAt: frozenTrialEnd, providerStartTime: expectedProviderStart } =
    payPalTrialCheckoutSchedule(attempt)
  // Agreements admitted before the frozen-end contract stored approval + 7 days.
  const legacyTrialEnd = new Date(authorizationAt.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
  if (enrollment.admission_status === "active") {
    const effective = await readTrialEffectiveContract(deps.supabase, enrollment.id)
    if (effective.provider !== "paypal" || !effective.agreementId)
      throw new Error("PayPal effective trial agreement unavailable")
    if (effective.revision === 0 && effective.agreementId === attempt.providerReference)
      assertPayPalTrialBindingForRecovery(intent, attempt, subscription)
    else {
      subscription = await retrieve(effective.agreementId)
      const catalog = await loadPayPalTrialPlanCatalog(deps.supabase, enrollment.id)
      const currentBilling = await findBillingSubscriptionByProviderId(
        deps.supabase,
        "paypal",
        effective.agreementId,
      )
      const paid = subscription.custom_id?.startsWith("trial-paid-recovery:")
        ? await deps.supabase.rpc("find_paypal_trial_paid_recovery_callback", {
            p_agreement_id: subscription.id,
          })
        : null
      if (paid?.error || (paid && paid.data?.status !== "committed"))
        throw new Error("PayPal paid continuation unavailable")
      const planId =
        paid?.data?.targetPlanId ??
        (effective.offer.interval === "month" ? catalog?.monthPlanId : catalog?.yearPlanId)
      if (paid?.data)
        assertPayPalPaidRecoveryPlan(
          subscription.plan ? { ...subscription.plan, status: "ACTIVE" } : null,
          effective.offer,
          paid.data.productId,
          paid.data.kind === "recover_unpaid" ? effective.offer.firstAmountMinor : 0,
        )
      if (
        !catalog ||
        subscription.id !== effective.agreementId ||
        subscription.plan_id !== planId ||
        !currentBilling ||
        currentBilling.user_id !== enrollment.user_id ||
        currentBilling.trial_enrollment_id !== enrollment.id ||
        currentBilling.provider_customer_id !== subscription.subscriber?.payer_id
      )
        throw new Error("PayPal revised trial owner or plan mismatch")
    }
    const storedTrialEnd = Date.parse(enrollment.original_trial_end_at ?? "")
    if (
      !enrollment.user_id ||
      effective.agreementId !== subscription.id ||
      (storedTrialEnd !== Date.parse(frozenTrialEnd) &&
        storedTrialEnd !== Date.parse(legacyTrialEnd))
    )
      throw new Error("PayPal active trial ownership mismatch")
    // Admission may have committed before projection was interrupted. A newer
    // provider cancellation/suspension must not create that missing access now.
    if (
      subscription.status !== "ACTIVE" &&
      !(await findBillingSubscriptionByProviderId(deps.supabase, "paypal", subscription.id!))
    )
      return { status: "pending" }
    const identity = await ensurePayPalTrialAccountIdentity(intent, deps, enrollment.user_id)
    await finishPayPalTrialProjection(intent, attempt, subscription, enrollment, identity, deps)
    await markPayPalCheckoutIntentActivated(deps.supabase, intent.token)
    return {
      ...identity,
      legacyQuizFuturePurchaseEligible: await resolvePayPalTrialCohortEligibility(
        deps,
        identity.userId,
        intent.lead_id,
        authorizationAt,
      ),
      trialEnrollmentId: enrollment.id,
      authorizationSucceededAt: authorizationAt.toISOString(),
      trialEndAt: new Date(storedTrialEnd).toISOString(),
    }
  }
  const trialEnd = frozenTrialEnd
  if (enrollment.admission_status !== "reserved")
    throw new Error("PayPal trial admission state unavailable")
  if (subscription.status !== "ACTIVE") return { status: "pending" }
  if (!subscription.subscriber?.payer_id) throw new Error("PayPal authorized payer missing")
  // Effective subscription plan includes frozen price overrides; never use today's catalog for accepted terms.
  assertPlanMatchesAcceptedOffer(
    subscription.plan ? { ...subscription.plan, status: "ACTIVE" } : null,
    { offer, productId: attempt.paypalProductId! },
  )
  const providerStart = Date.parse(subscription.start_time ?? "")
  if (
    Date.parse(trialEnd) <= Date.now() ||
    providerStart <= Date.now() ||
    // Late approval: the frozen end no longer covers the promised 7 × 24h.
    Date.parse(legacyTrialEnd) > Date.parse(trialEnd)
  ) {
    await blockPayPalTrialAgreement(intent, attempt, deps)
    return duplicateTrialActivation("trial_checkout_closed")
  }
  if (providerStart !== Date.parse(expectedProviderStart)) {
    // Agreements created before the frozen-end contract carry the retired
    // provisional start (freeze + 7 days, echoed in whole seconds). Close them
    // so the customer retries with a fresh checkout instead of activating a
    // trial whose provider billing clock cannot be verified. Anything else is
    // not the agreement this checkout requested: fail closed for reconciliation.
    const retiredProvisionalStart =
      Math.floor((Date.parse(attempt.requestExpiresAt ?? "") + 4 * 24 * 60 * 60 * 1000) / 1000) *
      1000
    if (!attempt.providerStartTime && Math.abs(providerStart - retiredProvisionalStart) < 1000) {
      await blockPayPalTrialAgreement(intent, attempt, deps)
      return duplicateTrialActivation("trial_checkout_closed")
    }
    throw new CheckoutRecoveryError("trial_reconciliation_required", {
      cause: new Error(
        `PayPal trial start is not the frozen provider request (start=${subscription.start_time ?? "missing"} expected=${expectedProviderStart})`,
      ),
    })
  }
  // A requested/echoed start does not prove when PayPal will collect. Verify
  // the reported batch independently, never before the promised trial end.
  const nextBillingAt = Date.parse(subscription.billing_info?.next_billing_time ?? "")
  if (
    subscription.status !== "ACTIVE" ||
    !(nextBillingAt >= Date.parse(trialEnd)) ||
    !(
      nextBillingAt <
      Date.parse(paypalTrialCollectionWindowEnd(paypalTrialCollectionStart(trialEnd)))
    )
  )
    throw new CheckoutRecoveryError("trial_reconciliation_required", {
      // Timestamps and status only — no payer data.
      cause: new Error(
        `PayPal trial billing deadline is not verified (status=${subscription.status ?? "missing"} start=${subscription.start_time ?? "missing"} nextBilling=${subscription.billing_info?.next_billing_time ?? "missing"} trialEnd=${trialEnd})`,
      ),
    })
  const identity = await ensurePayPalTrialAccountIdentity(intent, deps, enrollment.user_id)
  try {
    await (deps.assertCheckoutAccess ?? assertCanStartCheckout)(deps.supabase, identity.userId)
  } catch (error) {
    if (!(error instanceof CheckoutAccessAlreadyExistsError)) throw error
    const own = await findBillingSubscriptionByProviderId(deps.supabase, "paypal", subscription.id!)
    if (!own || own.user_id !== identity.userId || own.trial_enrollment_id !== enrollment.id) {
      await blockPayPalTrialAgreement(intent, attempt, deps, "existing_access")
      return duplicateTrialActivation("checkout_existing_access")
    }
  }
  if (enrollment.user_id && enrollment.user_id !== identity.userId)
    throw new Error("PayPal trial owner mismatch")
  if (!enrollment.user_id) {
    const result = await deps.supabase
      .from("trial_enrollments")
      .update({ user_id: identity.userId })
      .eq("id", enrollment.id)
      .is("user_id", null)
      .eq("admission_status", "reserved")
      .select("user_id")
      .maybeSingle()
    if (result.error) throw result.error
    if (!result.data) {
      const winner = await deps.supabase
        .from("trial_enrollments")
        .select("user_id")
        .eq("id", enrollment.id)
        .maybeSingle()
      if (winner.error || winner.data?.user_id !== identity.userId)
        throw new Error("PayPal trial owner changed")
    }
  }
  const identities: TrialIdentityInput[] = [
    { kind: "account", namespace: "chaarlie", normalizedIdentity: identity.userId },
    {
      kind: "paypal_payer",
      namespace: `${runtime.appId}:${runtime.trial.livemode ? "live" : "test"}`,
      normalizedIdentity: subscription.subscriber!.payer_id!,
    },
  ]
  const authOwner = await deps.supabase.auth.admin.getUserById(identity.userId)
  if (authOwner.error) throw authOwner.error
  if (
    authOwner.data.user?.email_confirmed_at &&
    authOwner.data.user.email?.trim().toLowerCase() === identity.email
  ) {
    identities.push({
      kind: "verified_email",
      namespace: "chaarlie",
      normalizedIdentity: identity.email,
    })
  }
  const admitted = await activateTrialAdmission(deps.supabase, {
    enrollmentId: enrollment.id,
    providerAgreementId: subscription.id!,
    authorizationSucceededAt: authorizationAt,
    originalTrialEndAt: new Date(trialEnd),
    claims: createTrialIdentityClaims(identities, runtime.trial.identityKeys),
  })
  if (admitted !== "active") {
    if (admitted === "trial_used" || admitted === "claim_reserved") {
      await neutralizePayPalTrialAgreementForRecovery(intent, attempt, deps)
      return duplicateTrialActivation(
        admitted === "trial_used" ? "trial_unavailable" : "trial_checkout_conflict",
      )
    }
    throw new CheckoutRecoveryError("trial_reconciliation_required", {
      cause: new Error(`PayPal trial admission result unavailable: ${admitted}`),
    })
  }
  await finishPayPalTrialProjection(
    intent,
    attempt,
    subscription,
    { ...enrollment, user_id: identity.userId, original_trial_end_at: trialEnd },
    identity,
    deps,
  )
  await markPayPalCheckoutIntentActivated(deps.supabase, intent.token)
  return {
    ...identity,
    legacyQuizFuturePurchaseEligible: await resolvePayPalTrialCohortEligibility(
      deps,
      identity.userId,
      intent.lead_id,
      authorizationAt,
    ),
    providerSubscriberEmail: subscription.subscriber?.email_address ?? null,
    trialEnrollmentId: enrollment.id,
    authorizationSucceededAt: authorizationAt.toISOString(),
    trialEndAt: trialEnd,
  }
}

function isTemporaryPayPalReadFailure(error: unknown) {
  return (
    (error instanceof PayPalRequestError &&
      (error.status === null || error.status === 429 || error.status >= 500)) ||
    (error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name))
  )
}

/** Validate the fresh server response before asking SQL to atomically select proof.
 * SQL repeats time/state checks at commit; its returned clock always wins.
 */
async function tryConfirmPayPalTrialActivation(
  intent: PayPalCheckoutIntentRow,
  attempt: PayPalTrialCheckoutAttempt,
  subscription: PayPalSubscription,
  enrollment: Record<string, unknown>,
  deps: PayPalTrialActivationDeps,
): Promise<PayPalTrialCheckoutAttempt> {
  if (
    attempt.requestId !== `paypal-trial:${attempt.id}:v2` ||
    attempt.status !== "provider_created" ||
    enrollment.admission_status !== "reserved" ||
    enrollment.neutralization_required ||
    subscription.status !== "ACTIVE"
  )
    return attempt
  const now = Date.now()
  if (!(Date.parse(intent.expires_at) > now) || !(Date.parse(attempt.requestExpiresAt ?? "") > now))
    return attempt
  const effective = await readTrialEffectiveContract(deps.supabase, attempt.enrollmentId)
  if (effective.revision !== 0) return attempt
  const catalog = await loadPayPalTrialPlanCatalog(deps.supabase, attempt.enrollmentId)
  const intentOffer = parseTrialOfferSnapshot(intent.metadata.accepted_offer)
  if (
    attempt.intentToken !== intent.token ||
    enrollment.id !== attempt.enrollmentId ||
    !intentOffer ||
    JSON.stringify(intentOffer) !== JSON.stringify(attempt.offer) ||
    intent.metadata.paypal_app_id !== attempt.paypalAppId ||
    intent.metadata.paypal_product_id !== attempt.paypalProductId ||
    intent.metadata.paypal_request_id !== attempt.requestId ||
    (attempt.scope.kind === "user"
      ? intent.user_id !== attempt.scope.id || enrollment.user_id !== attempt.scope.id
      : intent.lead_id !== attempt.scope.id) ||
    (intent.user_id && enrollment.user_id && intent.user_id !== enrollment.user_id) ||
    effective.provider !== "paypal" ||
    (effective.agreementId !== null && effective.agreementId !== subscription.id) ||
    JSON.stringify(effective.offer) !== JSON.stringify(attempt.offer) ||
    !catalog ||
    catalog.enrollmentId !== attempt.enrollmentId ||
    catalog.appId !== attempt.paypalAppId ||
    catalog.productId !== attempt.paypalProductId ||
    (attempt.offer.interval === "month" ? catalog.monthPlanId : catalog.yearPlanId) !==
      attempt.paypalPlanId
  )
    throw new Error("PayPal trial API confirmation binding mismatch")
  assertPayPalTrialBinding(intent, attempt, subscription)
  if (!subscription.subscriber?.payer_id?.trim()) throw new Error("PayPal authorized payer missing")
  assertPlanMatchesAcceptedOffer(
    subscription.plan ? { ...subscription.plan, status: "ACTIVE" } : null,
    { offer: attempt.offer, productId: attempt.paypalProductId! },
  )
  const { trialEndAt, providerStartTime } = payPalTrialCheckoutSchedule(attempt)
  const nextBilling = Date.parse(subscription.billing_info?.next_billing_time ?? "")
  if (
    Date.parse(subscription.start_time ?? "") !== Date.parse(providerStartTime) ||
    !(nextBilling >= Date.parse(trialEndAt)) ||
    !(
      nextBilling <
      Date.parse(paypalTrialCollectionWindowEnd(paypalTrialCollectionStart(trialEndAt)))
    )
  )
    throw new CheckoutRecoveryError("trial_reconciliation_required", {
      cause: new Error("PayPal trial API confirmation schedule mismatch"),
    })
  // A conservative observation can be too late even though the original event
  // proves timely authorization. Leave that agreement for the webhook to settle.
  const remaining = Date.parse(trialEndAt) - now
  if (remaining < 7 * 86400000 || remaining > 10 * 86400000) return attempt
  try {
    const winner = await confirmPayPalTrialActivation(deps.supabase, {
      token: intent.token,
      agreementId: subscription.id!,
      confirmationId: randomUUID(),
      appId: attempt.paypalAppId!,
      planId: attempt.paypalPlanId!,
      providerStartTime: subscription.start_time!,
      nextBillingTime: subscription.billing_info!.next_billing_time!,
    })
    // Even a successful RPC cannot substitute a different immutable attempt.
    if (
      winner.id !== attempt.id ||
      winner.enrollmentId !== attempt.enrollmentId ||
      winner.intentToken !== attempt.intentToken ||
      winner.requestId !== attempt.requestId ||
      winner.paypalAppId !== attempt.paypalAppId ||
      winner.paypalProductId !== attempt.paypalProductId ||
      winner.paypalPlanId !== attempt.paypalPlanId ||
      winner.providerStartTime !== attempt.providerStartTime ||
      winner.trialEndAt !== attempt.trialEndAt ||
      JSON.stringify(winner.offer) !== JSON.stringify(attempt.offer)
    )
      throw new Error("PayPal trial API proof winner binding mismatch")
    assertPayPalTrialBinding(intent, winner, subscription)
    return winner
  } catch (error) {
    if (error instanceof PayPalTrialConfirmationUnavailableError) return attempt
    throw error
  }
}

// A trial has no payment yet; its verified authorization time is the cohort
// timestamp that decides the first-time destination cutover. Runs after
// finishPayPalTrialProjection so the lead is already linked to the account.
function resolvePayPalTrialCohortEligibility(
  deps: { supabase: Parameters<typeof resolveLegacyQuizFuturePurchaseEligibility>[0] },
  userId: string,
  leadId: string | null,
  authorizationAt: Date,
): Promise<boolean> {
  return resolveLegacyQuizFuturePurchaseEligibility(deps.supabase, {
    userId,
    leadId,
    paidAt: authorizationAt.toISOString(),
    provider: "paypal",
  })
}

function duplicateTrialActivation(
  recoveryCode: CheckoutRecoveryCode,
): Extract<PayPalCheckoutAccountResult, { status: "duplicate" }> {
  return { status: "duplicate", recoveryCode }
}

function assertPayPalTrialBindingForRecovery(
  intent: PayPalCheckoutIntentRow,
  attempt: PayPalTrialCheckoutAttempt,
  subscription: PayPalSubscription,
) {
  try {
    assertPayPalTrialBinding(intent, attempt, subscription)
  } catch (cause) {
    throw new CheckoutRecoveryError("trial_reconciliation_required", { cause })
  }
}

async function blockPayPalTrialAgreement(
  intent: PayPalCheckoutIntentRow,
  attempt: PayPalTrialCheckoutAttempt,
  deps: PayPalTrialActivationDeps,
  recoveryReason?: "existing_access",
) {
  try {
    const billing = await findBillingSubscriptionByProviderId(
      deps.supabase,
      "paypal",
      attempt.providerReference!,
    )
    if (billing) throw new Error("PayPal trial billing exists before denial")
    const result = await deps.supabase
      .from("trial_enrollments")
      .update({
        admission_status: "blocked",
        provider_agreement_id: attempt.providerReference,
        ...(recoveryReason ? { admission_recovery_reason: recoveryReason } : {}),
        neutralization_required: true,
      })
      .eq("id", attempt.enrollmentId)
      .eq("admission_status", "reserved")
      .select("id")
      .maybeSingle()
    if (result.error || !result.data) throw new Error("PayPal trial denial reconciliation required")
    await neutralizePayPalTrialAgreementForRecovery(intent, attempt, deps)
  } catch (cause) {
    if (cause instanceof CheckoutRecoveryError) throw cause
    throw new CheckoutRecoveryError("trial_reconciliation_required", { cause })
  }
}

async function neutralizePayPalTrialAgreement(
  intent: PayPalCheckoutIntentRow,
  attempt: PayPalTrialCheckoutAttempt,
  deps: PayPalTrialActivationDeps,
) {
  const retrieve = deps.retrievePayPalSubscription ?? retrievePayPalTrialSubscription
  let subscription = await retrieve(attempt.providerReference!)
  assertPayPalTrialBinding(intent, attempt, subscription)
  if (subscription.status !== "CANCELLED") {
    await (deps.cancelPayPalSubscription ?? cancelPayPalSubscription)(
      subscription.id!,
      "Trial eligibility denied; do not collect payment",
    )
    subscription = await retrieve(subscription.id!)
  }
  assertPayPalTrialBinding(intent, attempt, subscription)
  if (subscription.status !== "CANCELLED")
    throw new Error("PayPal trial cancellation reconciliation required")
  const transactions = await (deps.listPayPalTrialTransactions ?? listPayPalTrialTransactions)(
    subscription.id!,
    intent.created_at,
    new Date().toISOString(),
  )
  if (transactions.length) throw new Error("PayPal trial transaction reconciliation required")
  if (
    !(await releaseTrialAdmission(
      deps.supabase,
      attempt.enrollmentId,
      `paypal:canceled:${subscription.id}`,
    ))
  )
    throw new Error("PayPal trial claim release reconciliation required")
}

async function neutralizePayPalTrialAgreementForRecovery(
  intent: PayPalCheckoutIntentRow,
  attempt: PayPalTrialCheckoutAttempt,
  deps: PayPalTrialActivationDeps,
) {
  try {
    await neutralizePayPalTrialAgreement(intent, attempt, deps)
  } catch (cause) {
    throw new CheckoutRecoveryError("trial_reconciliation_required", { cause })
  }
}

async function finishPayPalTrialProjection(
  intent: PayPalCheckoutIntentRow,
  attempt: PayPalTrialCheckoutAttempt,
  subscription: PayPalSubscription,
  enrollment: {
    id: string
    user_id: string
    original_trial_end_at: string
    paid_through_at?: string | null
    cancel_at_period_end?: boolean
  },
  identity: Extract<PayPalCheckoutAccountResult, { status: "active" }>,
  deps: PayPalTrialActivationDeps,
) {
  let billing = await findBillingSubscriptionByProviderId(deps.supabase, "paypal", subscription.id!)
  if (
    billing &&
    (billing.user_id !== enrollment.user_id || billing.trial_enrollment_id !== enrollment.id)
  )
    throw new Error("PayPal trial billing owner mismatch")
  if (!billing)
    billing = await upsertBillingSubscription(deps.supabase, {
      user_id: identity.userId,
      provider: "paypal",
      provider_customer_id: subscription.subscriber?.payer_id ?? null,
      provider_subscriber_email: subscription.subscriber?.email_address,
      provider_subscription_id: subscription.id!,
      provider_status: subscription.status ?? "ACTIVE",
      entitlement_status: "active",
      interval: attempt.offer.interval,
      current_period_end: enrollment.paid_through_at ?? enrollment.original_trial_end_at,
      cancel_at_period_end: enrollment.cancel_at_period_end ?? false,
      trial_enrollment_id: enrollment.id,
      metadata: {
        trial_cohort: "trial_v1",
        trial_offer_version: attempt.offer.offerVersion,
        paypal_plan_id: attempt.paypalPlanId,
        plan_id: attempt.paypalPlanId,
      },
    })
  await mirrorBillingSubscriptionToProfile(deps.supabase, billing, deps.premiumTierId)
  if (deps.linkQuizToProfile && intent.lead_id)
    await deps.linkQuizToProfile(identity.userId, identity.email, intent.lead_id)
}
