import type { DiscoveryCockpitStepView, DiscoveryCockpitView } from "@/lib/discovery/cockpit"
import { cockpitVoice } from "@/lib/discovery/cockpit-copy"
import type { DiscoveryItemFrequency } from "@/lib/discovery/frequency"
import {
  deriveStepFrequencyDelta,
  runsheetEntryInHerWeek,
  type WashAllowedRange,
  type WashAnchor,
} from "@/lib/discovery/runsheet"
import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"
import type { ProductFrequency } from "@/lib/vocabulary/frequencies"
import {
  RUNSHEET_DECISION_STATE_LABELS,
  runsheetDecisionState,
} from "@/lib/discovery/runsheet/decision-state"

import { RunsheetCard, RunsheetFrequencyChip, RunsheetPhase } from "./runsheet-parts"

/**
 * Phase 4 „Routine" (consult-runsheet T3): her week, composed from the Idealroutine and the
 * call's decisions — wash day and the days in between. Display only: the frequencies are
 * the engine's, and the wash-frequency line is her own answer with no recompute (parked O3).
 *
 * No price total: the read model carries no prices for the swap targets and
 * recommendations, so the row is left out entirely until slice 3 adds them.
 */

const TITLE = "Routine"
const ROUTINE_LABEL = "Idealroutine"
const WASH_FREQUENCY = "Wäschen pro Woche"
const WASH_FREQUENCY_NOTE = "Rhythmus im Call bestätigen — die Woche rechnet sich noch nicht neu."
const WASH_DAY = "Waschtag"
const OFF_DAYS = "Tage ohne Wäsche"
const OFF_DAYS_EMPTY = "Nichts nötig."
/** The week table's columns (iteration 3): step, product, timing + cadence, purpose. */
const WEEK_COLUMNS = ["Schritt", "Produkt", "Wann", "Zweck"] as const
const EMPTY_CELL = "–"
const ROUTINE_FROM_ANSWERS = "Aus den Angaben der Checkliste berechnet (Häufigkeit, Hitze)."
const HEAT_PROTECTION_ASK = "Hitzeschutz: im Call fragen"
const STEP_OPEN = "Offen"
const IN_RESEARCH = "noch in Recherche"
const CLOSING_QUESTION =
  "Abschlussfrage: „Alles klar so? Passt das in deine Woche?“ — dann festhalten."

/**
 * Where a step lives in her week (cockpit call-ready A3, Nick 2026-10-09 after the
 * steps-per-day research): a step appears in EVERY column it belongs to. Wash-only steps sit
 * on the wash day; a finishing or leave-on oil goes on last on a wash day AND on days
 * without washing; heat steps follow her hot tools — wash day always, days without washing
 * only when she uses a hot tool (unknown → both). Scalp serums stay on the wash day by
 * default (daily use only per label); dry shampoo bridges the days between washes.
 * Conventions, not hard rules. Unknown roles fall back to the timing label.
 */
const WASH_ONLY_ROLES = new Set([
  "shampoo_everyday",
  "shampoo_dandruff",
  "conditioner_rinse_out",
  "intensive_conditioning_mask",
  "post_wash_leave_in",
  "pre_wash_fibre_treatment",
  "residue_reset",
  "mineral_reset",
  "specialized_bond_treatment",
  "scalp_comfort",
  "scalp_flake_oil_adjunct",
  "density_claim_tonic",
  "scalp_exfoliant",
])
const WASH_AND_OFF_ROLES = new Set(["dry_finish", "leave_on_fibre_conditioning"])
const HEAT_ROLES = new Set(["pre_heat_protection", "pre_heat_application"])
const OFF_ONLY_ROLES = new Set(["root_refresh_bridge"])

/** The role a decision key names (`decision:<category>:<role>:gap`). */
function roleOf(decisionKey: string): string | null {
  return decisionKey.split(":")[2] ?? null
}

