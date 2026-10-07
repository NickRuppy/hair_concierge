import "server-only"

import {
  loadAuthenticatedAppAccessState,
  type AuthenticatedAppAccessState,
} from "@/lib/auth/authenticated-app-route-access"

/**
 * T17 (freemium-scanner-first PR5): what THIS request renders on Routine / Anwendung /
 * Chat, now that "not premium" has two shapes.
 *
 * - `"premium"` — today's real page, verbatim. Every flag-off request lands here with
 *   zero lookups, so the byte-identity rule still holds by construction.
 * - `"keepsake"` — a LAPSED user (held paid access, holds none now): the real page again,
 *   fed their OWN content, with every mutation locked to the Premium sheet.
 * - `"example"` — a never-paid free user: T12's framed „Beispiel" composition.
 *
 * Fail-closed to `"premium"` on any lookup failure: billing reads underneath throw
 * rather than returning `"unavailable"`, and a thrown lookup must never open a free surface.
 */
export type GatedPageMode = "premium" | "keepsake" | "example"

export async function resolveGatedPageMode(
  loadAccessState: () => Promise<AuthenticatedAppAccessState> = loadAuthenticatedAppAccessState,
): Promise<GatedPageMode> {
  let state: AuthenticatedAppAccessState
  try {
    state = await loadAccessState()
  } catch {
    return "premium"
  }
  if (state === "lapsed") return "keepsake"
  return state === "free" ? "example" : "premium"
}
