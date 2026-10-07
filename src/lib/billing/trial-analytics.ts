import type Stripe from "stripe"
import type { BillingInterval } from "./types"

export type TrialStartedAnalytics = {
  enrollmentId: string
  authorizationSucceededAt: string
  trialEndAt: string
  interval: BillingInterval
  currency: "EUR"
  value: 0
}

type TrialActivationResult = {
  trialEnrollmentId?: string
  authorizationSucceededAt?: string
  trialEndAt?: string
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value))
}

export function isTrialAnalyticsCandidate(input: {
  activation: TrialActivationResult
  session: Pick<Stripe.Checkout.Session, "metadata">
}) {
  return (
    Boolean(input.activation.trialEnrollmentId) ||
    Object.keys(input.session.metadata ?? {}).some((key) => key.startsWith("trial_"))
  )
}

/**
 * Checkout metadata identifies a candidate only. A trial event additionally needs the
 * matching admission result returned after provider authorization was verified.
 */
export function resolveTrialStartedAnalytics(input: {
  activation: TrialActivationResult
  interval: BillingInterval | string | undefined
  session: Pick<Stripe.Checkout.Session, "currency" | "metadata">
}): TrialStartedAnalytics | null {
  const { activation, interval, session } = input
  const enrollmentId = activation.trialEnrollmentId
  const authorizationSucceededAt = activation.authorizationSucceededAt
  const trialEndAt = activation.trialEndAt
  if (
    (interval !== "month" && interval !== "year") ||
    !enrollmentId ||
    !isIsoTimestamp(authorizationSucceededAt) ||
    !isIsoTimestamp(trialEndAt) ||
    Date.parse(trialEndAt) - Date.parse(authorizationSucceededAt) !== 7 * 24 * 60 * 60 * 1000 ||
    session.metadata?.trial_cohort !== "trial_v1" ||
    session.metadata.trial_enrollment_id !== enrollmentId ||
    session.currency?.trim().toUpperCase() !== "EUR"
  ) {
    return null
  }

  return {
    enrollmentId,
    authorizationSucceededAt,
    trialEndAt,
    interval,
    currency: "EUR",
    value: 0,
  }
}
