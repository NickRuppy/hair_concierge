import type { ApplicationDayView } from "./application-types"
import Link from "next/link"

export function ApplicationDayCard({ day }: { day: ApplicationDayView }) {
  return (
    <li>
      <Link
        href={`/anwendung/${day.dayType}`}
        className="flex min-h-[92px] w-full flex-col items-start justify-between rounded-md border border-border bg-card p-4 text-left shadow-[0_12px_34px_-30px_rgba(var(--brand-plum-rgb),0.7)] transition-colors hover:border-[var(--brand-plum)] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <span className="type-h3 text-[var(--text-heading)]">{day.labelDe}</span>
        <span className="type-body-sm mt-2 text-[var(--text-sub)]">{day.summaryDe}</span>
        {day.cadenceDe && (
          <span className="type-caption mt-3 text-[var(--text-caption)]">{day.cadenceDe}</span>
        )}
      </Link>
    </li>
  )
}
