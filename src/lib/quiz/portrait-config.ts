import type { HairLength } from "@/lib/vocabulary"
import {
  QUIZ_DENSITY_VALUES,
  QUIZ_HAIR_LENGTH_VALUES,
  QUIZ_STRUCTURE_VALUES,
  QUIZ_TREATMENT_VALUES,
  canonicalizeQuizAnswers,
} from "./normalization"
import type { QuizAnswers } from "./types"

export type PortraitLength = HairLength
export type PortraitHairPattern = (typeof QUIZ_STRUCTURE_VALUES)[number]
export type PortraitDensity = (typeof QUIZ_DENSITY_VALUES)[number]
export type PortraitTreatmentState = "none" | "perm" | "straightened" | "natural_fallback"
export type PortraitMarkerPreset = PortraitLength | "generic"

export interface PersonalizedPortraitConfig {
  kind: "personalized"
  length: PortraitLength
  naturalRootPattern: PortraitHairPattern
  treatedLengthPattern: PortraitHairPattern
  density: PortraitDensity
  treatmentState: PortraitTreatmentState
  markerPreset: PortraitLength
}

export interface GenericPortraitConfig {
  kind: "generic"
  markerPreset: "generic"
}

export type PortraitConfig = PersonalizedPortraitConfig | GenericPortraitConfig

const GENERIC_PORTRAIT_CONFIG: GenericPortraitConfig = {
  kind: "generic",
  markerPreset: "generic",
}

function isAllowedValue<T extends readonly string[]>(
  value: unknown,
  allowed: T,
): value is T[number] {
  return typeof value === "string" && allowed.includes(value)
}

function hasValidTreatmentAxis(rawTreatment: QuizAnswers["treatment"]): boolean {
  return (
    Array.isArray(rawTreatment) &&
    rawTreatment.length > 0 &&
    rawTreatment.some((value) => QUIZ_TREATMENT_VALUES.includes(value as never))
  )
}

function resolveTreatmentState(treatment: readonly string[]): PortraitTreatmentState {
  const hasPerm = treatment.includes("dauerwelle")
  const hasStraightened = treatment.includes("chemisch_geglaettet")

  if (hasPerm && hasStraightened) return "natural_fallback"
  if (hasPerm) return "perm"
  if (hasStraightened) return "straightened"
  return "none"
}

function resolveTreatedPattern(
  naturalPattern: PortraitHairPattern,
  treatmentState: PortraitTreatmentState,
): PortraitHairPattern {
  if (treatmentState === "perm") return "curly"
  if (treatmentState === "straightened") return "straight"
  return naturalPattern
}

export function derivePortraitConfig(rawAnswers: QuizAnswers): PortraitConfig {
  if (!hasValidTreatmentAxis(rawAnswers.treatment)) {
    return GENERIC_PORTRAIT_CONFIG
  }

  const answers = canonicalizeQuizAnswers(rawAnswers)

  if (
    !isAllowedValue(answers.hair_length, QUIZ_HAIR_LENGTH_VALUES) ||
    !isAllowedValue(answers.structure, QUIZ_STRUCTURE_VALUES) ||
    !isAllowedValue(answers.density, QUIZ_DENSITY_VALUES) ||
    !answers.treatment
  ) {
    return GENERIC_PORTRAIT_CONFIG
  }

  const treatmentState = resolveTreatmentState(answers.treatment)

  return {
    kind: "personalized",
    length: answers.hair_length,
    naturalRootPattern: answers.structure,
    treatedLengthPattern: resolveTreatedPattern(answers.structure, treatmentState),
    density: answers.density,
    treatmentState,
    markerPreset: answers.hair_length,
  }
}
