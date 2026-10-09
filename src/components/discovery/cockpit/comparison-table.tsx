import type { DiscoveryPropertyRow } from "@/lib/discovery/property-rows"
import { cn } from "@/lib/utils"

/**
 * The web counterpart of the iOS result card's `ComparisonTable`
 * (`ios/Chaarlie/Assessment/AssessmentSheet.swift`, locked design spec §2), for the call
 * cockpit only: one rounded card, a caps header „PRODUKT · ZIEL", and per property one
 * row — name, a status disc, the product's value in the status colour, her target in plum.
 *
 * Deliberately without the iOS info column: the cockpit has no explanation overlay (yet).
 * `compact` is the alternatives' variant (smaller value font, „Alternative" column), as on
 * iOS; with `ownedRows` it becomes the three-column „Bisheriges Produkt | Alternative | Ziel".
 * `productHeader` renames the product column only (F1: „Empfohlenes Produkt" for the
 * Idealplan's own recommendation) — same table, same design.
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
/**
 * Her target, as a pronoun-free cockpit label (Nick's ruling 2026-09-29) — like „Bisheriges
 * Produkt" next to it. The iOS card says „Dein Ziel" to the participant; this table is the
 * call's only.
 */
const TARGET_HEADER = "Ziel"
const TARGET_ARIA = "Ziel"

/** iOS breaks these two at their word joint („Pflege-/gewicht"); a soft hyphen does that. */
function breakableLabel(label: string): string {
  return label
    .replace("Pflegegewicht", "Pflege­gewicht")
    .replace("Pflegerichtung", "Pflege­richtung")
}

const GRID = "grid grid-cols-[96px_16px_minmax(0,1fr)_minmax(0,1fr)] items-center"
/** Alternative next to her product: name | her value | the alternative's value | target. */
const GRID_WITH_OWNED =
  "grid grid-cols-[96px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-center"

const OWNED_HEADER = "Bisheriges Produkt"
const OWNED_ARIA = "bisheriges Produkt"
const ALTERNATIVE_HEADER = "Alternative"

function StatusDisc({
  status,
  owned = false,
}: {
  status: DiscoveryPropertyRow["status"]
  owned?: boolean
}) {
  const entry = STATUS[status]
  return (
    <span
      aria-hidden="true"
      // Her badge carries its own marker so `data-glyph` stays „one per row, the row's own".
      {...(owned ? { "data-owned-glyph": entry.glyph } : { "data-glyph": entry.glyph })}
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[11px] font-bold leading-none text-white",
        entry.disc,
      )}
    >
      {entry.glyph}
    </span>
  )
}

/**
 * Her own product's rows, keyed by dimension — the same `dimensionId` the alternative's rows
 * carry (both come from `discoveryPropertyRows` over the iOS assessment rows).
 */
function ownedByDimension(
  ownedRows: readonly DiscoveryPropertyRow[] | null | undefined,
): Map<string, DiscoveryPropertyRow> | null {
  if (!ownedRows || ownedRows.length === 0) return null
  return new Map(ownedRows.map((row) => [row.dimensionId, row]))
}

