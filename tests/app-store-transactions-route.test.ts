import assert from "node:assert/strict"
import test from "node:test"
import {
  AppStoreVerificationError,
  createAppStoreVerifier,
  type AppStoreVerifier,
} from "../src/lib/app-store/verify"
import {
  handleAppStoreTransactionsPost,
  type AppStoreTransactionsDeps,
} from "../src/lib/mobile/app-store-transactions"
import { POST as transactionsRoute } from "../src/app/api/mobile/v1/app-store/transactions/route"
import { chain, jws, trusted } from "./helpers/app-store-jws"
import { appStoreEnv, createAppStoreSupabase, withEnv } from "./helpers/app-store-supabase"

const userId = "a1b2c3d4-1111-4111-8111-11111111abcd"
const otherUserId = "22222222-2222-4222-8222-222222222222"
const localUser = {
  id: userId,
  email: "Käufer@Example.Test",
  is_anonymous: false,
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
}
const mobileEnv = {
  ...appStoreEnv,
  MOBILE_API_ENABLED: "true",
  MOBILE_AUTH_MODE: "local",
  MOBILE_AUTH_CALLBACK_URL: "chaarlie-local://auth",
  MOBILE_PILOT_ENABLED: undefined,
  MOBILE_REGISTRATION_ENABLED: undefined,
  MOBILE_PAYWALL_ENABLED: "true",
  APP_STORE_BUNDLE_ID: undefined,
  APP_STORE_ENVIRONMENTS: undefined,
  APP_STORE_APP_APPLE_ID: undefined,
}

const day = 24 * 60 * 60 * 1000
const now = Date.now()
function transaction(overrides: Record<string, unknown> = {}) {
  return {
    transactionId: "2000000000000001",
    originalTransactionId: "2000000000000001",
    bundleId: "de.chaarlie.app",
    productId: "de.chaarlie.scanner.yearly",
    type: "Auto-Renewable Subscription",
    purchaseDate: now - day,
    expiresDate: now + 6 * day,
    signedDate: now - day + 1000,
    environment: "Sandbox",
    inAppOwnershipType: "PURCHASED",
    appAccountToken: userId,
    offerType: 1,
    offerDiscountType: "FREE_TRIAL",
    ...overrides,
  }
}

