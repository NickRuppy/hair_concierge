"use client"

import { useState } from "react"
import type { BillingProvider } from "@/lib/billing/types"

export function ManageSubscriptionButton({
  provider = "stripe",
  currentPeriodEnd,
  cancelAtPeriodEnd = false,
}: {
  provider?: BillingProvider
  currentPeriodEnd?: string | null
  cancelAtPeriodEnd?: boolean
}) {
  const [loading, setLoading] = useState(false)
  const [cancelled, setCancelled] = useState(cancelAtPeriodEnd)

  async function onClick() {
    setLoading(true)
    try {
      const res = await fetch(
        provider === "paypal" ? "/api/paypal/cancel-subscription" : "/api/stripe/portal-session",
        { method: "POST" },
      )
      if (!res.ok) {
        setLoading(false)
        alert(
          provider === "paypal"
            ? "Kündigung konnte nicht gespeichert werden."
            : "Konnte Portal nicht öffnen.",
        )
        return
      }
      if (provider === "paypal") {
        setCancelled(true)
        setLoading(false)
        return
      }
      const { url } = await res.json()
      window.location.href = url
    } catch {
      setLoading(false)
      alert(
        provider === "paypal"
          ? "Kündigung konnte nicht gespeichert werden."
          : "Konnte Portal nicht öffnen.",
      )
    }
  }

  if (provider === "paypal") {
    return (
      <div className="space-y-3">
        {currentPeriodEnd ? (
          <p className="text-sm text-muted-foreground">
            Dein Abo bleibt bis zum {new Date(currentPeriodEnd).toLocaleDateString("de-DE")} aktiv.
          </p>
        ) : null}
        {cancelled ? (
          <p className="text-sm text-muted-foreground">Danach wird es nicht verlängert.</p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          Zahlungsmethode ändern: Bitte aktualisiere deine Zahlungsquelle direkt in PayPal.
        </p>
        <button
          onClick={onClick}
          disabled={loading || cancelled}
          aria-label="Abo kündigen"
          className="rounded-lg border bg-card px-5 py-2.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
        >
          {loading ? "Wird gekündigt..." : cancelled ? "Kündigung vorgemerkt" : "Abo kündigen"}
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={onClick}
      disabled={loading}
      aria-label="Abo verwalten"
      className="rounded-lg border bg-card px-5 py-2.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
    >
      {loading ? "Wird geöffnet…" : "Verwalten"}
    </button>
  )
}
