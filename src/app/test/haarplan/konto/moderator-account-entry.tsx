"use client"

import { useEffect, useRef, useState } from "react"

import { createClient } from "@/lib/supabase/client"
import { PersonalPlanFieldTestEnded } from "@/components/personal-plan-field-test/personal-plan-field-test-ended"
import {
  parseModeratorOrganicStartResponse,
  prepareModeratorOrganicFreshStart,
} from "@/lib/quiz/moderator-fresh-start"
import { useQuizStore } from "@/lib/quiz/store"

type EntryState = "idle" | "starting" | "wrong_account" | "unavailable" | "ended"

export function ModeratorAccountEntry({ campaignId }: { campaignId: string }) {
  const [state, setState] = useState<EntryState>("idle")
  const startedRef = useRef(false)

  async function start() {
    if (startedRef.current) return
    startedRef.current = true
    setState("starting")
    try {
      const response = await fetch("/api/personal-plan/field-test/moderator/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ campaignId }),
      })
      const body: unknown = await response.json().catch(() => null)
      if (response.ok) {
        const startResult = parseModeratorOrganicStartResponse(body)
        if (startResult?.kind === "active") {
          window.location.assign("/plan-start")
          return
        }
        if (startResult?.kind === "quiz") {
          const freshBoundary = prepareModeratorOrganicFreshStart(
            startResult.funnelSessionId,
            startResult.freshStart,
          )
          if (freshBoundary === "failed") {
            setState("unavailable")
            return
          }
          if (freshBoundary === "fresh") useQuizStore.getState().reset()
          window.location.assign("/quiz")
          return
        }
      }
      setState(
        response.status === 410
          ? "ended"
          : response.status === 403
            ? "wrong_account"
            : "unavailable",
      )
    } catch {
      setState("unavailable")
    } finally {
      startedRef.current = false
    }
  }

  useEffect(() => {
    void start()
    // The campaign can only change through a fresh authenticated return route.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId])

  async function switchAccount() {
    try {
      const { error } = await createClient().auth.signOut()
      if (error) throw error
      const next = `/test/haarplan/konto?campaign=${encodeURIComponent(campaignId)}`
      window.location.assign(`/auth?next=${encodeURIComponent(next)}`)
    } catch {
      setState("unavailable")
    }
  }

  if (state === "ended") return <PersonalPlanFieldTestEnded />

  return (
    <main className="grid min-h-screen place-items-center bg-[#fcfaf7] px-4 text-center text-[var(--brand-plum-darkest)]">
      <section className="max-w-lg rounded-[2rem] border border-[var(--brand-plum-light)] bg-white p-7 shadow-[0_22px_54px_-40px_rgba(var(--brand-plum-rgb),0.55)]">
        {state === "wrong_account" ? (
          <>
            <p className="text-sm font-semibold text-[var(--brand-plum)]">Konto wechseln</p>
            <h1 className="mt-3 font-header text-3xl">
              Dieses Konto kann diese Einladung nicht nutzen.
            </h1>
            <p className="mt-4 leading-7 text-[var(--text-sub)]">
              Melde dich bitte mit dem Konto an, das zu deiner Einladung gehört.
            </p>
            <button
              className="mt-6 inline-flex rounded-full bg-[var(--brand-plum)] px-6 py-3 font-bold text-white"
              onClick={switchAccount}
            >
              Anderes Konto anmelden
            </button>
          </>
        ) : state === "unavailable" ? (
          <>
            <h1 className="font-header text-3xl">Der Produkttest ist gerade nicht verfügbar.</h1>
            <p className="mt-4 leading-7 text-[var(--text-sub)]">
              Bitte versuche es gleich noch einmal oder melde dich beim Chaarlie-Team.
            </p>
            <button
              className="mt-6 inline-flex rounded-full bg-[var(--brand-plum)] px-6 py-3 font-bold text-white"
              onClick={() => {
                startedRef.current = false
                void start()
              }}
            >
              Erneut versuchen
            </button>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-[var(--brand-plum)]">Dein Haar-Check</p>
            <h1 className="mt-3 font-header text-3xl">Dein Haar-Check wird geöffnet …</h1>
            <p className="mt-4 leading-7 text-[var(--text-sub)]">
              Dein persönlicher Plan bleibt in diesem Konto gespeichert. Das dauert nur einen
              Moment.
            </p>
          </>
        )}
      </section>
    </main>
  )
}
