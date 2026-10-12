import type { ConsultFlag } from "./knowledge"

/**
 * The point system v2 (plans/consult-brief-d, Nick 2026-10-12: dots + total range). Every
 * Hebel names a lever kind; the kind carries a fixed level (●●● / ●● / ●) and a time tag, and
 * three explicit modifiers fit it to her situation. One total range — never a per-lever number
 * — says what the plan realistically moves on her 1–10 rating.
 *
 * Evidence: no hair-care trial measures how much one measure moves a self-rating; the levels
 * rest on instrumental data plus practitioner consensus (research digest 2026-10-12), and the
 * modifiers, weights and caps are judgment calls kept here, deterministic, so the 4-week
 * re-scores can move a kind by whole levels later. Pure and client-safe.
 */

export const CONSULT_LEVER_KINDS = [
  "hitze_tools",
  "hitzeschutz",
  "foehnen",
  "entwirren",
  "chemie_abstaende",
  "spitzen",
  "waschrhythmus",
  "produktlast",
  "nachtschutz",
  "spuelung_neu",
  "gewicht_tausch",
  "leave_in",
  "bondbuilder",
  "maske",
  "oel",
  "kopfhaut",
  "sonstiges",
] as const

export type ConsultLeverKind = (typeof CONSULT_LEVER_KINDS)[number]

/** How far her current habit is from the target: „offen" = unknown, asked in the call. */
export const CONSULT_LEVER_GAPS = ["gross", "klein", "offen"] as const
export type ConsultLeverGap = (typeof CONSULT_LEVER_GAPS)[number]

export type ConsultLeverLevel = 1 | 2 | 3

export type ConsultLeverSpec = {
  /** What the prompt calls the kind. */
  label: string
  /** null: shown without dots (scalp block, bonus tips, free rows). */
  base: ConsultLeverLevel | null
  /** When she notices it; null when nobody can say. */
  timing: string | null
  /** Bleached or breaking hair lifts it one level. */
  breakage: boolean
  /** Fine hair lowers it one level (it weighs fine hair down). */
  weightSensitive: boolean
  /** Counts toward the 4–8-week range (false: needs an appointment first). */
  inRange: boolean
  /** Shown with „wenig belegt". */
  thinEvidence: boolean
}

const spec = (
  label: string,
  base: ConsultLeverLevel | null,
  timing: string | null,
  extra: Partial<
    Pick<ConsultLeverSpec, "breakage" | "weightSensitive" | "inRange" | "thinEvidence">
  > = {},
): ConsultLeverSpec => ({
  label,
  base,
  timing,
  breakage: false,
  weightSensitive: false,
  inRange: true,
  thinEvidence: false,
  ...extra,
})

export const CONSULT_LEVER_SPECS: Readonly<Record<ConsultLeverKind, ConsultLeverSpec>> = {
  hitze_tools: spec("Glätteisen, Lockenstab & Co.: schonender oder seltener", 3, "4–8 Wochen", {
    breakage: true,
  }),
  hitzeschutz: spec("Hitzeschutz vor jedem Hitze-Tool", 2, "ab der ersten Anwendung", {
    breakage: true,
  }),
  foehnen: spec("Föhnen: mittlere Stufe, Abstand, in Bewegung", 1, "2–4 Wochen"),
  entwirren: spec("Sanft entwirren", 2, "1–2 Wochen", { breakage: true }),
  chemie_abstaende: spec(
    "Blondieren, Färben, Glätten: Abstände strecken",
    3,
    "ab dem nächsten Termin",
    {
      breakage: true,
      inRange: false,
    },
  ),
  spitzen: spec("Spitzen schneiden", 2, "ab dem Schnitt", { inRange: false }),
  waschrhythmus: spec("Waschrhythmus oder milderes Waschen", 2, "2–4 Wochen"),
  produktlast: spec("Weniger Produkt, weniger Rückstände", 1, "1–3 Wochen"),
  nachtschutz: spec("Haar nachts schützen", null, null),
  spuelung_neu: spec("Spülung ergänzen, wo bisher keine ist", 3, "ab der ersten Wäsche"),
  gewicht_tausch: spec("Pflege im passenden Gewicht tauschen", 2, "nach 1–3 Wäschen"),
  leave_in: spec("Leave-in", 2, "ab der ersten Anwendung", { weightSensitive: true }),
  bondbuilder: spec("Bondbuilder", 1, null, { thinEvidence: true }),
  maske: spec("Maske", 1, "ab der ersten Anwendung"),
  oel: spec("Öl oder Serum für die Spitzen", 1, "sofort", { weightSensitive: true }),
  kopfhaut: spec("Kopfhaut (eigener Block)", null, "2–4 Wochen", { inRange: false }),
  sonstiges: spec("Sonstiges", null, null),
}

