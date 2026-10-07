import "server-only"
import { z } from "zod"
import { accountDeletionEnabled } from "@/lib/account-deletion/enabled"
import {
  AppStoreStateError,
  isScannerProductId,
  renewalStatusSnapshot,
  transactionSnapshot,
  type AppStoreSubscriptionStatusRow,
} from "@/lib/app-store/state"
import {
  accountForToken,
  upsertAppStoreSubscriptionStatus,
  upsertAppStoreTransaction,
} from "@/lib/app-store/store"
import {
  AppStoreVerificationError,
  appStoreVerifier,
  type AppStoreVerifier,
} from "@/lib/app-store/verify"
import {
  reportAppStoreNotificationFailure,
  type AppStoreFailureSink,
} from "@/lib/observability/app-store"
import { resolveMobileAccess } from "./access"
import {
  MobileError,
  mobileJSON,
  mobileJSONBody,
  mobileRateLimit,
  mobileRoute,
  requireMobileUser,
} from "./auth"

const MAX_TRANSACTIONS = 20
const MAX_JWS_BYTES = 16_384

const transactionsSchema = z
  .object({
    signedTransactions: z.array(z.string().min(1).max(MAX_JWS_BYTES)).min(1).max(MAX_TRANSACTIONS),
    // Optional so older app builds keep working; renewal data then arrives only by webhook.
    signedRenewalInfos: z
      .array(z.string().min(1).max(MAX_JWS_BYTES))
      .max(MAX_TRANSACTIONS)
      .optional(),
  })
  .strict()

export type AppStoreTransactionsDeps = {
  verifier?: () => AppStoreVerifier
  /** Test seam for the status-write failure sink; production always uses Sentry. */
  sink?: AppStoreFailureSink
}

async function verifiedRow(verifier: AppStoreVerifier, jws: string) {
  try {
    const { environment, payload } = await verifier.verifyTransaction(jws)
    return transactionSnapshot(payload, { environment })
  } catch (error) {
    if (error instanceof AppStoreVerificationError && error.code === "retryable")
      throw new MobileError("temporarily_unavailable", 503)
    // Signed by Apple for this bundle, but not a scanner product: nothing to unlock.
    if (error instanceof AppStoreStateError && error.code === "unknown_product")
      throw new MobileError("invalid_transaction", 409)
    if (error instanceof AppStoreVerificationError || error instanceof AppStoreStateError)
      throw new MobileError("invalid_transaction", 400)
    throw error
  }
}

/**
 * A renewal JWS that fails Apple's signature check rejects the batch like a transaction.
 * One that verifies but is no scanner status we can store is dropped (null): it must never
 * cost the purchase it accompanies its acknowledgement.
 */
async function verifiedStatus(
  verifier: AppStoreVerifier,
  jws: string,
): Promise<AppStoreSubscriptionStatusRow | null> {
  try {
    const { environment, payload } = await verifier.verifyRenewalInfo(jws)
    // Apple's renewal-info check does not pin the bundle; from the app, a named scanner
    // product plus the same-request originalTransactionId match are what tie it to us.
    if (!isScannerProductId(payload.productId)) throw new AppStoreStateError("unknown_product")
    return renewalStatusSnapshot(payload, { environment })
  } catch (error) {
    if (error instanceof AppStoreVerificationError && error.code === "retryable")
      throw new MobileError("temporarily_unavailable", 503)
    if (error instanceof AppStoreVerificationError)
      throw new MobileError("invalid_transaction", 400)
    if (error instanceof AppStoreStateError) {
      console.warn("[app-store:transactions] renewal info ignored", { code: error.code })
      return null
    }
    throw error
  }
}

/**
 * The app posts Apple-signed transactions right after purchase/restore. Only the
 * caller's own purchases bind: Apple's signed appAccountToken must be the caller's user
 * ID (or a deleted account's); a purchase without a token binds only while its
 * subscription is unowned (SQL).
 * Optional signed renewal info (auto-renew, billing retry, grace) is stored only for a
 * subscription whose transaction in this same request was verified and is the caller's;
 * renewal info alone never binds anything. The webhook remains the other source, and the
 * SQL newer-wins guard keeps whichever copy Apple signed last.
 * Every JWS is verified before anything is written. Answers the fresh bootstrap access.
 */
