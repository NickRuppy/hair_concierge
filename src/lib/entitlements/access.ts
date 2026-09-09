import "server-only"

import { resolveOneTimeAccessStateForUser } from "@/lib/billing/purchases"
import { hasCurrentAppAccess, hasCurrentPaidAppAccess } from "@/lib/billing/subscriptions"
import type { SupabaseBillingClient } from "@/lib/billing/types"
import { resolveModeratorAccess } from "@/lib/personal-plan-field-test/moderator"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * The same paid-access composite the subscription paywall in
 * `src/lib/supabase/middleware.ts` uses — `active || oneTimeAccessState ===
 * "active" || moderatorAccess === "active"`, including the T2 review fix
 * (finding I1/I3) that recomputes `active` via `hasCurrentPaidAppAccess`
 * (which excludes manual grants) once a moderator grant has ended or its
 * lookup is unavailable, so a revoked field-test's manual access grant can't
 * keep counting as paid.
 *
 * Freemium-admitted API routes (e.g. `/api/scan/save`, `/api/scan/wishlist`
 * — see plans/freemium-scanner-first/enforcement-matrix.md) are reachable by
 * free-tier users once the middleware carve-out lets them through, but
 * middleware doesn't forward its own per-request computation to the route
 * handler — this recomputes the same signal directly against the
 * billing/moderator tables. `userId` is assumed already verified by the
 * caller's own auth check.
 *
 * T4 review fix (C1): `email` is threaded through to `hasAppAccess` because
 * `findCurrentManualAccessGrant` (src/lib/billing/subscriptions.ts) looks up
 * `manual_access_grants` by email as a first-class path (nullable `user_id`,
 * `CHECK user_id OR email`) — an email-bound grant (friend/tester/admin/
 * support) has no `user_id` row to match on, so omitting `email` here falsely
 * denies those holders even though the middleware paywall (which does pass
 * `email`) let them through.
 *
 * T4 review fix (I2): the `"unavailable"` moderator-lookup state is now
 * surfaced as its own result kind (mirroring the middleware's retriable 503,
 * `moderator_access_unavailable`) instead of being collapsed into a plain
 * deny — callers must map it to a 503, not a 403.
 */
export type HasFreemiumPaidAccessDeps = {
  client?: SupabaseBillingClient
  hasAppAccess?: typeof hasCurrentAppAccess
  hasPaidAppAccess?: typeof hasCurrentPaidAppAccess
  resolveOneTimeAccessState?: typeof resolveOneTimeAccessStateForUser
  resolveModeratorAccess?: typeof resolveModeratorAccess
}

/**
 * `"allowed"` / `"denied"` mirror the middleware paywall's binary outcome.
 * `"unavailable"` mirrors the middleware's `moderator_access_unavailable`
 * 503 — the moderator lookup couldn't be read and there is no independently
 * verified paid entitlement to fall back on, so the caller should ask the
 * client to retry rather than treat this as a hard subscription denial.
 */
export type FreemiumAccessResult = "allowed" | "denied" | "unavailable"

export async function hasFreemiumPaidAccess(
  userId: string,
  email: string | null | undefined,
  deps: HasFreemiumPaidAccessDeps = {},
): Promise<FreemiumAccessResult> {
  const client = deps.client ?? createAdminClient()
  const hasAppAccess = deps.hasAppAccess ?? hasCurrentAppAccess
  const hasPaidAppAccess = deps.hasPaidAppAccess ?? hasCurrentPaidAppAccess
  const resolveOneTimeAccessState =
    deps.resolveOneTimeAccessState ?? resolveOneTimeAccessStateForUser
  const resolveModerator = deps.resolveModeratorAccess ?? resolveModeratorAccess

  const [activeInitial, oneTimeAccessState, moderatorAccess] = await Promise.all([
    hasAppAccess(client, { userId, email }),
    resolveOneTimeAccessState(client, userId),
    resolveModerator({ client, userId }),
  ])

  let active = activeInitial
  // Mirrors middleware.ts's `hasIndependentPaidEntitlement`: seeded from the
  // one-time state, then recomputed once the moderator grant has ended or is
  // unreadable so a stale manual grant folded into `active` can't keep
  // counting as paid.
  let hasIndependentPaidEntitlement = oneTimeAccessState === "active"
  if (moderatorAccess.kind === "ended" || moderatorAccess.kind === "unavailable") {
    hasIndependentPaidEntitlement = await hasPaidAppAccess(client, { userId })
    active = hasIndependentPaidEntitlement
  }

  if (moderatorAccess.kind === "unavailable" && !hasIndependentPaidEntitlement) {
    return "unavailable"
  }

  const allowed = active || oneTimeAccessState === "active" || moderatorAccess.kind === "active"
  return allowed ? "allowed" : "denied"
}
