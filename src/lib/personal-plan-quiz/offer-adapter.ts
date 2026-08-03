import { GOALS, type Goal } from "@/lib/vocabulary/concerns-goals"
import type { QuizAnswers } from "@/lib/quiz/types"
import type { PersonalPlanDiagnosticInput } from "@/lib/quiz/diagnostic-input"

import type {
  PersonalPlanQuizAnswers,
  PersonalPlanQuizConcern,
  PersonalPlanQuizGoal,
} from "./types"

export type PersonalPlanFallbackMetadata = {
  elasticityFallback: boolean
  scalpFallback: boolean
}

export type PersonalPlanOfferAdapterResult = {
  answers: QuizAnswers
  fallbackMetadata: PersonalPlanFallbackMetadata
}

const LEGACY_CONCERN_TO_DIAGNOSTIC = {
  hair_damage: "hair_damage",
  split_ends: "split_ends",
  breakage: "breakage",
  dryness: "dry_lengths",
  frizz: "frizz_flyaways",
  tangling: "tangling",
  dry_lengths: "dry_lengths",
  frizz_flyaways: "frizz_flyaways",
  low_shine: "low_shine",
  lost_shape: "lost_shape",
  low_volume_or_weighed_down: "low_volume_or_weighed_down",
} as const

const LEGACY_GOAL_TO_DIAGNOSTIC = {
  moisture: "moisture",
  less_frizz: "frizz_surface",
  shine: "shine",
  curl_definition: "shape_definition",
  volume: "volume_balance",
  less_volume: "volume_balance",
  anti_breakage: "strength_ends",
  less_split_ends: "strength_ends",
  healthy_scalp: "scalp_balance",
  frizz_surface: "frizz_surface",
  shape_definition: "shape_definition",
  volume_balance: "volume_balance",
  strength_ends: "strength_ends",
  scalp_balance: "scalp_balance",
  manageability_styling: "manageability_styling",
} as const

/**
 * Converts the legacy factual answers into the exact input the public
 * assessment understands. Context questions which legacy never asked remain
 * absent; this adapter must never synthesize them.
 */
export function adaptLegacyQuizAnswersForAssessment(
  answers: QuizAnswers,
): PersonalPlanDiagnosticInput {
  const concerns = (answers.concerns ?? []).flatMap((value) => {
    const mapped = LEGACY_CONCERN_TO_DIAGNOSTIC[value as keyof typeof LEGACY_CONCERN_TO_DIAGNOSTIC]
    return mapped ? [mapped] : []
  })
  const goals = (answers.goals ?? []).flatMap((value) => {
    const mapped = LEGACY_GOAL_TO_DIAGNOSTIC[value as keyof typeof LEGACY_GOAL_TO_DIAGNOSTIC]
    return mapped ? [mapped] : []
  })
  const scalpConcernByCondition = {
    schuppen: "oily_dandruff",
    trockene_schuppen: "dry_dandruff",
    gereizt: "irritated",
  } as const
  const treatmentByLegacyValue = {
    natur: "natural",
    gefaerbt: "colored",
    blondiert: "lightened",
    dauerwelle: "permed",
    chemisch_geglaettet: "chemically_straightened",
  } as const

  return {
    texture: answers.structure as PersonalPlanDiagnosticInput["texture"],
    thickness: answers.thickness as PersonalPlanDiagnosticInput["thickness"],
    density: answers.density as PersonalPlanDiagnosticInput["density"],
    goals: [...new Set(goals)],
    currentConcerns: [...new Set(concerns)],
    hairLength: answers.hair_length,
    hairSurface:
      answers.fingertest === "glatt"
        ? "smooth"
        : answers.fingertest === "leicht_uneben"
          ? "slightly_uneven"
          : answers.fingertest === "rau"
            ? "rough"
            : undefined,
    elasticResponse: answers.pulltest as PersonalPlanDiagnosticInput["elasticResponse"],
    chemicalTreatments: (answers.treatment ?? []).flatMap((value) => {
      const mapped = treatmentByLegacyValue[value as keyof typeof treatmentByLegacyValue]
      return mapped ? [mapped] : []
    }),
    scalpOiliness:
      answers.scalp_type === "fettig"
        ? "oily"
        : answers.scalp_type === "trocken"
          ? "dry"
          : answers.scalp_type === "ausgeglichen"
            ? "balanced"
            : undefined,
    scalpConcerns:
      answers.has_scalp_issue && answers.scalp_condition
        ? [
            scalpConcernByCondition[
              answers.scalp_condition as keyof typeof scalpConcernByCondition
            ],
          ].filter(
            (value): value is NonNullable<PersonalPlanDiagnosticInput["scalpConcerns"]>[number] =>
              value !== undefined,
          )
        : [],
  }
}

