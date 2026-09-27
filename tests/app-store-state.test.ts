import assert from "node:assert/strict"
import test from "node:test"
import {
  AppStoreStateError,
  hasActiveAppStoreAccess,
  mergeBySignedDate,
  renewalStatusSnapshot,
  transactionSnapshot,
  type AppStoreSubscriptionStatusRow,
  type AppStoreTransactionRow,
} from "../src/lib/app-store/state"

const day = 24 * 60 * 60 * 1000
const t0 = Date.parse("2026-09-01T10:00:00.000Z")
const now = new Date(t0 + 10 * day)

function transaction(overrides: Record<string, unknown> = {}) {
  return {
    transactionId: "2000000000000002",
    originalTransactionId: "2000000000000001",
    bundleId: "de.chaarlie.app",
    productId: "de.chaarlie.scanner.monthly",
    type: "Auto-Renewable Subscription",
    purchaseDate: t0,
    expiresDate: t0 + 30 * day,
    signedDate: t0 + 1000,
    environment: "Production",
    appAccountToken: "11111111-1111-4111-8111-111111111111",
    ...overrides,
  }
}

function renewal(overrides: Record<string, unknown> = {}) {
  return {
    originalTransactionId: "2000000000000001",
    productId: "de.chaarlie.scanner.monthly",
    autoRenewProductId: "de.chaarlie.scanner.monthly",
    autoRenewStatus: 1,
    isInBillingRetryPeriod: false,
    signedDate: t0 + 1000,
    environment: "Production",
    ...overrides,
  }
}

const tx = (overrides: Record<string, unknown> = {}, notificationType?: string) =>
  transactionSnapshot(transaction(overrides), { environment: "Production", notificationType })
const status = (overrides: Record<string, unknown> = {}) =>
  renewalStatusSnapshot(renewal(overrides), { environment: "Production" })

function access(
  transactions: AppStoreTransactionRow[],
  statuses: AppStoreSubscriptionStatusRow[] = [],
) {
  return hasActiveAppStoreAccess({ transactions, statuses }, now)
}

test("S1 a current, unrevoked period grants access", () => {
  const row = tx()
  assert.equal(row.transactionId, "2000000000000002")
  assert.equal(row.originalTransactionId, "2000000000000001")
  assert.equal(row.appAccountToken, "11111111-1111-4111-8111-111111111111")
  assert.equal(row.environment, "Production")
  assert.equal(row.revocationDate, null)
  assert.equal(access([row]), true)
})

test("S2 an expired period grants no access", () => {
  assert.equal(access([tx({ expiresDate: now.getTime() - 1 })]), false)
  assert.equal(access([]), false)
})

test("S3 billing retry inside the grace period keeps access", () => {
  const expired = tx({ expiresDate: now.getTime() - day })
  const retry = status({
    autoRenewStatus: 1,
    isInBillingRetryPeriod: true,
    gracePeriodExpiresDate: now.getTime() + day,
  })
  assert.equal(retry.inBillingRetry, true)
  assert.equal(retry.gracePeriodExpiresDate?.getTime(), now.getTime() + day)
  assert.equal(access([expired], [retry]), true)
})

test("S4 billing retry without an open grace period grants no access", () => {
  const expired = tx({ expiresDate: now.getTime() - day })
  assert.equal(access([expired], [status({ isInBillingRetryPeriod: true })]), false)
  assert.equal(
    access(
      [expired],
      [status({ isInBillingRetryPeriod: true, gracePeriodExpiresDate: now.getTime() })],
    ),
    false,
  )
  // A grace date without billing retry is stale renewal state, not an entitlement.
  assert.equal(
    access(
      [expired],
      [status({ isInBillingRetryPeriod: false, gracePeriodExpiresDate: now.getTime() + day })],
    ),
    false,
  )
})

test("S5 a refund of the current period removes access", () => {
  const current = tx()
  const refunded = tx(
    { revocationDate: now.getTime() - 1000, revocationReason: 0, signedDate: now.getTime() - 500 },
    "REFUND",
  )
  const merged = mergeBySignedDate(current, refunded)
  assert.equal(merged.revocationDate?.getTime(), now.getTime() - 1000)
  assert.equal(merged.revocationReason, 0)
  assert.equal(access([merged]), false)

  // REVOKE (Family Sharing withdrawal) revokes the named transaction the same way.
  const revoked = tx({ signedDate: now.getTime() - 500 }, "REVOKE")
  assert.equal(revoked.revocationDate?.getTime(), now.getTime() - 500)
  assert.equal(access([mergeBySignedDate(current, revoked)]), false)
})

