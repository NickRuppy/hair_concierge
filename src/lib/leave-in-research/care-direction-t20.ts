/**
 * Leave-In Standard v1.1 overlay, ruling T20 (2026-09-29): the `care_direction`
 * rule (§9-O1 … §9-O6) as a pure, deterministic function over a researcher's
 * species read.
 *
 * This is the executable form of the normative text in
 * `docs/research/leave-in-inci/v1.1/leave-in-classification-overlay.v1.1.md`.
 * It does not read INCI names: the researcher classifies every species that sits
 * above the §3.1.1 tail marker (or, where the marker is vacuous or
 * `none_visible`, on the ordinal read) and this function applies the rank rules.
 * No percentage, ratio or dose is computed or implied (G4) — only rank order
 * between two species on the same list.
 *
 * The production adapter does not call this function; it transcribes the
 * research envelope. The function exists so the rule is testable and so every
 * T20 corpus record can be mechanically re-checked against it.
 */

/** Species classes above the tail, per §9-O1 (directional) and §9-O2 (non-directional). */
export const T20_SPECIES_CLASSES = [
  /** §9-O1 (DH): settled humectant — water-binding function settled by the INCI name. */
  "settled_humectant",
  /** §9-O1 (DL): non-volatile lipid in the medium or rich spreading band (SR §D.1). */
  "medium_rich_lipid",
  /** T19 clause 2 film set: L2 persistent silicone, silicone quat, Polysilicone-29, §5 equivalent. */
  "persistent_film",
  /** §9-O2: multifunctional glycol — corroborates a DH species, never creates the leg. */
  "multifunctional_glycol",
  /** §9-O2: L1 cationic (quat, cationic polymer) — COND's conditioning baseline. */
  "cationic",
  /** §9-O2: LGN fatty alcohol — conditioning baseline. */
  "fatty_alcohol",
  /** §9-O2: dry-feel spreading ester (SR §D.1 dry-feel band). */
  "dry_feel_ester",
  /** §9-O2 / M6: volatile carrier or propellant — contributes nothing. */
  "volatile_carrier",
  /** Anything else: extract, plain hydrolysate, vitamin, emulsifier, thickener, fixative, pH, fragrance, alcohol. */
  "other",
] as const
export type T20SpeciesClass = (typeof T20_SPECIES_CLASSES)[number]

export type T20Species = { rank: number; inci: string; speciesClass: T20SpeciesClass }

export type T20MarkerStatus = "plausible" | "implausible" | "vacuous" | "none_visible"

export type T20Input = {
  /** R2 `repair_surface_film` is `candidate` or `tested` as architecture (§7.10). */
  proteinAnchor: boolean
  markerStatus: T20MarkerStatus
  /** Every classified species above the tail (ordinal read where the marker is vacuous / none_visible). */
  speciesAboveTail: T20Species[]
}

export type T20Row =
  | "protein_anchor"
  | "substantive_mixed"
  | "moisture_led"
  | "film_leads_moisture_leg"
  | "film_led_neutral"
  | "conditioning_only_neutral"
  | "evidence_failure"

export type T20ReviewTrigger = "moisture_leg_subordinate" | "glycol_only_leg"

export type T20Result = {
  value: "protein" | "moisture" | "balanced" | "unknown"
  row: T20Row
  /**
   * §9-O6 confidence for an O3/O4 `balanced`. `null` for every other row: those
   * keep the confidence their own v1.0 rule assigns (O5 and the protein anchor
   * are unchanged by T20).
   */
  o6Confidence: "moderate" | "low" | null
  /** O6 routing. The marker's own §14 trigger is carried by the record, not here. */
  reviewTriggers: T20ReviewTrigger[]
  /** O3 only: rank of the first directional species minus rank of the first film species. */
  filmLeadMargin: number | null
  /** Species above the tail that v1.0 counted as a leg (L1/L3/L4) but §9-O2 does not. */
  demotedSpecies: T20Species[]
}