const TEXTURED = new Set<PersonalPlanQuizAnswers["texture"]>(["wavy", "curly", "coily"])

const TREATMENT_MAP: Record<
  NonNullable<PersonalPlanQuizAnswers["chemicalTreatments"]>[number],
  string
> = {
  natural: "natur",
  colored: "gefaerbt",
  lightened: "blondiert",
  permed: "dauerwelle",
  chemically_straightened: "chemisch_geglaettet",
}

const SURFACE_MAP: Record<NonNullable<PersonalPlanQuizAnswers["hairSurface"]>, string> = {
  smooth: "glatt",
  slightly_uneven: "leicht_uneben",
  rough: "rau",
}

type ScalpConcern = NonNullable<PersonalPlanQuizAnswers["scalpConcerns"]>[number]

const SCALP_CONCERN_MAP: Record<ScalpConcern, string> = {
  oily_dandruff: "schuppen",
  dry_dandruff: "trockene_schuppen",
  irritated: "gereizt",
}

const SCALP_CONCERN_PRIORITY: readonly ScalpConcern[] = [
  "irritated",
  "oily_dandruff",
  "dry_dandruff",
]

function hasGoal(
  goals: readonly PersonalPlanQuizGoal[] | undefined,
  value: PersonalPlanQuizGoal,
): boolean {
  return goals?.includes(value) ?? false
}

function hasConcern(
  concerns: readonly PersonalPlanQuizConcern[] | undefined,
  value: PersonalPlanQuizConcern,
): boolean {
  return concerns?.includes(value) ?? false
}

function volumeGoal(answers: PersonalPlanQuizAnswers): Goal | null {
  const hasFineOrLowDensity = answers.thickness === "fine" || answers.density === "low"
  if (hasFineOrLowDensity) return "volume"

  const hasControlSignal =
    answers.thickness === "coarse" || answers.density === "high" || TEXTURED.has(answers.texture)
  return hasControlSignal ? "less_volume" : null
}

function retainConcerns(answers: PersonalPlanQuizAnswers): NonNullable<QuizAnswers["concerns"]> {
  const selected = new Set<NonNullable<QuizAnswers["concerns"]>[number]>()
  if (hasConcern(answers.currentConcerns, "hair_damage")) selected.add("hair_damage")
  if (hasConcern(answers.currentConcerns, "breakage")) selected.add("breakage")
  if (hasConcern(answers.currentConcerns, "split_ends")) selected.add("split_ends")
  if (hasConcern(answers.currentConcerns, "dry_lengths")) selected.add("dryness")
  if (hasConcern(answers.currentConcerns, "tangling")) selected.add("tangling")
  if (hasConcern(answers.currentConcerns, "frizz_flyaways")) selected.add("frizz")
  // The paid-plan legacy offer adapter remains intentionally capped for its
  // established routine contract. Raw Personal Plan answers and the shared
  // assessment above retain every selection.
  return [...selected].slice(0, 3)
}

function mappedGoalSet(answers: PersonalPlanQuizAnswers): Set<Goal> {
  const mapped = new Set<Goal>()
  if (hasGoal(answers.goals, "moisture")) mapped.add("moisture")
  if (hasGoal(answers.goals, "frizz_surface")) mapped.add("less_frizz")
  if (hasGoal(answers.goals, "shine")) mapped.add("shine")
  if (hasGoal(answers.goals, "shape_definition")) mapped.add("curl_definition")
  if (hasGoal(answers.goals, "strength_ends")) mapped.add("anti_breakage")
  if (hasGoal(answers.goals, "scalp_balance")) mapped.add("healthy_scalp")
  if (hasGoal(answers.goals, "manageability_styling")) mapped.add("less_frizz")
  if (hasGoal(answers.goals, "volume_balance")) {
    const direction = volumeGoal(answers)
    if (direction) mapped.add(direction)
  }

  if (hasConcern(answers.currentConcerns, "low_shine")) mapped.add("shine")
  if (hasConcern(answers.currentConcerns, "lost_shape")) mapped.add("curl_definition")
  if (hasConcern(answers.currentConcerns, "low_volume_or_weighed_down")) {
    const direction = volumeGoal(answers)
    if (direction) mapped.add(direction)
  }
  return mapped
}

