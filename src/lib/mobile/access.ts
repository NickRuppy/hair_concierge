import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { loadAppStoreEntitlement } from "@/lib/app-store/store"
import {
  hasActiveAppStoreAccess,
  scannerEntitlementRows,
  type AppStoreEntitlementSnapshot,
} from "@/lib/app-store/state"
import { resolvePaidAppAccess } from "@/lib/entitlements/access"
import { requireMobileUser } from "./auth"
import { MobileError } from "./errors"

export type MobileAppStoreAccess = {
  productId: string
  expiresAt: string
  willRenew: boolean
  inBillingRetry: boolean
}

export type MobileAccess = {
  status: "active" | "none"
  source: "app_store" | "web" | "open" | null
  appStore: MobileAppStoreAccess | null
}

/** Swappable for tests only; production callers always use the real implementations. */
export type MobileAccessDeps = {
  loadAppStoreEntitlement?: typeof loadAppStoreEntitlement
  resolvePaidAppAccess?: typeof resolvePaidAppAccess
}

/**
 * Display-only summary of the account's App Store subscription: the currently-granting
 * transaction (or, absent one, the latest-expiring non-revoked transaction) plus its
 * subscription's renewal status. Only scanner-product rows count. `null` only when the
 * account has no such rows at all — it does not mean "not currently granting" (see
 * `hasActiveAppStoreAccess`, which decides access itself). If every transaction happens
 * to be revoked, the latest-expiring one is still surfaced for display.
 */
export function deriveAppStoreAccess(
  snapshot: AppStoreEntitlementSnapshot,
  now: Date,
): MobileAppStoreAccess | null {
  const rows = scannerEntitlementRows(snapshot)
  if (rows.transactions.length === 0) return null
  const at = now.getTime()
  const nonRevoked = rows.transactions.filter((row) => row.revocationDate === null)
  const pool = nonRevoked.length > 0 ? nonRevoked : rows.transactions
  const granting = pool.filter(
    (row) => row.purchaseDate.getTime() <= at && at < row.expiresDate.getTime(),
  )
  const candidates = granting.length > 0 ? granting : pool
  const transaction = candidates.reduce((latest, row) =>
    row.expiresDate.getTime() > latest.expiresDate.getTime() ? row : latest,
  )
  const status = rows.statuses.find(
    (row) => row.originalTransactionId === transaction.originalTransactionId,
  )
  return {
    productId: transaction.productId,
    expiresAt: transaction.expiresDate.toISOString(),
    willRenew: status?.autoRenewStatus ?? false,
    inBillingRetry: status?.inBillingRetry ?? false,
  }
}

/**
 * Mobile scanner access: an active App Store subscription OR existing web paid access
 * (`resolvePaidAppAccess`, `fieldTestGuest: false` — mobile sessions are real accounts,
 * never a web field-test guest cookie). `MOBILE_PAYWALL_ENABLED` off is the pilot's
 * unaffected default: `active`/`open` without any DB read. The web check's
 * `"unavailable"` result throws (fail closed) rather than denying, matching the web
 * paywall's own retriable-503 handling.
 */
export async function resolveMobileAccess(
  client: SupabaseClient,
  userId: string,
  email: string,
  now: Date,
  deps: MobileAccessDeps = {},
): Promise<MobileAccess> {
  if (process.env.MOBILE_PAYWALL_ENABLED !== "true") {
    return { status: "active", source: "open", appStore: null }
  }
  const load = deps.loadAppStoreEntitlement ?? loadAppStoreEntitlement
  const resolveWeb = deps.resolvePaidAppAccess ?? resolvePaidAppAccess
  const snapshot = await load(client, userId)
  const appStore = deriveAppStoreAccess(snapshot, now)
  if (hasActiveAppStoreAccess(snapshot, now)) {
    return { status: "active", source: "app_store", appStore }
  }
  const webResult = await resolveWeb(userId, email, false, { client })
  if (webResult === "unavailable") throw new MobileError("temporarily_unavailable", 503)
  if (webResult === "allowed") return { status: "active", source: "web", appStore }
  return { status: "none", source: null, appStore }
}

/**
 * Auth + scanner-access gate in one call so scan routes stay one-liners. Throws 402
 * `subscription_required` before any service work when access isn't active; returns
 * the same identity shape as `requireMobileUser`.
 */
export async function requireMobileScannerAccess(request: Request) {
  const identity = await requireMobileUser(request)
  const access = await resolveMobileAccess(
    identity.client,
    identity.userId,
    identity.email,
    new Date(),
  )
  if (access.status !== "active") throw new MobileError("subscription_required", 402)
  return identity
}