const verifier = () =>
  createAppStoreVerifier({
    bundleId: "de.chaarlie.app",
    appAppleId: 1234567890,
    environments: ["Production", "Sandbox"],
    rootCertificates: [trusted.root.der],
    enableOnlineChecks: false,
  })

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/mobile/v1/app-store/transactions", {
    method: "POST",
    headers: {
      authorization: "Bearer raw-token",
      "content-type": "application/json",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

async function withFake(
  run: (db: ReturnType<typeof createAppStoreSupabase>) => Promise<void>,
  env: Record<string, string | undefined> = {},
) {
  const restoreEnv = withEnv({ ...mobileEnv, ...env })
  const db = createAppStoreSupabase({ authUser: localUser, profiles: [userId, otherUserId] })
  const restoreFetch = db.install()
  const warn = console.warn
  console.warn = () => {}
  try {
    await run(db)
  } finally {
    console.warn = warn
    restoreFetch()
    restoreEnv()
  }
}

const post = (body: unknown, deps: AppStoreTransactionsDeps = { verifier }) =>
  handleAppStoreTransactionsPost(request(body), deps)

test("the caller's own purchase binds to the caller and returns the fresh bootstrap access", async () => {
  await withFake(async (db) => {
    const response = await post({ signedTransactions: [jws(transaction())] })
    assert.equal(response.status, 200)
    assert.equal(response.headers.get("cache-control"), "no-store")
    const body = await response.json()
    assert.equal(body.access.status, "active")
    assert.equal(body.access.source, "app_store")
    assert.equal(body.access.appStore.productId, "de.chaarlie.scanner.yearly")
    assert.equal(body.access.appStore.expiresAt, new Date(now + 6 * day).toISOString())
    assert.deepEqual(Object.keys(body), ["access"])
    assert.equal(db.rpcCalls.length, 1)
    assert.equal(db.rpcCalls[0].args.p_user_id, userId)
    assert.equal(db.rpcCalls[0].args.p_is_trial, true)
    assert.equal(db.transactions.get("2000000000000001")?.user_id, userId)
  })
})

test("with the paywall flag off the purchase is still recorded and access reads open", async () => {
  await withFake(
    async (db) => {
      const response = await post({ signedTransactions: [jws(transaction())] })
      assert.equal(response.status, 200)
      assert.deepEqual(await response.json(), {
        access: { status: "active", source: "open", appStore: null },
      })
      assert.equal(db.transactions.get("2000000000000001")?.user_id, userId)
    },
    { MOBILE_PAYWALL_ENABLED: undefined },
  )
})

test("a purchase whose appAccountToken names another account is refused with 409 and not written", async () => {
  await withFake(async (db) => {
    const response = await post({
      signedTransactions: [jws(transaction({ appAccountToken: otherUserId }))],
    })
    assert.equal(response.status, 409)
    const body = await response.json()
    assert.equal(body.error, "owned_by_other_account")
    assert.equal(body.access.status, "none")
    assert.equal(db.rpcCalls.length, 0)
  })
})

test("the token comparison ignores case (Apple may echo an upper-case UUID)", async () => {
  await withFake(async (db) => {
    const response = await post({
      signedTransactions: [jws(transaction({ appAccountToken: userId.toUpperCase() }))],
    })
    assert.equal(response.status, 200)
    assert.equal(db.transactions.get("2000000000000001")?.user_id, userId)
  })
})

test("a purchase without a token binds to the caller while its subscription is unowned", async () => {
  await withFake(async (db) => {
    const response = await post({
      signedTransactions: [jws(transaction({ appAccountToken: undefined }))],
    })
    assert.equal(response.status, 200)
    assert.equal((await response.json()).access.source, "app_store")
    assert.equal(db.transactions.get("2000000000000001")?.user_id, userId)
  })
})

test("a purchase without a token for a subscription owned by another account is 409 and ownership stays", async () => {
  await withFake(async (db) => {
    db.statuses.set("2000000000000001", {
      original_transaction_id: "2000000000000001",
      user_id: otherUserId,
      environment: "Sandbox",
      auto_renew_status: true,
      auto_renew_product_id: "de.chaarlie.scanner.yearly",
      in_billing_retry: false,
      grace_period_expires_date: null,
      expiration_intent: null,
      signed_date: new Date(now - day).toISOString(),
      last_notification_type: "SUBSCRIBED",
    })
    const response = await post({
      signedTransactions: [
        jws(transaction({ transactionId: "2000000000000002", appAccountToken: undefined })),
      ],
    })
    assert.equal(response.status, 409)
    const body = await response.json()
    assert.equal(body.error, "owned_by_other_account")
    assert.equal(body.access.status, "none")
    // Apple's verified state is still recorded, but for the rightful owner.
    assert.equal(db.transactions.get("2000000000000002")?.user_id, otherUserId)
  })
})

test("replaying the same JWS is an idempotent success", async () => {
  await withFake(async (db) => {
    const body = { signedTransactions: [jws(transaction())] }
    const first = await post(body)
    const firstRow = { ...db.transactions.get("2000000000000001") }
    const second = await post(body)
    assert.equal(first.status, 200)
    assert.equal(second.status, 200)
    assert.deepEqual(await second.json(), await first.json())
    assert.equal(db.transactions.size, 1)
    assert.deepEqual(db.transactions.get("2000000000000001"), firstRow)
  })
})

test("an older copy posted after newer state is a stale no-op success", async () => {
  await withFake(async (db) => {
    const renewed = transaction({ expiresDate: now + 30 * day, signedDate: now - 1000 })
    assert.equal((await post({ signedTransactions: [jws(renewed)] })).status, 200)
    const stale = await post({ signedTransactions: [jws(transaction())] })
    assert.equal(stale.status, 200)
    assert.equal(
      db.transactions.get("2000000000000001")?.expires_date,
      new Date(now + 30 * day).toISOString(),
    )
  })
})

test("a batch binds several own periods in one call", async () => {
  await withFake(async (db) => {
    const response = await post({
      signedTransactions: [
        jws(transaction({ expiresDate: now - 1000, purchaseDate: now - 8 * day })),
        jws(transaction({ transactionId: "2000000000000002", signedDate: now - 1000 })),
      ],
    })
    assert.equal(response.status, 200)
    assert.equal(db.transactions.size, 2)
    assert.equal((await response.json()).access.status, "active")
  })
})

test("every JWS is verified before anything is written: one forged entry rejects the batch", async () => {
  await withFake(async (db) => {
    const forged = jws(transaction({ transactionId: "2000000000000009" }), chain())
    const response = await post({ signedTransactions: [jws(transaction()), forged] })
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), { error: "invalid_transaction" })
    assert.equal(db.rpcCalls.length, 0)
  })
})

