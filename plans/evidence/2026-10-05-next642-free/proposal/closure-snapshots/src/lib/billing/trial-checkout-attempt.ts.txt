import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { parseTrialOfferSnapshot, type TrialOfferSnapshot } from "./trial-offer"

export type TrialCheckoutScope = Readonly<{ kind: "user" | "lead"; id: string }>
export type TrialCheckoutAttempt = Readonly<{
  id: string
  enrollmentId: string
  scope: TrialCheckoutScope
  clientAttemptId: string
  offer: TrialOfferSnapshot
  status: "reserved" | "frozen" | "provider_created" | "reconciliation_required"
  stripeAccountId: string | null
  stripeLivemode: boolean | null
  stripeParams: Record<string, unknown> | null
  expiresAt: string | null
  providerReference: string | null
}>

type TrialCheckoutClient = Pick<SupabaseClient, "rpc">

function invalidAttempt(): never {
  throw new Error("trial checkout attempt unavailable")
}

function parseAttempt(value: unknown): TrialCheckoutAttempt {
  if (Array.isArray(value)) {
    if (value.length !== 1) invalidAttempt()
    return parseAttempt(value[0])
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) invalidAttempt()
  const row = value as Record<string, unknown>
  const offer = parseTrialOfferSnapshot(row.accepted_offer)
  if (
    typeof row.id !== "string" ||
    typeof row.enrollment_id !== "string" ||
    (row.scope_kind !== "user" && row.scope_kind !== "lead") ||
    typeof row.scope_id !== "string" ||
    typeof row.client_attempt_id !== "string" ||
    !offer ||
    !["reserved", "frozen", "provider_created", "reconciliation_required"].includes(
      String(row.status),
    ) ||
    !(row.stripe_account_id === null || typeof row.stripe_account_id === "string") ||
    !(row.stripe_livemode === null || typeof row.stripe_livemode === "boolean") ||
    !(
      row.stripe_params === null ||
      (typeof row.stripe_params === "object" && !Array.isArray(row.stripe_params))
    ) ||
    !(row.expires_at === null || typeof row.expires_at === "string") ||
    !(row.provider_reference === null || typeof row.provider_reference === "string")
  ) {
    invalidAttempt()
  }
  return {
    id: row.id,
    enrollmentId: row.enrollment_id,
    scope: { kind: row.scope_kind, id: row.scope_id },
    clientAttemptId: row.client_attempt_id,
    offer,
    status: row.status as TrialCheckoutAttempt["status"],
    stripeAccountId: row.stripe_account_id,
    stripeLivemode: row.stripe_livemode,
    stripeParams: row.stripe_params as Record<string, unknown> | null,
    expiresAt: row.expires_at,
    providerReference: row.provider_reference,
  }
}

async function call(
  client: TrialCheckoutClient,
  name: string,
  parameters: Record<string, unknown>,
) {
  const { data, error } = await client.rpc(name, parameters)
  if (error) invalidAttempt()
  return parseAttempt(data)
}

export function createTrialCheckoutAttempt(
  client: TrialCheckoutClient,
  input: { scope: TrialCheckoutScope; clientAttemptId: string; offer: TrialOfferSnapshot },
) {
  return call(client, "create_trial_checkout_attempt", {
    p_scope_kind: input.scope.kind,
    p_scope_id: input.scope.id,
    p_client_attempt_id: input.clientAttemptId,
    p_offer: input.offer,
  })
}

export function loadOwnedTrialCheckoutAttempt(
  client: TrialCheckoutClient,
  input: { scope: TrialCheckoutScope; clientAttemptId: string },
) {
  return call(client, "load_trial_checkout_attempt", {
    p_scope_kind: input.scope.kind,
    p_scope_id: input.scope.id,
    p_client_attempt_id: input.clientAttemptId,
  })
}

export function freezeTrialStripeCheckoutAttempt(
  client: TrialCheckoutClient,
  input: {
    attemptId: string
    stripeAccountId: string
    livemode: boolean
    params: Record<string, unknown>
    expiresAt: string
  },
) {
  return call(client, "freeze_trial_stripe_checkout_attempt", {
    p_attempt_id: input.attemptId,
    p_stripe_account_id: input.stripeAccountId,
    p_livemode: input.livemode,
    p_params: input.params,
    p_expires_at: input.expiresAt,
  })
}

export function bindTrialStripeCheckoutReference(
  client: TrialCheckoutClient,
  input: { attemptId: string; providerReference: string },
) {
  return call(client, "bind_trial_stripe_checkout_reference", {
    p_attempt_id: input.attemptId,
    p_provider_reference: input.providerReference,
  })
}
