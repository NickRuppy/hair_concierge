import { PRODUCT_FREQUENCY_METADATA, type ProductFrequency } from "@/lib/vocabulary/frequencies"

import type { DiscoveryCockpitStepView } from "../cockpit"
import { isKnownProductFrequency, mostFrequentDiscoveryFrequency } from "../frequency"

/**
 * Frequency-delta chips (verdict-layer T3, plan §4): how often she uses a product next to how
 * often the Idealroutine wants it — `zu oft | zu selten | passt`.
 *
 * The ideal side is prose: every cockpit step's `frequencyLabel` is printed by
 * `frequencyLabel(decision.frequency, paused)` (`src/lib/personal-plan/decision-presentation.ts`)
 * via `buildDiscoveryIdealSteps` (`src/lib/discovery/load-ideal-routine.ts`). This module maps
 * each of those strings — exactly the list below, pinned against that function in
 * `tests/discovery-runsheet-frequency.test.ts` — to a weekly band, anchored at her wash
 * frequency where the cadence is per wash. Anything else (a paused step, a string the
 * Idealroutine never prints) has no band, so no chip: the chip never guesses.
 *
 * The actual side is her intake answer (`ProductFrequency`, the shared vocabulary), as its
 * midpoint per week (`PRODUCT_FREQUENCY_METADATA`); „Weiß ich nicht" / not asked → no chip.
 *
 * Pure and client-safe. No German copy for the chip here — the runsheet UI owns it.
 */

/** Uses per week. `null` = open on that side (a half-open band). */
export type WeeklyBand = { min: number | null; max: number | null }

export type IdealCadenceRule =
  /** A fixed number of uses per week. */
  | { kind: "fixed"; band: WeeklyBand }
  /** Every `every`-th wash: her wash frequency's band divided by `every`. */
  | { kind: "per_wash"; every: 1 | 3 | 4 }
  /** Deliberately no band → no chip. */
  | { kind: "no_band"; reason: "as_needed" | "manufacturer" | "heat_event" | "unrefined" }

/**
 * Every string `frequencyLabel(…, paused = false)` can print (decision-presentation.ts,
 * `frequencyLabel`, one line per `PlanFrequencyTarget` kind):
 *
 * - `wet_wash_total` → `displayFrequencyValue(target)`: `PRODUCT_FREQUENCY_LABELS` with
 *   „x/" → „×/", one per `ProductFrequency`.
 * - `after_each_eligible_wash` → „nach jeder Haarwäsche".
 * - `event_based` → „vor jeder passenden Hitze-Anwendung".
 * - `every_nth_wash` (`every: 3 | 4`) → „jede 3. Haarwäsche", „jede 4. Haarwäsche".
 * - `unscheduled_as_needed` → „bei Bedarf".
 * - `mask_regular_interval` → „1× pro Woche", „etwa alle 2 Wochen", „etwa alle 3 Wochen".
 * - `role_based_wash_linked` → „nach Bedarf" (the category-level label; the cockpit does not
 *   use the role-level `roleFrequencyLabel`).
 * - `product_protocol_course`, `role_keyed_product_protocol` → „nach Herstellerangabe".
 * - no frequency target → „wird im nächsten Schritt verfeinert".
 *
 * A paused step prints the same with „später: " in front (and „später: nach Klärung" without
 * a target) — see `PAUSED_CADENCE_PREFIX`.
 */
export const IDEAL_CADENCE_LABELS = [
  "Seltener als 1×/Monat",
  "Ca. 1×/Monat",
  "Ca. alle 2 Wochen",
  "1×/Woche",
  "2×/Woche",
  "3-4×/Woche",
  "5-6×/Woche",
  "Täglich",
  "nach jeder Haarwäsche",
  "vor jeder passenden Hitze-Anwendung",
  "jede 3. Haarwäsche",
  "jede 4. Haarwäsche",
  "bei Bedarf",
  "1× pro Woche",
  "etwa alle 2 Wochen",
  "etwa alle 3 Wochen",
  "nach Bedarf",
  "nach Herstellerangabe",
  "wird im nächsten Schritt verfeinert",
] as const

export type IdealCadenceLabel = (typeof IDEAL_CADENCE_LABELS)[number]

/** A paused step: „später: …" — the step should not run now, so no chip (v1). */
export const PAUSED_CADENCE_PREFIX = "später: "

function productFrequencyBand(value: ProductFrequency): WeeklyBand {
  const metadata = PRODUCT_FREQUENCY_METADATA[value]
  return { min: metadata.minPerWeek, max: metadata.maxPerWeek }
}

