/**
 * Pure App Store entitlement state: verified Apple payloads → row snapshots, the
 * newer-wins merge, and the access rule. No I/O, so every rule is fixture-tested.
 *
 * Access = some unrevoked transaction with purchaseDate <= now < expiresDate, OR a
 * renewal status in billing retry whose grace period is still open. No clock tolerance.
 */

export const APP_STORE_ENVIRONMENTS = ["Production", "Sandbox", "Xcode"] as const
export type AppStoreEnvironment = (typeof APP_STORE_ENVIRONMENTS)[number]

/**
 * The only products that unlock the scanner (plan §4, group "Chaarlie Scanner"). A
 * verified auto-renewable subscription of any other product of the bundle is rejected
 * before a write and never counts toward access.
 */
export const APP_STORE_SCANNER_PRODUCT_IDS: readonly string[] = [
  "de.chaarlie.scanner.monthly",
  "de.chaarlie.scanner.yearly",
]

export function isScannerProductId(value: unknown): boolean {
  return typeof value === "string" && APP_STORE_SCANNER_PRODUCT_IDS.includes(value)
}

export type AppStoreTransactionRow = {
  transactionId: string
  originalTransactionId: string
  appAccountToken: string | null
  productId: string
  environment: AppStoreEnvironment
  purchaseDate: Date
  expiresDate: Date
  offerType: number | null
  isTrial: boolean
  revocationDate: Date | null
  revocationReason: number | null
  signedDate: Date
}

export type AppStoreSubscriptionStatusRow = {
  originalTransactionId: string
  environment: AppStoreEnvironment
  autoRenewStatus: boolean
  autoRenewProductId: string | null
  inBillingRetry: boolean
  gracePeriodExpiresDate: Date | null
  expirationIntent: number | null
  signedDate: Date
  lastNotificationType: string | null
}

export type AppStoreEntitlementSnapshot = {
  transactions: readonly AppStoreTransactionRow[]
  statuses: readonly AppStoreSubscriptionStatusRow[]
}

export class AppStoreStateError extends Error {
  constructor(readonly code: "environment_mismatch" | "invalid_payload" | "unknown_product") {
    super(code)
    this.name = "AppStoreStateError"
  }
}

type SnapshotContext = {
  /** The environment whose verifier accepted the signature. */
  environment: AppStoreEnvironment
  notificationType?: string
}

const AUTO_RENEWABLE = "Auto-Renewable Subscription"
const INTRODUCTORY_OFFER = 1
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function requiredId(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 64)
    throw new AppStoreStateError("invalid_payload")
  return value
}

function requiredDate(value: unknown): Date {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new AppStoreStateError("invalid_payload")
  return new Date(value)
}

function optionalDate(value: unknown): Date | null {
  return value === undefined || value === null ? null : requiredDate(value)
}

function optionalInteger(value: unknown): number | null {
  if (value === undefined || value === null) return null
  if (!Number.isInteger(value)) throw new AppStoreStateError("invalid_payload")
  return value as number
}

function matchEnvironment(value: unknown, context: SnapshotContext): AppStoreEnvironment {
  if (
    value !== context.environment ||
    !(APP_STORE_ENVIRONMENTS as readonly unknown[]).includes(context.environment)
  )
    throw new AppStoreStateError("environment_mismatch")
  return context.environment
}

type TransactionPayload = {
  transactionId?: unknown
  originalTransactionId?: unknown
  productId?: unknown
  type?: unknown
  purchaseDate?: unknown
  expiresDate?: unknown
  signedDate?: unknown
  environment?: unknown
  appAccountToken?: unknown
  offerType?: unknown
  offerDiscountType?: unknown
  revocationDate?: unknown
  revocationReason?: unknown
}

