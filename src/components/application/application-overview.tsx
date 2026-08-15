import type { MouseEvent } from "react"

import type { ApplicationDayTypeKey } from "@/lib/routines/personal-plan/application/contracts"

import type { ApplicationDayView } from "./application-types"
import { ApplicationDayCard } from "./application-day-card"

export function ApplicationOverview({
  days,
  showHeader = true,
  onOpenDay,
  navigationBasePath = "/anwendung",
}: {
  days: ApplicationDayView[]
  showHeader?: boolean
  onOpenDay?: (event: MouseEvent<HTMLAnchorElement>, dayType: ApplicationDayTypeKey) => void
  navigationBasePath?: string
}) {
  const hasPartialGuidance = days.some((day) => day.isPartial)
  const provisionalProductCount = days.reduce(
    (total, day) => total + day.provisionalProductCount,
    0,
  )
  const unresolvedProductCount = days.reduce((total, day) => total + day.unresolvedProductCount, 0)
  const summaryParts = [
    hasPartialGuidance ? "Der Plan ist teilweise bereit" : null,
    provisionalProductCount > 0
      ? `${provisionalProductCount} ${provisionalProductCount === 1 ? "Produkt ist" : "Produkte sind"} vorläufig`
      : null,
    unresolvedProductCount > 0
      ? `${unresolvedProductCount} ${unresolvedProductCount === 1 ? "Detail ist" : "Details sind"} noch offen`
      : null,
  ].filter(Boolean)

  return (
    <section
      aria-labelledby={showHeader ? "application-overview-title" : undefined}
      aria-label={showHeader ? undefined : "Verfügbare Anwendungstage"}
      className={showHeader ? "mx-auto w-full max-w-5xl px-4 py-5 sm:px-6" : "mt-5"}
    >
      {showHeader ? (
        <header className="max-w-2xl pb-1">
          <h1
            id="application-overview-title"
            className="type-h1 text-[var(--text-heading)]"
            data-personal-plan-transition-focus
            tabIndex={-1}
          >
            Anwendung
          </h1>
          <p className="type-body mt-2 text-[var(--text-sub)]">Wähle, was heute passt.</p>
        </header>
      ) : null}
      {showHeader && hasPartialGuidance ? (
        <section
          className="mt-4 border-l-2 border-[var(--brand-plum)] pl-3 text-sm leading-relaxed text-muted-foreground"
          aria-label="Status der Anwendung"
        >
          <p>{summaryParts.join(". ")}.</p>
        </section>
      ) : null}
      <ol className={`${showHeader ? "mt-5 " : ""}grid gap-4`}>
        {days.map((day) => (
          <ApplicationDayCard
            key={day.dayType}
            day={day}
            onOpenDay={onOpenDay}
            navigationBasePath={navigationBasePath}
          />
        ))}
      </ol>
    </section>
  )
}
