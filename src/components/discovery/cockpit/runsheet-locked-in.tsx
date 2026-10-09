"use client"

import type { ReactNode } from "react"

import type { RunsheetLockedIn } from "@/lib/discovery/runsheet"

import { RunsheetEyebrow } from "./runsheet-parts"

/**
 * „Für den Plan festgehalten" (produktphase-lockin T2): Phase 3's payoff under the buckets —
 * what gets bought (with prices and a sum), kept, left out (her dropped products) and which
 * steps deliberately stay without a product, plus how many decisions are still open. Display
 * only: the cockpit derives `lockedIn` from its live selection state (`runsheetLockedIn`), so
 * the section follows each Entscheidung click at once. Labels are pronoun-free (Nick,
 * 2026-09-29). Plum marks the section. No copy flow (R29): the list flows into Phase 4 and
 * the PDF on its own.
 */

const TITLE = "Für den Plan festgehalten"
const GROUP_BUY = "Neu kaufen"
const GROUP_KEEP = "Behalten"
const GROUP_DISCARD = "Weglassen"
const GROUP_SKIP = "Bewusst ohne Produkt"
const EMPTY = "Noch nichts festgehalten."
const SKIP_EMPTY_STEP = "kein Produkt nötig"
const TOTAL = "Summe neu"
const TOTAL_FROM = "ab"
const TOTAL_UNKNOWN = "Preis noch offen"
const ALL_DECIDED = "Alle Schritte entschieden — bereit für Phase 4."
const FLOW_NOTE = "Die Liste geht so in Phase 4 (Routine) und ins PDF."

/** „2 Schritte noch nicht entschieden." / „1 Schritt …" */
export function runsheetOpenStepsLabel(openCount: number): string {
  if (openCount === 0) return ALL_DECIDED
  return `${openCount} ${openCount === 1 ? "Schritt" : "Schritte"} noch nicht entschieden.`
}

/** „37,95 €"; „ab 28,00 €" while a buy price is missing; „Preis noch offen" without any. */
export function runsheetTotalLabel(
  lockedIn: Pick<RunsheetLockedIn, "totalLabel" | "missingPrices" | "hasKnownPrice" | "buy">,
): string {
  if (!lockedIn.missingPrices) return lockedIn.totalLabel
  if (lockedIn.buy.length > 0 && !lockedIn.hasKnownPrice) return TOTAL_UNKNOWN
  return `${TOTAL_FROM} ${lockedIn.totalLabel}`
}

export function RunsheetLockedInSection({ lockedIn }: { lockedIn: RunsheetLockedIn }) {
  return (
    <section
      aria-labelledby="runsheet-locked-in-title"
      id="runsheet-locked-in"
      className="flex flex-col gap-4 rounded-xl border border-[var(--brand-plum)] bg-card p-4"
    >
      <h3 id="runsheet-locked-in-title" className="text-[15px] font-bold text-[var(--brand-plum)]">
        {TITLE}
      </h3>

      <div className="flex flex-col gap-1.5">
        <RunsheetEyebrow>{GROUP_BUY}</RunsheetEyebrow>
        {lockedIn.buy.length === 0 ? (
          <Empty />
        ) : (
          lockedIn.buy.map((row, index) => (
            <Row
              key={`${row.categoryLabel}-${row.label}-${index}`}
              name={row.label}
              detail={row.categoryLabel}
              price={row.priceLabel}
            />
          ))
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <RunsheetEyebrow>{GROUP_KEEP}</RunsheetEyebrow>
        {lockedIn.keep.length === 0 ? (
          <Empty />
        ) : (
          lockedIn.keep.map((row, index) => (
            <Row
              key={`${row.categoryLabel}-${row.label}-${index}`}
              name={row.label}
              detail={row.categoryLabel}
            />
          ))
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <RunsheetEyebrow>{GROUP_DISCARD}</RunsheetEyebrow>
        {lockedIn.discard.length === 0 ? (
          <Empty />
        ) : (
          lockedIn.discard.map((row, index) => (
            <Row
              key={`${row.categoryLabel}-${row.label}-${index}`}
              name={row.label}
              detail={row.categoryLabel}
            />
          ))
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <RunsheetEyebrow>{GROUP_SKIP}</RunsheetEyebrow>
        {lockedIn.skip.length === 0 ? (
          <Empty />
        ) : (
          lockedIn.skip.map((row, index) => (
            <Row
              key={`${row.categoryLabel}-${index}`}
              name={row.categoryLabel}
              detail={SKIP_EMPTY_STEP}
            />
          ))
        )}
      </div>

      <div className="flex items-baseline border-t pt-2.5 text-sm font-bold text-foreground">
        <span>{TOTAL}</span>
        <span id="runsheet-locked-in-total" className="ml-auto tabular-nums">
          {runsheetTotalLabel(lockedIn)}
        </span>
      </div>

      <p
        aria-live="polite"
        className={`text-[13px] leading-5 ${
          lockedIn.openCount > 0
            ? "font-bold text-[var(--status-pending-text)]"
            : "text-[var(--status-ok-text)]"
        }`}
      >
        {runsheetOpenStepsLabel(lockedIn.openCount)}
      </p>

      <p className="text-[12px] text-muted-foreground">{FLOW_NOTE}</p>
    </section>
  )
}

function Empty() {
  return <p className="text-[13px] italic text-muted-foreground">{EMPTY}</p>
}

function Row({
  name,
  detail,
  price,
}: {
  name: ReactNode
  detail: ReactNode
  price?: string | null
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
      <span className="font-semibold text-foreground">{name}</span>
      <span className="text-xs text-muted-foreground">{detail}</span>
      {price ? (
        <span className="ml-auto font-semibold tabular-nums text-foreground">{price}</span>
      ) : null}
    </div>
  )
}
