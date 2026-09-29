"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"

import { runsheetShoppingListText, type RunsheetLockedIn } from "@/lib/discovery/runsheet"

import { RunsheetEyebrow } from "./runsheet-parts"

/**
 * „Für ihren Plan festgehalten" (produktphase-lockin T2): Phase 3's payoff under the buckets —
 * what she buys (with prices and a sum), keeps, and deliberately goes without, plus how many
 * decisions are still open and the shopping list to copy. Display only: the cockpit derives
 * `lockedIn` from its live selection state (`runsheetLockedIn`), so the section follows each
 * Entscheidung click at once. Cockpit voice (R6): neutral third person. Plum marks the
 * section, coral only the copy CTA.
 */

const TITLE = "Für ihren Plan festgehalten"
const GROUP_BUY = "Kauft sie neu"
const GROUP_KEEP = "Behält sie"
const GROUP_SKIP = "Bewusst ohne Produkt"
const EMPTY = "Noch nichts festgehalten."
const SKIP_EMPTY_STEP = "Schritt bleibt offen"
const TOTAL = "Summe neu"
const TOTAL_FROM = "ab"
const ALL_DECIDED = "Alle Schritte entschieden — bereit für Phase 4."
const COPY = "Liste kopieren"
const COPIED = "Kopiert ✓"
const COPY_FAILED = "Kopieren ging nicht — die Liste ist markiert, bitte manuell kopieren."
const FLOW_NOTE = "Die Liste geht so in Phase 4 (Routine) und ins PDF."
const COPIED_RESET_MS = 1500

/** „2 Schritte noch nicht entschieden." / „1 Schritt …" */
export function runsheetOpenStepsLabel(openCount: number): string {
  if (openCount === 0) return ALL_DECIDED
  return `${openCount} ${openCount === 1 ? "Schritt" : "Schritte"} noch nicht entschieden.`
}

/** „37,95 €", or „ab 28,00 €" while a product to buy has no price. */
export function runsheetTotalLabel(
  lockedIn: Pick<RunsheetLockedIn, "totalLabel" | "missingPrices">,
): string {
  return lockedIn.missingPrices ? `${TOTAL_FROM} ${lockedIn.totalLabel}` : lockedIn.totalLabel
}

export function RunsheetLockedInSection({ lockedIn }: { lockedIn: RunsheetLockedIn }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle")
  const listRef = useRef<HTMLDivElement>(null)
  const resetRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (resetRef.current) clearTimeout(resetRef.current)
    },
    [],
  )

  function copy() {
    const text = runsheetShoppingListText(lockedIn)
    const fallback = () => {
      // No clipboard (insecure context, denied permission): select the list so Nick can copy.
      const node = listRef.current
      const selection = typeof window === "undefined" ? null : window.getSelection()
      if (node && selection) selection.selectAllChildren(node)
      setCopyState("failed")
    }
    try {
      // Called synchronously inside the click, so the user gesture still counts.
      void navigator.clipboard.writeText(text).then(() => {
        setCopyState("copied")
        if (resetRef.current) clearTimeout(resetRef.current)
        resetRef.current = setTimeout(() => setCopyState("idle"), COPIED_RESET_MS)
      }, fallback)
    } catch {
      fallback()
    }
  }

  return (
    <section
      aria-labelledby="runsheet-locked-in-title"
      id="runsheet-locked-in"
      className="flex flex-col gap-4 rounded-xl border border-[var(--brand-plum)] bg-card p-4"
    >
      <h3 id="runsheet-locked-in-title" className="text-[15px] font-bold text-[var(--brand-plum)]">
        {TITLE}
      </h3>

      <div ref={listRef} className="flex flex-col gap-1.5">
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
        <RunsheetEyebrow>{GROUP_SKIP}</RunsheetEyebrow>
        {lockedIn.skip.length === 0 ? (
          <Empty />
        ) : (
          lockedIn.skip.map((row, index) =>
            row.label ? (
              <Row
                key={`${row.categoryLabel}-${row.label}-${index}`}
                name={row.label}
                detail={row.categoryLabel}
              />
            ) : (
              <Row
                key={`${row.categoryLabel}-${index}`}
                name={row.categoryLabel}
                detail={SKIP_EMPTY_STEP}
              />
            ),
          )
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

      <div className="flex flex-wrap items-center gap-3">
        <button
          id="runsheet-locked-in-copy"
          type="button"
          onClick={copy}
          className="rounded-lg bg-[var(--brand-coral)] px-4 py-2 text-sm font-bold text-white"
        >
          {copyState === "copied" ? COPIED : COPY}
        </button>
        {copyState === "failed" ? (
          <span role="status" className="text-[12px] text-muted-foreground">
            {COPY_FAILED}
          </span>
        ) : null}
      </div>

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
