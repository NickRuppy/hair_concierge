"use client"

import { useState } from "react"

import { trackAppEvent } from "@/lib/analytics/track-app-event"

export function PartnerAccessActivationCard({ leadId }: { leadId: string | null }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  async function activate() {
    if (!leadId || loading) return
    setLoading(true)
    setError(false)
    try {
      const response = await fetch("/api/partner-access/activate", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      })
      const body: unknown = await response.json().catch(() => null)
      const destination =
        body && typeof body === "object" && !Array.isArray(body)
          ? (body as Record<string, unknown>).destination
          : null
      if (
        !response.ok ||
        typeof destination !== "string" ||
        !destination.startsWith("/plan-bereit?lead=")
      ) {
        throw new Error("activation failed")
      }
      trackAppEvent("partner_access_activated", { leadId, testKind: "partner" })
      window.location.assign(destination)
    } catch {
      setError(true)
      setLoading(false)
    }
  }

  return (
    <div
      className="mx-auto max-w-xl rounded-[1.75rem] border border-[rgba(var(--brand-plum-rgb),0.13)] bg-white p-6 text-center shadow-[0_22px_54px_-40px_rgba(var(--brand-plum-rgb),0.6)] sm:p-8"
      data-partner-access-activation-card
    >
      <h2 className="font-serif text-3xl leading-tight">Dein Chaarlie Zugang ist bereit.</h2>
      <p className="mx-auto mt-3 max-w-md leading-7 text-[rgba(var(--brand-plum-rgb),0.72)]">
        Dein persönlicher Plan und deine Routine sind freigeschaltet.
      </p>
      {error ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          Bitte versuche es noch einmal.
        </p>
      ) : null}
      <button
        className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[var(--brand-plum)] px-6 py-3 font-bold text-white disabled:opacity-60"
        data-offer-cta="partner_access_activation"
        data-offer-destination="partner_access_activation"
        data-offer-source-section="pricing"
        disabled={!leadId || loading}
        onClick={() => void activate()}
        type="button"
      >
        {loading ? "Wird aktiviert …" : "Zugang aktivieren"}
      </button>
      <p className="mt-3 text-xs text-[var(--text-caption)]">Für dich kostenlos</p>
    </div>
  )
}