export function transactionSnapshot(
  payload: TransactionPayload,
  context: SnapshotContext,
): AppStoreTransactionRow {
  const environment = matchEnvironment(payload.environment, context)
  if (payload.type !== AUTO_RENEWABLE) throw new AppStoreStateError("invalid_payload")
  const productId = requiredId(payload.productId)
  if (!isScannerProductId(productId)) throw new AppStoreStateError("unknown_product")
  const token = payload.appAccountToken
  if (token !== undefined && (typeof token !== "string" || !UUID.test(token)))
    throw new AppStoreStateError("invalid_payload")
  const offerType = optionalInteger(payload.offerType)
  const signedDate = requiredDate(payload.signedDate)
  let revocationDate = optionalDate(payload.revocationDate)
  let revocationReason = optionalInteger(payload.revocationReason)
  if (context.notificationType === "REFUND_REVERSED") {
    revocationDate = null
    revocationReason = null
  } else if (
    (context.notificationType === "REFUND" || context.notificationType === "REVOKE") &&
    revocationDate === null
  ) {
    // The named transaction is revoked even if Apple omitted the date.
    revocationDate = signedDate
  }
  return {
    transactionId: requiredId(payload.transactionId),
    originalTransactionId: requiredId(payload.originalTransactionId),
    appAccountToken: typeof token === "string" ? token.toLowerCase() : null,
    productId,
    environment,
    purchaseDate: requiredDate(payload.purchaseDate),
    expiresDate: requiredDate(payload.expiresDate),
    offerType,
    // Our only introductory offer is the free week; older payloads omit the discount type.
    isTrial:
      offerType === INTRODUCTORY_OFFER &&
      (payload.offerDiscountType === undefined || payload.offerDiscountType === "FREE_TRIAL"),
    revocationDate,
    revocationReason,
    signedDate,
  }
}

type RenewalPayload = {
  originalTransactionId?: unknown
  productId?: unknown
  autoRenewStatus?: unknown
  autoRenewProductId?: unknown
  isInBillingRetryPeriod?: unknown
  gracePeriodExpiresDate?: unknown
  expirationIntent?: unknown
  signedDate?: unknown
  environment?: unknown
}

export function renewalStatusSnapshot(
  payload: RenewalPayload,
  context: SnapshotContext,
): AppStoreSubscriptionStatusRow {
  const environment = matchEnvironment(payload.environment, context)
  // Renewal info names the subscription's product (and its next one); both must be ours.
  // productId is optional in Apple's payload, so a missing one passes here (webhook and
  // reconciliation bind through Apple's own transaction); the app path requires it.
  for (const product of [payload.productId, payload.autoRenewProductId])
    if (product !== undefined && product !== null && product !== "" && !isScannerProductId(product))
      throw new AppStoreStateError("unknown_product")
  return {
    originalTransactionId: requiredId(payload.originalTransactionId),
    environment,
    autoRenewStatus: payload.autoRenewStatus === 1,
    autoRenewProductId:
      typeof payload.autoRenewProductId === "string" && payload.autoRenewProductId
        ? payload.autoRenewProductId
        : null,
    inBillingRetry: payload.isInBillingRetryPeriod === true,
    gracePeriodExpiresDate: optionalDate(payload.gracePeriodExpiresDate),
    expirationIntent: optionalInteger(payload.expirationIntent),
    signedDate: requiredDate(payload.signedDate),
    lastNotificationType: context.notificationType ?? null,
  }
}

/**
 * Newer-wins for one row key; an equal signedDate is an idempotent replay. Production
 * enforcement is the SQL guard in app_store_upsert_*; this is its reference form.
 */
export function mergeBySignedDate<T extends { signedDate: Date }>(
  existing: T | null,
  incoming: T,
): T {
  if (existing && incoming.signedDate.getTime() < existing.signedDate.getTime()) return existing
  return incoming
}

/**
 * The rows that may count: scanner-product transactions and the renewal status of their
 * subscriptions. Writes already reject other products; this keeps any row that predates
 * or bypasses that check from granting or being displayed.
 */
export function scannerEntitlementRows(
  snapshot: AppStoreEntitlementSnapshot,
): AppStoreEntitlementSnapshot {
  const transactions = snapshot.transactions.filter((row) => isScannerProductId(row.productId))
  const originals = new Set(transactions.map((row) => row.originalTransactionId))
  return {
    transactions,
    statuses: snapshot.statuses.filter((row) => originals.has(row.originalTransactionId)),
  }
}

export function hasActiveAppStoreAccess(snapshot: AppStoreEntitlementSnapshot, now: Date): boolean {
  const at = now.getTime()
  const rows = scannerEntitlementRows(snapshot)
  return (
    rows.transactions.some(
      (row) =>
        row.revocationDate === null &&
        row.purchaseDate.getTime() <= at &&
        at < row.expiresDate.getTime(),
    ) ||
    rows.statuses.some(
      (row) =>
        row.inBillingRetry &&
        row.gracePeriodExpiresDate !== null &&
        row.gracePeriodExpiresDate.getTime() > at,
    )
  )
}