export function runsheetWeekPlacement(
  decisionKey: string,
  timingLabel: string | null,
  hotTool: boolean | null,
  /** The step's product is an overnight leave-in (Bondbuilder `bedtime_leave_in`). */
  overnight = false,
): { washDay: boolean; offDays: boolean } {
  const role = roleOf(decisionKey)
  // An overnight treatment is an evening on a day without washing (research 2026-10-09).
  if (overnight) return { washDay: false, offDays: true }
  if (role && WASH_ONLY_ROLES.has(role)) return { washDay: true, offDays: false }
  if (role && WASH_AND_OFF_ROLES.has(role)) return { washDay: true, offDays: true }
  if (role && HEAT_ROLES.has(role)) return { washDay: true, offDays: hotTool !== false }
  if (role && OFF_ONLY_ROLES.has(role)) return { washDay: false, offDays: true }
  const wash = timingLabel !== null && WASH_DAY_TIMINGS.has(timingLabel)
  return { washDay: wash, offDays: !wash }
}

/** The step timings (`routineRoleTimingLabel`) that happen on a wash day — the fallback. */
const WASH_DAY_TIMINGS = new Set([
  "Haarwäsche",
  "Nach Shampoo",
  "Nach der Wäsche",
  "Vor der Haarwäsche",
  "Vor der Wäsche",
  "Statt Shampoo",
])

export type WeekLine = {
  decisionKey: string
  category: PersonalPlanCategory
  categoryLabel: string
  description: string
  frequencyLabel: string
  timingLabel: string | null
  /** The shampoo step's tolerated wash range (the frequency chip's band), else null. */
  allowedRange: WashAllowedRange | null
  /**
   * `proposal`: the Idealplan's recommendation for an empty step, not a decision.
   * `owned`: her own product (kept or undecided); `frequency`: how often she uses it (null =
   * not asked, and always null for a product that is not hers).
   */
  products: Array<{
    label: string
    proposal: boolean
    owned: boolean
    frequency: DiscoveryItemFrequency | null
  }>
}

/**
 * The product a step entry puts into her week, as the call has decided it so far. Her own
 * product counts exactly when `runsheetEntryInHerWeek` says so — the rule the Phase-3 chip
 * sums over too, so the two phases can never disagree (fix round 2).
 */
function productOf(step: DiscoveryCockpitStepView): WeekLine["products"][number] | null {
  // A1: the label carries the entry's one status (Entschieden · Vorschlag · Offen).
  const state = runsheetDecisionState({
    intakeItemId: step.intakeItemId,
    decision: decisionOf(step.outcome),
    hasProposal: step.recommendationLabel !== null,
  })
  const tagged = (label: string) =>
    `${RUNSHEET_DECISION_STATE_LABELS[state === "bewusst_ohne" ? "entschieden" : state]}: ${label}`
  if (runsheetEntryInHerWeek(step) && step.ownedLabel) {
    return {
      label: tagged(step.ownedLabel),
      proposal: false,
      owned: true,
      frequency: step.ownedFrequency,
    }
  }
  switch (step.outcome) {
    case "swapped":
      return step.swapProductLabel
        ? { label: tagged(step.swapProductLabel), proposal: false, owned: false, frequency: null }
        : null
    case "ideal":
      return step.recommendationLabel
        ? { label: tagged(step.recommendationLabel), proposal: true, owned: false, frequency: null }
        : null
    case "kept":
    case "undecided":
    case "dropped":
      return null
  }
}

function decisionOf(outcome: DiscoveryCockpitStepView["outcome"]): "keep" | "swap" | "drop" | null {
  return outcome === "kept"
    ? "keep"
    : outcome === "swapped"
      ? "swap"
      : outcome === "dropped"
        ? "drop"
        : null
}

/** An empty step decided without a product (A1: „Bewusst ohne Produkt") — not in her week. */
function deliberatelyEmpty(step: DiscoveryCockpitStepView): boolean {
  return (
    runsheetDecisionState({
      intakeItemId: step.intakeItemId,
      decision: decisionOf(step.outcome),
      hasProposal: step.recommendationLabel !== null,
    }) === "bewusst_ohne"
  )
}

/**
 * What a week line names. Her product in research (the Phase-3 slot of this step) wins over
 * the Idealplan's proposal — Phase 3 says „noch in Recherche", so Phase 4 must not propose.
 */
export function runsheetWeekLineText(line: WeekLine, researchLabel: string | undefined): string {
  const products = researchLabel ? line.products.filter((entry) => !entry.proposal) : line.products
  if (products.length > 0) return products.map((entry) => entry.label).join(" · ")
  return researchLabel ? `${researchLabel} — ${IN_RESEARCH}` : STEP_OPEN
}

