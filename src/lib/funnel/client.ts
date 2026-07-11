"use client"

import type { FunnelMilestone } from "./server"

export type CurrentFunnelContext = {
  funnelSessionId: string
  funnelPackageKey: string
}

let currentContext: CurrentFunnelContext | null = null
let bootstrapPromise: Promise<CurrentFunnelContext | null> | null = null

export function getCurrentFunnelContext() {
  return currentContext
}

export function bootstrapFunnelContext() {
  if (bootstrapPromise) return bootstrapPromise
  bootstrapPromise = fetch("/api/funnel/session", { headers: { Accept: "application/json" } })
    .then(async (response) => (response.ok ? response.json() : null))
    .then((body) => {
      if (typeof body?.funnelSessionId === "string" && typeof body?.funnelPackageKey === "string") {
        currentContext = {
          funnelSessionId: body.funnelSessionId,
          funnelPackageKey: body.funnelPackageKey,
        }
      }
      return currentContext
    })
    .catch(() => null)
  return bootstrapPromise
}

export function recordBrowserFunnelMilestone(
  milestone: FunnelMilestone,
  properties?: Record<string, unknown>,
  eventId = crypto.randomUUID(),
  persist = true,
) {
  const funnelEventId = eventId
  if (persist)
    void fetch("/api/funnel/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: funnelEventId, milestone, properties }),
      keepalive: true,
    })
      .then(async (response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (
          typeof body?.funnelSessionId === "string" &&
          typeof body?.funnelPackageKey === "string"
        ) {
          currentContext = {
            funnelSessionId: body.funnelSessionId,
            funnelPackageKey: body.funnelPackageKey,
          }
        }
      })
      .catch(() => undefined)

  return { funnelEventId, ...currentContext }
}

export function createFunnelEventId() {
  return crypto.randomUUID()
}
