"use client"

import { Check, LoaderCircle, Sparkles } from "lucide-react"
import Link from "next/link"
import { FormEvent, useEffect, useState } from "react"
import { PersonalPlanJourneyHeader } from "@/components/personal-plan-journey"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { HairLength } from "@/lib/vocabulary/hair-length"
import {
  PERSONAL_PLAN_READY_POLL_INTERVAL_MS,
  PERSONAL_PLAN_READY_POLL_LIMIT,
  canContinueToPersonalPlan,
  type PersonalPlanReadinessPhase,
} from "./transition"
import type { PlanBereitMissingSourceFact } from "./readiness"

type PlanBereitStatusBody = {
  status?: PersonalPlanReadinessPhase
  leadId?: string | null
  sourceVersion?: string | null
  missingFacts?: PlanBereitMissingSourceFact[]
}

type ClientReadiness = {
  status: PersonalPlanReadinessPhase
  leadId: string | null
  sourceVersion: string | null
  missingFacts: PlanBereitMissingSourceFact[]
}

function toClientReadiness(
  body: PlanBereitStatusBody,
  fallbackLeadId: string | null,
): ClientReadiness {
  return {
    status: body.status ?? "transient_error",
    leadId: body.leadId ?? fallbackLeadId,
    sourceVersion: body.sourceVersion ?? null,
    missingFacts: Array.isArray(body.missingFacts) ? body.missingFacts : [],
  }
}

export function PersonalPlanReadyClient({
  leadId,
  initialStatus = "checking",
  nextHref = "/plan-start",
}: {
  leadId: string | null
  initialStatus?: PersonalPlanReadinessPhase
  nextHref?: "/plan-start"
}) {
  const [readiness, setReadiness] = useState<ClientReadiness>({
    status: initialStatus,
    leadId,
    sourceVersion: null,
    missingFacts: [],
  })
  const [retryKey, setRetryKey] = useState(0)
  const [selectedHairLength, setSelectedHairLength] = useState<HairLength | null>(null)
  const [isSavingFact, setIsSavingFact] = useState(false)

  const currentLeadId = readiness.leadId ?? leadId
  const missingHairLength =
    readiness.missingFacts.find((fact) => fact.field === "hair_length") ?? null

  useEffect(() => {
    if (initialStatus === "forbidden") return
    const pollLeadId = leadId
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let attempts = 0

    async function poll() {
      attempts += 1
      try {
        const statusUrl = pollLeadId
          ? `/plan-bereit/status?lead=${encodeURIComponent(pollLeadId)}`
          : "/plan-bereit/status"
        const response = await fetch(statusUrl, {
          method: attempts === 1 ? "POST" : "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
        })
        const body = await response.json().catch(() => ({}))
        if (cancelled) return

        if (response.status === 401) {
          const authTarget = leadId ? `/plan-bereit?lead=${leadId}` : "/plan-bereit"
          window.location.assign(`/auth?next=${encodeURIComponent(authTarget)}`)
          return
        }
        if (response.status === 403) {
          setReadiness((current) => ({ ...current, status: "forbidden" }))
          return
        }
        if (!response.ok || body.status === "transient_error") {
          setReadiness((current) => ({ ...current, status: "transient_error" }))
          return
        }
        const next = toClientReadiness(body, pollLeadId)
        setReadiness(next)
        if (next.status !== "checking" && next.status !== "source_pending") {
          return
        }
      } catch {
        // A transient network failure consumes one attempt and is retried below.
      }

      if (attempts >= PERSONAL_PLAN_READY_POLL_LIMIT) {
        setReadiness((current) => ({ ...current, status: "timeout" }))
        return
      }
      timer = setTimeout(poll, PERSONAL_PLAN_READY_POLL_INTERVAL_MS)
    }

    void poll()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [leadId, initialStatus, retryKey])

  async function submitMissingHairLength(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!currentLeadId || !readiness.sourceVersion || !selectedHairLength) return
    setIsSavingFact(true)
    try {
      const response = await fetch(
        `/plan-bereit/status?lead=${encodeURIComponent(currentLeadId)}`,
        {
          method: "PATCH",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            field: "hair_length",
            value: selectedHairLength,
            sourceVersion: readiness.sourceVersion,
          }),
        },
      )
      const body = await response.json().catch(() => ({}))
      if (response.status === 401) {
        window.location.assign(
          `/auth?next=${encodeURIComponent(`/plan-bereit?lead=${currentLeadId}`)}`,
        )
        return
      }
      if (!response.ok || body.status === "transient_error") {
        setReadiness((current) => ({ ...current, status: "transient_error" }))
        return
      }
      setReadiness(toClientReadiness(body, currentLeadId))
    } catch {
      setReadiness((current) => ({ ...current, status: "transient_error" }))
    } finally {
      setIsSavingFact(false)
    }
  }

  const canContinue = canContinueToPersonalPlan(readiness.status)
  const showRetry =
    readiness.status === "timeout" ||
    readiness.status === "transient_error" ||
    readiness.status === "source_pending" ||
    readiness.status === "paid_pending"
  const showSupport = readiness.status === "invalid_source" || readiness.status === "forbidden"

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

                {showRetry ? (
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
                        setReadiness((current) => ({ ...current, status: "checking" }))
                        setRetryKey((value) => value + 1)
                      }}
                    >
                      Erneut prüfen
                    </Button>
                  </div>
                ) : null}
                {readiness.status === "missing_source_facts" && missingHairLength ? (
                  <form
                    className="space-y-4 rounded-3xl border border-border bg-card p-5 text-left"
                    onSubmit={submitMissingHairLength}
                  >
                    <div className="space-y-2">
                      <h2 className="text-base font-semibold text-foreground">
                        {missingHairLength.question}
                      </h2>
                      <p className="text-sm leading-6 text-[var(--text-sub)]">
                        {missingHairLength.helper}
                      </p>
                    </div>
                    <div className="grid gap-2">
                      {missingHairLength.options.map((option) => (
                        <label
                          key={option.value}
                          className={cn(
                            "flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium",
                            selectedHairLength === option.value
                              ? "border-[var(--brand-plum)] bg-[var(--brand-plum-ice)] text-[var(--brand-plum)]"
                              : "border-border bg-background text-foreground",
                          )}
                        >
                          <input
                            type="radio"
                            name="hair_length"
                            value={option.value}
                            checked={selectedHairLength === option.value}
                            onChange={() => setSelectedHairLength(option.value)}
                            className="h-4 w-4 accent-[var(--brand-plum)]"
                          />
                          <span>{option.label}</span>
                        </label>
                      ))}
                    </div>
                    <Button
                      type="submit"
                      variant="funnelCta"
                      className="w-full"
                      disabled={!selectedHairLength || isSavingFact}
                    >
                      {isSavingFact ? "Speichern..." : "Weiter"}
                    </Button>
                  </form>
                ) : null}
                {showSupport ? (
                  <div className="space-y-4 rounded-3xl border border-border bg-card p-5">
                    <p className="text-sm leading-6 text-[var(--text-sub)]">
                      Wir können diesen Haarplan gerade nicht eindeutig deinem Konto zuordnen. Deine
                      Zahlung bleibt sicher erfasst.
                    </p>
                    <a
                      href="/kontakt"
                      className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-border bg-background px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      Support kontaktieren
                    </a>
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
