export const MODERATOR_RESET_CUTOFF_KEY = "moderator_reset_cutoff_at"

export function moderatorResetCutoffMilliseconds(metadata: unknown): number | null {
  if (!isRecord(metadata) || !(MODERATOR_RESET_CUTOFF_KEY in metadata)) return null
  const value = metadata[MODERATOR_RESET_CUTOFF_KEY]
  if (typeof value !== "string")
    throw new Error("moderator reset cutoff marker must be an ISO timestamp")
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) throw new Error("moderator reset cutoff marker is invalid")
  return timestamp
}

export function assertStripeCreatedAfterModeratorResetCutoff(input: {
  metadata: unknown
  checkoutSessionCreated: unknown
  subscriptionCreated: unknown
}): void {
  const cutoff = moderatorResetCutoffMilliseconds(input.metadata)
  if (cutoff === null) return
  const sessionCreated = epochMilliseconds(input.checkoutSessionCreated, "checkout session")
  const subscriptionCreated = epochMilliseconds(input.subscriptionCreated, "subscription")
  if (sessionCreated <= cutoff || subscriptionCreated <= cutoff) {
    throw new Error("Stripe checkout or subscription predates moderator reset cutoff")
  }
}

function epochMilliseconds(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} created timestamp is required for a moderator reset cutoff`)
  }
  return value * 1000
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
