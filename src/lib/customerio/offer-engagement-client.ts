import type { AppEventMap } from "@/lib/analytics/events"

export async function sendCustomerIoOfferEngagement(
  payload: AppEventMap["offer_engaged"],
  {
    send = fetch,
    wait = (delayMs: number) => new Promise((resolve) => setTimeout(resolve, delayMs)),
  }: {
    send?: typeof fetch
    wait?: (delayMs: number) => Promise<unknown>
  } = {},
) {
  const request = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, analyticsConsent: true }),
    keepalive: true,
  } satisfies RequestInit

  for (const delayMs of [0, 250, 1_000]) {
    if (delayMs) await wait(delayMs)
    try {
      const response = await send("/api/analytics/offer-engaged", request)
      if (response.ok) return true
      if (response.status < 500) return false
    } catch {
      // Retry transient transport failures with the same idempotent event ID.
    }
  }

  // Analytics must never interrupt navigation or the offer experience.
  return false
}
