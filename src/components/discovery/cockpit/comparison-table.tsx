import type { DiscoveryPropertyRow } from "@/lib/discovery/property-rows"
import { cn } from "@/lib/utils"

/**
 * The web counterpart of the iOS result card's `ComparisonTable`
 * (`ios/Chaarlie/Assessment/AssessmentSheet.swift`, locked design spec §2), for the call
 * cockpit only: one rounded card, a caps header „PRODUKT · DEIN ZIEL", and per property one
 * row — name, a status disc, the product's value in the status colour, her target in plum.
 *
 * Deliberately without the iOS info column: the cockpit has no explanation overlay (yet).
 * `compact` is the alternatives' variant (smaller value font), as on iOS.
 */

const STATUS: Record<
  DiscoveryPropertyRow["status"],
  { glyph: string; label: string; surface: string; word: string; disc: string }
> = {
  match: {
    glyph: "✓",
    label: "passt",
    surface: "bg-[var(--status-ok-bg)]",
    word: "text-[var(--status-ok-text)]",
    disc: "bg-[var(--status-ok-text)]",
  },
  partial: {
    glyph: "!",
    label: "mit Einschränkung",
    surface: "bg-[var(--status-pending-bg)]",
    word: "text-[var(--status-pending-text)]",
    disc: "bg-[var(--status-pending-text)]",
  },
  mismatch: {
    glyph: "✕",
    label: "passt nicht",
    surface: "bg-[var(--status-danger-bg)]",
    word: "text-[var(--status-danger-text)]",
    disc: "bg-[var(--status-danger-text)]",
  },
  unknown: {
    glyph: "–",
    label: "nicht einschätzbar",
    surface: "bg-[#f6f3f0]",
    word: "text-muted-foreground",
    disc: "bg-muted-foreground",
  },
}

const EMPTY_VALUE = "–"
const UNAVAILABLE = "nicht verfügbar"

/** iOS breaks these two at their word joint („Pflege-/gewicht"); a soft hyphen does that. */
function breakableLabel(label: string): string {
  return label
    .replace("Pflegegewicht", "Pflege­gewicht")
    .replace("Pflegerichtung", "Pflege­richtung")
}

const GRID = "grid grid-cols-[68px_16px_minmax(0,1fr)_minmax(0,1fr)] items-center"

export function DiscoveryComparisonTable({
  rows,
  compact = false,
}: {
  rows: readonly DiscoveryPropertyRow[]
  compact?: boolean
}) {
  if (rows.length === 0) return null
  const gap = compact ? "gap-x-1.5" : "gap-x-2"
  const valueSize = compact ? "text-[12px]" : "text-[13px]"
  return (
    <div
      data-comparison={compact ? "compact" : "full"}
      className="overflow-hidden rounded-[14px] border border-border bg-card"
    >
      <div
        aria-hidden="true"
        className={cn(
          GRID,
          gap,
          "bg-[#f6f3f0] px-2.5 py-[9px] text-[12px] font-bold uppercase tracking-[0.08em] text-foreground",
        )}
      >
        <span />
        <span />
        <span>Produkt</span>
        <span className="text-[var(--brand-plum)]">Dein Ziel</span>
      </div>
      <ul className="divide-y divide-border border-t border-border">
        {rows.map((row) => {
          const status = STATUS[row.status]
          return (
            <li
              key={row.dimensionId}
              data-status={row.status}
              aria-label={`${row.label}, ${status.label}, Produkt: ${row.productValue ?? UNAVAILABLE}, dein Ziel: ${row.targetValue ?? UNAVAILABLE}`}
              className={cn(GRID, gap, "min-h-[52px] px-2.5 py-2.5", status.surface)}
            >
              <span
                aria-hidden="true"
                className="hyphens-manual break-words text-[13px] font-semibold leading-tight text-foreground"
              >
                {breakableLabel(row.label)}
              </span>
              <span
                aria-hidden="true"
                data-glyph={status.glyph}
                className={cn(
                  "flex h-4 w-4 items-center justify-center rounded-full text-[11px] font-bold leading-none text-white",
                  status.disc,
                )}
              >
                {status.glyph}
              </span>
              <span
                aria-hidden="true"
                className={cn(valueSize, "font-bold leading-snug break-words", status.word)}
              >
                {row.productValue ?? EMPTY_VALUE}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  valueSize,
                  "font-semibold leading-snug break-words text-[var(--brand-plum)]",
                )}
              >
                {row.targetValue ?? EMPTY_VALUE}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