function retainGoals(
  answers: PersonalPlanQuizAnswers,
  retainedConcerns: NonNullable<QuizAnswers["concerns"]>,
): NonNullable<QuizAnswers["goals"]> {
  const mapped = mappedGoalSet(answers)
  const selected: Goal[] = []
  const take = (goal: Goal | null) => {
    if (!goal || !mapped.has(goal) || selected.includes(goal) || selected.length >= 5) return
    selected.push(goal)
  }

  const explicitScalpNeed =
    mapped.has("healthy_scalp") ||
    Boolean(answers.scalpConcerns?.length) ||
    answers.scalpOiliness === "oily" ||
    answers.scalpOiliness === "dry"
  if (explicitScalpNeed) {
    mapped.add("healthy_scalp")
    take("healthy_scalp")
  }

  for (const concern of retainedConcerns) {
    if (concern === "breakage") mapped.add("anti_breakage")
    if (concern === "split_ends") mapped.add("less_split_ends")
    if (concern === "dryness") mapped.add("moisture")
    if (concern === "tangling" || concern === "frizz") mapped.add("less_frizz")
    if (concern === "breakage") take("anti_breakage")
    if (concern === "split_ends") take("less_split_ends")
    if (concern === "dryness") take("moisture")
    if (concern === "tangling" || concern === "frizz") take("less_frizz")
  }

  take(mapped.has("curl_definition") ? "curl_definition" : null)
  take(mapped.has("volume") ? "volume" : mapped.has("less_volume") ? "less_volume" : null)

  const tableOrder: Goal[] = [
    "moisture",
    "less_frizz",
    "shine",
    "curl_definition",
    "anti_breakage",
    "healthy_scalp",
    "volume",
    "less_volume",
    "less_split_ends",
  ]
  for (const goal of tableOrder) take(goal)

  if (selected.length === 0) selected.push("healthier_hair")
  const retainedSet = new Set(selected)
  return GOALS.filter((goal) => retainedSet.has(goal))
}

function mapTreatments(answers: PersonalPlanQuizAnswers): NonNullable<QuizAnswers["treatment"]> {
  const selected = answers.chemicalTreatments ?? []
  const mapped = selected
    .filter((value) => value !== "natural" || selected.length === 1)
    .map((value) => TREATMENT_MAP[value])
  return mapped.length > 0 ? mapped : ["natur"]
}

function mapScalpType(answers: PersonalPlanQuizAnswers): {
  scalpType: NonNullable<QuizAnswers["scalp_type"]>
  fallback: boolean
} {
  if (answers.scalpOiliness === "oily") return { scalpType: "fettig", fallback: false }
  if (answers.scalpOiliness === "dry") return { scalpType: "trocken", fallback: false }
  if (answers.scalpOiliness === "balanced") return { scalpType: "ausgeglichen", fallback: false }
  // No scalp answer captured (e.g. a legacy draft): default neutral and record it.
  return { scalpType: "ausgeglichen", fallback: true }
}

export function adaptPersonalPlanAnswersForOffer(
  answers: PersonalPlanQuizAnswers,
): PersonalPlanOfferAdapterResult {
  const retainedConcerns = retainConcerns(answers)
  const scalp = mapScalpType(answers)
  const primaryScalpConcern = SCALP_CONCERN_PRIORITY.find((concern) =>
    answers.scalpConcerns?.includes(concern),
  )
  const pulltest = answers.elasticResponse ?? "stretches_bounces"

  return {
    answers: {
      structure: answers.texture,
      thickness: answers.thickness,
      density: answers.density,
      hair_length: answers.hairLength,
      fingertest: answers.hairSurface ? SURFACE_MAP[answers.hairSurface] : undefined,
      pulltest,
      scalp_type: scalp.scalpType,
      has_scalp_issue: Boolean(primaryScalpConcern),
      ...(primaryScalpConcern ? { scalp_condition: SCALP_CONCERN_MAP[primaryScalpConcern] } : {}),
      concerns: retainedConcerns,
      treatment: mapTreatments(answers),
      goals: retainGoals(answers, retainedConcerns),
    },
    fallbackMetadata: {
      elasticityFallback: !answers.elasticResponse,
      scalpFallback: scalp.fallback,
    },
  }
}
