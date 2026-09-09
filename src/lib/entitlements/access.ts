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
 */
export type HasFreemiumPaidAccessDeps = {
  client?: SupabaseBillingClient
  hasAppAccess?: typeof hasCurrentAppAccess
  hasPaidAppAccess?: typeof hasCurrentPaidAppAccess
  resolveOneTimeAccessState?: typeof resolveOneTimeAccessStateForUser
  resolveModeratorAccess?: typeof resolveModeratorAccess
}

export async function hasFreemiumPaidAccess(
  userId: string,
  deps: HasFreemiumPaidAccessDeps = {},
): Promise<boolean> {
  const client = deps.client ?? createAdminClient()
  const hasAppAccess = deps.hasAppAccess ?? hasCurrentAppAccess
  const hasPaidAppAccess = deps.hasPaidAppAccess ?? hasCurrentPaidAppAccess
  const resolveOneTimeAccessState =
    deps.resolveOneTimeAccessState ?? resolveOneTimeAccessStateForUser
  const resolveModerator = deps.resolveModeratorAccess ?? resolveModeratorAccess

  const [activeInitial, oneTimeAccessState, moderatorAccess] = await Promise.all([
    hasAppAccess(client, { userId }),
    resolveOneTimeAccessState(client, userId),
    resolveModerator({ client, userId }),
  ])

  let active = activeInitial
  if (moderatorAccess.kind === "ended" || moderatorAccess.kind === "unavailable") {
    active = await hasPaidAppAccess(client, { userId })
  }

  return active || oneTimeAccessState === "active" || moderatorAccess.kind === "active"
}
