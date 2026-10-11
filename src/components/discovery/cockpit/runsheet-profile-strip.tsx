import type { RunsheetProfileRow } from "@/lib/discovery/runsheet/profile-strip"

/**
 * Her profile at a glance (cockpit call-ready E1) — first thing on the page, so the facts that
 * decide the plan are visible without opening a fold. One labelled line per area; the main
 * problem is marked. Display only.
 */

const TITLE = "Profil"
const MAIN_MARK = "Hauptproblem"

export function DiscoveryRunsheetProfileStrip({ rows }: { rows: readonly RunsheetProfileRow[] }) {
  if (rows.length === 0) return null
  return (
    <section
      id="runsheet-profile"
      aria-label={TITLE}
      className="rounded-xl border bg-card px-4 py-3"
    >
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        {TITLE}
      </p>
      <dl className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-1.5 text-[13px]">
        {rows.map((row) => (
          <div key={row.label} className="contents">
            <dt className="pt-0.5 font-bold text-foreground">{row.label}</dt>
            <dd className="flex flex-wrap gap-1.5">
              {row.items.map((item) => (
                <span
                  key={item.text}
                  className={
                    item.main
                      ? "rounded-full bg-[var(--brand-plum)] px-2 py-0.5 text-[12px] font-bold text-white"
                      : "rounded-full bg-[var(--status-neutral-bg)] px-2 py-0.5 text-[12px] text-foreground"
                  }
                >
                  {item.main ? `${MAIN_MARK}: ${item.text}` : item.text}
                </span>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