/** The explicit mapping decision for every real cadence string. */
export const IDEAL_CADENCE_RULES: Readonly<Record<IdealCadenceLabel, IdealCadenceRule>> = {
  // The shampoo step's wash target: the vocabulary's own band.
  "Seltener als 1×/Monat": { kind: "fixed", band: productFrequencyBand("less_than_monthly") },
  "Ca. 1×/Monat": { kind: "fixed", band: productFrequencyBand("monthly_1x") },
  "Ca. alle 2 Wochen": { kind: "fixed", band: productFrequencyBand("biweekly_1x") },
  "1×/Woche": { kind: "fixed", band: productFrequencyBand("weekly_1x") },
  "2×/Woche": { kind: "fixed", band: productFrequencyBand("weekly_2x") },
  "3-4×/Woche": { kind: "fixed", band: productFrequencyBand("weekly_3_4x") },
  "5-6×/Woche": { kind: "fixed", band: productFrequencyBand("weekly_5_6x") },
  Täglich: { kind: "fixed", band: productFrequencyBand("daily_1x") },
  "nach jeder Haarwäsche": { kind: "per_wash", every: 1 },
  // Heat frequency is its own topic — no chip in v1.
  "vor jeder passenden Hitze-Anwendung": { kind: "no_band", reason: "heat_event" },
  "jede 3. Haarwäsche": { kind: "per_wash", every: 3 },
  "jede 4. Haarwäsche": { kind: "per_wash", every: 4 },
  "bei Bedarf": { kind: "no_band", reason: "as_needed" },
  "1× pro Woche": { kind: "fixed", band: { min: 1, max: 1 } },
  // „etwa alle 2 Wochen" is exactly the intake's „Alle 2 Wochen" (0,5/week).
  "etwa alle 2 Wochen": { kind: "fixed", band: { min: 0.5, max: 0.5 } },
  // „etwa alle 3 Wochen" (≈0,33/week) has no intake answer of its own: both neighbouring
  // answers — „1× im Monat" (0,25) and „Alle 2 Wochen" (0,5) — pass.
  "etwa alle 3 Wochen": { kind: "fixed", band: { min: 0.25, max: 0.5 } },
  "nach Bedarf": { kind: "no_band", reason: "as_needed" },
  "nach Herstellerangabe": { kind: "no_band", reason: "manufacturer" },
  "wird im nächsten Schritt verfeinert": { kind: "no_band", reason: "unrefined" },
}

function isIdealCadenceLabel(value: string): value is IdealCadenceLabel {
  return Object.prototype.hasOwnProperty.call(IDEAL_CADENCE_RULES, value)
}

/**
 * The engine's tolerated wash range (`wet_wash_total.allowedRange`, from the shampoo
 * decision's scalp-route cadence) — carried by the shampoo step only.
 */
export type WashAllowedRange = { min: ProductFrequency; max: ProductFrequency }

/**
 * The chip for a step whose rhythm yields no verdict (cockpit call-ready E3): a deliberate
 * „no fixed rhythm" step (as needed, per manufacturer, per heat use) says so — „nicht
 * vergleichbar" read like a defect there. Anything else stays „nicht vergleichbar".
 */
export function runsheetNoVerdictLabel(cadenceLabel: string): string {
  return isIdealCadenceLabel(cadenceLabel) && IDEAL_CADENCE_RULES[cadenceLabel].kind === "no_band"
    ? "kein fester Rhythmus"
    : "nicht vergleichbar"
}

/**
 * The weekly band a step's cadence asks for; null = no chip (no band by decision, a paused
 * step, an unknown string, or a per-wash cadence without her wash frequency).
 *
 * `allowedRange` (fix round 1, conservatism: no chip warns where the engine tolerates): the
 * shampoo step's label prints the target bucket, but the engine accepts the whole range, so
 * the range widens the band. It never creates a band where the label has none.
 */
export function idealCadenceBand(
  cadenceLabel: string,
  washFrequency: ProductFrequency | null,
  allowedRange?: WashAllowedRange | null,
): WeeklyBand | null {
  return bandFor(
    cadenceLabel,
    washFrequency ? productFrequencyBand(washFrequency) : null,
    allowedRange,
  )
}

function bandFor(
  cadenceLabel: string,
  washBand: WeeklyBand | null,
  allowedRange: WashAllowedRange | null | undefined,
): WeeklyBand | null {
  const band = labelBand(cadenceLabel, washBand)
  if (!band || !allowedRange) return band
  return {
    min: PRODUCT_FREQUENCY_METADATA[allowedRange.min].minPerWeek,
    max: PRODUCT_FREQUENCY_METADATA[allowedRange.max].maxPerWeek,
  }
}

