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
import { getPayPalAppId } from "./client"
import { cancelPayPalSubscription } from "./subscriptions"
import { assertPlanMatchesAcceptedOffer, type PayPalTrialRuntime } from "./trial-checkout"
import {
  findPayPalTrialCheckoutAttempt,
  pinPayPalTrialActivation,
  provisionalPayPalTrialStart,
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
    resource.status !== "ACTIVE" ||
    resource.custom_id !== input.intent.token ||
    resource.plan_id !== attempt.paypalPlanId ||
    !resource.status_update_time ||
    !Number.isFinite(Date.parse(resource.status_update_time))
  )
    throw new Error("PayPal original activation evidence unavailable")
  if (Date.parse(resource.status_update_time) > Date.parse(input.intent.expires_at)) {
    await blockPayPalTrialAgreement(input.intent, attempt, deps)
    return
  }
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
  const attempt = await findPayPalTrialCheckoutAttempt(deps.supabase, intent.token)
  if (!attempt) throw new Error("PayPal trial attempt missing")
  if (
    (await (deps.attestPayPalApp ?? getPayPalAppId)()) !== attempt.paypalAppId ||
    runtime.appId !== attempt.paypalAppId
  )
    throw new Error("PayPal trial app mismatch")
  const retrieve = deps.retrievePayPalSubscription ?? retrievePayPalTrialSubscription
  if (!attempt.providerReference) return { status: "pending" }
  let subscription = await retrieve(attempt.providerReference)
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
  if (!attempt.authorizationSucceededAt) return { status: "pending" }
  const authorizationAt = new Date(attempt.authorizationSucceededAt)
  const trialEnd = new Date(authorizationAt.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
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
    if (
      !enrollment.user_id ||
      effective.agreementId !== subscription.id ||
      Date.parse(enrollment.original_trial_end_at) !== Date.parse(trialEnd)
    )
      throw new Error("PayPal active trial ownership mismatch")
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
      trialEndAt: trialEnd,
    }
  }
  if (enrollment.admission_status !== "reserved")
    throw new Error("PayPal trial admission state unavailable")
  if (subscription.status !== "ACTIVE") return { status: "pending" }
  if (!subscription.subscriber?.payer_id) throw new Error("PayPal authorized payer missing")
  // Effective subscription plan includes frozen price overrides; never use today's catalog for accepted terms.
  assertPlanMatchesAcceptedOffer(
    subscription.plan ? { ...subscription.plan, status: "ACTIVE" } : null,
    { offer, productId: attempt.paypalProductId! },
  )
  if (
    Date.parse(trialEnd) <= Date.now() ||
    Date.parse(subscription.start_time ?? "") <= Date.now()
  ) {
    await blockPayPalTrialAgreement(intent, attempt, deps)
    return duplicateTrialActivation("trial_checkout_closed")
  }
  // First collection happens on the day after the verified trial end: PayPal
  // bills in a daily batch keyed to the UTC date of start_time and cannot
  // promise a second-exact charge moment, so the schedule is verified at the
  // batch's own granularity — never inside the trial.
  const collectionStart = paypalTrialCollectionStart(trialEnd)
  if (Date.parse(subscription.start_time ?? "") !== Date.parse(collectionStart)) {
    // PayPal echoes start_time in whole seconds; a sub-second delta against the
    // frozen provisional start is provider rounding, not a mismatched agreement.
    const provisionalDeltaMs = Math.abs(
      Date.parse(subscription.start_time ?? "") - Date.parse(provisionalPayPalTrialStart(attempt)),
    )
    // Agreements patched before day-after collection carry the second-exact
    // trial end as start_time; they re-patch to the collection start.
    const legacyPatchedStart = Date.parse(subscription.start_time ?? "") === Date.parse(trialEnd)
    if (!(provisionalDeltaMs < 1000) && !legacyPatchedStart)
      throw new CheckoutRecoveryError("trial_reconciliation_required", {
        cause: new Error("PayPal provisional trial start mismatch"),
      })
    try {
      await (deps.patchPayPalTrialStart ?? patchPayPalTrialStart)(subscription.id!, collectionStart)
    } catch {
      // A timeout can mean the patch succeeded. Re-read before deciding whether to retry.
      subscription = await retrieve(subscription.id!)
      assertPayPalTrialBindingForRecovery(intent, attempt, subscription)
      if (Date.parse(subscription.start_time ?? "") !== Date.parse(collectionStart)) {
        await blockPayPalTrialAgreement(intent, attempt, deps)
        return duplicateTrialActivation("trial_checkout_closed")
      }
    }
    subscription = await retrieve(subscription.id!)
  }
  assertPayPalTrialBindingForRecovery(intent, attempt, subscription)
  const nextBillingAt = Date.parse(subscription.billing_info?.next_billing_time ?? "")
  if (
    subscription.status !== "ACTIVE" ||
    Date.parse(subscription.start_time ?? "") !== Date.parse(collectionStart) ||
    !(nextBillingAt > Date.parse(trialEnd)) ||
    !(nextBillingAt < Date.parse(paypalTrialCollectionWindowEnd(collectionStart)))
  )
    throw new CheckoutRecoveryError("trial_reconciliation_required", {
      // Timestamps and status only — no payer data. Needed to see what the
      // provider actually stored after the post-approval start_time patch.
      cause: new Error(
        `PayPal trial billing deadline is not verified (status=${subscription.status ?? "missing"} start=${subscription.start_time ?? "missing"} nextBilling=${subscription.billing_info?.next_billing_time ?? "missing"} expectedStart=${collectionStart} trialEnd=${trialEnd})`,
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
