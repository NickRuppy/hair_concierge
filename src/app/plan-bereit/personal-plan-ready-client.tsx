"use client"

import Link from "next/link"
import { FormEvent, useEffect, useRef, useState } from "react"
import {
  PersonalPlanJourneyHeader,
  PersonalPlanJourneyOverview,
} from "@/components/personal-plan-journey"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { HairLength } from "@/lib/vocabulary/hair-length"
import { markPersonalPlanStageNavigation } from "@/lib/personal-plan/stage-navigation-intent"
import {
  applyPersonalPlanReadyPollResponse,
  PERSONAL_PLAN_READY_POLL_INTERVAL_MS,
  PERSONAL_PLAN_READY_POLL_LIMIT,
  canContinueToPersonalPlan,
  createPersonalPlanReadyPollRequestState,
  takePersonalPlanReadyPollRequest,
  type PersonalPlanReadinessPhase,
} from "./transition"
import type {
  PlanBereitInitialAction,
  PlanBereitInitialReadiness,
  PlanBereitMissingSourceFact,
} from "./readiness"

type PlanBereitStatusBody = {
  status?: PersonalPlanReadinessPhase
  leadId?: string | null
  sourceVersion?: string | null
  missingFacts?: PlanBereitMissingSourceFact[]
  initialAction?: PlanBereitInitialAction
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
  initialReadiness,
  nextHref = "/plan-start",
}: {
  leadId: string | null
  initialStatus?: PersonalPlanReadinessPhase
  initialReadiness?: PlanBereitInitialReadiness
  nextHref?: "/plan-start"
}) {
  const serverReadiness = initialReadiness ?? {
    status: initialStatus,
    leadId,
    sourceVersion: null,
    missingFacts: [],
    initialAction: initialStatus === "checking" ? "link" : "none",
  }
  const initialAction = serverReadiness.initialAction
  const initialLeadId = serverReadiness.leadId ?? leadId
  const [readiness, setReadiness] = useState<ClientReadiness>({
    status: serverReadiness.status,
    leadId: initialLeadId,
    sourceVersion: serverReadiness.sourceVersion ?? null,
    missingFacts: serverReadiness.missingFacts,
  })
  const [retryKey, setRetryKey] = useState(0)
  const [retryAction, setRetryAction] = useState<PlanBereitInitialAction | null>(null)
  const [selectedHairLength, setSelectedHairLength] = useState<HairLength | null>(null)
  const [isSavingFact, setIsSavingFact] = useState(false)
  const actionDockRef = useRef<HTMLElement>(null)

  const currentLeadId = readiness.leadId ?? leadId
  const missingHairLength =
    readiness.missingFacts.find((fact) => fact.field === "hair_length") ?? null

  useEffect(() => {
    const activeInitialAction = retryAction ?? initialAction
    if (activeInitialAction === "none") return
    const pollLeadId = initialLeadId
    let requestState = createPersonalPlanReadyPollRequestState(activeInitialAction)
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let attempts = 0

    async function poll() {
      attempts += 1
      try {
        const statusUrl = pollLeadId
          ? `/plan-bereit/status?lead=${encodeURIComponent(pollLeadId)}`
          : "/plan-bereit/status"
        const request = takePersonalPlanReadyPollRequest(requestState)
        requestState = request.nextState
        const response = await fetch(statusUrl, {
          method: request.method,
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
        requestState = applyPersonalPlanReadyPollResponse(body.initialAction)
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
  }, [initialAction, initialLeadId, leadId, retryAction, retryKey])

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
  const readinessPath = currentLeadId
    ? `/plan-bereit?lead=${encodeURIComponent(currentLeadId)}`
    : "/plan-bereit"
  const showRetry =
    readiness.status === "timeout" ||
    readiness.status === "transient_error" ||
    readiness.status === "paid_pending" ||
    (readiness.status === "missing_source_facts" && missingHairLength === null)
  const showWaiting = readiness.status === "checking" || readiness.status === "source_pending"
  const showMissingFact = readiness.status === "missing_source_facts" && missingHairLength !== null
  const showSupport = readiness.status === "invalid_source" || readiness.status === "forbidden"

  useEffect(() => {
    const dock = actionDockRef.current
    if (!canContinue || !dock) return

    const rootStyle = document.documentElement.style
    const previous = {
      priority: rootStyle.getPropertyPriority("--landing-sticky-cta-offset"),
      value: rootStyle.getPropertyValue("--landing-sticky-cta-offset"),
    }
    let ownedOffset = ""
    const updateOffset = () => {
      ownedOffset = `${Math.ceil(dock.getBoundingClientRect().height)}px`
      rootStyle.setProperty("--landing-sticky-cta-offset", ownedOffset)
    }
    updateOffset()
    const observer = new ResizeObserver(updateOffset)
    observer.observe(dock)

    return () => {
      observer.disconnect()
      if (rootStyle.getPropertyValue("--landing-sticky-cta-offset") !== ownedOffset) return
      if (previous.value) {
        rootStyle.setProperty("--landing-sticky-cta-offset", previous.value, previous.priority)
      } else {
        rootStyle.removeProperty("--landing-sticky-cta-offset")
      }
    }
  }, [canContinue])

  if (canContinue) {
    return (
      <div className="min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
        <PersonalPlanJourneyHeader currentStage={1} sticky />
        <main className="personal-plan-cookie-clearance mx-auto flex min-h-[calc(100dvh-92px)] w-full max-w-[430px] flex-col px-3 pb-24 pt-2 sm:max-w-[560px] sm:px-5">
          <section className="flex min-h-0 flex-1 flex-col">
            <div className="px-2 pb-2 pt-1 text-center">
              <h1 className="text-balance font-header text-[22px] leading-[1.12] text-[var(--brand-plum-darkest)] sm:text-[26px]">
                Wir haben deinen Idealplan erstellt.
              </h1>
              <p className="mx-auto mt-1.5 max-w-[38ch] text-[11px] leading-[1.35] text-[var(--text-sub)] sm:text-[13px]">
                Jetzt machen wir ihn mit deinem Alltag und deinen Produkten wirklich zu deinem.
              </p>
            </div>

            <PersonalPlanJourneyOverview />
          </section>
        </main>

        <footer
          ref={actionDockRef}
          className="fixed inset-x-0 bottom-0 z-20 border-t border-[#ece6df] bg-[#fdfbf9]/95 px-3 pb-[calc(0.625rem+env(safe-area-inset-bottom))] pt-2.5 backdrop-blur"
        >
          <div className="mx-auto max-w-[430px] sm:max-w-[560px]">
            <Link
              href={nextHref}
              onClick={() => markPersonalPlanStageNavigation("/plan-start")}
              className={cn(buttonVariants({ variant: "funnelCta", size: null }))}
            >
              Idealplan ansehen
            </Link>
          </div>
        </footer>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <PersonalPlanJourneyHeader currentStage={1} sticky />
      <main className="personal-plan-cookie-clearance px-5 py-8 sm:px-8">
        <div className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-lg flex-col">
          <section className="flex flex-1 flex-col items-center justify-center py-12 text-center">
            <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--brand-plum-ice)]">
              <span className="h-3 w-3 rounded-full bg-[var(--brand-plum)]" aria-hidden="true" />
            </div>

            <p className="mb-3 text-sm font-medium text-[var(--brand-plum)]">
              Deine Angaben sind gespeichert
            </p>

            <div className="w-full space-y-6" aria-live="polite">
              {showWaiting ? (
                <>
                  <div className="space-y-4">
                    <h1 className="font-header text-4xl leading-tight">
                      Wir bereiten deinen Haarplan vor.
                    </h1>
                    <p className="mx-auto max-w-sm text-base leading-7 text-[var(--text-sub)]">
                      Du musst nichts tun. Wir prüfen gerade, ob dein vollständiges Profil mit
                      deinem Konto verbunden ist.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-card px-4 py-3 text-left">
                    <p className="text-sm font-semibold text-foreground">Haarplan wird geprüft</p>
                    <p className="mt-1 text-sm text-[var(--text-sub)]">Bitte kurz warten</p>
                  </div>
                  <noscript>
                    <div className="space-y-3 rounded-2xl border border-border bg-card p-4 text-left">
                      <p className="text-sm leading-6 text-[var(--text-sub)]">
                        Ohne JavaScript aktualisiert sich dieser Status nicht automatisch.
                      </p>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <a
                          href={readinessPath}
                          className="inline-flex min-h-11 items-center justify-center rounded-full border border-primary bg-transparent px-5 py-2 text-sm font-medium text-primary"
                        >
                          Status neu laden
                        </a>
                        <a
                          href="/kontakt"
                          className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-background px-5 py-2 text-sm font-medium text-foreground"
                        >
                          Support kontaktieren
                        </a>
                      </div>
                    </div>
                  </noscript>
                </>
              ) : null}

              {showRetry ? (
                <>
                  <div className="space-y-4">
                    <h1 className="font-header text-4xl leading-tight">
                      Die Prüfung dauert länger.
                    </h1>
                    <p className="mx-auto max-w-sm text-base leading-7 text-[var(--text-sub)]">
                      Wir konnten den aktuellen Status gerade nicht bestätigen. Bitte prüfe ihn
                      erneut.
                    </p>
                  </div>
                  <div className="space-y-4 rounded-3xl border border-border bg-card p-5">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full rounded-full"
                      onClick={() => {
                        setReadiness((current) => ({ ...current, status: "checking" }))
                        setRetryAction("poll")
                        setRetryKey((value) => value + 1)
                      }}
                    >
                      Erneut prüfen
                    </Button>
                    <noscript>
                      <a
                        href={readinessPath}
                        className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-primary bg-transparent px-5 py-2 text-sm font-medium text-primary"
                      >
                        Status neu laden
                      </a>
                    </noscript>
                  </div>
                </>
              ) : null}

              {showMissingFact ? (
                <>
                  <div className="space-y-4">
                    <h1 className="font-header text-4xl leading-tight">Eine Angabe fehlt noch.</h1>
                    <p className="mx-auto max-w-sm text-base leading-7 text-[var(--text-sub)]">
                      Beantworte noch eine kurze Frage, damit wir deinen Haarplan vorbereiten
                      können.
                    </p>
                  </div>
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
                  <noscript>
                    <div className="space-y-3 rounded-2xl border border-border bg-card p-4 text-left">
                      <p className="text-sm leading-6 text-[var(--text-sub)]">
                        Zum Speichern dieser Angabe muss JavaScript aktiviert sein.
                      </p>
                      <a
                        href="/kontakt"
                        className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-border bg-background px-5 py-2 text-sm font-medium text-foreground"
                      >
                        Support kontaktieren
                      </a>
                    </div>
                  </noscript>
                </>
              ) : null}

              {showSupport ? (
                <>
                  <div className="space-y-4">
                    <h1 className="font-header text-4xl leading-tight">
                      Wir können deinen Haarplan gerade nicht zuordnen.
                    </h1>
                    <p className="mx-auto max-w-sm text-base leading-7 text-[var(--text-sub)]">
                      Bitte kontaktiere den Support. Wir prüfen die Zuordnung mit dir gemeinsam.
                    </p>
                  </div>
                  <div className="space-y-4 rounded-3xl border border-border bg-card p-5">
                    <a
                      href="/kontakt"
                      className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-border bg-background px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      Support kontaktieren
                    </a>
                  </div>
                </>
              ) : null}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
