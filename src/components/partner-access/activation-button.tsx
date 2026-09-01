"use client"

import { useState } from "react"

import { trackAppEvent } from "@/lib/analytics/track-app-event"

export function parsePartnerAccessActivationDestination(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const destination = (value as Record<string, unknown>).destination
  return typeof destination === "string" && destination.startsWith("/plan-bereit?lead=")
    ? destination
    : null
}

const partnerAccessActivationRequests = new Map<string, Promise<string>>()

export function requestPartnerAccessActivation({
  leadId,
  fetcher = fetch,
  track = trackAppEvent,
}: {
  leadId: string
  fetcher?: typeof fetch
  track?: typeof trackAppEvent
}): Promise<string> {
  const existing = partnerAccessActivationRequests.get(leadId)
  if (existing) return existing

  const request = (async () => {
    const response = await fetcher("/api/partner-access/activate", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId }),
    })
    const destination = parsePartnerAccessActivationDestination(
      await response.json().catch(() => null),
    )
    if (!response.ok || !destination) throw new Error("activation failed")
    track("partner_access_activated", {
      leadId,
      testKind: "partner",
    })
    return destination
  })()

  partnerAccessActivationRequests.set(leadId, request)
  void request.catch(() => {
    if (partnerAccessActivationRequests.get(leadId) === request) {
      partnerAccessActivationRequests.delete(leadId)
    }
  })
  return request
}

export function PartnerAccessActivationButton({
  className,
  cta,
  leadId,
  showError = false,
  sourceSection,
}: {
  className: string
  cta: "sticky_header" | "partner_access_activation" | "final"
  leadId: string | null
  showError?: boolean
  sourceSection: "hero" | "pricing" | "final_cta"
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  async function activate() {
    if (!leadId || loading) return
    setLoading(true)
    setError(false)
    try {
      const destination = await requestPartnerAccessActivation({ leadId })
      window.location.assign(destination)
    } catch {
      setError(true)
      setLoading(false)
    }
  }

  return (
    <>
      {showError && error ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          Bitte versuche es noch einmal.
        </p>
      ) : null}
      <button
        className={className}
        data-offer-cta={cta}
        data-offer-destination="partner_access_activation"
        data-offer-source-section={sourceSection}
        disabled={!leadId || loading}
        onClick={() => void activate()}
        type="button"
      >
        {loading ? "Wird geöffnet …" : error ? "Erneut versuchen" : "Meinen Plan öffnen"}
      </button>
    </>
  )
}
