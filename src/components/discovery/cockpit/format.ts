/**
 * Timestamps for the cockpit, formatted from the stored ISO string itself.
 *
 * Deliberately not `toLocaleString`: this text is rendered on the server AND hydrated in
 * the browser, and those two run in different time zones, which is a hydration mismatch
 * waiting to happen. An internal tool can read UTC.
 */
export function formatDiscoveryTimestamp(value: string | null | undefined): string {
  if (!value) return "—"
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value)
  if (!match) return value
  const [, year, month, day, hour, minute] = match
  return `${day}.${month}.${year} ${hour}:${minute} UTC`
}

/** An invite created with just a name has no address until the participant types one. */
export const DISCOVERY_EMAIL_PENDING_LABEL = "noch offen"

/**
 * The React key for the cockpit's client islands. Their local state (radio selections,
 * finalize state, research badges) is seeded from server props once; when a
 * `router.refresh()` delivers a different routine (a research start changed an item's
 * identity) or a different finalize state, the new key remounts them so that state
 * re-syncs from the server instead of showing the old composition.
 */
export function discoveryCockpitStateKey(
  sourceHash: string,
  callFinalizedAt: string | null,
): string {
  return `${sourceHash}:${callFinalizedAt ?? "open"}`
}