function labelBand(cadenceLabel: string, washBand: WeeklyBand | null): WeeklyBand | null {
  const label = cadenceLabel.trim()
  if (label.startsWith(PAUSED_CADENCE_PREFIX.trim()) || !isIdealCadenceLabel(label)) return null
  const rule = IDEAL_CADENCE_RULES[label]
  switch (rule.kind) {
    case "fixed":
      return rule.band
    case "no_band":
      return null
    case "per_wash": {
      if (!washBand) return null
      const divide = (value: number | null) => (value === null ? null : value / rule.every)
      return { min: divide(washBand.min), max: divide(washBand.max) }
    }
  }
}

export type FrequencyDeltaStatus = "zu_oft" | "zu_selten" | "passt"

export type FrequencyDelta = {
  status: FrequencyDeltaStatus
  ideal: WeeklyBand
  /** Her uses per week (the intake answer's midpoint). */
  actual: number
}

/** actual > max → zu oft; actual < min → zu selten; otherwise (bounds included) passt. */
export function compareFrequencyToBand(actual: number, band: WeeklyBand): FrequencyDeltaStatus {
  if (band.max !== null && actual > band.max) return "zu_oft"
  if (band.min !== null && actual < band.min) return "zu_selten"
  return "passt"
}

/**
 * How many washes she has per week, honestly (fix wave, P2): with several shampoos the
 * count lies between her most frequent one (`single` — they share wash days) and their sum
 * (`combined` — separate days). One shampoo: both ends are its own band.
 */
export type WashAnchor = { single: WeeklyBand; combined: WeeklyBand }

type FrequencyDeltaContext = {
  /** The step's cadence as the Idealroutine prints it (`DiscoveryCockpitStepView.frequencyLabel`). */
  cadenceLabel: string
  /**
   * Her wash count: the range from `runsheetWashAnchor`, or a single frequency (both ends
   * equal); null when not known.
   */
  washFrequency: ProductFrequency | WashAnchor | null
  /** The shampoo step's `idealAllowedRange`; absent/null for every other step. */
  allowedRange?: WashAllowedRange | null
}

/**
 * A step against its band, on the SUM of all her products in it (fix round 1: one chip per
 * step — two shampoos she alternates add up). Any product without a known frequency → null:
 * a partial sum would understate her use.
 */
export function deriveStepFrequencyDelta(
  step: FrequencyDeltaContext & {
    frequencies: ReadonlyArray<string | null | undefined>
  },
): FrequencyDelta | null {
  if (step.frequencies.length === 0) return null
  let actual = 0
  for (const frequency of step.frequencies) {
    if (!isKnownProductFrequency(frequency)) return null
    actual += PRODUCT_FREQUENCY_METADATA[frequency].midpointPerWeek
  }
  const anchor =
    typeof step.washFrequency === "string"
      ? {
          single: productFrequencyBand(step.washFrequency),
          combined: productFrequencyBand(step.washFrequency),
        }
      : step.washFrequency
  // A per-wash cadence is judged at BOTH ends of her wash range; when the verdict depends on
  // which end is true, the chip stays away. A fixed band is the same at both ends.
  const low = bandFor(step.cadenceLabel, anchor?.single ?? null, step.allowedRange)
  const high = bandFor(step.cadenceLabel, anchor?.combined ?? null, step.allowedRange)
  if (!low || !high) return null
  const status = compareFrequencyToBand(actual, low)
  if (compareFrequencyToBand(actual, high) !== status) return null
  return { status, ideal: unionBand(low, high), actual }
}

function unionBand(a: WeeklyBand, b: WeeklyBand): WeeklyBand {
  return {
    min: a.min === null || b.min === null ? null : Math.min(a.min, b.min),
    max: a.max === null || b.max === null ? null : Math.max(a.max, b.max),
  }
}

/**
 * Her wash range from the shampoo entries in her week (`runsheetEntryInHerWeek`, the rule
 * the chips sum by, plus swapped shampoos — a swap keeps her wash days): `single` = her most
 * frequent shampoo's band, `combined` = the sum of
 * all of them. Null without an in-week shampoo, or when one of them has no known frequency
 * (the sum would understate).
 */
