import Link from "next/link"

import type {
  HairProfileSectionRow,
  HairProfileSectionViewModel,
} from "@/lib/personal-plan/refinement/hair-profile-section"
import { cn } from "@/lib/utils"

/**
 * „Dein Haarprofil" — the Feinschliff's durable home in the Profil tab
 * (Task 2.5, mockup screen 2). Presentational only: every value comes from
 * `buildHairProfileSection`, which in turn only reshapes the server's
 * refinement-status contract. No minutes in the rows (decision 6).
 */
export function HairProfileSection({ view }: { view: HairProfileSectionViewModel }) {
  return (
    <section aria-labelledby="haarprofil-heading" className="mb-8">
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id="haarprofil-heading"
          className="font-[family-name:var(--font-display)] text-2xl font-medium text-[var(--text-heading)]"
        >
          Dein Haarprofil
        </h2>
        <span className="whitespace-nowrap text-[12.5px] font-bold text-[var(--brand-plum)] [font-variant-numeric:tabular-nums]">
          {view.completedSteps} von {view.totalSteps}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Fortschritt deines Haarprofils"
        aria-valuemin={0}
        aria-valuemax={view.totalSteps}
        aria-valuenow={view.completedSteps}
        aria-valuetext={`${view.completedSteps} von ${view.totalSteps}`}
        className="mb-[18px] mt-1 h-2 overflow-hidden rounded-full bg-[#e6dff2]"
      >
        <div
          className="h-full rounded-full bg-[var(--brand-plum)]"
          style={{ width: `${view.progressPercent}%` }}
        />
      </div>
      <ul className="space-y-2.5">
        {view.rows.map((row) => (
          <li key={row.key}>
            <HairProfileRow row={row} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function HairProfileRow({ row }: { row: HairProfileSectionRow }) {
  const done = row.status === "done"
  const content = (
    <>
      <span
        aria-hidden="true"
        className={cn(
          "flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full text-sm font-extrabold",
          done
            ? "bg-[#e7efe3] text-[#5d8a6c]"
            : "bg-[var(--brand-plum-ice)] text-[var(--brand-plum)]",
        )}
      >
        {done ? "✓" : row.step}
      </span>
      <span className="min-w-0 flex-1">
        {/* The ✓/number chip and its colours are decorative; the state itself
            must reach assistive tech as text. */}
        <span className="sr-only">{done ? "Erledigt: " : "Offen: "}</span>
        <span
          className={cn(
            "block text-[15px]",
            done
              ? "font-semibold text-muted-foreground"
              : "font-bold text-[var(--brand-plum-darkest)]",
          )}
        >
          {row.label}
        </span>
        {row.note ? (
          <span className="mt-0.5 block text-xs text-muted-foreground">{row.note}</span>
        ) : null}
      </span>
      {row.href ? (
        <span aria-hidden="true" className="font-extrabold text-[var(--brand-plum-light)]">
          ›
        </span>
      ) : null}
    </>
  )

  const className = cn(
    "flex items-center gap-3 rounded-[16px] border px-[15px] py-3.5",
    // Warm done tone straight from the mockup (`.prow.done`) — the lavender
    // `--muted` token would pull the row out of the port's warm palette.
    done ? "border-border bg-[#f6f3f0]" : "border-border bg-card",
  )

  if (row.href) {
    return (
      <Link href={row.href} className={cn(className, "transition-colors hover:bg-accent/50")}>
        {content}
      </Link>
    )
  }

  return (
    <div className={className}>
      {content}
      {/* 2.4 M4: a finished module is edited on purpose, never re-walked by
          tapping the row itself. */}
      {row.editHref ? (
        <Link
          href={row.editHref}
          className="flex-none text-xs font-semibold text-[var(--brand-plum)] underline underline-offset-2 transition-colors hover:text-[var(--brand-plum-dark)]"
        >
          Angaben ändern
        </Link>
      ) : null}
    </div>
  )
}
