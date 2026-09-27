import assert from "node:assert/strict"
import test from "node:test"
import { handleAppStoreNotificationPost } from "../src/lib/app-store/notifications"
import { hasActiveAppStoreAccess } from "../src/lib/app-store/state"
import { loadAppStoreEntitlement } from "../src/lib/app-store/store"
import {
  AppStoreVerificationError,
  createAppStoreVerifier,
  type AppStoreVerifier,
} from "../src/lib/app-store/verify"
import { createAdminClient } from "../src/lib/supabase/admin"
import { POST as notificationsRoute } from "../src/app/api/app-store/notifications/route"
import { chain, jws, trusted } from "./helpers/app-store-jws"
import { appStoreEnv, createAppStoreSupabase, withEnv } from "./helpers/app-store-supabase"

const owner = "11111111-1111-4111-8111-111111111111"
const other = "22222222-2222-4222-8222-222222222222"
const deleted = "33333333-3333-4333-8333-333333333333"
const original = "2000000000000001"

// The webhook is public: it must work with the mobile API switched off entirely.
const webhookEnv = {
  ...appStoreEnv,
  MOBILE_API_ENABLED: undefined,
  MOBILE_AUTH_MODE: undefined,
  APP_STORE_BUNDLE_ID: undefined,
  APP_STORE_ENVIRONMENTS: undefined,
  APP_STORE_APP_APPLE_ID: undefined,
}

const day = 24 * 60 * 60 * 1000
const now = Date.now()
let clock = now - 10 * day
/** Strictly increasing signedDate per built notification, like Apple's. */
const tick = () => (clock += 1000)

function transaction(overrides: Record<string, unknown> = {}) {
  return {
    transactionId: original,
    originalTransactionId: original,
    bundleId: "de.chaarlie.app",
    productId: "de.chaarlie.scanner.monthly",
    type: "Auto-Renewable Subscription",
    purchaseDate: now - 2 * day,
    expiresDate: now + 28 * day,
    signedDate: clock,
    environment: "Production",
    inAppOwnershipType: "PURCHASED",
    appAccountToken: owner,
    ...overrides,
  }
}
function renewal(overrides: Record<string, unknown> = {}) {
  return {
    originalTransactionId: original,
    productId: "de.chaarlie.scanner.monthly",
    autoRenewProductId: "de.chaarlie.scanner.monthly",
    autoRenewStatus: 1,
    signedDate: clock,
    environment: "Production",
    ...overrides,
  }
}
function notification(
  notificationType: string,
  parts: {
    subtype?: string
    transaction?: Record<string, unknown> | null
    renewal?: Record<string, unknown> | null
  } = {},
) {
  const signedDate = tick()
  const data: Record<string, unknown> = {
    environment: "Production",
    bundleId: "de.chaarlie.app",
    appAppleId: 1234567890,
  }
  if (parts.transaction !== null)
    data.signedTransactionInfo = jws(transaction({ signedDate, ...parts.transaction }))
  if (parts.renewal !== null)
    data.signedRenewalInfo = jws(renewal({ signedDate, ...parts.renewal }))
  return jws({
    notificationType,
    ...(parts.subtype ? { subtype: parts.subtype } : {}),
    notificationUUID: crypto.randomUUID(),
    version: "2.0",
    signedDate,
    data,
  })
}

const verifier = () =>
  createAppStoreVerifier({
    bundleId: "de.chaarlie.app",
    appAppleId: 1234567890,
    environments: ["Production", "Sandbox"],
    rootCertificates: [trusted.root.der],
    enableOnlineChecks: false,
  })

function request(body: unknown) {
  return new Request("https://chaarlie.de/api/app-store/notifications", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}
const deliver = (
  signedPayload: string,
  deps: { verifier?: () => AppStoreVerifier } = { verifier },
) => handleAppStoreNotificationPost(request({ signedPayload }), deps)

type Db = ReturnType<typeof createAppStoreSupabase>
async function withFake(run: (db: Db, warnings: unknown[]) => Promise<void>) {
  const restoreEnv = withEnv(webhookEnv)
  const db = createAppStoreSupabase({ profiles: [owner, other] })
  const restoreFetch = db.install()
  const warn = console.warn
  const warnings: unknown[] = []
  console.warn = (...args: unknown[]) => warnings.push(args)
  try {
    await run(db, warnings)
  } finally {
    console.warn = warn
    restoreFetch()
    restoreEnv()
  }
}

async function ok(response: Response) {
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { received: true })
}
const accessAt = async (userId: string, at: number) =>
  hasActiveAppStoreAccess(await loadAppStoreEntitlement(createAdminClient(), userId), new Date(at))

