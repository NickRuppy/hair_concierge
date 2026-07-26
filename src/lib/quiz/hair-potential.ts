import type { GuidedStoryPriority } from "./guided-story-priorities"
import type { GuidedStoryPriorityFamily, GuidedStoryPriorityVariantId } from "./guided-story-copy"
import {
  getGuidedStoryPriorityIdentity,
  GUIDED_STORY_PRIORITY_LABELS,
} from "./guided-story-priority-identity"
import {
  canonicalizeQuizAnswers,
  QUIZ_CONCERN_VALUES,
  QUIZ_DENSITY_VALUES,
  QUIZ_FINGERTEST_VALUES,
  QUIZ_HAIR_LENGTH_VALUES,
  QUIZ_PULLTEST_VALUES,
  QUIZ_SCALP_CONDITION_VALUES,
  QUIZ_SCALP_TYPE_VALUES,
  QUIZ_STRUCTURE_VALUES,
  QUIZ_THICKNESS_VALUES,
  QUIZ_TREATMENT_VALUES,
} from "./normalization"
import { GOALS } from "@/lib/vocabulary/concerns-goals"
import type { QuizAnswers } from "./types"

export type HairPotentialValue = 40 | 45 | 50 | 55 | 60 | 65 | 70 | 75 | 80 | 85 | 90 | 95 | 100

const APPROVED_VALUES = new Set<number>([40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100])
const CHEMICAL_TREATMENTS = new Set(["gefaerbt", "blondiert", "dauerwelle", "chemisch_geglaettet"])
const TEXTURED_STRUCTURES = new Set(["wavy", "curly", "coily"])

export type HairPotentialDimension = {
  family: GuidedStoryPriorityFamily
  label: string
  priorityVariantId: GuidedStoryPriorityVariantId
  mergedVariantIds?: readonly GuidedStoryPriorityVariantId[]
  value: HairPotentialValue
}

export type HairPotentialResult = {
  modelVersion: "hair_potential_v1"
  dimensions: readonly [HairPotentialDimension, HairPotentialDimension, HairPotentialDimension]
  overall: number
}

function has(values: readonly string[] | undefined, value: string): boolean {
  return values?.includes(value) ?? false
}

function hasChemicalTreatment(answers: QuizAnswers): boolean {
  return answers.treatment?.some((value) => CHEMICAL_TREATMENTS.has(value)) ?? false
}

function lowest(...values: number[]): number {
  return Math.min(...values)
}

function isCompleteSupportedAnswers(raw: QuizAnswers): boolean {
  const allowed = (value: unknown, values: readonly string[]) =>
    typeof value === "string" && values.includes(value)
  const allowedList = (value: unknown, values: readonly string[]) =>
    Array.isArray(value) && value.every((item) => allowed(item, values))

  return (
    allowed(raw.structure, QUIZ_STRUCTURE_VALUES) &&
    allowed(raw.thickness, QUIZ_THICKNESS_VALUES) &&
    allowed(raw.density, QUIZ_DENSITY_VALUES) &&
    allowed(raw.hair_length, QUIZ_HAIR_LENGTH_VALUES) &&
    allowed(raw.fingertest, QUIZ_FINGERTEST_VALUES) &&
    allowed(raw.pulltest, QUIZ_PULLTEST_VALUES) &&
    allowed(raw.scalp_type, QUIZ_SCALP_TYPE_VALUES) &&
    typeof raw.has_scalp_issue === "boolean" &&
    allowedList(raw.concerns, QUIZ_CONCERN_VALUES) &&
    allowedList(raw.treatment, QUIZ_TREATMENT_VALUES) &&
    (raw.treatment?.length ?? 0) > 0 &&
    allowedList(raw.goals, GOALS) &&
    (raw.goals?.length ?? 0) > 0 &&
    (raw.has_scalp_issue
      ? allowed(raw.scalp_condition, QUIZ_SCALP_CONDITION_VALUES)
      : raw.scalp_condition === undefined)
  )
}

function scoreScalp(answers: QuizAnswers): number {
  if (answers.scalp_condition === "gereizt") return 40
  if (answers.scalp_condition === "trockene_schuppen") {
    return answers.scalp_type === "trocken" ? 45 : 50
  }
  if (answers.scalp_condition === "schuppen") {
    return answers.scalp_type === "fettig" ? 40 : 45
  }
  if (answers.scalp_type === "fettig" || answers.scalp_type === "trocken") return 75
  return 100
}

function scoreStrength(answers: QuizAnswers): number {
  const concerns = has(answers.concerns, "hair_damage") || has(answers.concerns, "breakage")
  const treatmentScore = has(answers.treatment, "blondiert")
    ? 65
    : has(answers.treatment, "chemisch_geglaettet")
      ? 70
      : has(answers.treatment, "dauerwelle")
        ? 75
        : has(answers.treatment, "gefaerbt")
          ? 85
          : 100
  const pullSignal = answers.pulltest === "stretches_stays"
  const strongSignals =
    Number(concerns) +
    Number(pullSignal) +
    Number(answers.fingertest === "rau") +
    Number(hasChemicalTreatment(answers))
  const values = [treatmentScore]
  if (concerns) values.push(has(answers.concerns, "breakage") ? 50 : 60)
  if (pullSignal) values.push(45)
  if (
    has(answers.goals, "strengthen") ||
    has(answers.goals, "anti_breakage") ||
    has(answers.goals, "healthier_hair")
  )
    values.push(80)
  if (strongSignals >= 3) values.push(40)
  else if (strongSignals >= 2) values.push(45)
  return lowest(...values)
}

