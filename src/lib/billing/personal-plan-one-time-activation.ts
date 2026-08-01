import { createHash } from "node:crypto"

import {
  BILLING_ANALYTICS_EXTERNAL_DESTINATIONS,
  recordBillingAnalyticsEvent,
} from "./analytics-outbox"
import {
  bindPersonalPlanOneTimePurchaseUser,
  findPersonalPlanOneTimeConsentById,
  recordPersonalPlanOneTimeConfirmation,
  recordPersonalPlanOneTimeDeliveryEvidence,
  type PersonalPlanOneTimeCheckoutConsentRow,
} from "./personal-plan-one-time-consents"
import {
  findOneTimePurchaseByConsentId,
  findOneTimePurchaseByProviderTransactionId,
  resolveOneTimePurchaseAccessState,
  upsertOneTimePurchase,
} from "./purchases"
import type {
  BillingOneTimePurchaseRow,
  BillingProvider,
  OneTimeAccessState,
  PersonalPlanOneTimeFulfillmentJobRow,
  SupabaseBillingAnalyticsClient,
} from "./types"
import {
  sendPersonalPlanOneTimeConfirmation,
  type PersonalPlanOneTimeConfirmationSendResult,
} from "@/lib/customerio/personal-plan-one-time-confirmation"
import { isBillingFunnelDeliveryEnabled, isFunnelAttributionEnabled } from "@/lib/funnel/flags"

export type VerifiedOneTimePayment = {
  provider: BillingProvider
  providerTransactionId: string
  providerOrderId: string
  providerCustomerId?: string | null
  consentId: string
  email: string
  amountMinor: 2999
  currency: "eur"
  paidAt: string
  providerEvidence?: Record<string, unknown>
}

export type OneTimeActivationAccount = {
  userId: string
}

export type OneTimeActivationResult = {
  state: OneTimeAccessState
  purchase: BillingOneTimePurchaseRow
  consent: PersonalPlanOneTimeCheckoutConsentRow
  job: PersonalPlanOneTimeFulfillmentJobRow | null
}

export type OneTimeActivationDependencies = {
  supabase: SupabaseBillingAnalyticsClient
  ensureAccount: (
    payment: VerifiedOneTimePayment,
    context: {
      consent: PersonalPlanOneTimeCheckoutConsentRow
      purchase: BillingOneTimePurchaseRow
    },
  ) => Promise<OneTimeActivationAccount>
  linkQuizToProfile?: (context: {
    payment: VerifiedOneTimePayment
    consent: PersonalPlanOneTimeCheckoutConsentRow
    purchase: BillingOneTimePurchaseRow
    userId: string
  }) => Promise<void>
  postPurchasePersisted?: (context: {
    payment: VerifiedOneTimePayment
    consent: PersonalPlanOneTimeCheckoutConsentRow
    purchase: BillingOneTimePurchaseRow
  }) => Promise<PersonalPlanOneTimeCheckoutConsentRow | void>
  sendConfirmation?: (
    input: Parameters<typeof sendPersonalPlanOneTimeConfirmation>[0],
  ) => Promise<PersonalPlanOneTimeConfirmationSendResult>
  finalizeLockedPlan?: (context: {
    payment: VerifiedOneTimePayment
    consent: PersonalPlanOneTimeCheckoutConsentRow
    purchase: BillingOneTimePurchaseRow
  }) => Promise<{
    lockedPlan: unknown
    deliveryProvider: string
    deliveryReference: string
    deliveredAt?: string
  }>
  siteUrl?: string
  defer?: (work: () => void | Promise<void>) => void
  now?: () => Date
}

export type OneTimeFulfillmentProcessorDependencies = Pick<
  OneTimeActivationDependencies,
  | "ensureAccount"
  | "linkQuizToProfile"
  | "postPurchasePersisted"
  | "sendConfirmation"
  | "finalizeLockedPlan"
  | "siteUrl"
  | "now"
> & {
  supabase: SupabaseBillingAnalyticsClient
  resolveVerifiedPaymentForRetry: (context: {
    purchase: BillingOneTimePurchaseRow
    consent: PersonalPlanOneTimeCheckoutConsentRow
    job: PersonalPlanOneTimeFulfillmentJobRow
  }) => Promise<VerifiedOneTimePayment>
}

