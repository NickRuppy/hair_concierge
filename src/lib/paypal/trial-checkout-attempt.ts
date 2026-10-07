import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { TrialCheckoutScope } from "../billing/trial-checkout-attempt"
import { parseTrialOfferSnapshot, type TrialOfferSnapshot } from "../billing/trial-offer"
import type { PayPalCheckoutSource } from "./checkout-intents"
import { frozenPayPalTrialStart, paypalTrialProviderStart } from "./trial-collection-start"

export type PayPalTrialCheckoutAttempt = Readonly<{
  id: string
  enrollmentId: string
  intentToken: string
  scope: TrialCheckoutScope
  clientAttemptId: string
  offer: TrialOfferSnapshot
  status: "reserved" | "frozen" | "provider_created" | "reconciliation_required"
  paypalAppId: string | null
  paypalProductId: string | null
  paypalPlanId: string | null
  requestId: string | null
  requestExpiresAt: string | null
  trialEndAt: string | null
  providerStartTime: string | null
  providerReference: string | null
  authorizationSucceededAt: string | null
  activationEventId: string | null
  authorizationProofKind: "webhook" | "api_confirmation" | null
  apiConfirmationId: string | null
  apiConfirmedAt: string | null
}>

type Client = Pick<SupabaseClient, "rpc">

function parse(value: unknown): PayPalTrialCheckoutAttempt {
  const row = Array.isArray(value) ? value[0] : value
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    throw new Error("PayPal trial checkout attempt unavailable")
  }

  const item = row as Record<string, unknown>
  const offer = parseTrialOfferSnapshot(item.accepted_offer)
  if (
    typeof item.id !== "string" ||
    typeof item.enrollment_id !== "string" ||
    typeof item.intent_token !== "string" ||
    (item.scope_kind !== "user" && item.scope_kind !== "lead") ||
    typeof item.scope_id !== "string" ||
    typeof item.client_attempt_id !== "string" ||
    !offer ||
    !["reserved", "frozen", "provider_created", "reconciliation_required"].includes(
      String(item.status),
    ) ||
    !(item.request_expires_at === null || typeof item.request_expires_at === "string")
  ) {
    throw new Error("PayPal trial checkout attempt unavailable")
  }

  const trialEndAt = item.trial_end_at ?? null
  const providerStartTime = item.provider_start_time ?? null
  const isV2 = typeof item.request_id === "string" && item.request_id.endsWith(":v2")
  if (
    (trialEndAt !== null && typeof trialEndAt !== "string") ||
    (providerStartTime !== null && typeof providerStartTime !== "string") ||
    ((trialEndAt !== null || providerStartTime !== null) && !isV2) ||
    (isV2 &&
      (item.request_id !== `paypal-trial:${item.id}:v2` ||
        typeof trialEndAt !== "string" ||
        typeof providerStartTime !== "string" ||
        Date.parse(trialEndAt) !== Date.parse(frozenPayPalTrialStart(item.request_expires_at)) ||
        Date.parse(providerStartTime) !== Date.parse(paypalTrialProviderStart(trialEndAt))))
  )
    throw new Error("PayPal trial frozen schedule unavailable")

  const authorizationSucceededAt = item.authorization_succeeded_at ?? null
  const activationEventId = item.activation_event_id ?? null
  const apiConfirmationId = item.api_confirmation_id ?? null
  const apiConfirmedAt = item.api_confirmed_at ?? null
  const finiteTime = (value: unknown): value is string =>
    typeof value === "string" && Number.isFinite(Date.parse(value))
  // Missing provenance is a rolling-deployment legacy row, never API evidence.
  const authorizationProofKind =
    item.authorization_proof_kind === undefined
      ? authorizationSucceededAt !== null && activationEventId !== null
        ? "webhook"
        : null
      : item.authorization_proof_kind
  const validProof =
    authorizationProofKind === null
      ? authorizationSucceededAt === null &&
        activationEventId === null &&
        apiConfirmationId === null &&
        apiConfirmedAt === null
      : authorizationProofKind === "webhook"
        ? finiteTime(authorizationSucceededAt) &&
          typeof activationEventId === "string" &&
          activationEventId.trim().length > 0 &&
          apiConfirmationId === null &&
          apiConfirmedAt === null
        : authorizationProofKind === "api_confirmation" &&
          finiteTime(authorizationSucceededAt) &&
          finiteTime(apiConfirmedAt) &&
          Date.parse(authorizationSucceededAt) === Date.parse(apiConfirmedAt) &&
          activationEventId === null &&
          typeof apiConfirmationId === "string" &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(apiConfirmationId)
  if (!validProof) throw new Error("PayPal trial authorization proof unavailable")

  return {
    id: item.id,
    enrollmentId: item.enrollment_id,
    intentToken: item.intent_token,
    scope: { kind: item.scope_kind, id: item.scope_id },
    clientAttemptId: item.client_attempt_id,
    offer,
    status: item.status as PayPalTrialCheckoutAttempt["status"],
    paypalAppId: typeof item.paypal_app_id === "string" ? item.paypal_app_id : null,
    paypalProductId: typeof item.paypal_product_id === "string" ? item.paypal_product_id : null,
    paypalPlanId: typeof item.paypal_plan_id === "string" ? item.paypal_plan_id : null,
    requestId: typeof item.request_id === "string" ? item.request_id : null,
    requestExpiresAt: item.request_expires_at,
    trialEndAt,
    providerStartTime,
    authorizationSucceededAt: authorizationSucceededAt as string | null,
    activationEventId: activationEventId as string | null,
    authorizationProofKind:
      authorizationProofKind as PayPalTrialCheckoutAttempt["authorizationProofKind"],
    apiConfirmationId: apiConfirmationId as string | null,
    apiConfirmedAt: apiConfirmedAt as string | null,
    providerReference: typeof item.provider_reference === "string" ? item.provider_reference : null,
  }
}

