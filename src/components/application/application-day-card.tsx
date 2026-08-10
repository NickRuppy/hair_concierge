import type { ApplicationDayView } from "./application-types"
import Link from "next/link"

export function ApplicationDayCard({ day }: { day: ApplicationDayView }) {
  return (
    <li>
      <Link
        href={`/anwendung/${day.dayType}`}
        className="flex min-h-[92px] w-full flex-col items-start justify-between rounded-md border border-border bg-card p-4 text-left shadow-[0_12px_34px_-30px_rgba(var(--brand-plum-rgb),0.7)] transition-colors hover:border-[var(--brand-plum)] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <span className="flex w-full items-start justify-between gap-3">
          <span className="type-h3 text-[var(--text-heading)]">{day.labelDe}</span>
          {day.isPartial ? (
            <span className="type-caption shrink-0 text-[var(--success)]">Teilweise bereit</span>
          ) : null}
        </span>
        <span className="type-body-sm mt-2 text-[var(--text-sub)]">{day.summaryDe}</span>
        {day.isPartial ? (
          <span className="type-caption mt-2 text-[var(--text-caption)]">
            {[
              day.provisionalProductCount > 0
                ? `${day.provisionalProductCount} ${day.provisionalProductCount === 1 ? "Produkt" : "Produkte"} vorläufig`
                : null,
              day.unresolvedProductCount > 0
                ? `${day.unresolvedProductCount} ${day.unresolvedProductCount === 1 ? "Anwendungsdetail" : "Anwendungsdetails"} offen`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        ) : null}
        {day.cadenceDe && (
          <span className="type-caption mt-3 text-[var(--text-caption)]">{day.cadenceDe}</span>
        )}
      </Link>
    </li>
  )
}