const MAX_FULFILLMENT_ATTEMPTS = 5

export async function activateVerifiedOneTimePayment(
  payment: VerifiedOneTimePayment,
  deps: OneTimeActivationDependencies,
): Promise<OneTimeActivationResult> {
  validateVerifiedOneTimePayment(payment)
  const consent = await loadCanonicalConsent(deps.supabase, payment.consentId)

  const existing = await findOneTimePurchaseByProviderTransactionId(
    deps.supabase,
    payment.provider,
    payment.providerTransactionId,
  )
  if (existing && existing.consent_id !== payment.consentId) {
    throw new OneTimeActivationError(
      "one_time_payment_consent_conflict",
      "Verified one-time payment belongs to a different consent",
      false,
    )
  }

  const consentPurchase = await findOneTimePurchaseByConsentId(deps.supabase, payment.consentId)
  if (consentPurchase && !isSameOneTimePayment(consentPurchase, payment)) {
    throw duplicateConsentChargeError()
  }

  let purchase: BillingOneTimePurchaseRow
  try {
    purchase = await upsertOneTimePurchase(deps.supabase, {
      user_id: null,
      consent_id: payment.consentId,
      provider: payment.provider,
      provider_transaction_id: payment.providerTransactionId,
      provider_order_id: payment.providerOrderId,
      provider_customer_id: payment.providerCustomerId ?? null,
      amount_minor: payment.amountMinor,
      currency: payment.currency,
      status: "paid",
      paid_at: payment.paidAt,
      metadata: {
        provider_evidence: sanitizeProviderEvidence(payment.providerEvidence ?? {}),
      },
    })
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      const concurrentConsentPurchase = await findOneTimePurchaseByConsentId(
        deps.supabase,
        payment.consentId,
      )
      if (concurrentConsentPurchase && !isSameOneTimePayment(concurrentConsentPurchase, payment)) {
        throw duplicateConsentChargeError()
      }
    }
    throw error
  }

  // Provider dispute/refund webhooks may win the race between verification and
  // activation. Persisting the verified payment is still useful for auditability,
  // but a non-paid row must never enter the fulfillment pipeline.
  if (purchase.status !== "paid") {
    return {
      state: "revoked",
      purchase,
      consent,
      job: null,
    }
  }

  let canonicalConsent = consent
  const job = await ensurePersonalPlanOneTimeFulfillmentJob(deps.supabase, purchase)
  if (deps.postPurchasePersisted) {
    try {
      canonicalConsent =
        (await deps.postPurchasePersisted({
          payment,
          consent,
          purchase,
        })) ?? consent
    } catch {
      return {
        state: resolveOneTimePurchaseAccessState({ purchase, consent }),
        purchase,
        consent,
        job,
      }
    }
  }

  const claimedJob = await claimPersonalPlanOneTimeFulfillmentJob(deps.supabase, job.id)
  if (!claimedJob)
    return reloadOneTimeActivationResult(deps.supabase, purchase.id, canonicalConsent.id, job.id)

  const fulfilled = await tryCompletePersonalPlanOneTimeActivation(deps.supabase, {
    payment,
    purchase,
    consent: canonicalConsent,
    job: claimedJob,
    ensureAccount: deps.ensureAccount,
    linkQuizToProfile: deps.linkQuizToProfile,
    sendConfirmation: deps.sendConfirmation,
    finalizeLockedPlan: deps.finalizeLockedPlan,
    siteUrl: deps.siteUrl,
    defer: deps.defer,
    now: deps.now,
  })

  return {
    state: resolveOneTimePurchaseAccessState({
      purchase: fulfilled.purchase,
      consent: fulfilled.consent,
    }),
    purchase: fulfilled.purchase,
    consent: fulfilled.consent,
    job: fulfilled.job,
  }
}

function isSameOneTimePayment(
  purchase: BillingOneTimePurchaseRow,
  payment: VerifiedOneTimePayment,
) {
  return (
    purchase.provider === payment.provider &&
    purchase.provider_transaction_id === payment.providerTransactionId &&
    purchase.provider_order_id === payment.providerOrderId
  )
}

