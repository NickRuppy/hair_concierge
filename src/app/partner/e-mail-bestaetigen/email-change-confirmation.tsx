"use client"

import { useEffect, useRef, useState } from "react"

export function PartnerEmailChangeConfirmation() {
  const startedRef = useRef(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    async function confirmEmailChange() {
      const token = new URLSearchParams(window.location.hash.slice(1)).get("token")
      window.history.replaceState(window.history.state, "", window.location.pathname)
      if (!token) {
        await Promise.resolve()
        setFailed(true)
        return
      }

      try {
        const response = await fetch("/api/partner-access/email-change/confirm", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        })
        const body: unknown = await response.json().catch(() => null)
        const destination =
          body && typeof body === "object" && !Array.isArray(body)
            ? (body as Record<string, unknown>).destination
            : null
        if (!response.ok || typeof destination !== "string") throw new Error("unavailable")
        window.location.assign(destination)
      } catch {
        setFailed(true)
      }
    }

    void confirmEmailChange()
  }, [])

  return (
    <main className="grid min-h-dvh place-items-center bg-[#fcfaf7] px-4 text-center text-[var(--brand-plum-darkest)]">
      <section className="max-w-md rounded-[2rem] border border-[var(--brand-plum-light)] bg-white p-8">
        <h1 className="font-header text-3xl">
          {failed ? "Dieser Bestätigungslink ist nicht verfügbar." : "E-Mail wird bestätigt …"}
        </h1>
      </section>
    </main>
  )
}
