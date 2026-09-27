import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  AppStoreEntitlementSnapshot,
  AppStoreEnvironment,
  AppStoreSubscriptionStatusRow,
  AppStoreTransactionRow,
} from "./state"

/**
 * Service-role persistence for App Store entitlements. The newer-wins guard, immutable
 * row identity (environment, original transaction) and one-account-per-subscription
 * ownership (plan A3) live in SQL (app_store_upsert_*), serialized per subscription.
 */

/**
 * `owned_by_other_account`: the subscription is bound to `owner`, not the caller (409);
 * Apple's state was still recorded for the owner. `stale`: an older signedDate was
 * ignored. The mismatch outcomes changed nothing and are worth logging.
 */
export type AppStoreWriteOutcome =
  | "applied"
  | "stale"
  | "owned_by_other_account"
  | "environment_mismatch"
  | "identity_mismatch"
export type AppStoreWriteResult = { outcome: AppStoreWriteOutcome; owner: string | null }

const OUTCOMES: readonly string[] = [
  "applied",
  "stale",
  "owned_by_other_account",
  "environment_mismatch",
  "identity_mismatch",
]

const iso = (value: Date | null) => (value === null ? null : value.toISOString())

function writeResult(data: unknown, error: unknown): AppStoreWriteResult {
  const result = data as { outcome?: unknown; owner?: unknown } | null
  if (
    error ||
    !result ||
    typeof result.outcome !== "string" ||
    !OUTCOMES.includes(result.outcome) ||
    (result.owner !== null && typeof result.owner !== "string")
  )
    throw new Error("app_store_write_failed")
  return { outcome: result.outcome as AppStoreWriteOutcome, owner: result.owner }
}

export async function upsertAppStoreTransaction(
  client: SupabaseClient,
  row: AppStoreTransactionRow,
  userId: string | null,
): Promise<AppStoreWriteResult> {
  const { data, error } = await client.rpc("app_store_upsert_transaction", {
    p_transaction_id: row.transactionId,
    p_original_transaction_id: row.originalTransactionId,
    p_user_id: userId,
    p_app_account_token: row.appAccountToken,
    p_product_id: row.productId,
    p_environment: row.environment,
    p_purchase_date: iso(row.purchaseDate),
    p_expires_date: iso(row.expiresDate),
    p_offer_type: row.offerType,
    p_is_trial: row.isTrial,
    p_revocation_date: iso(row.revocationDate),
    p_revocation_reason: row.revocationReason,
    p_signed_date: iso(row.signedDate),
  })
  return writeResult(data, error)
}

export async function upsertAppStoreSubscriptionStatus(
  client: SupabaseClient,
  row: AppStoreSubscriptionStatusRow,
  userId: string | null,
): Promise<AppStoreWriteResult> {
  const { data, error } = await client.rpc("app_store_upsert_subscription_status", {
    p_original_transaction_id: row.originalTransactionId,
    p_user_id: userId,
    p_environment: row.environment,
    p_auto_renew_status: row.autoRenewStatus,
    p_auto_renew_product_id: row.autoRenewProductId,
    p_in_billing_retry: row.inBillingRetry,
    p_grace_period_expires_date: iso(row.gracePeriodExpiresDate),
    p_expiration_intent: row.expirationIntent,
    p_signed_date: iso(row.signedDate),
    p_last_notification_type: row.lastNotificationType,
  })
  return writeResult(data, error)
}

/**
 * The account an Apple appAccountToken may bind to: the token's account while it still
 * exists, else null. A deleted account's token survives at Apple, but its rows were
 * cascade-deleted with the profile and it can no longer own anything.
 */
export async function accountForToken(
  client: SupabaseClient,
  token: string | null,
): Promise<string | null> {
  if (token === null) return null
  const { data, error } = await client.from("profiles").select("id").eq("id", token).maybeSingle()
  if (error) throw new Error("app_store_read_failed")
  return data ? token : null
}

type TransactionRecord = {
  transaction_id: string
  original_transaction_id: string
  app_account_token: string | null
  product_id: string
  environment: AppStoreEnvironment
  purchase_date: string
  expires_date: string
  offer_type: number | null
  is_trial: boolean
  revocation_date: string | null
  revocation_reason: number | null
  signed_date: string
}

type StatusRecord = {
  original_transaction_id: string
  environment: AppStoreEnvironment
  auto_renew_status: boolean
  auto_renew_product_id: string | null
  in_billing_retry: boolean
  grace_period_expires_date: string | null
  expiration_intent: number | null
  signed_date: string
  last_notification_type: string | null
}

const date = (value: string | null) => (value === null ? null : new Date(value))

/**
 * Everything that can grant this account App Store access: its bound transactions and
 * the renewal status of those subscriptions. Throws when the store is unreachable so
 * callers fail closed.
 */
export async function loadAppStoreEntitlement(
  client: SupabaseClient,
  userId: string,
): Promise<AppStoreEntitlementSnapshot> {
  const { data, error } = await client
    .from("app_store_transactions")
    .select(
      "transaction_id,original_transaction_id,app_account_token,product_id,environment,purchase_date,expires_date,offer_type,is_trial,revocation_date,revocation_reason,signed_date",
    )
    .eq("user_id", userId)
    .order("expires_date", { ascending: false })
  if (error || !data) throw new Error("app_store_read_failed")
  const transactions = data as TransactionRecord[]
  const originals = Array.from(new Set(transactions.map((row) => row.original_transaction_id)))
  let statuses: StatusRecord[] = []
  if (originals.length > 0) {
    const result = await client
      .from("app_store_subscription_status")
      .select(
        "original_transaction_id,environment,auto_renew_status,auto_renew_product_id,in_billing_retry,grace_period_expires_date,expiration_intent,signed_date,last_notification_type",
      )
      .in("original_transaction_id", originals)
    if (result.error || !result.data) throw new Error("app_store_read_failed")
    statuses = result.data as StatusRecord[]
  }
  return {
    transactions: transactions.map((row) => ({
      transactionId: row.transaction_id,
      originalTransactionId: row.original_transaction_id,
      appAccountToken: row.app_account_token,
      productId: row.product_id,
      environment: row.environment,
      purchaseDate: new Date(row.purchase_date),
      expiresDate: new Date(row.expires_date),
      offerType: row.offer_type,
      isTrial: row.is_trial,
      revocationDate: date(row.revocation_date),
      revocationReason: row.revocation_reason,
      signedDate: new Date(row.signed_date),
    })),
    statuses: statuses.map((row) => ({
      originalTransactionId: row.original_transaction_id,
      environment: row.environment,
      autoRenewStatus: row.auto_renew_status,
      autoRenewProductId: row.auto_renew_product_id,
      inBillingRetry: row.in_billing_retry,
      gracePeriodExpiresDate: date(row.grace_period_expires_date),
      expirationIntent: row.expiration_intent,
      signedDate: new Date(row.signed_date),
      lastNotificationType: row.last_notification_type,
    })),
  }
}