export function runsheetWeek(
  steps: readonly DiscoveryCockpitStepView[],
  options: {
    /** She uses a hot tool (iron, straightener, airflow styler); null = not asked. */
    hotTool?: boolean | null
  } = {},
): {
  washDay: WeekLine[]
  offDays: WeekLine[]
} {
  const lines = new Map<string, WeekLine>()
  // A step whose every entry was deliberately left without a product is not part of her week.
  const skipped = new Set(
    [...new Set(steps.map((step) => step.decisionKey))].filter((key) =>
      steps.filter((step) => step.decisionKey === key).every(deliberatelyEmpty),
    ),
  )
  for (const step of steps) {
    if (skipped.has(step.decisionKey)) continue
    const line = lines.get(step.decisionKey) ?? {
      decisionKey: step.decisionKey,
      category: step.category,
      categoryLabel: step.categoryLabel,
      // The role sentence is the plan's own (second person there) — neutral here (T4).
      description: cockpitVoice(step.roleDescription ?? step.roleLabel),
      frequencyLabel: step.frequencyLabel,
      timingLabel: step.depth?.timingLabel ?? null,
      allowedRange: step.idealAllowedRange,
      products: [],
    }
    const product = productOf(step)
    if (product) line.products.push(product)
    lines.set(step.decisionKey, line)
  }
  const all = [...lines.values()]
  const hotTool = options.hotTool ?? null
  // The product a step puts into her week is applied overnight (swapped-in or the pick).
  const overnightKeys = new Set(
    steps.flatMap((step) => {
      const product =
        step.outcome === "swapped"
          ? step.swapOptions.find((option) => option.productId === step.swapProductId)
          : step.outcome === "ideal"
            ? step.swapOptions.find((option) => option.origin === "ideal_recommendation")
            : undefined
      return product?.applicationMode === "bedtime_leave_in" ? [step.decisionKey] : []
    }),
  )
  const placed = all.map(
    (line) =>
      [
        line,
        runsheetWeekPlacement(
          line.decisionKey,
          line.timingLabel,
          hotTool,
          overnightKeys.has(line.decisionKey),
        ),
      ] as const,
  )
  return {
    washDay: placed.filter(([, at]) => at.washDay).map(([line]) => line),
    offDays: placed.filter(([, at]) => at.offDays).map(([line]) => line),
  }
}

export function DiscoveryRunsheetRoutine({
  view,
  washFrequencyLabel,
  washChangeNote = null,
  washFrequency = null,
  researchLabels = {},
  hotTool = null,
}: {
  view: Pick<DiscoveryCockpitView, "steps" | "heatProtectionAsk" | "routineSource">
  /** She uses a hot tool (her checklist's heat answers); null = not asked. */
  hotTool?: boolean | null
  /** Her shampoo frequency from the checklist („3–4× pro Woche"); null when not asked. */
  washFrequencyLabel: string | null
  /** Why the wash frequency changes (`runsheetWashChangeNote`, F2); null = no change. */
  washChangeNote?: string | null
  /** Her wash range (`runsheetWashAnchor`): the anchor of per-wash frequency chips. */
  washFrequency?: ProductFrequency | WashAnchor | null
  /**
   * Her product still in research per step (`decisionKey`, the Phase-3 join): that step
   * names it instead of reading as open or showing a proposal.
   */
  researchLabels?: Readonly<Record<string, string>>
}) {
  const week = runsheetWeek(view.steps, { hotTool })
  return (
    <RunsheetPhase number={4} title={TITLE} id="runsheet-phase-4">
      <RunsheetCard title={ROUTINE_LABEL}>
        {view.routineSource === "intake_answers" ? (
          <p className="text-[12px] text-muted-foreground">{ROUTINE_FROM_ANSWERS}</p>
        ) : null}
        {washFrequencyLabel ? (
          <p className="flex flex-wrap items-baseline gap-2 text-[13px]">
            <span className="font-bold text-foreground">{WASH_FREQUENCY}</span>
            <span className="rounded-full bg-[var(--brand-plum)] px-2.5 py-0.5 text-xs font-bold text-white">
              {`heute ${washFrequencyLabel}`}
            </span>
            <span className="text-[12px] text-muted-foreground">{WASH_FREQUENCY_NOTE}</span>
          </p>
        ) : null}
        {washChangeNote ? (
          <p className="text-[13px] leading-5 text-foreground">{washChangeNote}</p>
        ) : null}
        {/* Stacked, not side by side: each day's four-column table needs the full width. */}
        <div className="flex flex-col gap-3">
          <WeekCard
            title={WASH_DAY}
            lines={week.washDay}
            empty={null}
            researchLabels={researchLabels}
            washFrequency={washFrequency}
          />
          <WeekCard
            title={OFF_DAYS}
            lines={week.offDays}
            empty={OFF_DAYS_EMPTY}
            researchLabels={researchLabels}
            washFrequency={washFrequency}
          />
        </div>
        {view.heatProtectionAsk ? (
          <p className="text-[13px] font-bold text-[var(--status-pending-text)]">
            {HEAT_PROTECTION_ASK}
          </p>
        ) : null}
        <p className="text-[12px] text-muted-foreground">{CLOSING_QUESTION}</p>
      </RunsheetCard>
    </RunsheetPhase>
  )
}

