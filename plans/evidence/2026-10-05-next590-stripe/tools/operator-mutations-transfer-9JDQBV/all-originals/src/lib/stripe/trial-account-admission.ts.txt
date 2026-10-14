import "server-only"

import { readTrialRuntime } from "../billing/trial-runtime"
import type Stripe from "stripe"
import type { SupabaseClient } from "@supabase/supabase-js"
import { activateTrialAdmission, releaseTrialAdmission } from "../billing/trial-admission"
import {
  createTrialIdentityClaims,
  type TrialIdentityClaimKey,
} from "../billing/trial-identity-claims"
import { parseTrialOfferSnapshot } from "../billing/trial-offer"
import { retrieveStripeTrialAuthorizationEvidence } from "./trial-authorization"
import {
  CheckoutRecoveryError,
  getPersistedTrialRecoveryCode,
} from "../auth/checkout-activation-outcome"

/** Server-owned configuration. Provision only after the real-processing release checks. */
export type StripeTrialRuntime = {
  stripeAccountId: string
  livemode: boolean
  identityKeys: readonly TrialIdentityClaimKey[]
}

type Deps = { supabase: SupabaseClient; stripe: Stripe; trialRuntime?: StripeTrialRuntime }

export function hasStripeTrialMarker(session: Pick<Stripe.Checkout.Session, "metadata">): boolean {
  return Object.keys(session.metadata ?? {}).some((key) => key.startsWith("trial_"))
}

export async function prepareStripeTrialAccountAdmission(
  sessionId: string,
  enrollmentId: string | undefined,
  deps: Deps,
  now: Date,
) {
  // Rollback disables new checkout creation, never reconciliation of accepted terms.
  const runtime = deps.trialRuntime ?? readTrialRuntime()
  if (
    !runtime ||
    !/^acct_\w+$/.test(runtime.stripeAccountId) ||
    typeof runtime.livemode !== "boolean"
  ) {
    throw new Error("Stripe trial activation is not configured")
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(enrollmentId ?? "")) {
    throw new Error("Invalid Stripe trial enrollment")
  }
  const { data: enrollment, error } = await deps.supabase
    .from("trial_enrollments")
    .select(
      "id,user_id,provider,accepted_offer,admission_status,admission_denial_reason,admission_recovery_reason,provider_agreement_id,access_revoked,neutralization_required",
    )
    .eq("id", enrollmentId!)
    .maybeSingle()
  if (error) throw error
  const offer = parseTrialOfferSnapshot(enrollment?.accepted_offer)
  if (
    !enrollment ||
    !offer ||
    enrollment.provider !== "stripe" ||
    enrollment.access_revoked !== false ||
    !["reserved", "active", "blocked", "released"].includes(enrollment.admission_status)
  ) {
    throw new Error("Stripe trial enrollment is unavailable")
  }
  const account = await deps.stripe.accounts.retrieve(null)
  if (account.id !== runtime.stripeAccountId) throw new Error("Stripe trial account mismatch")
  if (["blocked", "released"].includes(enrollment.admission_status)) {
    let neutralizationSettled = enrollment.neutralization_required === false
    if (enrollment.neutralization_required && enrollment.provider_agreement_id) {
      // The original denial persisted the verified agreement before cancellation.
      // A lost response must reconcile that agreement without requiring it to
      // become trialing again or creating another account.
      try {
        await neutralizeStripeTrialAgreement(
          deps,
          enrollment.id,
          enrollment.provider_agreement_id,
          runtime.livemode,
        )
      } catch (cause) {
        throw new CheckoutRecoveryError("trial_reconciliation_required", { cause })
      }
      neutralizationSettled = true
    }
    throw new CheckoutRecoveryError(
      getPersistedTrialRecoveryCode({
        ...enrollment,
        neutralization_required: neutralizationSettled ? false : enrollment.neutralization_required,
      }) ?? "trial_checkout_closed",
    )
  }
  if (enrollment.user_id === null && enrollment.admission_status !== "reserved") {
    throw new Error("Stripe trial owner is unavailable")
  }
  const proof = await retrieveStripeTrialAuthorizationEvidence(
    deps.stripe,
    sessionId,
    { enrollmentId: enrollment.id, offer },
    now,
    runtime.livemode,
  )
  if (
    !proof ||
    (enrollment.provider_agreement_id &&
      enrollment.provider_agreement_id !== proof.authorization.providerAgreementId)
  ) {
    throw new CheckoutRecoveryError("trial_reconciliation_required", {
      cause: new Error(
        !proof
          ? "Stripe trial authorization is not verified"
          : "Stripe trial authorization agreement does not match enrollment",
      ),
    })
  }
  // Validate keys before creating an account or persisting any admission claim.
  const cardClaims = createTrialIdentityClaims(
    [
      {
        kind: "stripe_card",
        namespace: `${runtime.stripeAccountId}:${runtime.livemode ? "live" : "test"}`,
        normalizedIdentity: proof.authorization.cardFingerprint,
      },
    ],
    runtime.identityKeys,
  )
  return { ...proof, enrollment, offer, runtime, cardClaims }
}

export type PreparedStripeTrialAdmission = Awaited<
  ReturnType<typeof prepareStripeTrialAccountAdmission>