test("TEST and unrecorded notification types are acknowledged without writes", async () => {
  await withFake(async (db) => {
    await ok(await deliver(notification("TEST", { transaction: null, renewal: null })))
    await ok(await deliver(notification("PRICE_INCREASE", { subtype: "PENDING" })))
    await ok(await deliver(notification("CONSUMPTION_REQUEST")))
    await ok(await deliver(notification("SOMETHING_APPLE_ADDS_LATER")))
    assert.equal(db.rpcCalls.length, 0)
  })
})

test("SUBSCRIBED binds the transaction and renewal status via appAccountToken", async () => {
  await withFake(async (db) => {
    await ok(await deliver(notification("SUBSCRIBED", { subtype: "INITIAL_BUY" })))
    assert.equal(db.transactions.get(original)?.user_id, owner)
    assert.equal(db.statuses.get(original)?.user_id, owner)
    assert.equal(db.statuses.get(original)?.last_notification_type, "SUBSCRIBED")
    assert.equal(await accessAt(owner, now), true)
    assert.equal(await accessAt(other, now), false)
  })
})

test("DID_RENEW without a token extends access: the new period inherits the owner", async () => {
  await withFake(async (db) => {
    await ok(await deliver(notification("SUBSCRIBED")))
    await ok(
      await deliver(
        notification("DID_RENEW", {
          transaction: {
            transactionId: "2000000000000002",
            appAccountToken: undefined,
            purchaseDate: now + 28 * day,
            expiresDate: now + 58 * day,
          },
        }),
      ),
    )
    assert.equal(
      db.rpcCalls.find(
        (call) =>
          call.name.endsWith("transaction") && call.args.p_transaction_id === "2000000000000002",
      )?.args.p_user_id,
      null,
    )
    assert.equal(db.transactions.get("2000000000000002")?.user_id, owner)
    assert.equal(await accessAt(owner, now + 40 * day), true)
  })
})

test("DID_FAIL_TO_RENEW with a grace period keeps access until the grace period ends", async () => {
  await withFake(async (db) => {
    await ok(await deliver(notification("SUBSCRIBED", { transaction: { expiresDate: now - day } })))
    await ok(
      await deliver(
        notification("DID_FAIL_TO_RENEW", {
          subtype: "GRACE_PERIOD",
          transaction: { expiresDate: now - day },
          renewal: { isInBillingRetryPeriod: true, gracePeriodExpiresDate: now + 5 * day },
        }),
      ),
    )
    assert.equal(db.statuses.get(original)?.in_billing_retry, true)
    assert.equal(await accessAt(owner, now), true)
    assert.equal(await accessAt(owner, now + 6 * day), false)

    // GRACE_PERIOD_EXPIRED: still in billing retry, but the grace period is over.
    await ok(
      await deliver(
        notification("GRACE_PERIOD_EXPIRED", {
          transaction: { expiresDate: now - day },
          renewal: { isInBillingRetryPeriod: true, gracePeriodExpiresDate: now - 1000 },
        }),
      ),
    )
    assert.equal(await accessAt(owner, now), false)
  })
})

test("DID_FAIL_TO_RENEW without a grace period ends access at expiry", async () => {
  await withFake(async (db) => {
    await ok(
      await deliver(
        notification("DID_FAIL_TO_RENEW", {
          transaction: { expiresDate: now - day },
          renewal: { isInBillingRetryPeriod: true },
        }),
      ),
    )
    assert.equal(db.statuses.get(original)?.grace_period_expires_date, null)
    assert.equal(await accessAt(owner, now), false)
  })
})

