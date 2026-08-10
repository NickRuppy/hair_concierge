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

  return (
    <section
      aria-labelledby={showHeader ? "application-overview-title" : undefined}
      aria-label={showHeader ? undefined : "Verfügbare Anwendungstage"}
      className={showHeader ? "mx-auto w-full max-w-5xl px-4 py-5 sm:px-6" : "mt-5"}
    >
      {showHeader ? (
        <header className="max-w-2xl border-b border-border pb-4">
          <h1 id="application-overview-title" className="type-h1 text-[var(--text-heading)]">
            Anwendung
          </h1>
          <p className="type-body mt-2 text-[var(--text-sub)]">
            Wähle den passenden Tag und folge der Reihenfolge.
          </p>
        </header>
      ) : null}
      {showHeader && hasPartialGuidance ? (
        <div className="mt-4 rounded-md border border-[var(--brand-plum-light)] bg-[var(--brand-plum-ice)] p-4">
          <p className="type-h3 text-[var(--text-heading)]">Dein Plan wird noch vervollständigt</p>
          <p className="type-body-sm mt-1 text-[var(--text-sub)]">
            Du kannst die bekannten Schritte bereits nutzen. Vorgemerkte Produkte und noch offene
            Anwendungsdetails sind klar markiert.
          </p>
        </div>
      ) : null}
      <ol
        className={`${showHeader ? "mt-5 " : ""}grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3`}
      >
        {days.map((day) => (
          <ApplicationDayCard key={day.dayType} day={day} />
        ))}
      </ol>
    </section>
  )
}
