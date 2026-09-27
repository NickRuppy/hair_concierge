import assert from "node:assert/strict"
import test from "node:test"
import {
  appStoreServerAPIClient,
  reconcileAppStoreSubscription,
  type SubscriptionStatusClient,
} from "../src/lib/app-store/reconcile"
import { AppStoreConfigError, createAppStoreVerifier } from "../src/lib/app-store/verify"
import { createAdminClient } from "../src/lib/supabase/admin"
import { chain, jws, trusted } from "./helpers/app-store-jws"
import { appStoreEnv, createAppStoreSupabase, withEnv } from "./helpers/app-store-supabase"

const owner = "11111111-1111-4111-8111-111111111111"
const original = "2000000000000001"
const now = Date.now()
const day = 24 * 60 * 60 * 1000

const verifier = createAppStoreVerifier({
  bundleId: "de.chaarlie.app",
  appAppleId: 1234567890,
  environments: ["Production", "Sandbox"],
  rootCertificates: [trusted.root.der],
  enableOnlineChecks: false,
})
const signedTransactionInfo = (
  overrides: Record<string, unknown> = {},
  signer: ReturnType<typeof chain> = trusted,
) =>
  jws(
    {
      transactionId: "2000000000000003",
      originalTransactionId: original,
      bundleId: "de.chaarlie.app",
      productId: "de.chaarlie.scanner.yearly",
      type: "Auto-Renewable Subscription",
      purchaseDate: now - day,
      expiresDate: now + 364 * day,
      signedDate: now,
      environment: "Sandbox",
      appAccountToken: owner,
      ...overrides,
    },
    signer,
  )
const signedRenewalInfo = jws({
  originalTransactionId: original,
  autoRenewProductId: "de.chaarlie.scanner.yearly",
  autoRenewStatus: 1,
  signedDate: now,
  environment: "Sandbox",
})

function apiReturning(signedTransaction: string): SubscriptionStatusClient & { asked: string[] } {
  const asked: string[] = []
  return {
    asked,
    async getAllSubscriptionStatuses(transactionId: string) {
      asked.push(transactionId)
      return {
        environment: "Sandbox",
        bundleId: "de.chaarlie.app",
        data: [
          {
            subscriptionGroupIdentifier: "21000000",
            lastTransactions: [
              {
                status: 1,
                originalTransactionId: original,
                signedTransactionInfo: signedTransaction,
                signedRenewalInfo,
              },
            ],
          },
        ],
      }
    },
  }
}

async function withFake(run: (db: ReturnType<typeof createAppStoreSupabase>) => Promise<void>) {
  const restoreEnv = withEnv(appStoreEnv)
  const db = createAppStoreSupabase({ profiles: [owner] })
  const restoreFetch = db.install()
  try {
    await run(db)
  } finally {
    restoreFetch()
    restoreEnv()
  }
}

test("reconciliation records Apple's verified current status like a notification", async () => {
  await withFake(async (db) => {
    const api = apiReturning(signedTransactionInfo())
    const outcomes = await reconcileAppStoreSubscription(createAdminClient(), original, "Sandbox", {
      apiClient: api,
      verifier,
    })
    assert.deepEqual(api.asked, [original])
    assert.deepEqual(outcomes, ["applied", "applied"])
    assert.equal(db.transactions.get("2000000000000003")?.user_id, owner)
    assert.equal(db.statuses.get(original)?.auto_renew_status, true)
    // Idempotent on re-run.
    assert.deepEqual(
      await reconcileAppStoreSubscription(createAdminClient(), original, "Sandbox", {
        apiClient: api,
        verifier,
      }),
      ["applied", "applied"],
    )
  })
})

test("reconciliation re-verifies Apple's data and writes nothing it cannot verify", async () => {
  await withFake(async (db) => {
    await assert.rejects(
      reconcileAppStoreSubscription(createAdminClient(), original, "Sandbox", {
        apiClient: apiReturning(signedTransactionInfo({}, chain())),
        verifier,
      }),
    )
    await assert.rejects(
      reconcileAppStoreSubscription(createAdminClient(), original, "Production", {
        apiClient: apiReturning(signedTransactionInfo()),
        verifier,
      }),
    )
    assert.equal(db.rpcCalls.length, 0)
  })
})

test("FW1 reconciliation skips a subscription of another product without writing", async () => {
  await withFake(async (db) => {
    const outcomes = await reconcileAppStoreSubscription(createAdminClient(), original, "Sandbox", {
      apiClient: apiReturning(signedTransactionInfo({ productId: "de.chaarlie.other.yearly" })),
      verifier,
    })
    assert.deepEqual(outcomes, [])
    assert.equal(db.rpcCalls.length, 0)
  })
})

test("the App Store Server API client needs its credentials", () => {
  assert.throws(
    () => appStoreServerAPIClient("Sandbox", {}),
    (error) => error instanceof AppStoreConfigError,
  )
  assert.throws(
    () => appStoreServerAPIClient("Sandbox", { APP_STORE_BUNDLE_ID: "de.chaarlie.app" }),
    (error) => error instanceof AppStoreConfigError,
  )
})