test("DID_CHANGE_RENEWAL_STATUS / _PREF update the renewal row only; EXPIRED ends access", async () => {
  await withFake(async (db) => {
    await ok(await deliver(notification("SUBSCRIBED")))
    await ok(
      await deliver(
        notification("DID_CHANGE_RENEWAL_PREF", {
          subtype: "DOWNGRADE",
          renewal: { autoRenewProductId: "de.chaarlie.scanner.yearly" },
        }),
      ),
    )
    assert.equal(db.statuses.get(original)?.auto_renew_product_id, "de.chaarlie.scanner.yearly")
    await ok(
      await deliver(
        notification("DID_CHANGE_RENEWAL_STATUS", {
          subtype: "AUTO_RENEW_DISABLED",
          renewal: { autoRenewStatus: 0 },
        }),
      ),
    )
    assert.equal(db.statuses.get(original)?.auto_renew_status, false)
    assert.equal(await accessAt(owner, now), true)
    await ok(
      await deliver(
        notification("EXPIRED", {
          subtype: "VOLUNTARY",
          transaction: { expiresDate: now - 1000 },
          renewal: { autoRenewStatus: 0, expirationIntent: 1 },
        }),
      ),
    )
    assert.equal(db.statuses.get(original)?.expiration_intent, 1)
    assert.equal(await accessAt(owner, now), false)
  })
})

test("REFUND and REVOKE revoke the named transaction; REFUND_REVERSED restores it", async () => {
  await withFake(async (db) => {
    await ok(await deliver(notification("SUBSCRIBED")))
    await ok(
      await deliver(
        notification("REFUND", {
          transaction: { revocationDate: now - 1000, revocationReason: 0 },
        }),
      ),
    )
    assert.ok(db.transactions.get(original)?.revocation_date)
    assert.equal(await accessAt(owner, now), false)
    await ok(await deliver(notification("REFUND_REVERSED")))
    assert.equal(db.transactions.get(original)?.revocation_date, null)
    assert.equal(await accessAt(owner, now), true)
    // Family-sharing style revoke without an explicit date still revokes.
    await ok(await deliver(notification("REVOKE")))
    assert.ok(db.transactions.get(original)?.revocation_date)
    assert.equal(await accessAt(owner, now), false)
  })
})

test("replaying a notification is idempotent", async () => {
  await withFake(async (db) => {
    const payload = notification("SUBSCRIBED")
    await ok(await deliver(payload))
    const snapshot = JSON.stringify([...db.transactions.values(), ...db.statuses.values()])
    await ok(await deliver(payload))
    await ok(await deliver(payload))
    assert.equal(JSON.stringify([...db.transactions.values(), ...db.statuses.values()]), snapshot)
    assert.equal(db.transactions.size, 1)
    assert.equal(db.statuses.size, 1)
  })
})

test("out-of-order delivery: an older notification never overwrites newer state", async () => {
  await withFake(async (db) => {
    const olderRenew = notification("DID_RENEW", { renewal: { autoRenewStatus: 1 } })
    const newerRefund = notification("REFUND", {
      transaction: { revocationDate: now - 1000 },
      renewal: { autoRenewStatus: 0 },
    })
    await ok(await deliver(newerRefund))
    await ok(await deliver(olderRenew))
    assert.ok(db.transactions.get(original)?.revocation_date)
    assert.equal(db.statuses.get(original)?.auto_renew_status, false)
    assert.equal(db.statuses.get(original)?.last_notification_type, "REFUND")
    assert.equal(await accessAt(owner, now), false)
  })
})

test("a token of a deleted account leaves the rows unbound instead of failing forever", async () => {
  await withFake(async (db) => {
    await ok(
      await deliver(notification("DID_RENEW", { transaction: { appAccountToken: deleted } })),
    )
    assert.equal(db.transactions.get(original)?.user_id, null)
    assert.equal(db.transactions.get(original)?.app_account_token, deleted)
    assert.equal(db.statuses.get(original)?.user_id, null)
  })
})

