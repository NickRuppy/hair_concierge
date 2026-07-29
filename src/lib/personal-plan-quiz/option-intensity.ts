/**
 * Intensity pip mapping for icon-less scale / frequency answer lists.
 *
 * Each qualifying option renders a leading "pip" glyph (filled dots out of a
 * per-question maximum) instead of a diagnostic icon. The filled count encodes
 * how strongly the option sits on its question's scale — the strongest reading
 * gets the most pips AND the deepest tint. Mappings are derived from each
 * option's semantics (not its list index), so reordering the option list never
 * silently flips the ramp.
 */

export type OptionIntensity = {
  /** Number of filled pips (0 when the option is a "weiß nicht"-style opt-out). */
  pips: number
  /** Total pips shown for this question (its strongest option's pip count). */
  max: number
  /** True for opt-out answers ("weiß nicht"), which render an outlined glyph. */
  unknown?: boolean
}

/** Values that read as an explicit "I can't say" opt-out across the quiz. */
const UNKNOWN_VALUES = new Set(["unknown"])

/**
 * value -> intensity rank (1 = weakest reading, higher = strongest reading).
 * The per-question maximum is derived from the largest rank in the map, so a
 * three-option scale shows three pips and a five-option scale shows five.
 */
const INTENSITY_RANKS: Record<string, Record<string, number>> = {
  // "How reliably do you get your desired result?" — more reliable = stronger.
  resultReliability: {
    rarely: 1,
    sometimes: 2,
    mostly: 3,
  },
  // "Do you know what to change when it doesn't fit?" — more confident = stronger.
  adaptationConfidence: {
    no: 1,
    partly: 2,
    yes: 3,
  },
  // "How would you describe your current routine?" — a clearer, more established
  // routine reads strongest; "no fixed routine" reads weakest. The option list is
  // ordered most→least clarity, so pip counts descend 4-3-2-1 top-to-bottom.
  routineClarity: {
    none: 1,
    trial_and_error: 2,
    partial: 3,
    clear: 4,
  },
  // "How did your previous attempts go?" — more unmet struggle = stronger need.
  previousAttempts: {
    mostly_works: 1,
    some_steps_helped: 2,
    little_targeted_trial: 3,
    nothing_reliably_worked: 4,
  },
  // "How much daily time?" — ascending time commitment.
  dailyTime: {
    "5_minutes": 1,
    "10_minutes": 2,
    "15_minutes": 3,
    "20_plus_minutes": 4,
  },
  // Shared frequency/aspiration scale used by every admission screen and the
  // dynamic conflict prompt (often/very = strongest, rather_not/less = weakest).
  admission: {
    rather_not: 1,
    less: 1,
    sometimes: 2,
    somewhat: 2,
    often: 3,
    very: 3,
  },
}

const FIELD_MAX: Record<string, number> = Object.fromEntries(
  Object.entries(INTENSITY_RANKS).map(([field, ranks]) => [
    field,
    Math.max(...Object.values(ranks)),
  ]),
)

/**
 * Returns the pip descriptor for an option, or null when the field has no pip
 * ramp (e.g. icon-based or free-form multi-select lists). Callers only render a
 * pip when a descriptor is returned and the option has no meaningful icon.
 */
export function getOptionIntensity(field: string, value: string): OptionIntensity | null {
  const ranks = INTENSITY_RANKS[field]
  if (!ranks) return null

  const max = FIELD_MAX[field]

  if (UNKNOWN_VALUES.has(value)) {
    return { pips: 0, max, unknown: true }
  }

  const pips = ranks[value]
  if (pips === undefined) return null

  return { pips, max }
}
