import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  JWSRenewalInfoDecodedPayload,
  JWSTransactionDecodedPayload,
} from "@apple/app-store-server-library"
import { readBoundedJsonBody } from "@/lib/bounded-json-body"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  AppStoreStateError,
  renewalStatusSnapshot,
  transactionSnapshot,
  type AppStoreEnvironment,
} from "./state"
import {
  upsertAppStoreSubscriptionStatus,
  upsertAppStoreTransaction,
  type AppStoreWriteOutcome,
} from "./store"
import { AppStoreVerificationError, appStoreVerifier, type AppStoreVerifier } from "./verify"

/**
 * App Store Server Notifications V2. Apple retries every non-2xx response, so the
 * webhook answers 200 only after the verified state is stored (or deliberately
 * ignored), 4xx for data that fails verification, and 503 for anything transient.
 * Replays are idempotent: the SQL newer-wins guard treats an equal signedDate as a
 * no-op and ignores older ones.
 */

/** Types whose transaction/renewal info can change access or the Profil Abo row. */
const RECORDED_TYPES = new Set([
  "SUBSCRIBED",
  "DID_RENEW",
  "DID_CHANGE_RENEWAL_STATUS",
  "DID_CHANGE_RENEWAL_PREF",
  "DID_FAIL_TO_RENEW",
  "GRACE_PERIOD_EXPIRED",
  "EXPIRED",
  "REFUND",
  "REFUND_REVERSED",
  "REVOKE",
])

const MAX_BYTES = 65_536

export type VerifiedAppStoreData = {
  environment: AppStoreEnvironment
  transaction: JWSTransactionDecodedPayload | null
  renewalInfo: JWSRenewalInfoDecodedPayload | null
  notificationType?: string
}

/**
 * Binds only through Apple's signed appAccountToken, and only to an account that still
 * exists (a deleted account's token survives at Apple). Without one, null leaves the row
 * unbound or lets it inherit the subscription's existing owner in SQL.
 */
async function accountForToken(client: SupabaseClient, token: string | null) {
  if (token === null) return null
  const { data, error } = await client.from("profiles").select("id").eq("id", token).maybeSingle()
  if (error) throw new Error("app_store_read_failed")
  return data ? token : null
}

/** Stores Apple-verified subscription data; throws AppStoreStateError before any write. */
export async function recordVerifiedAppStoreData(
  client: SupabaseClient,
  data: VerifiedAppStoreData,
): Promise<AppStoreWriteOutcome[]> {
  const context = { environment: data.environment, notificationType: data.notificationType }
  const transaction = data.transaction ? transactionSnapshot(data.transaction, context) : null
  const status = data.renewalInfo ? renewalStatusSnapshot(data.renewalInfo, context) : null
  const userId = await accountForToken(client, transaction?.appAccountToken ?? null)
  const outcomes: AppStoreWriteOutcome[] = []
  // Transaction first, so the status row inherits the owner it establishes.
  if (transaction)
    outcomes.push((await upsertAppStoreTransaction(client, transaction, userId)).outcome)
  if (status)
    outcomes.push((await upsertAppStoreSubscriptionStatus(client, status, userId)).outcome)
  return outcomes
}

function respond(body: unknown, status: number) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } })
}

export type AppStoreNotificationDeps = { verifier?: () => AppStoreVerifier }

export async function handleAppStoreNotificationPost(
  request: Request,
  deps: AppStoreNotificationDeps = {},
): Promise<Response> {
  const body = await readBoundedJsonBody(request, MAX_BYTES)
  const signedPayload =
    body.ok && body.value && typeof body.value === "object"
      ? (body.value as { signedPayload?: unknown }).signedPayload
      : undefined
  if (typeof signedPayload !== "string" || signedPayload.length === 0)
    return respond({ error: "invalid_request" }, 400)

  let verified
  try {
    verified = await (deps.verifier ?? appStoreVerifier)().verifyNotification(signedPayload)
  } catch (error) {
    if (error instanceof AppStoreVerificationError && error.code !== "retryable") {
      console.warn("[app-store:notification] rejected unverified payload", { code: error.code })
      return respond({ error: "invalid_notification" }, 400)
    }
    // Missing config/certs or Apple's OCSP unreachable: Apple retries later.
    return respond({ error: "temporarily_unavailable" }, 503)
  }

  const notificationType = verified.payload.notificationType
  // TEST and types that carry nothing we store are acknowledged without writes.
  if (!notificationType || !RECORDED_TYPES.has(notificationType))
    return respond({ received: true }, 200)

  try {
    const outcomes = await recordVerifiedAppStoreData(createAdminClient(), {
      environment: verified.environment,
      transaction: verified.transaction,
      renewalInfo: verified.renewalInfo,
      notificationType,
    })
    for (const outcome of outcomes)
      if (outcome !== "applied" && outcome !== "stale")
        console.warn("[app-store:notification] write refused", {
          outcome,
          notificationType,
          environment: verified.environment,
        })
  } catch (error) {
    if (error instanceof AppStoreStateError) {
      // Verified by Apple but not a subscription row we can store; a retry cannot fix it.
      console.warn("[app-store:notification] unusable payload", {
        code: error.code,
        notificationType,
        environment: verified.environment,
      })
      return respond({ received: true }, 200)
    }
    return respond({ error: "temporarily_unavailable" }, 503)
  }
  return respond({ received: true }, 200)
}
