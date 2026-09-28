import type { DiscoveryCockpitStepView, DiscoveryCockpitView } from "@/lib/discovery/cockpit"
import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"

import { RunsheetCard, RunsheetPhase } from "./runsheet-parts"

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
const ROUTINE_FROM_ANSWERS = "Mit ihren Angaben aus der Checkliste berechnet (Häufigkeit, Hitze)."
const HEAT_PROTECTION_ASK = "Hitzeschutz: im Call fragen"
const PROPOSAL = "Vorschlag"
const STEP_OPEN = "bleibt offen"
const IN_RESEARCH = "noch in Recherche"
const CLOSING_QUESTION =
  "Abschlussfrage: „Alles klar so? Passt das in deine Woche?“ — dann festhalten."

/** The step timings (`routineRoleTimingLabel`) that happen on a wash day. */
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
  /** `proposal`: the Idealplan's recommendation for an empty step, not a decision. */
  products: Array<{ label: string; proposal: boolean }>
}

/** The product a step entry puts into her week, as the call has decided it so far. */
function productOf(step: DiscoveryCockpitStepView): { label: string; proposal: boolean } | null {
  switch (step.outcome) {
    case "kept":
      return step.intakeItemId === null || !step.ownedLabel
        ? null
        : { label: step.ownedLabel, proposal: false }
    case "swapped":
      return step.swapProductLabel ? { label: step.swapProductLabel, proposal: false } : null
    case "dropped":
      return null
    case "undecided":
      return step.ownedLabel ? { label: step.ownedLabel, proposal: false } : null
    case "ideal":
      return step.recommendationLabel
        ? { label: `${PROPOSAL}: ${step.recommendationLabel}`, proposal: true }
        : null
  }
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

export function runsheetWeek(steps: readonly DiscoveryCockpitStepView[]): {
  washDay: WeekLine[]
  offDays: WeekLine[]
} {
  const lines = new Map<string, WeekLine>()
  for (const step of steps) {
    const line = lines.get(step.decisionKey) ?? {
      decisionKey: step.decisionKey,
      category: step.category,
      categoryLabel: step.categoryLabel,
      description: step.roleDescription ?? step.roleLabel,
      frequencyLabel: step.frequencyLabel,
      timingLabel: step.depth?.timingLabel ?? null,
      products: [],
    }
    const product = productOf(step)
    if (product) line.products.push(product)
    lines.set(step.decisionKey, line)
  }
  const all = [...lines.values()]
  return {
    washDay: all.filter((line) => line.timingLabel && WASH_DAY_TIMINGS.has(line.timingLabel)),
    offDays: all.filter((line) => !line.timingLabel || !WASH_DAY_TIMINGS.has(line.timingLabel)),
  }
}

export function DiscoveryRunsheetRoutine({
  view,
  washFrequencyLabel,
  researchLabels = {},
}: {
  view: Pick<DiscoveryCockpitView, "steps" | "heatProtectionAsk" | "routineSource">
  /** Her shampoo frequency from the checklist („3–4× pro Woche"); null when not asked. */
  washFrequencyLabel: string | null
  /**
   * Her product still in research per step (`decisionKey`, the Phase-3 join): that step
   * names it instead of reading as open or showing a proposal.
   */
  researchLabels?: Readonly<Record<string, string>>
}) {
  const week = runsheetWeek(view.steps)
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
        <div className="grid gap-3 md:grid-cols-2">
          <WeekCard
            title={WASH_DAY}
            lines={week.washDay}
            empty={null}
            researchLabels={researchLabels}
          />
          <WeekCard
            title={OFF_DAYS}
            lines={week.offDays}
            empty={OFF_DAYS_EMPTY}
            researchLabels={researchLabels}
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
}: {
  title: string
  lines: WeekLine[]
  empty: string | null
  researchLabels: Readonly<Record<string, string>>
}) {
  if (lines.length === 0 && empty === null) return null
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <h3 className="mb-2 text-sm font-bold text-foreground">{title}</h3>
      {lines.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">{empty}</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {lines.map((line) => (
            <li key={line.decisionKey} className="text-[13px] leading-5">
              <span className="font-bold text-foreground">{line.categoryLabel}</span>
              <span className="text-muted-foreground">
                {` · ${[line.timingLabel, line.frequencyLabel].filter(Boolean).join(" · ")}`}
              </span>
              <span className="block text-foreground">
                {runsheetWeekLineText(line, researchLabels[line.decisionKey])}
              </span>
              <span className="block text-[12px] text-muted-foreground">{line.description}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