test("S6 a refund of an older period leaves the current period active", () => {
  const older = tx(
    {
      transactionId: "2000000000000001",
      purchaseDate: t0 - 30 * day,
      expiresDate: t0,
      revocationDate: now.getTime() - 1000,
      signedDate: now.getTime() - 500,
    },
    "REFUND",
  )
  assert.equal(access([older, tx()]), true)
})

test("S7 REFUND_REVERSED clears only that transaction's revocation", () => {
  const refunded = tx({
    revocationDate: t0 + 2 * day,
    revocationReason: 1,
    signedDate: t0 + 2 * day,
  })
  assert.equal(access([refunded]), false)
  // Apple's reversed transaction may still echo the old revocation fields.
  const reversed = tx(
    { revocationDate: t0 + 2 * day, revocationReason: 1, signedDate: t0 + 3 * day },
    "REFUND_REVERSED",
  )
  assert.equal(reversed.revocationDate, null)
  assert.equal(reversed.revocationReason, null)
  const merged = mergeBySignedDate(refunded, reversed)
  assert.equal(access([merged]), true)
})

test("S8 an older signedDate never overwrites newer state for the same row, whatever the arrival order", () => {
  const arrive = <T extends { signedDate: Date }>(...rows: T[]) =>
    rows.reduce<T | null>((stored, incoming) => mergeBySignedDate(stored, incoming), null)!

  // Same transaction: the REFUND (newer) is stored before a stale device copy (older) arrives.
  const refunded = tx({ revocationDate: t0 + 5 * day, signedDate: t0 + 5 * day }, "REFUND")
  const staleCopy = tx({ signedDate: t0 + 1000 })
  assert.equal(arrive(refunded, staleCopy), refunded)
  assert.equal(arrive(staleCopy, refunded), refunded)
  assert.equal(access([arrive(refunded, staleCopy)]), false)
  // An identical replay (same signedDate) is idempotent.
  assert.deepEqual(arrive(refunded, { ...refunded }), refunded)

  // Same renewal transaction: DID_RENEW extended expiresDate (newer) arrives before the
  // app's earlier copy of that transaction with the original expiresDate (older).
  const renewed = tx({ expiresDate: now.getTime() + 20 * day, signedDate: now.getTime() - day })
  const earlierCopy = tx({ expiresDate: now.getTime() - day, signedDate: t0 + 1000 })
  assert.equal(arrive(renewed, earlierCopy), renewed)
  assert.equal(access([arrive(renewed, earlierCopy)]), true)

  // Same status row: DID_FAIL_TO_RENEW (retry + grace, newer) arrives before a delayed
  // DID_RENEW-era renewal info (no retry, older); the grace entitlement survives.
  const expired = tx({ expiresDate: now.getTime() - day })
  const retry = status({
    isInBillingRetryPeriod: true,
    gracePeriodExpiresDate: now.getTime() + day,
    signedDate: now.getTime() - 1000,
  })
  const olderRenewal = status({ isInBillingRetryPeriod: false, signedDate: t0 + 2 * day })
  assert.equal(arrive(retry, olderRenewal), retry)
  assert.equal(access([expired], [arrive(retry, olderRenewal)]), true)
  assert.equal(access([expired], [arrive(olderRenewal, retry)]), true)

  // Different periods are separate rows: a late period-1 copy never hides period 2.
  const period2 = tx({
    transactionId: "2000000000000003",
    purchaseDate: t0 + 30 * day,
    expiresDate: t0 + 60 * day,
    signedDate: t0 + 30 * day,
  })
  const latePeriod1 = tx({ expiresDate: now.getTime() - 1, signedDate: t0 + 1000 })
  assert.equal(
    hasActiveAppStoreAccess(
      { transactions: [period2, latePeriod1], statuses: [] },
      new Date(t0 + 31 * day),
    ),
    true,
  )
})