function WeekCard({
  title,
  lines,
  empty,
  researchLabels,
  washFrequency,
}: {
  title: string
  lines: WeekLine[]
  empty: string | null
  researchLabels: Readonly<Record<string, string>>
  washFrequency: ProductFrequency | WashAnchor | null
}) {
  if (lines.length === 0 && empty === null) return null
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <h3 className="mb-2 text-sm font-bold text-foreground">{title}</h3>
      {lines.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">{empty}</p>
      ) : (
        <WeekTable lines={lines} researchLabels={researchLabels} washFrequency={washFrequency} />
      )}
    </div>
  )
}

/**
 * One row per week line — Schritt | Produkt | Wann | Zweck — with visible row separators, so
 * where one product ends is instantly clear (Nick, iteration 3). Borders and the caps header
 * follow the comparison table; on narrow widths the table scrolls inside its card, never
 * the page.
 */
function WeekTable({
  lines,
  researchLabels,
  washFrequency,
}: {
  lines: WeekLine[]
  researchLabels: Readonly<Record<string, string>>
  washFrequency: ProductFrequency | WashAnchor | null
}) {
  return (
    <div className="overflow-hidden rounded-[14px] border border-border bg-card">
      <div className="overflow-x-auto">
        <table data-week-table="" className="w-full min-w-[560px] border-collapse text-left">
          <thead className="bg-[#f6f3f0]">
            <tr>
              {WEEK_COLUMNS.map((column) => (
                <th
                  key={column}
                  scope="col"
                  className="px-2.5 py-[9px] text-[12px] font-bold uppercase tracking-[0.08em] text-foreground"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border border-t border-border">
            {lines.map((line) => (
              <tr key={line.decisionKey} className="align-top text-[13px] leading-5">
                <th
                  scope="row"
                  className="w-[120px] px-2.5 py-2.5 text-left font-bold text-foreground"
                >
                  {line.categoryLabel}
                </th>
                <td className="px-2.5 py-2.5 text-foreground">
                  {runsheetWeekLineText(line, researchLabels[line.decisionKey])}
                </td>
                <td className="w-[170px] px-2.5 py-2.5 text-muted-foreground">
                  {[line.timingLabel, line.frequencyLabel].filter(Boolean).join(" · ") ||
                    EMPTY_CELL}
                  <WeekLineFrequencyChips line={line} washFrequency={washFrequency} />
                </td>
                <td className="px-2.5 py-2.5 text-[12px] text-muted-foreground">
                  {line.description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/**
 * The week line's frequency chip (verdict-layer T3, fix round 1): one per line, on the sum
 * of her own products in it; none when any of them has no known frequency.
 */
function WeekLineFrequencyChips({
  line,
  washFrequency,
}: {
  line: WeekLine
  washFrequency: ProductFrequency | WashAnchor | null
}) {
  const frequencies = line.products
    .filter((product) => product.owned)
    .map((product) => product.frequency)
  const input = {
    cadenceLabel: line.frequencyLabel,
    frequencies,
    washFrequency,
    allowedRange: line.allowedRange,
  }
  // No empty wrapper when the step gets no chip.
  if (!deriveStepFrequencyDelta(input)) return null
  return (
    <span className="mt-1 flex flex-wrap items-center gap-1.5">
      <RunsheetFrequencyChip {...input} />
    </span>
  )
}
