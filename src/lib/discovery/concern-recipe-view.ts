import { CATEGORY_LABELS } from "@/lib/personal-plan/decision-presentation"
import type { DiagnosticConcern } from "@/lib/quiz/diagnostic-input"

import {
  concernRecipeFor,
  type ConcernRecipeCategory,
  type ConcernRecipeEvidence,
  type ConcernRecipeWhen,
} from "./concern-recipes"

/**
 * The „Hauptproblem" section's view (batch 7c, F9): one concern's recipe, evaluated against
 * her profile and her products. Pure — the page composes it from the cockpit model.
 *
 * Conditional categories follow the README's `when` semantics (OR within a key, AND across
 * keys, OR across entries of one category) with one deliberate difference for the call:
 * a gate that depends on a fact nobody knows yet is shown as „prüfen" instead of staying
 * silent, so Nick can ask. A gate a KNOWN fact already fails drops out.
 */

/** Her profile as the recipe gates read it; `null` = unknown. */
export type DiscoveryConcernProfileFacts = {
  hair_texture: "straight" | "wavy" | "curly" | "coily" | null
  thickness: "fine" | "normal" | "coarse" | null
  scalp_type: "oily" | "balanced" | "dry" | null
  chemical_treatment: string[] | null
  damaged: boolean | null
  heat_styling: boolean | null
}

export const UNKNOWN_CONCERN_PROFILE_FACTS: DiscoveryConcernProfileFacts = {
  hair_texture: null,
  thickness: null,
  scalp_type: null,
  chemical_treatment: null,
  damaged: null,
  heat_styling: null,
}

const FACT_LABELS: Record<keyof ConcernRecipeWhen, string> = {
  hair_texture: "Haarstruktur",
  thickness: "Haardicke",
  scalp_type: "Kopfhaut",
  damaged: "Schädigung",
  chemical_treatment: "chemische Behandlung",
  heat_styling: "Hitzestyling",
}

/** README: only these treatments count as structural damage (`colored` alone does not). */
const DAMAGING_TREATMENTS = new Set(["lightened", "permed", "chemically_straightened"])
/** README: heat styling = weekly or more often. */
const WEEKLY_OR_MORE = new Set(["weekly_1x", "weekly_2x", "weekly_3_4x", "weekly_5_6x", "daily_1x"])

/**
 * Her facts from the Idealplan's own snapshot (`ScanEvaluationContext.snapshot`) — the same
 * profile the Idealroutine was computed from. Defensive: whatever cannot be read is unknown.
 */
export function discoveryConcernProfileFacts(snapshot: unknown): DiscoveryConcernProfileFacts {
  const profile = field(snapshot, "profile")
  const hair = field(profile, "hair")
  const scalp = field(profile, "scalp")
  const heat = field(field(snapshot, "assessments"), "heatExposure")

  const treatments = field(hair, "chemicalTreatments")
  const chemical = Array.isArray(treatments)
    ? treatments.filter((entry): entry is string => typeof entry === "string")
    : null
  const surface = field(hair, "surface")
  const elasticity = field(hair, "elasticity")
  // Any one signal decides „damaged"; „not damaged" needs all three facts read.
  const damaged =
    chemical?.some((entry) => DAMAGING_TREATMENTS.has(entry)) ||
    surface === "rough" ||
    elasticity === "snaps"
      ? true
      : chemical !== null && typeof surface === "string" && typeof elasticity === "string"
        ? false
        : null

  const heatState = field(heat, "state")
  const events = field(heat, "events")
  const heatStyling =
    heatState === "absent"
      ? false
      : heatState === "present" && Array.isArray(events)
        ? events.some((event) => WEEKLY_OR_MORE.has(String(field(event, "frequency"))))
        : null

  return {
    hair_texture: oneOf(field(hair, "texture"), ["straight", "wavy", "curly", "coily"] as const),
    thickness: oneOf(field(hair, "thickness"), ["fine", "normal", "coarse"] as const),
    scalp_type: oneOf(field(scalp, "oiliness"), ["oily", "balanced", "dry"] as const),
    chemical_treatment: chemical,
    damaged,
    heat_styling: heatStyling,
  }
}

export type ConcernRecipeWhenResult = {
  result: "match" | "unknown" | "no_match"
  /** The keys whose fact is unknown (only meaningful for `unknown`). */
  unknownKeys: Array<keyof ConcernRecipeWhen>
}

export function evaluateConcernRecipeWhen(
  when: ConcernRecipeWhen,
  facts: DiscoveryConcernProfileFacts,
): ConcernRecipeWhenResult {
  const unknownKeys: Array<keyof ConcernRecipeWhen> = []
  let failed = false
  for (const key of Object.keys(when) as Array<keyof ConcernRecipeWhen>) {
    const outcome = keyMatches(key, when, facts)
    if (outcome === null) unknownKeys.push(key)
    else if (!outcome) failed = true
  }
  if (failed) return { result: "no_match", unknownKeys: [] }
  return unknownKeys.length > 0
    ? { result: "unknown", unknownKeys }
    : { result: "match", unknownKeys: [] }
}