export type ConsultLeverSituation = { vulnerable: boolean; fineHair: boolean }

export function consultLeverSituation(flags: readonly ConsultFlag[]): ConsultLeverSituation {
  return {
    vulnerable: flags.includes("bleached") || flags.includes("breakage_signal"),
    fineHair: flags.includes("fine_hair"),
  }
}

function clampLevel(value: number): ConsultLeverLevel {
  return Math.min(3, Math.max(1, value)) as ConsultLeverLevel
}

/**
 * The kind's base level, +1 for a breakage lever on bleached or breaking hair, −1 for a small or
 * unknown gap (unknown is asked in the call), −1 for a weight-sensitive lever on fine hair —
 * clamped to 1–3. A kind without a base has no level.
 */
export function consultLeverLevel(
  kind: ConsultLeverKind,
  gap: ConsultLeverGap,
  situation: ConsultLeverSituation,
): ConsultLeverLevel | null {
  const { base, breakage, weightSensitive } = CONSULT_LEVER_SPECS[kind]
  if (base === null) return null
  let level: number = base
  if (breakage && situation.vulnerable) level += 1
  if (gap !== "gross") level -= 1
  if (weightSensitive && situation.fineHair) level -= 1
  return clampLevel(level)
}

/** Briefs stored before v6 carry the model's 0,5–2 points; they render as the nearest level. */
export function levelFromLegacyPoints(points: number | null): ConsultLeverLevel | null {
  if (points === null || !(points > 0)) return null
  if (points >= 1.5) return 3
  if (points >= 1) return 2
  return 1
}

/** The ceiling of the realistic range: the plan's own max, ahead of the old 9-cap. */
const RANGE_MAX_GAIN = 2
/** Share of the room above her baseline a plan can realistically take in 4–8 weeks. */
const HEADROOM_SHARE = 0.6
const RANGE_CEILING = 9
const LEVEL_WEIGHT: Record<ConsultLeverLevel, number> = { 1: 0.5, 2: 1, 3: 1.5 }

function floorHalf(value: number): number {
  return Math.floor(value * 2 + 1e-9) / 2
}

export type ConsultScoreRange = { low: number; high: number }

/**
 * The realistic total: levers overlap (conditioner, mask, detangling all move softness and
 * breakage), so the strongest counts whole and every other one half. The gain is capped by
 * the plan's max, by a share of the room above her baseline and by 9; the low end is half the
 * gain. Half points throughout. Null when no lever counts.
 */
export function consultScoreRange(
  baseline: number,
  levers: ReadonlyArray<{ kind: ConsultLeverKind | null; level: ConsultLeverLevel | null }>,
): ConsultScoreRange | null {
  const weights = levers
    .filter(
      (lever) =>
        lever.level !== null && (lever.kind === null || CONSULT_LEVER_SPECS[lever.kind].inRange),
    )
    .map((lever) => LEVEL_WEIGHT[lever.level as ConsultLeverLevel])
    .sort((a, b) => b - a)
  if (weights.length === 0) return null
  const combined = weights[0] + 0.5 * weights.slice(1).reduce((sum, weight) => sum + weight, 0)
  const gain = floorHalf(
    Math.min(
      combined,
      RANGE_MAX_GAIN,
      HEADROOM_SHARE * (10 - baseline),
      Math.max(0, RANGE_CEILING - baseline),
    ),
  )
  return { low: baseline + floorHalf(gain / 2), high: baseline + gain }
}