test("verified data that is not our subscription is rejected without writes", async () => {
  await withFake(async (db) => {
    for (const payload of [
      transaction({ type: "Consumable" }),
      transaction({ bundleId: "com.example.other" }),
      transaction({ appAccountToken: "not-a-uuid" }),
    ]) {
      const response = await post({ signedTransactions: [jws(payload)] })
      assert.equal(response.status, 400)
      assert.deepEqual(await response.json(), { error: "invalid_transaction" })
    }
    assert.equal(db.rpcCalls.length, 0)
  })
})

test("FW1 an unrelated auto-renewable product of the bundle is 409 invalid_transaction and grants nothing", async () => {
  await withFake(async (db) => {
    const response = await post({
      signedTransactions: [jws(transaction({ productId: "de.chaarlie.other.monthly" }))],
    })
    assert.equal(response.status, 409)
    assert.deepEqual(await response.json(), { error: "invalid_transaction" })
    assert.equal(db.rpcCalls.length, 0)
    assert.equal(db.transactions.size, 0)
    // The same caller's scanner purchase still binds normally afterwards.
    const ok = await post({ signedTransactions: [jws(transaction())] })
    assert.equal(ok.status, 200)
    assert.equal((await ok.json()).access.source, "app_store")
  })
})

test("a retryable verification failure (Apple OCSP unreachable) is 503 so the app retries", async () => {
  await withFake(async (db) => {
    const unreachable: AppStoreVerifier = {
      verifyTransaction: async () => {
        throw new AppStoreVerificationError("retryable")
      },
      verifyRenewalInfo: async () => {
        throw new Error("unused")
      },
      verifyNotification: async () => {
        throw new Error("unused")
      },
    }
    const response = await post(
      { signedTransactions: [jws(transaction())] },
      {
        verifier: () => unreachable,
      },
    )
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), { error: "temporarily_unavailable" })
    assert.equal(db.rpcCalls.length, 0)
  })
})

test("missing App Store configuration fails closed with 503 on the real route", async () => {
  await withFake(async (db) => {
    const response = await transactionsRoute(request({ signedTransactions: [jws(transaction())] }))
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), { error: "temporarily_unavailable" })
    assert.equal(db.rpcCalls.length, 0)
  })
})

test("an identity or environment mismatch is logged and answered 409 invalid_transaction", async () => {
  await withFake(async (db) => {
    db.transactions.set("2000000000000001", {
      transaction_id: "2000000000000001",
      original_transaction_id: "2000000000000001",
      user_id: userId,
      environment: "Production",
      signed_date: new Date(now - day).toISOString(),
      expires_date: new Date(now + day).toISOString(),
    })
    const warnings: unknown[] = []
    console.warn = (...args: unknown[]) => warnings.push(args)
    const response = await post({ signedTransactions: [jws(transaction())] })
    assert.equal(response.status, 409)
    assert.deepEqual(await response.json(), { error: "invalid_transaction" })
    assert.equal(db.transactions.get("2000000000000001")?.environment, "Production")
    assert.equal(warnings.length, 1)
    const logged = JSON.stringify(warnings)
    assert.match(logged, /environment_mismatch/)
    assert.doesNotMatch(logged, new RegExp(userId))
    assert.doesNotMatch(logged, /2000000000000001/)
  })
})

test("a transient store failure is 503", async () => {
  await withFake(async (db) => {
    db.state.failWrites = 1
    const response = await post({ signedTransactions: [jws(transaction())] })
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), { error: "temporarily_unavailable" })
  })
})