function duplicateConsentChargeError() {
  return new OneTimeActivationError(
    "one_time_payment_duplicate_consent_charge",
    "One-time consent is already bound to a different payment",
    false,
  )
}

export async function ensurePersonalPlanOneTimeFulfillmentJob(
  supabase: SupabaseBillingAnalyticsClient,
  purchase: Pick<BillingOneTimePurchaseRow, "id" | "consent_id">,
): Promise<PersonalPlanOneTimeFulfillmentJobRow> {
  const now = new Date().toISOString()
  const row = {
    purchase_id: purchase.id,
    consent_id: purchase.consent_id,
    status: "pending",
    updated_at: now,
  }
  const insert = await supabase
    .from("personal_plan_one_time_fulfillment_jobs")
    .insert(row)
    .select("*")
    .single()

  if (!insert.error) return insert.data as PersonalPlanOneTimeFulfillmentJobRow
  if (!isDuplicateKeyError(insert.error)) throw insert.error

  const { data, error } = await supabase
    .from("personal_plan_one_time_fulfillment_jobs")
    .select("*")
    .eq("purchase_id", purchase.id)
    .single()
  if (error) throw error
  return data as PersonalPlanOneTimeFulfillmentJobRow
}

export async function claimDuePersonalPlanOneTimeFulfillmentJobs(
  supabase: SupabaseBillingAnalyticsClient,
  input: { limit?: number; staleAfterMinutes?: number } = {},
): Promise<PersonalPlanOneTimeFulfillmentJobRow[]> {
  const result = supabase.rpc("claim_personal_plan_one_time_fulfillment_jobs", {
    p_limit: input.limit ?? 10,
    p_stale_after_minutes: input.staleAfterMinutes ?? 15,
  }) as PromiseLike<{ data: unknown; error: unknown }>
  const { data, error } = await result
  if (error) throw error
  return ((data as PersonalPlanOneTimeFulfillmentJobRow[] | null) ?? []).filter(
    isClaimedFulfillmentJob,
  )
}

export async function claimPersonalPlanOneTimeFulfillmentJob(
  supabase: SupabaseBillingAnalyticsClient,
  jobId: string,
  input: { staleAfterMinutes?: number } = {},
): Promise<PersonalPlanOneTimeFulfillmentJobRow | null> {
  const result = supabase.rpc("claim_personal_plan_one_time_fulfillment_job", {
    p_job_id: jobId,
    p_stale_after_minutes: input.staleAfterMinutes ?? 15,
  }) as PromiseLike<{ data: unknown; error: unknown }>
  const { data, error } = await result
  if (error) throw error
  return normalizeClaimedFulfillmentJob(data)
}