async function call(client: Client, name: string, args: Record<string, unknown>) {
  const { data, error } = await client.rpc(name, args)
  if (error) throw new Error("PayPal trial checkout attempt unavailable")
  return parse(data)
}

export function createPayPalTrialCheckoutAttempt(
  client: Client,
  input: {
    scope: TrialCheckoutScope
    clientAttemptId: string
    offer: TrialOfferSnapshot
    email: string | null
    leadId: string | null
    source: PayPalCheckoutSource
  },
) {
  return call(client, "create_paypal_trial_checkout_attempt_v2", {
    p_scope_kind: input.scope.kind,
    p_scope_id: input.scope.id,
    p_client_attempt_id: input.clientAttemptId,
    p_offer: input.offer,
    p_email: input.email,
    p_lead_id: input.leadId,
    p_source: input.source,
  })
}

export function freezePayPalTrialCheckoutAttempt(
  client: Client,
  input: { attemptId: string; appId: string; productId: string; planId: string; requestId: string },
) {
  return call(client, "freeze_paypal_trial_checkout_attempt_v2", {
    p_attempt_id: input.attemptId,
    p_app_id: input.appId,
    p_product_id: input.productId,
    p_plan_id: input.planId,
    p_request_id: input.requestId,
  })
}

export function bindPayPalTrialCheckoutReference(
  client: Client,
  input: { attemptId: string; providerReference: string },
) {
  return call(client, "bind_paypal_trial_checkout_reference", {
    p_attempt_id: input.attemptId,
    p_provider_reference: input.providerReference,
  })
}

export async function findPayPalTrialCheckoutAttempt(client: Client, token: string) {
  const { data, error } = await client.rpc("get_paypal_trial_checkout_attempt_v2", {
    p_token: token,
  })
  if (error) throw new Error("PayPal trial checkout attempt unavailable")
  return data ? parse(data) : null
}

export function pinPayPalTrialActivation(
  client: Client,
  input: { token: string; agreementId: string; eventId: string; authorizedAt: string },
) {
  return call(client, "pin_paypal_trial_activation", {
    p_token: input.token,
    p_agreement_id: input.agreementId,
    p_event_id: input.eventId,
    p_authorized_at: input.authorizedAt,
  })
}