test("the body is strict: 1–20 JWS strings of at most 16 KB, JSON only", async () => {
  await withFake(async (db) => {
    const one = jws(transaction())
    for (const body of [
      {},
      { signedTransactions: [] },
      { signedTransactions: Array.from({ length: 21 }, () => one) },
      { signedTransactions: ["x".repeat(16_385)] },
      { signedTransactions: [""] },
      { signedTransactions: [42] },
      { signedTransactions: [one], extra: true },
      "not json",
    ]) {
      const response = await post(body)
      assert.equal(response.status, 400, JSON.stringify(body).slice(0, 80))
      assert.deepEqual(await response.json(), { error: "invalid_request" })
    }
    const textPlain = await handleAppStoreTransactionsPost(
      request({ signedTransactions: [one] }, { "content-type": "text/plain" }),
      { verifier },
    )
    assert.equal(textPlain.status, 400)
    // 20 maximum-size entries pass the body limit and reach verification.
    const full = await post({
      signedTransactions: Array.from({ length: 20 }, () => "x".repeat(16_384)),
    })
    assert.deepEqual(await full.json(), { error: "invalid_transaction" })
    const twenty = await post({ signedTransactions: Array.from({ length: 20 }, () => one) })
    assert.equal(twenty.status, 200)
    assert.equal(db.transactions.size, 1)
  })
})

test("requires a mobile session and sits behind the mobile policy gate", async () => {
  await withFake(async (db) => {
    const anonymous = await handleAppStoreTransactionsPost(
      new Request("http://localhost/api/mobile/v1/app-store/transactions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ signedTransactions: [jws(transaction())] }),
      }),
      { verifier },
    )
    assert.equal(anonymous.status, 401)
    assert.equal(db.rpcCalls.length, 0)
  })
  await withFake(
    async (db) => {
      const disabled = await post({ signedTransactions: [jws(transaction())] })
      assert.equal(disabled.status, 404)
      assert.equal(db.rpcCalls.length, 0)
    },
    { MOBILE_API_ENABLED: undefined },
  )
})

test("is not behind the scanner gate: a caller without access can post and learns the result", async () => {
  await withFake(async (db) => {
    // A lapsed period grants nothing; the scanner gate would have answered 402.
    const response = await post({
      signedTransactions: [
        jws(transaction({ purchaseDate: now - 8 * day, expiresDate: now - day })),
      ],
    })
    assert.equal(response.status, 200)
    const { access } = await response.json()
    assert.equal(access.status, "none")
    assert.equal(access.appStore.expiresAt, new Date(now - day).toISOString())
    assert.equal(db.transactions.size, 1)
  })
})

test("a token of a deleted account is claimable by the verified caller (A3 protects living accounts only)", async () => {
  const deletedUserId = "d0d0d0d0-3333-4333-8333-33333333dead"
  await withFake(async (db) => {
    db.profiles.add(deletedUserId)
    const token = { appAccountToken: deletedUserId }
    // The deleted account's history: bound period + renewal status, as the webhook stored them.
    db.transactions.set("2000000000000001", {
      transaction_id: "2000000000000001",
      original_transaction_id: "2000000000000001",
      user_id: deletedUserId,
      app_account_token: deletedUserId,
      environment: "Sandbox",
      signed_date: new Date(now - 2 * day).toISOString(),
      purchase_date: new Date(now - day).toISOString(),
      expires_date: new Date(now + 6 * day).toISOString(),
    })
    db.statuses.set("2000000000000001", {
      original_transaction_id: "2000000000000001",
      user_id: deletedUserId,
      environment: "Sandbox",
      signed_date: new Date(now - 2 * day).toISOString(),
    })
    // While that account lives, its token is refused.
    const refused = await post({ signedTransactions: [jws(transaction(token))] })
    assert.equal(refused.status, 409)

    db.deleteProfile(deletedUserId)
    assert.equal(db.transactions.size + db.statuses.size, 0, "rows cascade with the profile")
    const response = await post({ signedTransactions: [jws(transaction(token))] })
    assert.equal(response.status, 200)
    const { access } = await response.json()
    assert.equal(access.status, "active")
    assert.equal(access.source, "app_store")
    const write = db.rpcCalls.at(-1)
    assert.equal(write?.args.p_user_id, userId)
    assert.equal(db.transactions.get("2000000000000001")?.user_id, userId)
  })
})

