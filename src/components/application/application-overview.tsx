import type { ApplicationDayView } from "./application-types"
import { ApplicationDayCard } from "./application-day-card"

export function ApplicationOverview({
  days,
  showHeader = true,
}: {
  days: ApplicationDayView[]
  showHeader?: boolean
}) {
  const hasPartialGuidance = days.some((day) => day.isPartial)
  const provisionalProductCount = days.reduce(
    (total, day) => total + day.provisionalProductCount,
    0,
  )
  const unresolvedProductCount = days.reduce((total, day) => total + day.unresolvedProductCount, 0)

  return (
    <section
      aria-labelledby={showHeader ? "application-overview-title" : undefined}
      aria-label={showHeader ? undefined : "Verfügbare Anwendungstage"}
      className={showHeader ? "mx-auto w-full max-w-5xl px-4 py-5 sm:px-6" : "mt-5"}
    >
      {showHeader ? (
        <header className="max-w-2xl pb-1">
          <h1 id="application-overview-title" className="type-h1 text-[var(--text-heading)]">
            Anwendung
          </h1>
          <p className="type-body mt-2 text-[var(--text-sub)]">Wähle, was heute passt.</p>
        </header>
      ) : null}
      {showHeader && hasPartialGuidance ? (
        <div className="mt-4 flex flex-wrap gap-2" aria-label="Status der Anwendung">
          <span className="type-caption rounded-full bg-[#fff0f1] px-3 py-1.5 font-bold text-[#a4404a]">
            Plan teilweise bereit
          </span>
          {provisionalProductCount > 0 ? (
            <span className="type-caption rounded-full bg-[#fff6e9] px-3 py-1.5 font-bold text-[#9b642c]">
              {provisionalProductCount}{" "}
              {provisionalProductCount === 1 ? "Produkt" : "Produkte"} vorläufig
            </span>
          ) : null}
          {unresolvedProductCount > 0 ? (
            <span className="type-caption rounded-full bg-[var(--brand-plum-ice)] px-3 py-1.5 font-bold text-[var(--brand-plum)]">
              {unresolvedProductCount}{" "}
              {unresolvedProductCount === 1 ? "Detail" : "Details"} offen
            </span>
          ) : null}
        </div>
      ) : null}
      <ol
        className={`${
          showHeader ? "mt-5 " : ""
        }flex snap-x gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-2 md:overflow-visible md:pb-0 xl:grid-cols-3`}
      >
        {days.map((day) => (
          <ApplicationDayCard key={day.dayType} day={day} />
        ))}
      </ol>
    </section>
  )
}