function scoreMoisture(answers: QuizAnswers): number {
  const dry = has(answers.concerns, "dryness")
  const rough = answers.fingertest === "rau"
  const treated = hasChemicalTreatment(answers)
  const values = [100]
  if (has(answers.goals, "moisture")) values.push(80)
  if (dry) values.push(60)
  if (answers.pulltest === "snaps") values.push(55)
  if (dry && rough && treated) values.push(45)
  else if (dry && (rough || treated)) values.push(50)
  return lowest(...values)
}

function scoreSurface(answers: QuizAnswers): number {
  const frizz = has(answers.concerns, "frizz")
  const tangling = has(answers.concerns, "tangling")
  const values = [100]
  if (answers.fingertest === "leicht_uneben" && !frizz && !tangling) values.push(85)
  if (has(answers.goals, "shine") || has(answers.goals, "less_frizz")) values.push(80)
  if (answers.fingertest === "rau" && !frizz && !tangling) values.push(65)
  if (frizz) values.push(60)
  if (tangling) values.push(55)
  if (frizz && tangling) values.push(answers.fingertest === "rau" ? 40 : 45)
  return lowest(...values)
}

function scoreEnds(answers: QuizAnswers): number {
  if (!has(answers.concerns, "split_ends")) return has(answers.goals, "less_split_ends") ? 80 : 100
  const wearSignals =
    Number(answers.hair_length === "long" || answers.hair_length === "very_long") +
    Number(answers.fingertest === "rau") +
    Number(hasChemicalTreatment(answers))
  return wearSignals >= 2 ? 40 : wearSignals === 1 ? 45 : 50
}

function scoreDefinition(answers: QuizAnswers): number | null {
  if (!has(answers.goals, "curl_definition")) return null
  const frizz = has(answers.concerns, "frizz")
  const dry = has(answers.concerns, "dryness")
  if (frizz && dry && answers.fingertest === "rau") return 50
  if (frizz && dry) return 55
  if (frizz || dry) return 65
  return 80
}

function scoreVolume(answers: QuizAnswers): number | null {
  if (has(answers.goals, "volume")) {
    const characteristics = Number(answers.thickness === "fine") + Number(answers.density === "low")
    return characteristics === 2 ? 55 : characteristics === 1 ? 60 : 80
  }
  if (has(answers.goals, "less_volume")) {
    const characteristics =
      Number(answers.density === "high") +
      Number(answers.thickness === "coarse") +
      Number(TEXTURED_STRUCTURES.has(answers.structure ?? ""))
    return characteristics >= 2 ? 55 : characteristics === 1 ? 65 : 80
  }
  return null
}

function scoreColor(answers: QuizAnswers): number | null {
  if (!has(answers.goals, "color_protection")) return null
  if (has(answers.treatment, "blondiert")) return 55
  if (has(answers.treatment, "gefaerbt")) return 65
  return 80
}

function scoreFamily(family: GuidedStoryPriorityFamily, answers: QuizAnswers): number | null {
  switch (family) {
    case "scalp_flakes":
    case "scalp_comfort":
      return scoreScalp(answers)
    case "strength_damage":
      return scoreStrength(answers)
    case "moisture_dryness":
      return scoreMoisture(answers)
    case "surface_manageability":
      return scoreSurface(answers)
    case "ends_protection":
      return scoreEnds(answers)
    case "definition":
      return scoreDefinition(answers)
    case "volume_weight":
      return scoreVolume(answers)
    case "color_protection":
      return scoreColor(answers)
  }
}

function scorePriority(
  priority: GuidedStoryPriority,
  answers: QuizAnswers,
): HairPotentialDimension | null {
  const identity = getGuidedStoryPriorityIdentity(priority.variantId)
  if (!identity || priority.family !== identity.family) return null
  const variantIds = priority.mergedVariantIds ?? [priority.variantId]
  if (
    priority.mergedVariantIds &&
    (priority.mergedVariantIds.length < 2 ||
      !priority.mergedVariantIds.includes(priority.variantId) ||
      new Set(priority.mergedVariantIds).size !== priority.mergedVariantIds.length)
  ) {
    return null
  }
  const constituent = variantIds.map((variantId) => getGuidedStoryPriorityIdentity(variantId))
  if (constituent.some((item) => !item)) return null
  const scores = constituent.map((item) => scoreFamily(item!.family, answers))
  if (scores.some((value) => value === null)) return null
  const value = lowest(...(scores as number[]))
  if (!APPROVED_VALUES.has(value)) return null
  return {
    family: identity.family,
    label: GUIDED_STORY_PRIORITY_LABELS[identity.family],
    priorityVariantId: priority.variantId as GuidedStoryPriorityVariantId,
    ...(priority.mergedVariantIds
      ? { mergedVariantIds: [...priority.mergedVariantIds] as GuidedStoryPriorityVariantId[] }
      : {}),
    value: value as HairPotentialValue,
  }
}

export function calculateHairPotential(
  rawAnswers: QuizAnswers,
  rankedPriorities: readonly GuidedStoryPriority[],
): HairPotentialResult | null {
  if (!isCompleteSupportedAnswers(rawAnswers) || rankedPriorities.length !== 3) return null
  const answers = canonicalizeQuizAnswers(rawAnswers)
  const dimensions = rankedPriorities.map((priority) => scorePriority(priority, answers))
  if (dimensions.some((dimension) => dimension === null)) return null
  const resolved = dimensions as [
    HairPotentialDimension,
    HairPotentialDimension,
    HairPotentialDimension,
  ]
  const overall = Math.round(resolved.reduce((sum, dimension) => sum + dimension.value, 0) / 3)
  return { modelVersion: "hair_potential_v1", dimensions: resolved, overall }
}