test("a mixed batch writes the caller's own row and answers 409 with the access it unlocked", async () => {
  await withFake(async (db) => {
    const response = await post({
      signedTransactions: [
        jws(transaction()),
        jws(
          transaction({
            transactionId: "3000000000000001",
            originalTransactionId: "3000000000000001",
            appAccountToken: otherUserId,
          }),
        ),
      ],
    })
    assert.equal(response.status, 409)
    const body = await response.json()
    assert.equal(body.error, "owned_by_other_account")
    assert.equal(body.access.status, "active")
    assert.equal(body.access.source, "app_store")
    assert.equal(db.transactions.get("2000000000000001")?.user_id, userId)
    assert.equal(db.transactions.has("3000000000000001"), false)
  })
})

// ---- Signed renewal info posted by the app next to its transaction.

function renewal(overrides: Record<string, unknown> = {}) {
  return {
    originalTransactionId: "2000000000000001",
    productId: "de.chaarlie.scanner.yearly",
    autoRenewProductId: "de.chaarlie.scanner.yearly",
    autoRenewStatus: 1,
    signedDate: now - 500,
    environment: "Sandbox",
    ...overrides,
  }
}
const statusWrites = (db: ReturnType<typeof createAppStoreSupabase>) =>
  db.rpcCalls.filter((call) => call.name === "app_store_upsert_subscription_status")

test("renewal info of the caller's own purchase is stored and answers willRenew right away", async () => {
  await withFake(async (db) => {
    const response = await post({
      signedTransactions: [jws(transaction())],
      signedRenewalInfos: [jws(renewal())],
    })
    assert.equal(response.status, 200)
    const { access } = await response.json()
    assert.equal(access.appStore.willRenew, true)
    assert.equal(access.appStore.inBillingRetry, false)
    assert.deepEqual(
      db.rpcCalls.map((call) => call.name),
      ["app_store_upsert_transaction", "app_store_upsert_subscription_status"],
    )
    const status = db.statuses.get("2000000000000001")
    assert.equal(status?.user_id, userId)
    assert.equal(status?.auto_renew_status, true)
    assert.equal(status?.environment, "Sandbox")
    assert.equal(status?.last_notification_type, null)
  })
})

test("without renewal info (older app builds) the purchase still binds and willRenew stays false", async () => {
  await withFake(async (db) => {
    for (const body of [
      { signedTransactions: [jws(transaction())] },
      { signedTransactions: [jws(transaction())], signedRenewalInfos: [] },
    ]) {
      const response = await post(body)
      assert.equal(response.status, 200)
      assert.equal((await response.json()).access.appStore.willRenew, false)
    }
    assert.equal(statusWrites(db).length, 0)
  })
})

test("renewal info for a subscription not proven in the same request is ignored without a write", async () => {
  await withFake(async (db) => {
    // Unmatched: names a subscription whose transaction was not posted.
    const unmatched = await post({
      signedTransactions: [jws(transaction())],
      signedRenewalInfos: [jws(renewal({ originalTransactionId: "3000000000000001" }))],
    })
    assert.equal(unmatched.status, 200)
    // Same subscription ID, other environment: not the verified transaction's subscription.
    const otherEnvironment = await post({
      signedTransactions: [jws(transaction())],
      signedRenewalInfos: [jws(renewal({ environment: "Production" }))],
    })
    assert.equal(otherEnvironment.status, 200)
    assert.equal(statusWrites(db).length, 0)
    assert.equal(db.statuses.size, 0)
  })
})

test("renewal info never rides along with another account's purchase", async () => {
  await withFake(async (db) => {
    // A living account's token: the transaction is refused, so its renewal info is too.
    const foreignToken = await post({
      signedTransactions: [
        jws(
          transaction({
            transactionId: "3000000000000001",
            originalTransactionId: "3000000000000001",
            appAccountToken: otherUserId,
          }),
        ),
      ],
      signedRenewalInfos: [jws(renewal({ originalTransactionId: "3000000000000001" }))],
    })
    assert.equal(foreignToken.status, 409)
    assert.equal(db.rpcCalls.length, 0)

    // A token-less purchase of a subscription another account owns: recorded for the owner,
    // but the caller's renewal info is not written.
    db.transactions.set("4000000000000001", {
      transaction_id: "4000000000000001",
      original_transaction_id: "4000000000000001",
      user_id: otherUserId,
      environment: "Sandbox",
      signed_date: new Date(now - 2 * day).toISOString(),
      purchase_date: new Date(now - 2 * day).toISOString(),
      expires_date: new Date(now + 5 * day).toISOString(),
    })
    const ownedElsewhere = await post({
      signedTransactions: [
        jws(
          transaction({
            transactionId: "4000000000000002",
            originalTransactionId: "4000000000000001",
            appAccountToken: undefined,
          }),
        ),
      ],
      signedRenewalInfos: [
        jws(renewal({ originalTransactionId: "4000000000000001", autoRenewStatus: 0 })),
      ],
    })
    assert.equal(ownedElsewhere.status, 409)
    assert.equal(statusWrites(db).length, 0)
    assert.equal(db.statuses.size, 0)
  })
})

