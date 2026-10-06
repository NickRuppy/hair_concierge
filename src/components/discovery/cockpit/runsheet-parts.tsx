import type { ReactNode } from "react"

import { DISCOVERY_INTAKE_CATEGORY_COPY } from "@/components/discovery/intake/categories"
import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"
import { isKnownProductFrequency } from "@/lib/discovery/frequency"
import {
  deriveStepFrequencyDelta,
  type FrequencyDelta,
  type FrequencyDeltaStatus,
  type RunsheetPrepItem,
  type WashAllowedRange,
  type WashAnchor,
  type WeeklyBand,
} from "@/lib/discovery/runsheet"
import { PRODUCT_FREQUENCY_METADATA, type ProductFrequency } from "@/lib/vocabulary/frequencies"

/**
 * Shared pieces of the call runsheet (consult-runsheet T3): the phase frame, cards, chips
 * and the checklist copy. Cockpit-owned copy is pronoun-free (Nick's ruling 2026-09-29,
 * replacing R6's third person).
 */

export function RunsheetPhase({
  number,
  title,
  id,
  children,
}: {
  number: number
  title: string
  id: string
  children: ReactNode
}) {
  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-3" id={id}>
      <div className="flex items-center gap-2.5 border-b pb-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--brand-plum)] text-xs font-bold text-white">
          {number}
        </span>
        <h2 id={`${id}-title`} className="text-lg font-bold text-foreground">
          {title}
        </h2>
      </div>
      {children}
    </section>
  )
}

export function RunsheetCard({
  title,
  children,
  className = "",
}: {
  title?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`flex flex-col gap-3 rounded-xl border bg-card p-4 ${className}`}>
      {title ? <RunsheetEyebrow>{title}</RunsheetEyebrow> : null}
      {children}
    </div>
  )
}

export function RunsheetEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
      {children}
    </p>
  )
}

export type RunsheetTone = "ok" | "danger" | "pending" | "neutral" | "plum"

const TONE_CLASS: Record<RunsheetTone, string> = {
  ok: "bg-[var(--status-ok-bg)] text-[var(--status-ok-text)]",
  danger: "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]",
  pending: "bg-[var(--status-pending-bg)] text-[var(--status-pending-text)]",
  neutral: "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)]",
  plum: "bg-[var(--brand-plum-ice)] text-[var(--brand-plum)]",
}

