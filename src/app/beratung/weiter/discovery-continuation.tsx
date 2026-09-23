"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { DISCOVERY_CLAIM_ENDPOINT, DISCOVERY_QUIZ_ENTRY_HREF } from "@/lib/discovery/participant"

/**
 * Where the magic link lands: the account already existed, so the claim could
 * not finish before the participant proved they own the address. It finishes
 * here, with the credential carried in the link's fragment.
 */
export function DiscoveryContinuation() {
  const startedRef = useRef(false)
  const handoffRef = useRef<string | null>(null)
  const [error, setError] = useState(false)

  const continueClaim = useCallback(async () => {
    setError(false)
    try {
      const response = await fetch(DISCOVERY_CLAIM_ENDPOINT, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: handoffRef.current ? JSON.stringify({ handoff: handoffRef.current }) : undefined,
      })
      const body: unknown = await response.json().catch(() => null)
      const destination =
        body && typeof body === "object" && !Array.isArray(body)
          ? (body as Record<string, unknown>).destination
          : null
      if (!response.ok || destination !== DISCOVERY_QUIZ_ENTRY_HREF) throw new Error("claim failed")
      window.location.assign(destination)
    } catch {
      setError(true)
    }
  }, [])

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    const fragment = new URLSearchParams(window.location.hash.slice(1))
    handoffRef.current = fragment.get("handoff")
    if (window.location.hash) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`)
    }
    void continueClaim()
  }, [continueClaim])

  return (
    <main className="grid min-h-dvh place-items-center bg-[#fcfaf7] px-4 text-center text-[var(--brand-plum-darkest)]">
      <section className="max-w-md rounded-[2rem] border border-[var(--brand-plum-light)] bg-white p-8">
        <h1 className="font-header text-3xl">
          {error ? "Dein Zugang konnte nicht geöffnet werden." : "Dein Zugang wird geöffnet …"}
        </h1>
        {error ? (
          <button className={primaryButtonClass} onClick={() => void continueClaim()} type="button">
            Erneut versuchen
          </button>
        ) : null}
      </section>
    </main>
  )
}

const primaryButtonClass =
  "mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--brand-plum)] px-6 py-3 font-bold text-white"
