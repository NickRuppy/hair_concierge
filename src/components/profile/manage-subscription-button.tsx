"use client"

import { useState } from "react"

export function ManageSubscriptionButton() {
  const [loading, setLoading] = useState(false)

  async function onClick() {
    setLoading(true)
    const res = await fetch("/api/stripe/portal-session", { method: "POST" })
    if (!res.ok) {
      setLoading(false)
      alert("Konnte Portal nicht öffnen.")
      return
    }
    const { url } = await res.json()
    window.location.href = url
  }

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="rounded-lg border bg-card px-5 py-2.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
    >
      {loading ? "Wird geöffnet…" : "Verwalten"}
    </button>
  )
}
