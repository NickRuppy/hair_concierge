import "server-only"
import { z } from "zod"
import { AppStoreStateError, transactionSnapshot } from "@/lib/app-store/state"
import { upsertAppStoreTransaction } from "@/lib/app-store/store"
import {
  AppStoreVerificationError,
  appStoreVerifier,
  type AppStoreVerifier,
} from "@/lib/app-store/verify"
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
  })
  .strict()

export type AppStoreTransactionsDeps = { verifier?: () => AppStoreVerifier }

async function verifiedRow(verifier: AppStoreVerifier, jws: string) {
  try {
    const { environment, payload } = await verifier.verifyTransaction(jws)
    return transactionSnapshot(payload, { environment })
  } catch (error) {
    if (error instanceof AppStoreVerificationError && error.code === "retryable")
      throw new MobileError("temporarily_unavailable", 503)
    if (error instanceof AppStoreVerificationError || error instanceof AppStoreStateError)
      throw new MobileError("invalid_transaction", 400)
    throw error
  }
}

/**
 * The app posts Apple-signed transactions right after purchase/restore. Only the
 * caller's own purchases bind: Apple's signed appAccountToken must be the caller's user
 * ID; a purchase without a token binds only while its subscription is unowned (SQL).
 * Every JWS is verified before anything is written. Answers the fresh bootstrap access.
 */
export async function handleAppStoreTransactionsPost(
  request: Request,
  deps: AppStoreTransactionsDeps = {},
): Promise<Response> {
  return mobileRoute(async () => {
    const { client, userId, email } = await requireMobileUser(request)
    await mobileRateLimit(client, userId, "mobile-app-store-transactions", 20, 60_000)
    const parsed = transactionsSchema.safeParse(
      await mobileJSONBody(request, MAX_TRANSACTIONS * MAX_JWS_BYTES + 1024),
    )
    if (!parsed.success) throw new MobileError("invalid_request", 400)

    const verifier = (deps.verifier ?? appStoreVerifier)()
    const rows = []
    for (const jws of parsed.data.signedTransactions) rows.push(await verifiedRow(verifier, jws))

    const caller = userId.toLowerCase()
    let ownedByOther = false
    let invalid = false
    for (const row of rows) {
      if (row.appAccountToken !== null && row.appAccountToken !== caller) {
        ownedByOther = true
        continue
      }
      const { outcome } = await upsertAppStoreTransaction(client, row, userId)
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
    if (ownedByOther) throw new MobileError("owned_by_other_account", 409)
    if (invalid) throw new MobileError("invalid_transaction", 409)
    return mobileJSON({ access: await resolveMobileAccess(client, userId, email, new Date()) })
  })
}