test("S9 the free introductory week is flagged as a trial and grants access", () => {
  const trial = tx({
    productId: "de.chaarlie.scanner.yearly",
    offerType: 1,
    offerDiscountType: "FREE_TRIAL",
    purchaseDate: now.getTime() - 2 * day,
    expiresDate: now.getTime() + 5 * day,
  })
  assert.equal(trial.isTrial, true)
  assert.equal(trial.offerType, 1)
  assert.equal(access([trial]), true)
  assert.equal(tx().isTrial, false)
  assert.equal(tx().offerType, null)
  assert.equal(tx({ offerType: 1, offerDiscountType: "PAY_AS_YOU_GO" }).isTrial, false)
  assert.equal(tx({ offerType: 2, offerDiscountType: "FREE_TRIAL" }).isTrial, false)
})

test("S10 a payload whose environment differs from the verified environment is rejected", () => {
  assert.throws(
    () =>
      transactionSnapshot(transaction({ environment: "Sandbox" }), { environment: "Production" }),
    (error: unknown) =>
      error instanceof AppStoreStateError && error.code === "environment_mismatch",
  )
  assert.throws(
    () => renewalStatusSnapshot(renewal({ environment: "Xcode" }), { environment: "Sandbox" }),
    (error: unknown) =>
      error instanceof AppStoreStateError && error.code === "environment_mismatch",
  )
  assert.throws(
    () =>
      transactionSnapshot(transaction({ environment: "LocalTesting" }), {
        environment: "LocalTesting" as never,
      }),
    (error: unknown) =>
      error instanceof AppStoreStateError && error.code === "environment_mismatch",
  )
})

test("S11 access ends exactly at expiresDate and starts exactly at purchaseDate", () => {
  const row = tx()
  assert.equal(
    hasActiveAppStoreAccess({ transactions: [row], statuses: [] }, new Date(t0 + 30 * day)),
    false,
  )
  assert.equal(
    hasActiveAppStoreAccess({ transactions: [row], statuses: [] }, new Date(t0 + 30 * day - 1)),
    true,
  )
  assert.equal(hasActiveAppStoreAccess({ transactions: [row], statuses: [] }, new Date(t0)), true)
  assert.equal(
    hasActiveAppStoreAccess({ transactions: [row], statuses: [] }, new Date(t0 - 1)),
    false,
  )
  const retry = status({ isInBillingRetryPeriod: true, gracePeriodExpiresDate: t0 + 40 * day })
  const expired = { ...row }
  assert.equal(
    hasActiveAppStoreAccess(
      { transactions: [expired], statuses: [retry] },
      new Date(t0 + 40 * day),
    ),
    false,
  )
})

test("malformed or non-subscription payloads are rejected, never defaulted", () => {
  for (const broken of [
    { transactionId: undefined },
    { originalTransactionId: "" },
    { productId: undefined },
    { purchaseDate: undefined },
    { expiresDate: undefined },
    { signedDate: undefined },
    { purchaseDate: Number.NaN },
    { type: "Consumable" },
    { appAccountToken: "not-a-uuid" },
  ]) {
    assert.throws(
      () => tx(broken),
      (error: unknown) => error instanceof AppStoreStateError && error.code === "invalid_payload",
      JSON.stringify(broken),
    )
  }
  assert.equal(tx({ appAccountToken: undefined }).appAccountToken, null)
  assert.equal(
    tx({ appAccountToken: "AAAAAAAA-1111-4111-8111-111111111111" }).appAccountToken,
    "aaaaaaaa-1111-4111-8111-111111111111",
  )
  assert.throws(
    () => status({ originalTransactionId: undefined }),
    (error: unknown) => error instanceof AppStoreStateError && error.code === "invalid_payload",
  )
  assert.throws(
    () => status({ signedDate: undefined }),
    (error: unknown) => error instanceof AppStoreStateError && error.code === "invalid_payload",
  )
})

test("renewal snapshot records renewal intent and the triggering notification", () => {
  const row = renewalStatusSnapshot(
    renewal({
      autoRenewStatus: 0,
      expirationIntent: 1,
      autoRenewProductId: "de.chaarlie.scanner.yearly",
    }),
    { environment: "Production", notificationType: "DID_CHANGE_RENEWAL_STATUS" },
  )
  assert.deepEqual(row, {
    originalTransactionId: "2000000000000001",
    environment: "Production",
    autoRenewStatus: false,
    autoRenewProductId: "de.chaarlie.scanner.yearly",
    inBillingRetry: false,
    gracePeriodExpiresDate: null,
    expirationIntent: 1,
    signedDate: new Date(t0 + 1000),
    lastNotificationType: "DID_CHANGE_RENEWAL_STATUS",
  })
})