const DIRECTIONAL: readonly T20SpeciesClass[] = ["settled_humectant", "medium_rich_lipid"]
/** §9-O4: species that make the care architecture readable although none of them sets a direction. */
const READABLE_NON_DIRECTIONAL: readonly T20SpeciesClass[] = [
  "persistent_film",
  "cationic",
  "fatty_alcohol",
  "multifunctional_glycol",
  "dry_feel_ester",
]
/** Species v1.0 §9 counted as a moisture leg (L1, L3 incl. dry-feel band, L4 incl. glycols). */
const V1_0_LEG_CLASSES_DEMOTED_BY_T20: readonly T20SpeciesClass[] = [
  "cationic",
  "dry_feel_ester",
  "multifunctional_glycol",
]

function firstRank(species: T20Species[], classes: readonly T20SpeciesClass[]): number | null {
  const ranks = species
    .filter((item) => classes.includes(item.speciesClass))
    .map((item) => item.rank)
    .sort((left, right) => left - right)
  return ranks[0] ?? null
}

export function deriveLeaveInCareDirectionT20(input: T20Input): T20Result {
  const species = [...input.speciesAboveTail].sort((left, right) => left.rank - right.rank)
  const demotedSpecies = species.filter((item) =>
    V1_0_LEG_CLASSES_DEMOTED_BY_T20.includes(item.speciesClass),
  )
  const firstDirectional = firstRank(species, DIRECTIONAL)
  const firstFilm = firstRank(species, ["persistent_film"])
  const firstGlycol = firstRank(species, ["multifunctional_glycol"])
  const base = { demotedSpecies }

  // Protein anchor first. Reading (a) — substantive mixed — reads its moisture
  // leg through §9-O1 as well: one leg definition for the whole field.
  if (input.proteinAnchor) {
    return firstDirectional !== null
      ? {
          ...base,
          value: "balanced",
          row: "substantive_mixed",
          o6Confidence: null,
          reviewTriggers: [],
          filmLeadMargin: null,
        }
      : {
          ...base,
          value: "protein",
          row: "protein_anchor",
          o6Confidence: null,
          reviewTriggers: [],
          filmLeadMargin: null,
        }
  }

  const markerReliable = input.markerStatus === "plausible"
  // O6 glycol clause: the read rests on demoting a glycol when a glycol above the
  // tail outranks the highest film species — or when there is no film at all.
  const glycolClauseFails = firstGlycol !== null && (firstFilm === null || firstGlycol < firstFilm)

  // §9-O3 film-lead test.
  if (firstDirectional !== null && firstFilm !== null && firstFilm < firstDirectional) {
    const margin = firstDirectional - firstFilm
    const moderate = markerReliable && margin >= 2 && !glycolClauseFails
    const reviewTriggers: T20ReviewTrigger[] = []
    if (glycolClauseFails) reviewTriggers.push("glycol_only_leg")
    if (!moderate) reviewTriggers.push("moisture_leg_subordinate")
    return {
      ...base,
      value: "balanced",
      row: "film_leads_moisture_leg",
      o6Confidence: moderate ? "moderate" : "low",
      reviewTriggers,
      filmLeadMargin: margin,
    }
  }

  // §9-O5: a directional species leads (or no film competes) → moisture.
  if (firstDirectional !== null) {
    return {
      ...base,
      value: "moisture",
      row: "moisture_led",
      o6Confidence: null,
      reviewTriggers: [],
      filmLeadMargin: null,
    }
  }

  // §9-O4: no directional species above the tail.
  const readable = species.some((item) => READABLE_NON_DIRECTIONAL.includes(item.speciesClass))
  if (!readable) {
    return {
      ...base,
      value: "unknown",
      row: "evidence_failure",
      o6Confidence: null,
      reviewTriggers: [],
      filmLeadMargin: null,
    }
  }
  const moderate = markerReliable && !glycolClauseFails
  return {
    ...base,
    value: "balanced",
    row: firstFilm !== null ? "film_led_neutral" : "conditioning_only_neutral",
    o6Confidence: moderate ? "moderate" : "low",
    reviewTriggers: glycolClauseFails ? ["glycol_only_leg"] : [],
    filmLeadMargin: null,
  }
}
