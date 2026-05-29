import type {
  BillingSubscriptionInput,
  BillingSubscriptionRow,
  SupabaseBillingClient,
} from "./types"
import { findCurrentBillingSubscriptionForUser, isFutureIso } from "./subscriptions"

type MirrorableBillingSubscription = BillingSubscriptionInput | BillingSubscriptionRow

export async function mirrorBillingSubscriptionToProfile(
  supabase: SupabaseBillingClient,
  subscription: MirrorableBillingSubscription,
  premiumTierId: string,
  options: { freeTierId?: string } = {},
): Promise<void> {
  const profileStatus = profileStatusForSubscription(subscription)
  const patch: Record<string, unknown> = {
    subscription_status: profileStatus,
    subscription_interval: subscription.interval ?? null,
    current_period_end: subscription.current_period_end ?? null,
  }

  if (profileStatus === "active" || profileStatus === "past_due") {
    patch.subscription_tier_id = premiumTierId
  } else if (profileStatus === "canceled" || profileStatus === "incomplete") {
    patch.subscription_tier_id = options.freeTierId ?? null
  }

  const { error } = await supabase.from("profiles").update(patch).eq("id", subscription.user_id)
  if (error) throw error
}

export async function reconcileExpiredBillingEntitlements(
  supabase: SupabaseBillingClient,
  options: { freeTierId: string; now?: Date },
): Promise<{ downgraded: number }> {
  const now = options.now ?? new Date()
  const { data, error } = await supabase
    .from("billing_subscriptions")
    .select("*")
    .eq("entitlement_status", "canceled")

  if (error) throw error

  const expiredRows = ((data as BillingSubscriptionRow[] | null) ?? []).filter(
    (row) => !row.current_period_end || !isFutureIso(row.current_period_end, now),
  )

  let downgraded = 0

  for (const row of expiredRows) {
    const currentSubscription = await findCurrentBillingSubscriptionForUser(
      supabase,
      row.user_id,
      now,
    )
    if (currentSubscription && currentSubscription.id !== row.id) continue

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        subscription_status: "canceled",
        subscription_tier_id: options.freeTierId,
      })
      .eq("id", row.user_id)

    if (profileError) throw profileError
    downgraded += 1
  }

  return { downgraded }
}

function profileStatusForSubscription(subscription: MirrorableBillingSubscription) {
  if (
    subscription.entitlement_status === "canceled" &&
    subscription.cancel_at_period_end &&
    isFutureIso(subscription.current_period_end ?? null)
  ) {
    return "active"
  }

  return subscription.entitlement_status
}