export async function processPersonalPlanOneTimeFulfillmentJob(
  job: PersonalPlanOneTimeFulfillmentJobRow,
  deps: OneTimeFulfillmentProcessorDependencies,
): Promise<OneTimeActivationResult> {
  if (!hasFulfillmentJobLease(job)) {
    return reloadOneTimeActivationResult(deps.supabase, job.purchase_id, job.consent_id, job.id)
  }

  let purchase: BillingOneTimePurchaseRow | null = null
  let consent: PersonalPlanOneTimeCheckoutConsentRow | null = null
  let payment: VerifiedOneTimePayment

  try {
    purchase = await loadOneTimePurchaseById(deps.supabase, job.purchase_id)
    consent = await loadCanonicalConsent(deps.supabase, job.consent_id)
    if (purchase.status !== "paid") {
      const terminalJob = await markFulfillmentJobFailed(
        deps.supabase,
        job,
        new OneTimeActivationError(
          "one_time_fulfillment_purchase_revoked",
          "One-time purchase is no longer paid",
          false,
        ),
        deps.now,
      )
      return { state: "revoked", purchase, consent, job: terminalJob }
    }
    payment = await deps.resolveVerifiedPaymentForRetry({ purchase, consent, job })

    if (
      payment.provider !== purchase.provider ||
      payment.providerTransactionId !== purchase.provider_transaction_id ||
      payment.consentId !== consent.id
    ) {
      throw new OneTimeActivationError(
        "one_time_retry_payment_mismatch",
        "Verified retry payment does not match the fulfillment job",
        false,
      )
    }
  } catch (error) {
    const failedJob = await markFulfillmentJobFailed(deps.supabase, job, error, deps.now).catch(
      () => job,
    )
    if (purchase && consent) {
      return {
        state: resolveOneTimePurchaseAccessState({ purchase, consent }),
        purchase,
        consent,
        job: failedJob,
      }
    }
    throw error
  }

  let canonicalConsent = consent
  if (deps.postPurchasePersisted) {
    try {
      canonicalConsent =
        (await deps.postPurchasePersisted({
          payment,
          consent,
          purchase,
        })) ?? consent
    } catch (error) {
      const failedJob = await markFulfillmentJobFailed(deps.supabase, job, error, deps.now).catch(
        () => job,
      )
      return {
        state: resolveOneTimePurchaseAccessState({ purchase, consent }),
        purchase,
        consent,
        job: failedJob,
      }
    }
  }

  return tryCompletePersonalPlanOneTimeActivation(deps.supabase, {
    payment,
    purchase,
    consent: canonicalConsent,
    job,
    ensureAccount: deps.ensureAccount,
    linkQuizToProfile: deps.linkQuizToProfile,
    sendConfirmation: deps.sendConfirmation,
    finalizeLockedPlan: deps.finalizeLockedPlan,
    siteUrl: deps.siteUrl,
    now: deps.now,
  })
}

async function tryCompletePersonalPlanOneTimeActivation(
  supabase: SupabaseBillingAnalyticsClient,
  input: {
    payment: VerifiedOneTimePayment
    purchase: BillingOneTimePurchaseRow
    consent: PersonalPlanOneTimeCheckoutConsentRow
    job: PersonalPlanOneTimeFulfillmentJobRow
    ensureAccount: OneTimeActivationDependencies["ensureAccount"]
    linkQuizToProfile?: OneTimeActivationDependencies["linkQuizToProfile"]
    sendConfirmation?: OneTimeActivationDependencies["sendConfirmation"]
    finalizeLockedPlan?: OneTimeActivationDependencies["finalizeLockedPlan"]
    siteUrl?: string
    defer?: OneTimeActivationDependencies["defer"]
    now?: () => Date
  },
): Promise<OneTimeActivationResult> {
  let purchase = input.purchase
  try {
    let consent = input.consent
    if (!purchase.user_id) {
      const account = await input.ensureAccount(input.payment, { consent, purchase })
      purchase = await bindPersonalPlanOneTimePurchaseUser(supabase, {
        consentId: consent.id,
        purchaseId: purchase.id,
        userId: account.userId,
      })
    }

    if (purchase.user_id) {
      await input.linkQuizToProfile?.({
        payment: input.payment,
        consent,
        purchase,
        userId: purchase.user_id,
      })
    }

    if (consent.confirmation_status !== "sent" && consent.confirmation_status !== "delivered") {
      const siteUrl = input.siteUrl ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
      const confirmation = await (input.sendConfirmation ?? sendPersonalPlanOneTimeConfirmation)({
        email: input.payment.email,
        consent: {
          text: consent.consent_text,
          version: consent.copy_version,
          acceptedAt: consent.accepted_at,
        },
        payment: {
          provider: input.payment.provider,
          reference: input.payment.providerTransactionId,
        },
        supportUrl: new URL("/kontakt", siteUrl).toString(),
        withdrawalUrl: new URL("/widerruf", siteUrl).toString(),
        resultUrl: new URL(`/result/${encodeURIComponent(consent.lead_id)}`, siteUrl).toString(),
      })
      consent = await recordPersonalPlanOneTimeConfirmation(supabase, consent.id, {
        provider: "customerio",
        reference: confirmation.confirmationReference,
        status: "sent",
        at: (input.now ?? (() => new Date()))().toISOString(),
      })
    }

    if (!consent.delivered_at) {
      if (!input.finalizeLockedPlan) {
        throw new OneTimeActivationError(
          "one_time_fulfillment_missing_finalizer",
          "One-time activation is missing a locked-plan finalizer",
          true,
        )
      }

      const generationStartedAt = (input.now ?? (() => new Date()))().toISOString()
      const finalized = await input.finalizeLockedPlan({
        payment: input.payment,
        consent,
        purchase,
      })
      const generationCompletedAt = (input.now ?? (() => new Date()))().toISOString()
      consent = await recordPersonalPlanOneTimeDeliveryEvidence(supabase, consent.id, {
        generationStartedAt,
        generationCompletedAt,
        generatedContentSha256: canonicalContentSha256(finalized.lockedPlan),
        deliveryProvider: finalized.deliveryProvider,
        deliveryReference: finalized.deliveryReference,
        deliveredAt: finalized.deliveredAt ?? (input.now ?? (() => new Date()))().toISOString(),
      })
    }

    let outboxError: unknown = null
    try {
      await createOneTimePurchaseCompletedOutbox(supabase, {
        payment: input.payment,
        purchase,
        consent,
        defer: input.defer,
      })
    } catch (error) {
      outboxError = error
    }

    if (outboxError) throw outboxError

    const job = await markFulfillmentJobCompleted(supabase, input.job, consent)
    return { state: "active", purchase, consent, job }
  } catch (error) {
    const [consent, freshPurchase, job] = await Promise.all([
      loadCanonicalConsent(supabase, input.consent.id).catch(() => input.consent),
      loadOneTimePurchaseById(supabase, input.purchase.id).catch(() => purchase),
      markFulfillmentJobFailed(supabase, input.job, error, input.now).catch(() => input.job),
    ])
    return {
      state: resolveOneTimePurchaseAccessState({ purchase: freshPurchase, consent }),
      purchase: freshPurchase,
      consent,
      job,
    }
  }
}