function keyMatches(
  key: keyof ConcernRecipeWhen,
  when: ConcernRecipeWhen,
  facts: DiscoveryConcernProfileFacts,
): boolean | null {
  switch (key) {
    case "hair_texture":
      return facts.hair_texture === null ? null : when.hair_texture!.includes(facts.hair_texture)
    case "thickness":
      return facts.thickness === null ? null : when.thickness!.includes(facts.thickness)
    case "scalp_type":
      return facts.scalp_type === null ? null : when.scalp_type!.includes(facts.scalp_type)
    case "chemical_treatment":
      return facts.chemical_treatment === null
        ? null
        : facts.chemical_treatment.some((entry) =>
            (when.chemical_treatment as readonly string[]).includes(entry),
          )
    case "damaged":
      return facts.damaged
    case "heat_styling":
      return facts.heat_styling
  }
}

// --- coverage --------------------------------------------------------------------

/** „hat sie" = one of her products is used as or IS that category; „Idealroutine" = a step. */
export type DiscoveryConcernCoverage = { owned: boolean; inRoutine: boolean }

export type DiscoveryConcernCoverageInput = {
  owned: ReadonlySet<string>
  routine: ReadonlySet<string>
}

export function discoveryConcernCoverageInput(view: {
  intakeProducts: ReadonlyArray<{ category: string | null; productType: string | null }>
  steps: ReadonlyArray<{ category: string }>
}): DiscoveryConcernCoverageInput {
  return {
    owned: new Set(
      view.intakeProducts.flatMap((product) =>
        [product.category, product.productType].filter((entry): entry is string => !!entry),
      ),
    ),
    routine: new Set(view.steps.map((step) => step.category)),
  }
}

function coverageOf(
  category: ConcernRecipeCategory,
  input: DiscoveryConcernCoverageInput,
): DiscoveryConcernCoverage {
  return { owned: input.owned.has(category), inRoutine: input.routine.has(category) }
}

// --- the view --------------------------------------------------------------------

export type DiscoveryConcernRecipeView = {
  code: DiagnosticConcern
  label: string
  talkingPoint: string
  /** Rates the core recommendation (primary categories and levers). */
  evidence: ConcernRecipeEvidence
  /** `hair_loss_or_thinning`: a safety boundary, never a product list. */
  boundaryOnly: boolean
  boundary: string | null
  primaryCategories: Array<{
    category: ConcernRecipeCategory
    label: string
    why: string
    evidence: ConcernRecipeEvidence
    coverage: DiscoveryConcernCoverage
  }>
  levers: Array<{
    lever: string
    evidence: ConcernRecipeEvidence
    /** The category this lever may unlock once the call confirms the signal. */
    signalCategoryLabel: string | null
  }>
  /** Only the categories that apply to her, or need checking; one row per category. */
  conditional: Array<{
    category: ConcernRecipeCategory
    label: string
    status: "applies" | "check"
    reasons: Array<{ why: string; evidence: ConcernRecipeEvidence }>
    /** For „prüfen": which facts to ask about. */
    uncheckedFacts: string[]
    coverage: DiscoveryConcernCoverage
  }>
  avoid: string[]
}

export function buildDiscoveryConcernRecipeView(
  code: DiagnosticConcern,
  facts: DiscoveryConcernProfileFacts,
  coverage: DiscoveryConcernCoverageInput,
): DiscoveryConcernRecipeView | null {
  const recipe = concernRecipeFor(code)
  if (!recipe) return null

  const conditional: DiscoveryConcernRecipeView["conditional"] = []
  for (const category of [...new Set(recipe.conditional.map((entry) => entry.category))]) {
    const evaluated = recipe.conditional
      .filter((entry) => entry.category === category)
      .map((entry) => ({ entry, ...evaluateConcernRecipeWhen(entry.when, facts) }))
    const applying = evaluated.filter((item) => item.result === "match")
    const checking = evaluated.filter((item) => item.result === "unknown")
    const shown = applying.length > 0 ? applying : checking
    if (shown.length === 0) continue
    conditional.push({
      category,
      label: CATEGORY_LABELS[category],
      status: applying.length > 0 ? "applies" : "check",
      reasons: shown.map((item) => ({ why: item.entry.why, evidence: item.entry.evidence })),
      uncheckedFacts:
        applying.length > 0
          ? []
          : [...new Set(checking.flatMap((item) => item.unknownKeys))].map(
              (key) => FACT_LABELS[key],
            ),
      coverage: coverageOf(category, coverage),
    })
  }

  return {
    code: recipe.code,
    label: recipe.labelDe,
    talkingPoint: recipe.talkingPointDe,
    evidence: recipe.evidence,
    boundaryOnly: recipe.primary.categories.length === 0 && recipe.conditional.length === 0,
    boundary: recipe.boundary,
    primaryCategories: recipe.primary.categories.map((entry) => ({
      category: entry.category,
      label: CATEGORY_LABELS[entry.category],
      why: entry.why,
      evidence: entry.evidence,
      coverage: coverageOf(entry.category, coverage),
    })),
    levers: recipe.primary.levers.map((entry) => ({
      lever: entry.lever,
      evidence: entry.evidence,
      signalCategoryLabel: entry.category ? CATEGORY_LABELS[entry.category] : null,
    })),
    conditional,
    avoid: recipe.avoid,
  }
}

function field(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)[key]
    : undefined
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null
}
