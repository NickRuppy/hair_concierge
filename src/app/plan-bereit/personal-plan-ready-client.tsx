"use client"

import { Check, LoaderCircle, Sparkles } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { PersonalPlanJourneyHeader } from "@/components/personal-plan-journey"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  PERSONAL_PLAN_READY_MESSAGES,
  PERSONAL_PLAN_READY_MIN_STORY_MS,
  PERSONAL_PLAN_READY_POLL_INTERVAL_MS,
  PERSONAL_PLAN_READY_POLL_LIMIT,
  canContinueToPersonalPlan,
  personalPlanStoryIndexAt,
  type PersonalPlanReadinessPhase,
} from "./transition"

export function PersonalPlanReadyClient({
  leadId,
  nextHref,
}: {
  leadId: string
  nextHref: "/plan-start" | "/onboarding?returnTo=%2Froutine"
}) {
  const [storyIndex, setStoryIndex] = useState(0)
  const [storyComplete, setStoryComplete] = useState(false)
  const [readiness, setReadiness] = useState<PersonalPlanReadinessPhase>("checking")
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

  const canContinue = canContinueToPersonalPlan(readiness)
  const waitingForPlan = storyComplete && readiness === "checking"
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

            {canContinue ? (
              <div className="w-full space-y-7">
                <div className="space-y-3">
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--brand-plum)]">
                    Dein Bedarfsplan ist bereit
                  </p>
                  <h1 className="font-header text-4xl leading-tight">Das braucht dein Haar.</h1>
                  <p className="mx-auto max-w-sm text-base leading-7 text-[var(--text-sub)]">
                    Zuerst siehst du, was dein Haar laut deiner Haaranalyse braucht. Danach machen
                    wir den Plan mit deinen eigenen Produkten wirklich zu deinem.
                  </p>
                </div>

                <Link
                  href={nextHref}
                  className={cn(buttonVariants({ variant: "funnelCta", size: null }))}
                >
                  Plan ansehen
                </Link>
              </div>
            ) : (
              <div className="w-full space-y-8">
                <div className="min-h-36 space-y-4" aria-live="polite">
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--brand-plum)]">
                    Dein persönlicher Haarplan
                  </p>
                  <h1 className="font-header text-4xl leading-tight">
                    {PERSONAL_PLAN_READY_MESSAGES[storyIndex]}
                  </h1>
                  {waitingForPlan ? (
                    <p className="flex items-center justify-center gap-2 text-sm text-[var(--text-sub)]">
                      <LoaderCircle
                        className="h-4 w-4 motion-safe:animate-spin"
                        aria-hidden="true"
                      />
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
                        index <= storyIndex ? "bg-[var(--brand-plum)]" : "bg-[var(--border)]",
                      ].join(" ")}
                    />
                  ))}
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