export async function handleAppStoreTransactionsPost(
  request: Request,
  deps: AppStoreTransactionsDeps = {},
): Promise<Response> {
  return mobileRoute(async () => {
    const { client, userId, email } = await requireMobileUser(request)
    // app_store_* tables are not migrated yet: no DB work.
    if (!accountDeletionEnabled()) throw new MobileError("temporarily_unavailable", 503)
    await mobileRateLimit(client, userId, "mobile-app-store-transactions", 20, 60_000)
    const parsed = transactionsSchema.safeParse(
      await mobileJSONBody(request, 2 * MAX_TRANSACTIONS * MAX_JWS_BYTES + 1024),
    )
    if (!parsed.success) throw new MobileError("invalid_request", 400)

    const verifier = (deps.verifier ?? appStoreVerifier)()
    const rows = []
    for (const jws of parsed.data.signedTransactions) rows.push(await verifiedRow(verifier, jws))
    const statuses = []
    for (const jws of parsed.data.signedRenewalInfos ?? []) {
      const status = await verifiedStatus(verifier, jws)
      if (status) statuses.push(status)
    }

    const caller = userId.toLowerCase()
    let ownedByOther = false
    let invalid = false
    // "originalTransactionId environment" of subscriptions this request proved are the caller's.
    const ownSubscriptions = new Set<string>()
    for (const row of rows) {
      // Another living account's token: A3, one subscription per account. A deleted
      // account's token binds nobody, so the verified caller (holder of the Apple ID)
      // may claim it.
      if (
        row.appAccountToken !== null &&
        row.appAccountToken !== caller &&
        (await accountForToken(client, row.appAccountToken)) !== null
      ) {
        ownedByOther = true
        continue
      }
      const { outcome, owner } = await upsertAppStoreTransaction(client, row, userId)
      if ((outcome === "applied" || outcome === "stale") && owner?.toLowerCase() === caller)
        ownSubscriptions.add(`${row.originalTransactionId} ${row.environment}`)
      if (outcome === "owned_by_other_account") ownedByOther = true
      else if (outcome === "environment_mismatch" || outcome === "identity_mismatch") {
        // Nothing was written; never log the JWS or account identifiers.
        console.warn("[app-store:transactions] write refused", {
          outcome,
          environment: row.environment,
        })
        invalid = true
      }
    }
    for (const status of statuses) {
      // Unmatched or foreign renewal info is ignored without a write. This same-request
      // originalTransactionId match is the only thing binding renewal info to Chaarlie at all:
      // Apple's renewal-info verification checks the signature chain and environment but not
      // the bundle ID, so another app's genuine renewal info would otherwise verify here too.
      if (!ownSubscriptions.has(`${status.originalTransactionId} ${status.environment}`)) continue
      try {
        const { outcome } = await upsertAppStoreSubscriptionStatus(client, status, userId)
        if (outcome !== "applied" && outcome !== "stale")
          console.warn("[app-store:transactions] renewal write refused", {
            outcome,
            environment: status.environment,
          })
      } catch (error) {
        // The transaction is already committed by this point; renewal info must never cost
        // the purchase its acknowledgement. Report and move on — the webhook remains the
        // durable path for this status.
        reportAppStoreNotificationFailure(
          error,
          { stage: "record", environment: status.environment },
          deps.sink,
        )
      }
    }
    if (invalid && !ownedByOther) throw new MobileError("invalid_transaction", 409)
    const access = await resolveMobileAccess(client, userId, email, new Date())
    // A mixed batch still wrote the caller's own rows; the 409 carries what they unlocked.
    if (ownedByOther) return mobileJSON({ error: "owned_by_other_account", access }, 409)
    return mobileJSON({ access })
  })
}