/** Only temporary database availability failures are safe to fall back from. */
export class PayPalTrialConfirmationUnavailableError extends Error {}

export async function confirmPayPalTrialActivation(
  client: Client,
  input: {
    token: string
    agreementId: string
    confirmationId: string
    appId: string
    planId: string
    providerStartTime: string
    nextBillingTime: string
  },
) {
  const { data, error, status } = await client.rpc("confirm_paypal_trial_activation", {
    p_token: input.token,
    p_agreement_id: input.agreementId,
    p_confirmation_id: input.confirmationId,
    p_app_id: input.appId,
    p_plan_id: input.planId,
    p_provider_start_time: input.providerStartTime,
    p_next_billing_time: input.nextBillingTime,
  })
  if (error) {
    if (
      // PostgREST preserves HTTP status but has no service error code for a
      // fetch rejection or plain gateway response. Structured integrity and
      // permission codes take precedence even if a gateway labels them 5xx.
      (!error.code && (status === 0 || status === 429 || status >= 500)) ||
      /^(08|53)/.test(error.code ?? "") ||
      ["40001", "40P01", "57014", "57P01", "PGRST000", "PGRST001", "PGRST002", "PGRST003"].includes(
        error.code ?? "",
      )
    )
      throw new PayPalTrialConfirmationUnavailableError(
        "PayPal trial API confirmation temporarily unavailable",
        { cause: error },
      )
    throw new Error("PayPal trial API confirmation failed", { cause: error })
  }
  return parse(data)
}

export type PayPalTrialPlanCatalog = {
  enrollmentId: string
  appId: string
  productId: string
  monthPlanId: string
  yearPlanId: string
}
function parsePlanCatalog(value: unknown): PayPalTrialPlanCatalog {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("PayPal frozen plan catalog unavailable")
  const row = value as Record<string, unknown>
  for (const key of ["enrollment_id", "app_id", "product_id", "month_plan_id", "year_plan_id"])
    if (typeof row[key] !== "string" || !row[key])
      throw new Error("PayPal frozen plan catalog unavailable")
  return {
    enrollmentId: row.enrollment_id as string,
    appId: row.app_id as string,
    productId: row.product_id as string,
    monthPlanId: row.month_plan_id as string,
    yearPlanId: row.year_plan_id as string,
  }
}
export async function loadPayPalTrialPlanCatalog(client: Client, enrollmentId: string) {
  const { data, error } = await client.rpc("get_paypal_trial_plan_catalog", {
    p_enrollment_id: enrollmentId,
  })
  if (error) throw new Error("PayPal frozen plan catalog unavailable")
  return data ? parsePlanCatalog(data) : null
}
export async function freezePayPalTrialPlanCatalog(
  client: Client,
  catalog: PayPalTrialPlanCatalog,
) {
  const { data, error } = await client.rpc("freeze_paypal_trial_plan_catalog", {
    p_enrollment_id: catalog.enrollmentId,
    p_app_id: catalog.appId,
    p_product_id: catalog.productId,
    p_month_plan_id: catalog.monthPlanId,
    p_year_plan_id: catalog.yearPlanId,
  })
  if (error) throw new Error("PayPal frozen plan catalog unavailable")
  return parsePlanCatalog(data)
}
export async function findPayPalTrialCheckoutAttemptByScope(
  client: Client,
  scope: TrialCheckoutScope,
  clientAttemptId: string,
) {
  const { data, error } = await client.rpc("get_paypal_trial_checkout_attempt_by_scope_v2", {
    p_scope_kind: scope.kind,
    p_scope_id: scope.id,
    p_client_attempt_id: clientAttemptId,
  })
  if (error) throw new Error("PayPal trial checkout attempt unavailable")
  return data ? parse(data) : null
}

/** Decoded immutable schedule; only historical v1 rows derive their midnight. */
export function payPalTrialCheckoutSchedule(attempt: PayPalTrialCheckoutAttempt) {
  const trialEndAt = attempt.trialEndAt ?? frozenPayPalTrialStart(attempt.requestExpiresAt)
  return { trialEndAt, providerStartTime: attempt.providerStartTime ?? trialEndAt }
}