export function RunsheetChip({ tone, children }: { tone: RunsheetTone; children: ReactNode }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${TONE_CLASS[tone]}`}>
      {children}
    </span>
  )
}

// --- frequency-delta chip (verdict-layer T3) ------------------------------------------------

const FREQUENCY_STATUS_LABEL: Record<FrequencyDeltaStatus, string> = {
  zu_oft: "zu oft",
  zu_selten: "zu selten",
  passt: "passt",
}

/** 1 → „1", 4/3 → „1,3". */
function formatDecimal(value: number): string {
  return String(Math.round(value * 10) / 10).replace(".", ",")
}

/** A weekly band, compact: „2×/Wo", „3–4×/Wo", „alle 2 Wo", „alle 2–4 Wo". */
export function formatRunsheetWeeklyBand(band: WeeklyBand): string {
  const { min, max } = band
  if (max === null) return min === null ? "" : `ab ${formatDecimal(min)}×/Wo`
  if (min === null || min === 0) {
    return max >= 1
      ? `bis ${formatDecimal(max)}×/Wo`
      : `seltener als alle ${formatDecimal(1 / max)} Wo`
  }
  if (max < 1) {
    return min === max
      ? `alle ${formatDecimal(1 / min)} Wo`
      : `alle ${formatDecimal(1 / max)}–${formatDecimal(1 / min)} Wo`
  }
  return min === max
    ? `${formatDecimal(min)}×/Wo`
    : `${formatDecimal(min)}–${formatDecimal(max)}×/Wo`
}

/**
 * „2×/Wo · Ziel 1×/Wo — zu oft": her answers' band (summed over her products in the step),
 * the step's band, the status.
 */
export function runsheetFrequencyChipLabel(
  delta: FrequencyDelta,
  frequencies: readonly ProductFrequency[],
): string {
  let min = 0
  let max = 0
  for (const frequency of frequencies) {
    min += PRODUCT_FREQUENCY_METADATA[frequency].minPerWeek
    max += PRODUCT_FREQUENCY_METADATA[frequency].maxPerWeek
  }
  const actual = formatRunsheetWeeklyBand({ min, max })
  return `${actual} · Ziel ${formatRunsheetWeeklyBand(delta.ideal)} — ${FREQUENCY_STATUS_LABEL[delta.status]}`
}

/**
 * One step's frequency chip: her products in the step (summed) next to the step's band.
 * Renders nothing without a band or when any of her products has no known frequency —
 * `deriveStepFrequencyDelta` decides.
 */
export function RunsheetFrequencyChip({
  cadenceLabel,
  frequencies,
  washFrequency,
  allowedRange,
  noVerdict = null,
}: {
  cadenceLabel: string
  frequencies: ReadonlyArray<string | null | undefined>
  washFrequency: ProductFrequency | WashAnchor | null
  allowedRange: WashAllowedRange | null
  /** Rendered instead when all her answers are known but the step yields no verdict. */
  noVerdict?: ReactNode
}) {
  const delta = deriveStepFrequencyDelta({
    cadenceLabel,
    frequencies,
    washFrequency,
    allowedRange,
  })
  const known = frequencies.filter(isKnownProductFrequency)
  if (known.length !== frequencies.length) return null
  if (!delta) return noVerdict
  return (
    <RunsheetChip tone={delta.status === "passt" ? "ok" : "pending"}>
      {runsheetFrequencyChipLabel(delta, known)}
    </RunsheetChip>
  )
}

const FREQUENCY_ROW_LABEL = "Wie oft"
const FREQUENCY_ROW_OWNED = "Angabe:"
const FREQUENCY_ROW_IDEAL = "Idealplan:"
const FREQUENCY_ROW_NOT_ASKED = "keine Angabe"
export const FREQUENCY_ROW_NOT_COMPARABLE = "nicht vergleichbar"

/**
 * „Wie oft — Angabe: Täglich ⇄ Idealplan: nach Bedarf": her answer next to the step's
 * rhythm on every product of hers, so the two are never hidden behind a missing verdict.
 * `verdict` is the step chip (or nothing) — this row only places it.
 */
export function RunsheetFrequencyRow({
  ownedFrequencyLabel,
  idealFrequencyLabel,
  verdict,
}: {
  ownedFrequencyLabel: string | null
  idealFrequencyLabel: string
  verdict: ReactNode
}) {
  return (
    <span className="flex w-full flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-foreground">
      <span className="text-xs text-muted-foreground">{FREQUENCY_ROW_LABEL}</span>
      <span>
        {FREQUENCY_ROW_OWNED}{" "}
        <span className="font-bold">{ownedFrequencyLabel ?? FREQUENCY_ROW_NOT_ASKED}</span>
      </span>
      <span aria-hidden="true" className="text-muted-foreground">
        ⇄
      </span>
      <span>
        {FREQUENCY_ROW_IDEAL} <span className="font-bold">{idealFrequencyLabel}</span>
      </span>
      {verdict}
    </span>
  )
}

/** The routine-category anchor every product entry carries (R4). */
export function RunsheetCategoryChip({
  category,
  label,
}: {
  category: PersonalPlanCategory | null
  /** A step's own `categoryLabel`; otherwise the checklist's name for the category. */
  label?: string
}) {
  return (
    <span className="rounded bg-[var(--brand-plum-ice)] px-2 py-0.5 text-xs font-bold text-[var(--brand-plum)]">
      {label ?? (category ? DISCOVERY_INTAKE_CATEGORY_COPY[category].label : CATEGORY_OPEN)}
    </span>
  )
}

const CATEGORY_OPEN = "Kategorie offen"

// --- „Vor dem Call" ----------------------------------------------------------------

export const RUNSHEET_ASK_TOPIC: Record<
  "ask_bleach_cadence" | "ask_detangling" | "ask_where_she_shops",
  string
> = {
  // The rule also fires for colored-only hair (T2), so the copy names both.
  ask_bleach_cadence: "Färbe-/Blondier-Rhythmus",
  ask_detangling: "Entwirren (Kamm oder Bürste)",
  ask_where_she_shops: "Einkaufsort",
}

const RESEARCH_OPEN = "Recherche abschließen"
const SCORE_MISSING = "Baseline-Score abfragen (1–10) und oben eintragen"
const BRIEF_CHECK = "Consult-Brief prüfen (Diagnose, Hebel, Begründungen)"
const ASK_PREFIX = "Im Call klären:"

export type RunsheetChecklistLine = { id: string; label: string }

/** The checklist as lines: research items one by one, the ask_* rules on one line. */
export function runsheetChecklistLines(
  items: readonly RunsheetPrepItem[],
): RunsheetChecklistLine[] {
  const lines: RunsheetChecklistLine[] = []
  const asks: string[] = []
  for (const item of items) {
    switch (item.kind) {
      case "research_open": {
        const category = item.category
          ? ` (${DISCOVERY_INTAKE_CATEGORY_COPY[item.category].label})`
          : ""
        const gtin = item.gtin && !item.label.includes(item.gtin) ? ` · ${item.gtin}` : ""
        lines.push({ id: item.id, label: `${RESEARCH_OPEN} — ${item.label}${gtin}${category}` })
        break
      }
      case "score_missing":
        lines.push({ id: item.id, label: SCORE_MISSING })
        break
      case "ask_bleach_cadence":
      case "ask_detangling":
      case "ask_where_she_shops":
        asks.push(RUNSHEET_ASK_TOPIC[item.kind])
        break
    }
  }
  lines.push({ id: "brief_check", label: BRIEF_CHECK })
  if (asks.length > 0) lines.push({ id: "ask", label: `${ASK_PREFIX} ${asks.join(" · ")}` })
  return lines
}

/** 5.5 → „5,5" — formatted by hand, not by locale (server and browser must agree). */
export function formatRunsheetScore(value: number): string {
  return String(Math.round(value * 10) / 10).replace(".", ",")
}
