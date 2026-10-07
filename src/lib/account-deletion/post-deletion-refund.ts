import type { SupabaseClient } from "@supabase/supabase-js"

export type WebRefundKind = "deletion" | "post_deletion"

/**
 * R-a: the subscription's payments are refunded in full by the account-deletion refund
 * worker (reconcile cron). Shares the deletion refunds' key (provider + subscription), so a
 * subscription is never paid out twice. Throws so the webhook is retried.
 *
 * Returns the RPC's result: false when the subscription already has a refund row that was
 * not taken over (a retried webhook's own post-deletion row, or a deletion row that paid
 * something out or is not settled yet).
 */
export async function recordPostDeletionRefund(
  supabase: SupabaseClient,
  provider: "stripe" | "paypal",
  subscriptionId: string,
  /** The deletion (anonymization) time: only payments at/after it are refunded (I-2). */
  paymentsFrom: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("account_deletion_record_post_deletion_refund", {
    p_provider: provider,
    p_subscription_id: subscriptionId,
    p_payments_from: paymentsFrom,
  })
  if (error) throw new Error("Post-deletion refund could not be recorded")
  return data === true
}

/** N2: the kind of the subscription's existing refund row (null: none). Throws on failure. */
export async function webRefundKind(
  supabase: SupabaseClient,
  provider: "stripe" | "paypal",
  subscriptionId: string,
): Promise<WebRefundKind | null> {
  const { data, error } = await supabase.rpc("account_deletion_web_refund_kind", {
    p_provider: provider,
    p_subscription_id: subscriptionId,
  })
  if (error) throw new Error("Web refund kind could not be read")
  return data === "deletion" || data === "post_deletion" ? data : null
}