export function runsheetWashAnchor(
  steps: ReadonlyArray<
    Pick<
      DiscoveryCockpitStepView,
      "category" | "outcome" | "intakeItemId" | "ownedLabel" | "ownedFrequency"
    >
  >,
): WashAnchor | null {
  // A swapped shampoo keeps her wash days — the replacement takes them over (cockpit
  // call-ready E3); only a dropped one leaves her washes.
  const shampoos = steps.filter(
    (step) =>
      step.category === "shampoo" &&
      (runsheetEntryInHerWeek(step) || (step.outcome === "swapped" && Boolean(step.ownedLabel))),
  )
  if (shampoos.length === 0) return null
  const known: ProductFrequency[] = []
  for (const step of shampoos) {
    if (!isKnownProductFrequency(step.ownedFrequency)) return null
    known.push(step.ownedFrequency)
  }
  const most = mostFrequentDiscoveryFrequency(known)
  if (!most) return null
  const combined = { min: 0, max: 0 }
  for (const frequency of known) {
    combined.min += PRODUCT_FREQUENCY_METADATA[frequency].minPerWeek
    combined.max += PRODUCT_FREQUENCY_METADATA[frequency].maxPerWeek
  }
  return { single: productFrequencyBand(most), combined }
}

/**
 * Whether a step entry is her product IN her week — the one ownership rule both runsheet
 * phases share (fix round 2), so the Phase-3 and Phase-4 chips sum the same products: kept
 * (with its intake row) or still undecided. A dropped entry leaves her routine, a swapped one
 * is replaced by another product — neither counts toward the step's frequency.
 */
export function runsheetEntryInHerWeek(
  step: Pick<DiscoveryCockpitStepView, "outcome" | "intakeItemId" | "ownedLabel">,
): boolean {
  switch (step.outcome) {
    case "kept":
      return step.intakeItemId !== null && Boolean(step.ownedLabel)
    case "undecided":
      return Boolean(step.ownedLabel)
    case "swapped":
    case "dropped":
    case "ideal":
      return false
  }
}

/**
 * Her wash frequency: the most frequent KNOWN frequency among her shampoos (the same rule as
 * the Waschtag cadence, `mostFrequentDiscoveryFrequency`); null when none is known.
 */
export function runsheetWashFrequency(
  products: ReadonlyArray<{ category: string | null; frequency?: string | null }>,
): ProductFrequency | null {
  return mostFrequentDiscoveryFrequency(
    products.filter((product) => product.category === "shampoo").map((p) => p.frequency),
  )
}

/**
 * F2 (consult-iteration-2): the one-line „warum ändert sich die Waschfrequenz" for the
 * Phase-4 header. Her checklist answer vs the shampoo step's tolerated range
 * (`idealAllowedRange`): clearly outside → a deterministic explanation naming both
 * frequencies; inside the range, unknown on either side, or a paused shampoo step → null.
 * With SEVERAL shampoos her weekly wash count is their sum and a single label would
 * misstate it (Codex review) — the note then stays silent and the chips own the picture.
 * The note never guesses — same conservatism as the chips.
 */
export function runsheetWashChangeNote(
  steps: ReadonlyArray<Pick<DiscoveryCockpitStepView, "frequencyLabel" | "idealAllowedRange">>,
  products: ReadonlyArray<{ category: string | null; frequency?: string | null }>,
  washFrequencyLabel: string | null,
): string | null {
  if (!washFrequencyLabel) return null
  const shampooFrequencies = products
    .filter((product) => product.category === "shampoo")
    .map((product) => product.frequency)
  const single = shampooFrequencies.length === 1 ? shampooFrequencies[0] : null
  if (!isKnownProductFrequency(single)) return null
  const washFrequency = single
  const target = steps.find((step) => step.idealAllowedRange !== null)
  if (!target?.frequencyLabel || target.frequencyLabel.startsWith(PAUSED_CADENCE_PREFIX)) {
    return null
  }
  const range = target.idealAllowedRange as WashAllowedRange
  const allowedMin = productFrequencyBand(range.min).min
  const allowedMax = productFrequencyBand(range.max).max
  const hers = productFrequencyBand(washFrequency)
  if (allowedMin === null || allowedMax === null) return null
  if (hers.min !== null && hers.min > allowedMax) {
    return `Warum seltener (${target.frequencyLabel} statt ${washFrequencyLabel}): Häufiges Waschen entzieht Fett und trocknet die Längen aus — der größere Abstand beruhigt Kopfhaut und Längen.`
  }
  if (hers.max !== null && hers.max < allowedMin) {
    return `Warum öfter (${target.frequencyLabel} statt ${washFrequencyLabel}): Zwischen den Wäschen sammeln sich Talg und Rückstände — der kürzere Abstand hält die Kopfhaut im Gleichgewicht.`
  }
  return null
}
