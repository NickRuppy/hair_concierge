"use client"

import { Check, LoaderCircle, Sparkles } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { PersonalPlanJourneyHeader } from "@/components/personal-plan-journey"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  PERSONAL_PLAN_READY_POLL_INTERVAL_MS,
  PERSONAL_PLAN_READY_POLL_LIMIT,
  canContinueToPersonalPlan,
  type PersonalPlanReadinessPhase,
} from "./transition"

export function PersonalPlanReadyClient({
  leadId,
  nextHref,
}: {
  leadId: string
  nextHref: "/plan-start" | "/onboarding?returnTo=%2Froutine"
}) {
  const [readiness, setReadiness] = useState<PersonalPlanReadinessPhase>("checking")
  const [retryKey, setRetryKey] = useState(0)

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

  const canContinue = canContinueToPersonalPlan(readiness)
  const showRecovery = readiness === "timeout" || readiness === "error"

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <PersonalPlanJourneyHeader currentStage={1} sticky />
      <main className="personal-plan-cookie-clearance px-5 py-8 sm:px-8">
        <div className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-lg flex-col">
          <section className="flex flex-1 flex-col items-center justify-center py-12 text-center">
            <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--brand-plum-ice)]">
              {canContinue ? (
                <Check className="h-9 w-9 text-[var(--brand-plum)]" aria-hidden="true" />
              ) : (
                <Sparkles className="h-9 w-9 text-[var(--brand-plum)]" aria-hidden="true" />
              )}
            </div>

            <div
              aria-hidden="true"
              className="mb-7 grid w-full max-w-sm grid-cols-[1.1fr_0.9fr] gap-2 rounded-3xl border border-[var(--brand-plum)]/15 bg-[var(--brand-plum-ice)] p-3 text-left"
              data-personal-plan-ready-preview
            >
              <div className="rounded-2xl bg-white/85 p-3 shadow-sm">
                <span className="block h-2 w-14 rounded-full bg-[var(--brand-plum)]/25" />
                <span className="mt-3 block h-3 w-full rounded-full bg-[var(--brand-plum)]/80" />
                <span className="mt-2 block h-3 w-4/5 rounded-full bg-[var(--brand-coral)]/70" />
                <span className="mt-2 block h-3 w-3/5 rounded-full bg-[#6FAA70]/70" />
              </div>
              <div className="flex flex-col justify-between rounded-2xl bg-[var(--brand-plum)] p-3 text-white">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/75">
                  Dein Plan
                </span>
                {canContinue ? <Check className="h-8 w-8" /> : <Sparkles className="h-8 w-8" />}
              </div>
            </div>

            {canContinue ? (
              <div className="w-full space-y-7">
                <div className="space-y-4">
                  <h1 className="font-header text-4xl leading-tight">
                    Das empfehlen wir für dein Haar.
                  </h1>
                  <p className="mx-auto max-w-sm text-base leading-7 text-[var(--text-sub)]">
                    Basierend auf deinen Quiz-Antworten.
                  </p>
                </div>

                <Link
                  href={nextHref}
                  className={cn(buttonVariants({ variant: "funnelCta", size: null }))}
                >
                  Bedarfsplan ansehen
                </Link>
              </div>
            ) : (
              <div className="w-full space-y-6" aria-live="polite">
                <div className="space-y-4">
                  <h1 className="font-header text-4xl leading-tight">
                    Wir bereiten deinen Haarplan vor.
                  </h1>
                  <p className="flex items-center justify-center gap-2 text-sm text-[var(--text-sub)]">
                    <LoaderCircle className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
                    Wir gleichen deine Quiz-Antworten ab.
                  </p>
                </div>

                {showRecovery ? (
                  <div className="space-y-4 rounded-3xl border border-border bg-card p-5">
                    <p className="text-sm leading-6 text-[var(--text-sub)]">
                      Die Aktivierung dauert gerade etwas länger. Deine Zahlung und deine Antworten
                      aus der Haaranalyse bleiben sicher gespeichert.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full rounded-full"
                      onClick={() => {
                        setReadiness("checking")
                        setRetryKey((value) => value + 1)
                      }}
                    >
                      Erneut prüfen
                    </Button>
                  </div>
                ) : null}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
