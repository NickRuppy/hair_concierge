import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { TrialCheckoutScope } from "../billing/trial-checkout-attempt"
import { parseTrialOfferSnapshot, type TrialOfferSnapshot } from "../billing/trial-offer"
import type { PayPalCheckoutSource } from "./checkout-intents"

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
  providerReference: string | null
  authorizationSucceededAt: string | null
  activationEventId: string | null
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
    authorizationSucceededAt:
      typeof item.authorization_succeeded_at === "string" ? item.authorization_succeeded_at : null,
    activationEventId:
      typeof item.activation_event_id === "string" ? item.activation_event_id : null,
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
  return call(client, "create_paypal_trial_checkout_attempt", {
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
  return call(client, "freeze_paypal_trial_checkout_attempt", {
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
  const { data, error } = await client.rpc("get_paypal_trial_checkout_attempt", { p_token: token })
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

/** Freeze uses a 72-hour idempotency window; the separately disclosed provisional start is seven days after that freeze. */
export function provisionalPayPalTrialStart(
  attempt: Pick<PayPalTrialCheckoutAttempt, "requestExpiresAt">,
): string {
  const expiry = Date.parse(attempt.requestExpiresAt ?? "")
  if (!Number.isFinite(expiry)) throw new Error("PayPal trial frozen start unavailable")
  return new Date(expiry + 4 * 24 * 60 * 60 * 1000).toISOString()
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
  const { data, error } = await client.rpc("get_paypal_trial_checkout_attempt_by_scope", {
    p_scope_kind: scope.kind,
    p_scope_id: scope.id,
    p_client_attempt_id: clientAttemptId,
  })
  if (error) throw new Error("PayPal trial checkout attempt unavailable")
  return data ? parse(data) : null
}
