import "server-only"

import { loadAuthenticatedAppPageTier } from "@/lib/auth/authenticated-app-route-access"
import type { EntitlementTier } from "@/lib/entitlements"

/**
 * The one server-side decision behind T12 (freemium-scanner-first PR3): does THIS request
 * render the framed „Beispiel" composition instead of the real Routine / Anwendung / Chat
 * page?
 *
 * Only the free tier does. Premium — and every request while the flag is off, which
 * `loadAuthenticatedAppPageTier` resolves to `"premium"` without a single lookup — falls
 * through to today's page untouched, so the keepsake/byte-identity rule holds by
 * construction: this predicate is the only branch the three pages gained.
 *
 * The tier itself is NOT recomputed here. It comes from the same email-aware,
 * field-test-aware paid-access composite `/scan` uses (PR2 review fix C1), which fails
 * closed to `"premium"` on an entitlement-source outage — an outage must never hand a
 * paying user an example of someone else's routine.
 */
export async function shouldRenderGatedExample(
  loadTier: () => Promise<EntitlementTier> = loadAuthenticatedAppPageTier,
): Promise<boolean> {
  return (await loadTier()) === "free"
}
