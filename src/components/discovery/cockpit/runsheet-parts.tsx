import type { ReactNode } from "react"

import { DISCOVERY_INTAKE_CATEGORY_COPY } from "@/components/discovery/intake/categories"
import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"
import type { RunsheetPrepItem } from "@/lib/discovery/runsheet"

/**
 * Shared pieces of the call runsheet (consult-runsheet T3): the phase frame, cards, chips
 * and the checklist copy. Cockpit-owned copy is neutral third person (R6).
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
  ask_detangling: "Kamm oder Bürste, wie sie entwirrt",
  ask_where_she_shops: "wo sie einkauft",
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
