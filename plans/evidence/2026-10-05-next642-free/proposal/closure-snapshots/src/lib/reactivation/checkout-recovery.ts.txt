import type { SupabaseClient } from "@supabase/supabase-js"
import type { MembershipReactivationCheckoutReservation } from "./checkout-reservations"

/** Resolve ownership from authentication, never from a browser's attempt UUID. */
export async function findOwnedReactivationCheckout(
  client: Pick<SupabaseClient, "from">,
  userId: string,
): Promise<MembershipReactivationCheckoutReservation | null> {
  const { data, error } = await client
    .from("membership_reactivation_checkout_reservations")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["open", "provider_selected", "provider_created", "reconciliation_required"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data as MembershipReactivationCheckoutReservation | null
}

export function reactivationRecoveryPayload(
  reservation: MembershipReactivationCheckoutReservation,
  state: "resume" | "pending" = "pending",
) {
  return {
    error:
      state === "resume"
        ? "reactivation_checkout_in_progress"
        : "reactivation_checkout_unavailable",
    ...(reservation.provider
      ? {
          recovery: { provider: reservation.provider, state, interval: reservation.interval },
        }
      : {}),
  }
}

/** A token may authorize the SDK to create once. A lost reply remains pending. */
export async function claimPayPalReactivationClientCreation(
  client: Pick<SupabaseClient, "rpc">,
  intent: { id: string; user_id: string | null; reactivation_reservation_id: string | null },
  userId: string,
): Promise<boolean> {
  if (intent.user_id !== userId || !intent.reactivation_reservation_id) return false
  const { data, error } = await client.rpc("claim_membership_reactivation_paypal_client_creation", {
    p_reservation_id: intent.reactivation_reservation_id,
    p_user_id: userId,
    p_intent_id: intent.id,
  })
  if (error) throw error
  return data === true
}