>

export async function rejectStripeTrialForExistingAccess(
  prepared: PreparedStripeTrialAdmission,
  deps: Deps,
) {
  const { data, error } = await deps.supabase
    .from("trial_enrollments")
    .update({
      admission_status: "blocked",
      provider_agreement_id: prepared.authorization.providerAgreementId,
      admission_recovery_reason: "existing_access",
      neutralization_required: true,
    })
    .eq("id", prepared.enrollment.id)
    .eq("admission_status", "reserved")
    .select("id")
    .maybeSingle()
  if (error) throw error
  if (!data) throw new CheckoutRecoveryError("trial_reconciliation_required")
  try {
    await neutralizeStripeTrialAgreement(
      deps,
      prepared.enrollment.id,
      prepared.authorization.providerAgreementId,
      prepared.runtime.livemode,
    )
  } catch (cause) {
    throw new CheckoutRecoveryError("trial_reconciliation_required", { cause })
  }
}

async function neutralizeStripeTrialAgreement(
  deps: Deps,
  enrollmentId: string,
  agreementId: string,
  livemode: boolean,
) {
  const subscription = await deps.stripe.subscriptions.retrieve(agreementId)
  if (
    subscription.id !== agreementId ||
    subscription.livemode !== livemode ||
    subscription.metadata?.trial_cohort !== "trial_v1" ||
    subscription.metadata.trial_enrollment_id !== enrollmentId ||
    !["trialing", "canceled"].includes(subscription.status)
  ) {
    throw new Error("Stripe trial collection reconciliation required")
  }
  if (subscription.status !== "canceled") {
    const canceled = await deps.stripe.subscriptions.cancel(agreementId, {
      invoice_now: false,
      prorate: false,
    })
    if (canceled.id !== agreementId || canceled.status !== "canceled")
      throw new Error("Stripe trial cancellation reconciliation required")
  }
  // A successful or still-collectible payment must be reconciled, never silently
  // discarded just because cancellation returned success. Fail on pagination.
  const invoices = await deps.stripe.invoices.list({ subscription: agreementId, limit: 100 })
  if (
    invoices.has_more !== false ||
    !Array.isArray(invoices.data) ||
    invoices.data.some(
      (invoice) =>
        invoice.amount_paid !== 0 ||
        invoice.amount_remaining !== 0 ||
        !["paid", "void"].includes(invoice.status ?? ""),
    )
  ) {
    throw new Error("Stripe trial collection reconciliation required")
  }
  if (
    !(await releaseTrialAdmission(deps.supabase, enrollmentId, `stripe:canceled:${agreementId}`))
  ) {
    throw new Error("Stripe trial claim release reconciliation required")
  }
}

export async function admitStripeTrialAccount(
  prepared: PreparedStripeTrialAdmission,
  userId: string,
  deps: Deps,
) {
  const { enrollment, authorization, runtime, cardClaims } = prepared
  if (enrollment.user_id !== null && enrollment.user_id !== userId)
    throw new Error("Stripe trial owner mismatch")
  if (enrollment.user_id === null) {
    // A deleted active account cannot reclaim its historical enrollment. For a
    // new attempt the first verified account wins the compare-and-set.
    if (enrollment.admission_status !== "reserved")
      throw new Error("Stripe trial owner is unavailable")
    const { data, error } = await deps.supabase
      .from("trial_enrollments")
      .update({ user_id: userId })
      .eq("id", enrollment.id)
      .is("user_id", null)
      .eq("admission_status", "reserved")
      .select("user_id")
      .maybeSingle()
    if (error) throw error
    if (!data) {
      const { data: winner, error: readError } = await deps.supabase
        .from("trial_enrollments")
        .select("user_id")
        .eq("id", enrollment.id)
        .maybeSingle()
      if (readError) throw readError
      if (winner?.user_id !== userId) throw new Error("Stripe trial owner changed")
    }
  }
  const claims = [
    ...cardClaims,
    ...createTrialIdentityClaims(
      [{ kind: "account", namespace: "chaarlie", normalizedIdentity: userId }],
      runtime.identityKeys,
    ),
  ]
  const result = await activateTrialAdmission(deps.supabase, {
    enrollmentId: enrollment.id,
    claims,
    providerAgreementId: authorization.providerAgreementId,
    authorizationSucceededAt: new Date(authorization.authorizationSucceededAt),
  })
  if (result !== "active") {
    // Only a fully verified, denied free agreement is neutralized. API failures
    // propagate; no claim release or fallback paid checkout follows a timeout.
    if (result === "trial_used" || result === "claim_reserved") {
      try {
        await neutralizeStripeTrialAgreement(
          deps,
          enrollment.id,
          authorization.providerAgreementId,
          runtime.livemode,
        )
      } catch (cause) {
        throw new CheckoutRecoveryError("trial_reconciliation_required", { cause })
      }
      throw new CheckoutRecoveryError(
        result === "trial_used" ? "trial_unavailable" : "trial_checkout_conflict",
      )
    }
    throw new CheckoutRecoveryError("trial_reconciliation_required", {
      cause: new Error(`Unexpected Stripe trial admission result: ${result}`),
    })
  }
}