test("a token naming a different account than the owner keeps the owner and is logged", async () => {
  await withFake(async (db, warnings) => {
    await ok(await deliver(notification("SUBSCRIBED")))
    await ok(
      await deliver(
        notification("DID_RENEW", {
          transaction: { transactionId: "2000000000000002", appAccountToken: other },
        }),
      ),
    )
    assert.equal(db.transactions.get("2000000000000002")?.user_id, owner)
    const logged = JSON.stringify(warnings)
    assert.match(logged, /owned_by_other_account/)
    assert.doesNotMatch(logged, new RegExp(`${owner}|${other}|${original}`))
  })
})

test("unverified input is rejected with 400 and never written", async () => {
  await withFake(async (db) => {
    const untrusted = jws(
      {
        notificationType: "SUBSCRIBED",
        notificationUUID: crypto.randomUUID(),
        signedDate: tick(),
        data: {
          environment: "Production",
          bundleId: "de.chaarlie.app",
          appAppleId: 1234567890,
          signedTransactionInfo: jws(transaction(), chain()),
        },
      },
      chain(),
    )
    const [header, , signature] = notification("SUBSCRIBED").split(".")
    const tampered = `${header}.${Buffer.from(JSON.stringify({ notificationType: "REFUND" })).toString("base64url")}.${signature}`
    for (const payload of [untrusted, tampered, "not-a-jws"]) {
      const response = await deliver(payload)
      assert.equal(response.status, 400)
      assert.deepEqual(await response.json(), { error: "invalid_notification" })
    }
    // A valid envelope cannot carry a transaction signed by another chain.
    const smuggled = jws({
      notificationType: "SUBSCRIBED",
      notificationUUID: crypto.randomUUID(),
      signedDate: tick(),
      data: {
        environment: "Production",
        bundleId: "de.chaarlie.app",
        appAppleId: 1234567890,
        signedTransactionInfo: jws(transaction(), chain()),
      },
    })
    assert.equal((await deliver(smuggled)).status, 400)
    assert.equal(db.rpcCalls.length, 0)
  })
})

test("malformed bodies are 400", async () => {
  await withFake(async (db) => {
    for (const body of ["not json", {}, { signedPayload: "" }, { signedPayload: 42 }, []]) {
      const response = await handleAppStoreNotificationPost(request(body), { verifier })
      assert.equal(response.status, 400)
      assert.deepEqual(await response.json(), { error: "invalid_request" })
    }
    const oversized = await handleAppStoreNotificationPost(
      request({ signedPayload: "x".repeat(65_537) }),
      { verifier },
    )
    assert.equal(oversized.status, 400)
    assert.equal(db.rpcCalls.length, 0)
  })
})

test("a retryable verification failure and missing configuration are 503 (Apple retries)", async () => {
  await withFake(async (db) => {
    const unreachable: AppStoreVerifier = {
      verifyTransaction: async () => {
        throw new Error("unused")
      },
      verifyRenewalInfo: async () => {
        throw new Error("unused")
      },
      verifyNotification: async () => {
        throw new AppStoreVerificationError("retryable")
      },
    }
    const retry = await deliver(notification("SUBSCRIBED"), { verifier: () => unreachable })
    assert.equal(retry.status, 503)
    const unconfigured = await notificationsRoute(
      request({ signedPayload: notification("SUBSCRIBED") }),
    )
    assert.equal(unconfigured.status, 503)
    assert.deepEqual(await unconfigured.json(), { error: "temporarily_unavailable" })
    assert.equal(db.rpcCalls.length, 0)
  })
})

test("a transient database failure is 503 and the retry then succeeds", async () => {
  await withFake(async (db) => {
    const payload = notification("SUBSCRIBED")
    db.state.failWrites = 1
    const failed = await deliver(payload)
    assert.equal(failed.status, 503)
    assert.deepEqual(await failed.json(), { error: "temporarily_unavailable" })
    await ok(await deliver(payload))
    assert.equal(db.transactions.get(original)?.user_id, owner)
    assert.equal(db.statuses.get(original)?.user_id, owner)
  })
})

test("a verified payload that is not a storable subscription row is acknowledged without writes", async () => {
  await withFake(async (db, warnings) => {
    await ok(await deliver(notification("REFUND", { transaction: { type: "Consumable" } })))
    assert.equal(db.rpcCalls.length, 0)
    assert.match(JSON.stringify(warnings), /invalid_payload/)
  })
})
