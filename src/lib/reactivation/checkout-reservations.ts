import type { SupabaseClient } from "@supabase/supabase-js"

import type { BillingInterval } from "@/lib/stripe/intervals"
import {
  parseStripeCheckoutContext,
  type StripeCheckoutContextV1,
} from "@/lib/reactivation/stripe-checkout-context"

export type MembershipReactivationProvider = "stripe" | "paypal"
export type MembershipReactivationReservationStatus =
  | "open"
  | "provider_selected"
  | "provider_created"
  | "completed"
  | "expired"
  | "reconciliation_required"

export type MembershipReactivationCheckoutReservation = {
  id: string
  user_id: string
  checkout_attempt_id: string
  interval: BillingInterval
  return_destination: string
  provider: MembershipReactivationProvider | null
  provider_reference: string | null
  status: MembershipReactivationReservationStatus
  expires_at: string
  created_at: string
  updated_at: string
  stripe_checkout_context?: StripeCheckoutContextV1 | null
}

type ReservationClient = Pick<SupabaseClient, "from" | "rpc">

export class MembershipReactivationCheckoutConflictError extends Error {
  constructor(message = "membership reactivation checkout already in progress") {
    super(message)
    this.name = "MembershipReactivationCheckoutConflictError"
  }
}

export async function acquireMembershipReactivationCheckout(
  supabase: ReservationClient,
  input: {
    userId: string
    checkoutAttemptId: string
    interval: BillingInterval
    returnDestination: string
  },
): Promise<MembershipReactivationCheckoutReservation> {
  const { data, error } = await supabase.rpc("acquire_membership_reactivation_checkout", {
    p_user_id: input.userId,
    p_checkout_attempt_id: input.checkoutAttemptId,
    p_interval: input.interval,
    p_return_destination: input.returnDestination,
  })

  if (error) {
    if (isReservationConflict(error)) throw new MembershipReactivationCheckoutConflictError()
    throw error
  }
  return normalizeReservation(data)
}

export async function claimMembershipReactivationProvider(
  supabase: ReservationClient,
  reservationId: string,
  userId: string,
  provider: MembershipReactivationProvider,
): Promise<MembershipReactivationCheckoutReservation> {
  const { data, error } = await supabase.rpc("claim_membership_reactivation_checkout_provider", {
    p_reservation_id: reservationId,
    p_user_id: userId,
    p_provider: provider,
  })
  if (error) {
    if (isReservationConflict(error)) throw new MembershipReactivationCheckoutConflictError()
    throw error
  }
  return normalizeReservation(data)
}

export async function prepareMembershipReactivationStripeCheckout(
  supabase: ReservationClient,
  input: { reservationId: string; userId: string; context: StripeCheckoutContextV1 },
): Promise<MembershipReactivationCheckoutReservation> {
  const context = parseStripeCheckoutContext(input.context)
  if (
    context.user_id !== input.userId ||
    context.recovery_params ||
    context.initial_params.metadata?.reactivation_reservation_id !== input.reservationId
  ) {
    throw new MembershipReactivationCheckoutConflictError(
      "reactivation checkout context ownership mismatch",
    )
  }
  const { data, error } = await supabase.rpc("prepare_membership_reactivation_stripe_checkout", {
    p_reservation_id: input.reservationId,
    p_user_id: input.userId,
    p_context: context,
  })
  if (error) {
    if (isReservationConflict(error)) throw new MembershipReactivationCheckoutConflictError()
    throw error
  }
  return normalizeStripeReservation(data)
}

export async function recoverMembershipReactivationStripeCheckout(
  supabase: ReservationClient,
  input: {
    reservationId: string
    userId: string
    stripeAccountId: string
    livemode: boolean
    originalCustomerId: string
  },
): Promise<MembershipReactivationCheckoutReservation> {
  const { data, error } = await supabase.rpc("recover_membership_reactivation_stripe_checkout", {
    p_reservation_id: input.reservationId,
    p_user_id: input.userId,
    p_stripe_account_id: input.stripeAccountId,
    p_livemode: input.livemode,
    p_original_customer_id: input.originalCustomerId,
  })
  if (error) {
    if (isReservationConflict(error)) throw new MembershipReactivationCheckoutConflictError()
    throw error
  }
  return normalizeStripeReservation(data)
}