test("a forged renewal JWS rejects the whole batch before any write", async () => {
  await withFake(async (db) => {
    const response = await post({
      signedTransactions: [jws(transaction())],
      signedRenewalInfos: [jws(renewal(), chain())],
    })
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), { error: "invalid_transaction" })
    assert.equal(db.rpcCalls.length, 0)
  })
})

test("verified renewal info that is not a scanner status is dropped; the purchase still binds", async () => {
  await withFake(async (db) => {
    const response = await post({
      signedTransactions: [jws(transaction())],
      signedRenewalInfos: [jws(renewal({ autoRenewProductId: "de.chaarlie.other.monthly" }))],
    })
    assert.equal(response.status, 200)
    assert.equal((await response.json()).access.source, "app_store")
    assert.equal(statusWrites(db).length, 0)
    assert.equal(db.transactions.get("2000000000000001")?.user_id, userId)
  })
})

test("a retryable renewal verification failure is 503 and writes nothing", async () => {
  await withFake(async (db) => {
    const real = verifier()
    const flaky: AppStoreVerifier = {
      verifyTransaction: (value) => real.verifyTransaction(value),
      verifyRenewalInfo: async () => {
        throw new AppStoreVerificationError("retryable")
      },
      verifyNotification: (value) => real.verifyNotification(value),
    }
    const response = await post(
      { signedTransactions: [jws(transaction())], signedRenewalInfos: [jws(renewal())] },
      { verifier: () => flaky },
    )
    assert.equal(response.status, 503)
    assert.equal(db.rpcCalls.length, 0)
  })
})

test("a newer webhook status is not overwritten by older renewal info the app posts", async () => {
  await withFake(async (db) => {
    // Apple told the webhook auto-renew was turned off after the app fetched its copy.
    db.statuses.set("2000000000000001", {
      original_transaction_id: "2000000000000001",
      user_id: userId,
      environment: "Sandbox",
      auto_renew_status: false,
      auto_renew_product_id: "de.chaarlie.scanner.yearly",
      in_billing_retry: false,
      grace_period_expires_date: null,
      expiration_intent: null,
      signed_date: new Date(now - 100).toISOString(),
      last_notification_type: "DID_CHANGE_RENEWAL_STATUS",
    })
    const response = await post({
      signedTransactions: [jws(transaction())],
      signedRenewalInfos: [jws(renewal({ signedDate: now - 500 }))],
    })
    assert.equal(response.status, 200)
    assert.equal((await response.json()).access.appStore.willRenew, false)
    const status = db.statuses.get("2000000000000001")
    assert.equal(status?.auto_renew_status, false)
    assert.equal(status?.last_notification_type, "DID_CHANGE_RENEWAL_STATUS")

    // A newer app copy (auto-renew turned back on) does win.
    const newer = await post({
      signedTransactions: [jws(transaction())],
      signedRenewalInfos: [jws(renewal({ signedDate: now }))],
    })
    assert.equal((await newer.json()).access.appStore.willRenew, true)
  })
})

// ---- M2/M3/M5 fix-round tests (see .superpowers/sdd/plan/renewal-review.md)

type Reported = { tags: Record<string, string>; context: unknown; errors: unknown[] }
function recordingSink() {
  const reports: Reported[] = []
  return {
    reports,
    sink: {
      captureException(error: unknown) {
        reports.at(-1)!.errors.push(error)
      },
      withScope(callback: (scope: never) => void) {
        const report: Reported = { tags: {}, context: null, errors: [] }
        reports.push(report)
        callback({
          setTag: (key: string, value: string) => (report.tags[key] = value),
          setContext: (_name: string, context: unknown) => (report.context = context),
          setLevel: () => {},
        } as never)
      },
    },
  }
}