async function reloadOneTimeActivationResult(
  supabase: SupabaseBillingAnalyticsClient,
  purchaseId: string,
  consentId: string,
  jobId: string,
): Promise<OneTimeActivationResult> {
  const [purchase, consent, job] = await Promise.all([
    loadOneTimePurchaseById(supabase, purchaseId),
    loadCanonicalConsent(supabase, consentId),
    loadFulfillmentJobById(supabase, jobId),
  ])
  return {
    state: resolveOneTimePurchaseAccessState({ purchase, consent }),
    purchase,
    consent,
    job,
  }
}

async function createOneTimePurchaseCompletedOutbox(
  supabase: SupabaseBillingAnalyticsClient,
  input: {
    payment: VerifiedOneTimePayment
    purchase: BillingOneTimePurchaseRow
    consent: PersonalPlanOneTimeCheckoutConsentRow
    defer?: OneTimeActivationDependencies["defer"]
  },
) {
  if (!input.purchase.user_id) return null
  const funnelSession = await findCanonicalFunnelSession(supabase, input.consent.funnel_session_id)
  const destinations = [...BILLING_ANALYTICS_EXTERNAL_DESTINATIONS]
  if (
    isFunnelAttributionEnabled() &&
    isBillingFunnelDeliveryEnabled() &&
    funnelSession?.package_key
  ) {
    destinations.push("funnel")
  }
  const analyticsAnchor =
    input.payment.provider === "stripe"
      ? input.payment.providerOrderId
      : input.payment.providerTransactionId
  return recordBillingAnalyticsEvent(
    supabase,
    {
      eventKey: `${input.payment.provider}:purchase_completed:${analyticsAnchor}`,
      eventName: "purchase_completed",
      userId: input.purchase.user_id,
      provider: input.payment.provider,
      providerCustomerId: input.payment.providerCustomerId ?? null,
      sourceEventId: input.payment.providerTransactionId,
      sourceObjectId: input.payment.providerOrderId,
      occurredAt: input.payment.paidAt,
      payload: {
        product_kind: "personal_plan_once",
        amount_minor: input.payment.amountMinor,
        checkout_reference: input.payment.providerOrderId,
        meta_event_id: input.payment.providerOrderId,
        value: input.payment.amountMinor / 100,
        currency: "EUR",
        interval: "one_time",
        plan_id: "personal_plan_once",
        has_paid_access: true,
        consent_id: input.consent.id,
        funnel_session_id: input.consent.funnel_session_id,
        ...(funnelSession?.package_key ? { funnel_package_key: funnelSession.package_key } : {}),
        offer_variant: input.consent.offer_variant,
      },
    },
    { destinations, defer: input.defer },
  )
}