export async function bindMembershipReactivationProviderReference(
  supabase: ReservationClient,
  reservationId: string,
  providerReference: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("membership_reactivation_checkout_reservations")
    .update({
      provider_reference: providerReference,
      status: "provider_created",
      updated_at: new Date().toISOString(),
    })
    .eq("id", reservationId)
    .is("provider_reference", null)
    .in("status", ["provider_selected", "provider_created", "reconciliation_required"])
    .select("id, provider_reference")
    .maybeSingle()

  if (!error && data) return

  const { data: currentReservation, error: readError } = await supabase
    .from("membership_reactivation_checkout_reservations")
    .select("provider_reference")
    .eq("id", reservationId)
    .maybeSingle()

  if (currentReservation?.provider_reference === providerReference) return

  await markMembershipReactivationReconciliationRequired(supabase, reservationId).catch(() => {})
  if (error) throw error
  if (readError) throw readError
  throw new MembershipReactivationCheckoutConflictError(
    "reactivation checkout provider reference could not be bound",
  )
}

export async function markMembershipReactivationReconciliationRequired(
  supabase: ReservationClient,
  reservationId: string,
): Promise<void> {
  const { error } = await supabase
    .from("membership_reactivation_checkout_reservations")
    .update({ status: "reconciliation_required", updated_at: new Date().toISOString() })
    .eq("id", reservationId)
    .in("status", ["provider_selected", "provider_created", "reconciliation_required"])
  if (error) throw error
}

export async function expireMembershipReactivationCheckoutReservation(
  supabase: ReservationClient,
  input: {
    reservationId: string
    userId: string
    providerReference: string
  },
): Promise<void> {
  const { data, error } = await supabase
    .from("membership_reactivation_checkout_reservations")
    .update({ status: "expired", updated_at: new Date().toISOString() })
    .eq("id", input.reservationId)
    .eq("user_id", input.userId)
    .eq("provider_reference", input.providerReference)
    .in("status", ["provider_created", "reconciliation_required"])
    .select("id")
    .maybeSingle()
  if (error) throw error
  if (!data) {
    throw new MembershipReactivationCheckoutConflictError(
      "reactivation checkout reservation could not be expired",
    )
  }
}

export async function markMembershipReactivationCheckoutCompleted(
  supabase: ReservationClient,
  reservationId: string,
  userId: string,
  binding: { provider: MembershipReactivationProvider; providerReference: string },
): Promise<void> {
  const { data, error } = await supabase
    .from("membership_reactivation_checkout_reservations")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("id", reservationId)
    .eq("user_id", userId)
    .eq("provider", binding.provider)
    .eq("provider_reference", binding.providerReference)
    // Webhooks and browser returns can both confirm the same verified payment.
    .in("status", ["provider_created", "reconciliation_required", "completed"])
    .select("id")
    .maybeSingle()
  if (error) throw error
  if (!data) {
    throw new MembershipReactivationCheckoutConflictError(
      "reactivation checkout reservation could not be completed",
    )
  }
}

function isReservationConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const candidate = error as { code?: unknown; message?: unknown }
  const message = typeof candidate.message === "string" ? candidate.message : ""
  return candidate.code === "P0001" || message.includes("reactivation checkout")
}

function normalizeReservation(data: unknown): MembershipReactivationCheckoutReservation {
  const reservation = Array.isArray(data) ? data[0] : data
  if (!reservation || typeof reservation !== "object") {
    throw new Error("reactivation checkout reservation response missing")
  }
  return reservation as MembershipReactivationCheckoutReservation
}

function normalizeStripeReservation(data: unknown): MembershipReactivationCheckoutReservation {
  const reservation = normalizeReservation(data)
  const context = parseStripeCheckoutContext(reservation.stripe_checkout_context)
  if (
    reservation.provider !== "stripe" ||
    context.user_id !== reservation.user_id ||
    context.initial_params.metadata?.reactivation_reservation_id !== reservation.id
  ) {
    throw new MembershipReactivationCheckoutConflictError(
      "reactivation checkout persisted context mismatch",
    )
  }
  return { ...reservation, stripe_checkout_context: context }
}
