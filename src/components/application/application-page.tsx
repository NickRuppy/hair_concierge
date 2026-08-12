"use client"

import { useMemo } from "react"
import Link from "next/link"
import { PersonalPlanJourneyHeader } from "@/components/personal-plan-journey"

import { ApplicationDay } from "./application-day"
import { ApplicationOverview } from "./application-overview"
import { ApplicationState } from "./application-state"
import type { ApplicationDayView, ApplicationPageView } from "./application-types"

function sortDays(days: ApplicationDayView[]) {
  return [...days].sort((left, right) => left.sortOrder - right.sortOrder)
}

function NoCompleteDayView({ restDay }: { restDay: ApplicationDayView }) {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6">
      <div className="mb-5 rounded-md border border-[var(--brand-plum-light)] bg-card p-4 shadow-[0_14px_38px_-32px_rgba(var(--brand-plum-rgb),0.7)]">
        <p className="type-overline mb-2 text-[var(--text-caption)]">Anwendung</p>
        <h1 className="type-h1 text-[var(--text-heading)]">
          Noch keine vollständige Anleitung verfügbar
        </h1>
        <p className="type-body-sm mt-2 max-w-2xl text-[var(--text-sub)]">
          Deine Routine bleibt unverändert. Für die vorhandenen Produkte fehlen noch ausreichend
          geprüfte Anwendungsschritte.
        </p>
        <Link
          href="/routine"
          className="mt-4 inline-flex min-h-[44px] items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          Zur Routine
        </Link>
      </div>
      <ApplicationOverview days={[restDay]} showHeader={false} />
    </section>
  )
}

export function ApplicationPage({
  view,
  internalComputeMs,
}: {
  view: ApplicationPageView
  internalComputeMs?: number
}) {
  const days = useMemo(() => (view.state === "ready" ? sortDays(view.days) : []), [view])

  let content
  if (view.state === "no_complete_day") {
    content = <NoCompleteDayView restDay={view.restDay} />
  } else if (view.state !== "ready") {
    content = <ApplicationState view={view} />
  } else {
    const selectedDayType = view.selectedDayType ?? null
    const selectedDay = days.find((day) => day.dayType === selectedDayType) ?? null
    content = selectedDay ? (
      <ApplicationDay day={selectedDay} />
    ) : (
      <ApplicationOverview days={days} />
    )
  }

  return (
    <div
      className="personal-plan-cookie-clearance min-h-dvh bg-[var(--background)]"
      data-personal-plan-application-root="true"
      data-personal-plan-application-compute-ms={internalComputeMs}
    >
      <PersonalPlanJourneyHeader currentStage={5} saveStatus="saved" />
      {content}
    </div>
  )
}