export function DiscoveryComparisonTable({
  rows,
  compact = false,
  ownedRows = null,
  productHeader: productHeaderOverride,
}: {
  rows: readonly DiscoveryPropertyRow[]
  /** The alternatives' variant: smaller value font, product column headed „Alternative". */
  compact?: boolean
  /**
   * Cockpit alternatives only: her own product's rows in the same step. When present (and
   * `compact`), the table gains a leading „Bisheriges Produkt" column — her value and status per
   * axis, matched by `dimensionId`; an axis her product lacks leaves the cell empty. Row tint
   * stays the alternative's status.
   */
  ownedRows?: readonly DiscoveryPropertyRow[] | null
  /** The product column's header, e.g. „Empfohlenes Produkt"; defaults by variant. */
  productHeader?: string
}) {
  if (rows.length === 0) return null
  const owned = compact ? ownedByDimension(ownedRows) : null
  if (owned) {
    return <ComparisonWithOwned rows={rows} owned={owned} productHeader={productHeaderOverride} />
  }
  const gap = compact ? "gap-x-1.5" : "gap-x-2"
  const valueSize = compact ? "text-[12px]" : "text-[13px]"
  const productHeader = productHeaderOverride ?? (compact ? ALTERNATIVE_HEADER : "Produkt")
  return (
    <div
      lang="de"
      data-comparison={compact ? "compact" : "full"}
      className="overflow-hidden rounded-[14px] border border-border bg-card"
    >
      <div
        aria-hidden="true"
        className={cn(
          GRID,
          gap,
          "bg-[#f6f3f0] px-2.5 py-[9px] text-[11px] font-bold uppercase leading-tight tracking-[0.04em] text-foreground [&>span]:min-w-0",
        )}
      >
        <span />
        <span />
        <span>{productHeader}</span>
        <span className="text-[var(--brand-plum)]">{TARGET_HEADER}</span>
      </div>
      <ul className="divide-y divide-border border-t border-border">
        {rows.map((row) => {
          const status = STATUS[row.status]
          return (
            <li
              key={row.dimensionId}
              data-status={row.status}
              aria-label={`${row.label}, ${status.label}, ${productHeader}: ${row.productValue ?? UNAVAILABLE}, ${TARGET_ARIA}: ${row.targetValue ?? UNAVAILABLE}`}
              className={cn(GRID, gap, "min-h-[52px] px-2.5 py-2.5", status.surface)}
            >
              <span
                aria-hidden="true"
                className="hyphens-auto break-normal text-[13px] font-semibold leading-tight text-foreground"
              >
                {breakableLabel(row.label)}
              </span>
              <StatusDisc status={row.status} />
              <span
                aria-hidden="true"
                className={cn(
                  valueSize,
                  "font-bold leading-snug hyphens-auto break-normal",
                  status.word,
                )}
              >
                {row.productValue ?? EMPTY_VALUE}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  valueSize,
                  "font-semibold leading-snug hyphens-auto break-normal text-[var(--brand-plum)]",
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

/**
 * Bisheriges Produkt | Alternative | Ziel — fit and comparison in one glance (Produktphase
 * mockup V2). Each value cell carries its own status disc; the row is tinted by the
 * alternative. On narrow widths the table scrolls inside its own card, never the page.
 */
function ComparisonWithOwned({
  rows,
  owned,
  productHeader,
}: {
  rows: readonly DiscoveryPropertyRow[]
  owned: Map<string, DiscoveryPropertyRow>
  /** Middle-column header; defaults to „Alternative" (F1: „Empfohlenes Produkt"). */
  productHeader?: string
}) {
  const middleHeader = productHeader ?? ALTERNATIVE_HEADER
  const gap = "gap-x-1.5"
  return (
    <div
      lang="de"
      data-comparison="compact-owned"
      className="overflow-hidden rounded-[14px] border border-border bg-card"
    >
      <div className="overflow-x-auto">
        <div className="min-w-[440px]">
          <div
            aria-hidden="true"
            className={cn(
              GRID_WITH_OWNED,
              gap,
              "bg-[#f6f3f0] px-2.5 py-[9px] text-[11px] font-bold uppercase leading-tight tracking-[0.04em] text-foreground [&>span]:min-w-0",
            )}
          >
            <span />
            <span>{OWNED_HEADER}</span>
            <span>{middleHeader}</span>
            <span className="text-[var(--brand-plum)]">{TARGET_HEADER}</span>
          </div>
          <ul className="divide-y divide-border border-t border-border">
            {rows.map((row) => {
              const status = STATUS[row.status]
              const hers = owned.get(row.dimensionId) ?? null
              const hersStatus = hers ? STATUS[hers.status] : null
              const hersAria = hers
                ? `, ${OWNED_ARIA}: ${hers.productValue ?? UNAVAILABLE} (${hersStatus!.label})`
                : ""
              return (
                <li
                  key={row.dimensionId}
                  data-status={row.status}
                  data-owned-status={hers?.status ?? "none"}
                  aria-label={`${row.label}, ${status.label}${hersAria}, ${middleHeader}: ${row.productValue ?? UNAVAILABLE}, ${TARGET_ARIA}: ${row.targetValue ?? UNAVAILABLE}`}
                  className={cn(GRID_WITH_OWNED, gap, "min-h-[52px] px-2.5 py-2.5", status.surface)}
                >
                  <span
                    aria-hidden="true"
                    className="hyphens-auto break-normal text-[13px] font-semibold leading-tight text-foreground"
                  >
                    {breakableLabel(row.label)}
                  </span>
                  <span aria-hidden="true" data-cell="owned" className="flex items-center gap-1.5">
                    {hers && hersStatus ? (
                      <>
                        <StatusDisc status={hers.status} owned />
                        <span
                          className={cn(
                            "text-[12px] font-semibold leading-snug hyphens-auto break-normal",
                            hersStatus.word,
                          )}
                        >
                          {hers.productValue ?? EMPTY_VALUE}
                        </span>
                      </>
                    ) : null}
                  </span>
                  <span
                    aria-hidden="true"
                    data-cell="alternative"
                    className="flex items-center gap-1.5"
                  >
                    <StatusDisc status={row.status} />
                    <span
                      className={cn(
                        "text-[12px] font-bold leading-snug hyphens-auto break-normal",
                        status.word,
                      )}
                    >
                      {row.productValue ?? EMPTY_VALUE}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className="text-[12px] font-semibold leading-snug hyphens-auto break-normal text-[var(--brand-plum)]"
                  >
                    {row.targetValue ?? EMPTY_VALUE}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}
