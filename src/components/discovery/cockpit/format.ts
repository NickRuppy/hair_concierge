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