function normalizeClaimedFulfillmentJob(
  data: unknown,
): PersonalPlanOneTimeFulfillmentJobRow | null {
  const candidate = Array.isArray(data) ? data[0] : data
  return isClaimedFulfillmentJob(candidate) ? candidate : null
}

function isClaimedFulfillmentJob(job: unknown): job is PersonalPlanOneTimeFulfillmentJobRow {
  if (!job || typeof job !== "object") return false
  const candidate = job as Partial<PersonalPlanOneTimeFulfillmentJobRow>
  return (
    typeof candidate.id === "string" &&
    candidate.id.trim().length > 0 &&
    hasFulfillmentJobLease(candidate)
  )
}

function hasFulfillmentJobLease(
  job: Partial<Pick<PersonalPlanOneTimeFulfillmentJobRow, "status" | "processing_started_at">>,
) {
  return (
    job.status === "processing" &&
    typeof job.processing_started_at === "string" &&
    job.processing_started_at.trim().length > 0
  )
}

async function findCanonicalFunnelSession(
  supabase: SupabaseBillingAnalyticsClient,
  funnelSessionId: string,
): Promise<{ id: string; package_key: string | null } | null> {
  const { data, error } = await supabase
    .from("funnel_sessions")
    .select("id, package_key")
    .eq("id", funnelSessionId)
    .maybeSingle()
  if (error) throw error
  return (data as { id: string; package_key: string | null } | null) ?? null
}

async function loadCanonicalConsent(
  supabase: SupabaseBillingAnalyticsClient,
  consentId: string,
): Promise<PersonalPlanOneTimeCheckoutConsentRow> {
  const consent = await findPersonalPlanOneTimeConsentById(supabase, consentId)
  if (!consent) {
    throw new OneTimeActivationError(
      "one_time_payment_consent_missing",
      "Verified one-time payment is missing its canonical consent",
      false,
    )
  }
  return consent
}

async function loadOneTimePurchaseById(
  supabase: SupabaseBillingAnalyticsClient,
  purchaseId: string,
): Promise<BillingOneTimePurchaseRow> {
  const { data, error } = await supabase
    .from("billing_one_time_purchases")
    .select("*")
    .eq("id", purchaseId)
    .single()
  if (error) throw error
  if (!data) {
    throw new OneTimeActivationError(
      "one_time_purchase_missing",
      "One-time purchase is missing for fulfillment retry",
      true,
    )
  }
  return data as BillingOneTimePurchaseRow
}

