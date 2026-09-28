import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * R-a: the subscription's payments are refunded in full by the account-deletion refund
 * worker (reconcile cron). Shares the deletion refunds' key (provider + subscription), so a
 * subscription is never paid out twice. Throws so the webhook is retried.
 */
export async function recordPostDeletionRefund(
  supabase: SupabaseClient,
  provider: "stripe" | "paypal",
  subscriptionId: string,
): Promise<void> {
  const { error } = await supabase.rpc("account_deletion_record_post_deletion_refund", {
    p_provider: provider,
    p_subscription_id: subscriptionId,
  })
  if (error) throw new Error("Post-deletion refund could not be recorded")
}