test("M2 a status-write failure after the transaction commits is reported but still answers success", async () => {
  await withFake(async (db) => {
    const { reports, sink } = recordingSink()
    db.state.failStatusWrites = 1
    const response = await post(
      { signedTransactions: [jws(transaction())], signedRenewalInfos: [jws(renewal())] },
      { verifier, sink },
    )
    assert.equal(response.status, 200)
    const { access } = await response.json()
    assert.equal(access.status, "active")
    assert.equal(access.source, "app_store")
    // The transaction commits even though its status write failed.
    assert.equal(db.transactions.get("2000000000000001")?.user_id, userId)
    assert.equal(db.statuses.size, 0, "the failed status write left no row")
    assert.equal(reports.length, 1)
    assert.deepEqual(reports[0].context, {
      stage: "record",
      error_name: "Error",
      error_code: "app_store_write_failed",
      notification_type: null,
      environment: "Sandbox",
    })
    assert.doesNotMatch(JSON.stringify(reports), new RegExp(userId))
  })
})

test("M3 an expired transaction plus grace-period renewal info grants access through the grace end", async () => {
  await withFake(async (db) => {
    const graceEnd = new Date(now + 2 * day)
    const response = await post({
      signedTransactions: [
        jws(transaction({ purchaseDate: now - 10 * day, expiresDate: now - day })),
      ],
      signedRenewalInfos: [
        jws(renewal({ isInBillingRetryPeriod: true, gracePeriodExpiresDate: graceEnd.getTime() })),
      ],
    })
    assert.equal(response.status, 200)
    const { access } = await response.json()
    assert.equal(access.status, "active")
    assert.equal(access.source, "app_store")
    assert.equal(access.appStore.inBillingRetry, true)
    // Billing-retry/grace fields map through the app path exactly as the webhook writes them.
    assert.equal(db.statuses.get("2000000000000001")?.in_billing_retry, true)
    assert.equal(
      db.statuses.get("2000000000000001")?.grace_period_expires_date,
      graceEnd.toISOString(),
    )
  })
})

test("M3 access ends once Apple's grace period has passed", async () => {
  await withFake(async (db) => {
    const graceEnd = now - 2 * day
    const response = await post({
      signedTransactions: [
        jws(transaction({ purchaseDate: now - 10 * day, expiresDate: now - 5 * day })),
      ],
      signedRenewalInfos: [
        jws(renewal({ isInBillingRetryPeriod: true, gracePeriodExpiresDate: graceEnd })),
      ],
    })
    assert.equal(response.status, 200)
    assert.equal((await response.json()).access.status, "none")
  })
})

test("M5 renewal info missing productId is dropped like a non-allowlisted product", async () => {
  await withFake(async (db) => {
    const response = await post({
      signedTransactions: [jws(transaction())],
      signedRenewalInfos: [jws(renewal({ productId: undefined, autoRenewProductId: undefined }))],
    })
    assert.equal(response.status, 200)
    assert.equal((await response.json()).access.source, "app_store")
    assert.equal(statusWrites(db).length, 0)
    assert.equal(db.statuses.size, 0)
  })
})

test("signedRenewalInfos is bounded like signedTransactions", async () => {
  await withFake(async (db) => {
    const one = jws(transaction())
    for (const signedRenewalInfos of [
      Array.from({ length: 21 }, () => "x"),
      ["x".repeat(16_385)],
      [""],
      [42],
      "not-an-array",
    ]) {
      const response = await post({ signedTransactions: [one], signedRenewalInfos })
      assert.equal(response.status, 400)
      assert.deepEqual(await response.json(), { error: "invalid_request" })
    }
    assert.equal(db.rpcCalls.length, 0)
    // 20 + 20 maximum-size entries pass the body limit and reach verification.
    const full = await post({
      signedTransactions: Array.from({ length: 20 }, () => "x".repeat(16_384)),
      signedRenewalInfos: Array.from({ length: 20 }, () => "x".repeat(16_384)),
    })
    assert.deepEqual(await full.json(), { error: "invalid_transaction" })
  })
})