async function loadFulfillmentJobById(
  supabase: SupabaseBillingAnalyticsClient,
  jobId: string,
): Promise<PersonalPlanOneTimeFulfillmentJobRow | null> {
  const { data, error } = await supabase
    .from("personal_plan_one_time_fulfillment_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle()
  if (error) throw error
  return (data as PersonalPlanOneTimeFulfillmentJobRow | null) ?? null
}

async function markFulfillmentJobCompleted(
  supabase: SupabaseBillingAnalyticsClient,
  job: PersonalPlanOneTimeFulfillmentJobRow,
  consent: PersonalPlanOneTimeCheckoutConsentRow,
) {
  if (!hasFulfillmentJobLease(job)) {
    return reloadFulfillmentJobAfterLeaseMiss(supabase, job.id)
  }

  const { data, error } = await supabase
    .from("personal_plan_one_time_fulfillment_jobs")
    .update({
      status: "completed",
      processing_started_at: null,
      next_attempt_at: null,
      last_error: null,
      delivery_provider: consent.delivery_provider,
      delivery_reference: consent.delivery_reference,
      canonical_content_sha256: consent.generated_content_sha256,
      delivered_at: consent.delivered_at,
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id)
    .eq("status", "processing")
    .eq("processing_started_at", job.processing_started_at)
    .select("*")
    .maybeSingle()
  if (error) throw error
  if (!data) return reloadFulfillmentJobAfterLeaseMiss(supabase, job.id)
  return data as PersonalPlanOneTimeFulfillmentJobRow
}

async function markFulfillmentJobFailed(
  supabase: SupabaseBillingAnalyticsClient,
  job: PersonalPlanOneTimeFulfillmentJobRow,
  error: unknown,
  nowFn?: () => Date,
): Promise<PersonalPlanOneTimeFulfillmentJobRow> {
  if (!hasFulfillmentJobLease(job)) {
    return reloadFulfillmentJobAfterLeaseMiss(supabase, job.id)
  }

  const attempts = job.attempts + 1
  const retryable = !(error instanceof OneTimeActivationError) || error.retryable
  const status = !retryable || attempts >= MAX_FULFILLMENT_ATTEMPTS ? "failed_permanent" : "failed"
  const now = nowFn?.() ?? new Date()
  const nextAttemptAt =
    status === "failed"
      ? new Date(now.getTime() + Math.min(60, 2 ** attempts) * 60_000).toISOString()
      : null
  const message = sanitizeErrorMessage(error)
  const result = await supabase
    .from("personal_plan_one_time_fulfillment_jobs")
    .update({
      status,
      attempts,
      processing_started_at: null,
      next_attempt_at: nextAttemptAt,
      last_error: message,
      updated_at: now.toISOString(),
    })
    .eq("id", job.id)
    .eq("status", "processing")
    .eq("processing_started_at", job.processing_started_at)
    .select("*")
    .maybeSingle()
  if (result.error) throw result.error
  if (!result.data) return reloadFulfillmentJobAfterLeaseMiss(supabase, job.id)
  return result.data as PersonalPlanOneTimeFulfillmentJobRow
}

async function reloadFulfillmentJobAfterLeaseMiss(
  supabase: SupabaseBillingAnalyticsClient,
  jobId: string,
): Promise<PersonalPlanOneTimeFulfillmentJobRow> {
  const job = await loadFulfillmentJobById(supabase, jobId)
  if (job) return job
  throw new OneTimeActivationError(
    "one_time_fulfillment_job_missing",
    "One-time fulfillment job is missing while resolving a terminal lease update",
    true,
  )
}

function validateVerifiedOneTimePayment(payment: VerifiedOneTimePayment) {
  if (payment.amountMinor !== 2999 || payment.currency !== "eur") {
    throw new OneTimeActivationError(
      "one_time_payment_invalid_amount",
      "Verified one-time payment has an unexpected amount or currency",
      false,
    )
  }
  if (!payment.providerTransactionId || !payment.providerOrderId || !payment.consentId) {
    throw new OneTimeActivationError(
      "one_time_payment_invalid_reference",
      "Verified one-time payment is missing required provider or consent references",
      false,
    )
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payment.email.trim())) {
    throw new OneTimeActivationError(
      "one_time_payment_invalid_email",
      "Verified one-time payment email is invalid",
      false,
    )
  }
  if (!Number.isFinite(Date.parse(payment.paidAt))) {
    throw new OneTimeActivationError(
      "one_time_payment_invalid_paid_at",
      "Verified one-time payment paid_at is invalid",
      false,
    )
  }
}

function sanitizeProviderEvidence(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, entry]) => {
        const normalized = key.toLowerCase()
        if (
          normalized.includes("email") ||
          normalized.includes("payload") ||
          normalized.includes("payment_method") ||
          normalized.includes("card")
        ) {
          return false
        }
        return !Array.isArray(entry)
      })
      .map(([key, entry]) => [
        key,
        entry && typeof entry === "object"
          ? sanitizeProviderEvidence(entry as Record<string, unknown>)
          : entry,
      ]),
  )
}

function canonicalContentSha256(value: unknown): string {
  return createHash("sha256").update(stableStringify(value), "utf8").digest("hex")
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(",")}}`
  }
  return JSON.stringify(value)
}

function sanitizeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[email]").slice(0, 500)
}

function isDuplicateKeyError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const code = (error as { code?: unknown }).code
  return code === "23505"
}

export class OneTimeActivationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message)
    this.name = "OneTimeActivationError"
  }
}
