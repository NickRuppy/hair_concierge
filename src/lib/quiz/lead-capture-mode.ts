import type { LeadCaptureMode } from "./types"

/**
 * Whether the quiz already holds a server-verified identity for this run.
 *
 * `partner` (a claimed creator invitation) and `discovery` (a claimed
 * discovery-call enrollment) both arrive with the name and e-mail the server
 * will validate the lead against, so the two identity screens are skipped: they
 * do not run, do not consume a browser-history entry, and an identity error is
 * shown on the consent sheet instead of on an e-mail step that never exists.
 *
 * This is a predicate rather than a widened `=== "partner"` comparison so a
 * fourth mode has to be considered here once, instead of silently inheriting
 * partner behaviour at five call sites.
 */
export function hasLockedLeadIdentity(mode: LeadCaptureMode): boolean {
  return mode === "partner" || mode === "discovery"
}
