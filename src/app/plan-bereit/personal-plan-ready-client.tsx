"use client"

import { Check, LoaderCircle, Sparkles } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import {
  PERSONAL_PLAN_READY_MESSAGES,
  PERSONAL_PLAN_READY_MIN_STORY_MS,
  PERSONAL_PLAN_READY_POLL_INTERVAL_MS,
  PERSONAL_PLAN_READY_POLL_LIMIT,
  personalPlanStoryIndexAt,
} from "./transition"

type ReadinessPhase = "checking" | "ready" | "timeout" | "error"

export function PersonalPlanReadyClient({ leadId }: { leadId: string }) {
  const [storyIndex, setStoryIndex] = useState(0)
  const [storyComplete, setStoryComplete] = useState(false)
  const [readiness, setReadiness] = useState<ReadinessPhase>("checking")
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    const startedAt = Date.now()
    const messageTimer = window.setInterval(() => {
      setStoryIndex(personalPlanStoryIndexAt(Date.now() - startedAt))
    }, 200)
    const completeTimer = window.setTimeout(() => {
      setStoryIndex(PERSONAL_PLAN_READY_MESSAGES.length - 1)
      setStoryComplete(true)
    }, PERSONAL_PLAN_READY_MIN_STORY_MS)

    return () => {
      window.clearInterval(messageTimer)
      window.clearTimeout(completeTimer)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let attempts = 0

    async function poll() {
      attempts += 1
      try {
        const response = await fetch(`/plan-bereit/status?lead=${encodeURIComponent(leadId)}`, {
          method: attempts === 1 ? "POST" : "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
        })
        const body = await response.json().catch(() => ({}))
        if (cancelled) return

        if (response.status === 401) {
          window.location.assign(`/auth?next=${encodeURIComponent(`/plan-bereit?lead=${leadId}`)}`)
          return
        }
        if (response.status === 403) {
          setReadiness("error")
          return
        }
        if (!response.ok || body.status === "error") {
          setReadiness("error")
          return
        }
        if (response.ok && body.status === "ready") {
          setReadiness("ready")
          return
        }
      } catch {
        // A transient network failure consumes one attempt and is retried below.
      }

      if (attempts >= PERSONAL_PLAN_READY_POLL_LIMIT) {
        setReadiness("timeout")
        return
      }
      timer = setTimeout(poll, PERSONAL_PLAN_READY_POLL_INTERVAL_MS)
    }

    void poll()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [leadId, retryKey])

  const canContinue = storyComplete && readiness === "ready"
  const waitingForPlan = storyComplete && readiness === "checking"
  const showRecovery = readiness === "timeout" || readiness === "error"

  return (
    <main className="min-h-screen bg-[#fbf8f5] px-5 py-8 text-[#30232d] sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-lg flex-col">
        <div className="text-center font-header text-3xl font-semibold tracking-tight">
          chaarlie
        </div>

        <section className="flex flex-1 flex-col items-center justify-center py-12 text-center">
          <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-[#f1e4ec]">
            {canContinue ? (
              <Check className="h-9 w-9 text-[#88466c]" aria-hidden="true" />
            ) : (
              <Sparkles className="h-9 w-9 text-[#88466c]" aria-hidden="true" />
            )}
          </div>

          {canContinue ? (
            <div className="w-full space-y-7">
              <div className="space-y-3">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#88466c]">
                  Dein Plan ist vorbereitet
                </p>
                <h1 className="font-header text-4xl leading-tight">
                  Verfeinere ihn jetzt mit deinen Produkten.
                </h1>
                <p className="mx-auto max-w-sm text-base leading-7 text-[#6d6069]">
                  Ergänze die Produkte, die du bereits verwendest. Danach siehst du deinen
                  vollständigen Haarplan in deiner Routine.
                </p>
              </div>

              <Link
                href="/onboarding?returnTo=%2Froutine"
                className="inline-flex min-h-14 w-full items-center justify-center rounded-full bg-[#88466c] px-6 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-[#743b5c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#88466c] focus-visible:ring-offset-2"
              >
                Plan mit Produkten verfeinern
              </Link>
            </div>
          ) : (
            <div className="w-full space-y-8">
              <div className="min-h-36 space-y-4" aria-live="polite">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#88466c]">
                  Dein persönlicher Haarplan
                </p>
                <h1 className="font-header text-4xl leading-tight">
                  {PERSONAL_PLAN_READY_MESSAGES[storyIndex]}
                </h1>
                {waitingForPlan ? (
                  <p className="flex items-center justify-center gap-2 text-sm text-[#6d6069]">
                    <LoaderCircle className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
                    Wir schließen die letzten Details ab.
                  </p>
                ) : null}
              </div>

              <div className="mx-auto grid w-44 grid-cols-3 gap-2" aria-hidden="true">
                {PERSONAL_PLAN_READY_MESSAGES.map((message, index) => (
                  <span
                    key={message}
                    className={[
                      "h-1.5 rounded-full",
                      index <= storyIndex ? "bg-[#88466c]" : "bg-[#e6dce2]",
                    ].join(" ")}
                  />
                ))}
              </div>

              {showRecovery ? (
                <div className="space-y-4 rounded-3xl border border-[#e6dce2] bg-white p-5">
                  <p className="text-sm leading-6 text-[#6d6069]">
                    Die Aktivierung dauert gerade etwas länger. Deine Zahlung und deine
                    Quiz-Antworten bleiben sicher gespeichert.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setReadiness("checking")
                      setRetryKey((value) => value + 1)
                    }}
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-[#88466c] px-5 py-2 text-sm font-semibold text-[#88466c] hover:bg-[#f6edf2]"
                  >
                    Erneut prüfen
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
