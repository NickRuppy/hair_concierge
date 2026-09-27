import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { AppStoreServerAPIClient, Environment } from "@apple/app-store-server-library"
import { recordVerifiedAppStoreData } from "./notifications"
import type { AppStoreWriteOutcome } from "./store"
import {
  AppStoreConfigError,
  AppStoreVerificationError,
  appStoreVerifier,
  type AppStoreVerifier,
} from "./verify"

/**
 * Manual reconciliation for the operations runbook (not scheduled): pulls Apple's
 * current status for one subscription via the App Store Server API and records it
 * exactly like a notification. Apple's signed data is re-verified before any write.
 */

type ServerEnvironment = "Production" | "Sandbox"
export type SubscriptionStatusClient = Pick<AppStoreServerAPIClient, "getAllSubscriptionStatuses">

export function appStoreServerAPIClient(
  environment: ServerEnvironment,
  env: Record<string, string | undefined> = process.env,
): SubscriptionStatusClient {
  const {
    APP_STORE_ISSUER_ID: issuerId,
    APP_STORE_KEY_ID: keyId,
    APP_STORE_PRIVATE_KEY: privateKey,
    APP_STORE_BUNDLE_ID: bundleId,
  } = env
  if (!issuerId || !keyId || !privateKey || !bundleId) throw new AppStoreConfigError()
  return new AppStoreServerAPIClient(
    // Env stores often keep the .p8 PEM on one line with escaped newlines.
    privateKey.replace(/\\n/g, "\n"),
    keyId,
    issuerId,
    bundleId,
    environment === "Production" ? Environment.PRODUCTION : Environment.SANDBOX,
  )
}

export async function reconcileAppStoreSubscription(
  db: SupabaseClient,
  transactionId: string,
  environment: ServerEnvironment,
  deps: { apiClient?: SubscriptionStatusClient; verifier?: AppStoreVerifier } = {},
): Promise<AppStoreWriteOutcome[]> {
  const api = deps.apiClient ?? appStoreServerAPIClient(environment)
  const verifier = deps.verifier ?? appStoreVerifier()
  const response = await api.getAllSubscriptionStatuses(transactionId)
  const outcomes: AppStoreWriteOutcome[] = []
  for (const group of response.data ?? []) {
    for (const item of group.lastTransactions ?? []) {
      const transaction = item.signedTransactionInfo
        ? await verifier.verifyTransaction(item.signedTransactionInfo)
        : null
      const renewal = item.signedRenewalInfo
        ? await verifier.verifyRenewalInfo(item.signedRenewalInfo)
        : null
      if (
        (transaction && transaction.environment !== environment) ||
        (renewal && renewal.environment !== environment)
      )
        throw new AppStoreVerificationError("invalid_environment")
      outcomes.push(
        ...(await recordVerifiedAppStoreData(db, {
          environment,
          transaction: transaction?.payload ?? null,
          renewalInfo: renewal?.payload ?? null,
        })),
      )
    }
  }
  return outcomes
}
