import type {
  PersonalPlanQuizAnswers,
  PersonalPlanQuizConcern,
  PersonalPlanQuizGoal,
} from "./types"

export const HAIR_ASSESSMENT_DIMENSION_IDS = [
  "scalp_balance",
  "moisture_softness",
  "surface_frizz",
  "shine",
  "breakage_stability",
  "split_ends",
  "manageability_tangling",
  "shape_definition",
  "volume_lightness",
] as const

export type HairAssessmentDimensionId = (typeof HAIR_ASSESSMENT_DIMENSION_IDS)[number]
export type AssessmentEvidenceKind = "primary" | "observation" | "support" | "neutral"

export type AssessmentEvidence = {
  id: string
  kind: AssessmentEvidenceKind
  weight: 0 | 0.5 | 1 | 2
}

export type HairAssessmentDimension = {
  id: HairAssessmentDimensionId
  evidenceScore: number
  goalMatch: boolean
  active: boolean
  explicitConcern: boolean
  positiveEligible: boolean
  evidence: AssessmentEvidence[]
  recurrence?: "often" | "sometimes" | "rather_not"
}

export type HairAssessment = {
  modelVersion: "hair_assessment_v1"
  dimensions: HairAssessmentDimension[]
  selectedDimensionIds: HairAssessmentDimensionId[]
}

const GOAL_BY_DIMENSION: Record<HairAssessmentDimensionId, PersonalPlanQuizGoal> = {
  scalp_balance: "scalp_balance",
  moisture_softness: "moisture",
  surface_frizz: "frizz_surface",
  shine: "shine",
  breakage_stability: "strength_ends",
  split_ends: "strength_ends",
  manageability_tangling: "manageability_styling",
  shape_definition: "shape_definition",
  volume_lightness: "volume_balance",
}

const CONCERN_BY_DIMENSION: Partial<Record<HairAssessmentDimensionId, PersonalPlanQuizConcern>> = {
  moisture_softness: "dry_lengths",
  surface_frizz: "frizz_flyaways",
  shine: "low_shine",
  breakage_stability: "breakage",
  split_ends: "split_ends",
  manageability_tangling: "tangling",
  shape_definition: "lost_shape",
  volume_lightness: "low_volume_or_weighed_down",
}

const RECURRENCE_RANK = { often: 3, sometimes: 2, rather_not: 1 } as const
const HARSH_TREATMENTS = new Set(["lightened", "permed", "chemically_straightened"])

function hasConcern(answers: PersonalPlanQuizAnswers, concern: PersonalPlanQuizConcern) {
  return answers.currentConcerns?.includes(concern) ?? false
}

function hasHarshTreatment(answers: PersonalPlanQuizAnswers) {
  return answers.chemicalTreatments?.some((treatment) => HARSH_TREATMENTS.has(treatment)) ?? false
}

function dimension(
  id: HairAssessmentDimensionId,
  answers: PersonalPlanQuizAnswers,
  evidence: AssessmentEvidence[],
  positiveEligible = false,
): HairAssessmentDimension {
  const active = evidence.some((item) => item.kind === "primary" || item.kind === "observation")
  const scored = active ? evidence : evidence.filter((item) => item.kind === "neutral")
  const explicitConcern = CONCERN_BY_DIMENSION[id]
    ? hasConcern(answers, CONCERN_BY_DIMENSION[id]!)
    : false
  const concernRecurrence = answers.concernRecurrence
  const recurrence =
    explicitConcern && concernRecurrence && concernRecurrence.concernId === CONCERN_BY_DIMENSION[id]
      ? concernRecurrence.frequency
      : undefined
  return {
    id,
    evidenceScore: Math.min(
      3,
      scored.reduce((total, item) => total + item.weight, 0),
    ),
    goalMatch: answers.goals?.includes(GOAL_BY_DIMENSION[id]) ?? false,
    active,
    explicitConcern,
    positiveEligible,
    evidence: scored,
    ...(recurrence ? { recurrence } : {}),
  }
}

function evaluateDimensions(answers: PersonalPlanQuizAnswers): HairAssessmentDimension[] {
  const scalpSignals: AssessmentEvidence[] = []
  if (answers.scalpOiliness === "oily")
    scalpSignals.push({ id: "scalp_oily", kind: "primary", weight: 2 })
  if (answers.scalpOiliness === "dry")
    scalpSignals.push({ id: "scalp_dry", kind: "primary", weight: 2 })
  const scalpConcerns = answers.scalpConcerns ?? []
  const scalpConcern = scalpConcerns[0]
  const hadOilinessSignal = scalpSignals.length > 0
  if (scalpConcern && !hadOilinessSignal)
    scalpSignals.push({ id: `scalp_${scalpConcern}`, kind: "primary", weight: 2 })
  const additionalScalpConcern = hadOilinessSignal
    ? scalpConcerns.includes("irritated")
      ? "irritated"
      : scalpConcern
    : scalpConcerns.slice(1).includes("irritated")
      ? "irritated"
      : scalpConcerns[1]
  if (additionalScalpConcern)
    scalpSignals.push({
      id: `scalp_${additionalScalpConcern}`,
      kind: "support",
      weight: 0.5,
    })
  if (answers.scalpOiliness === "balanced" && !answers.scalpConcerns?.length)
    scalpSignals.push({ id: "scalp_balanced", kind: "neutral", weight: 0 })

  const moisture: AssessmentEvidence[] = []
  if (hasConcern(answers, "dry_lengths"))
    moisture.push({ id: "dry_lengths", kind: "primary", weight: 2 })
  if (answers.hairSurface === "rough")
    moisture.push({ id: "surface_rough", kind: "support", weight: 0.5 })
  if (hasHarshTreatment(answers))
    moisture.push({ id: "chemical_stress", kind: "support", weight: 0.5 })

  const surface: AssessmentEvidence[] = []
  if (hasConcern(answers, "frizz_flyaways"))
    surface.push({ id: "frizz_flyaways", kind: "primary", weight: 2 })
  if (answers.hairSurface === "rough")
    surface.push({ id: "surface_rough", kind: "primary", weight: 2 })
  if (answers.hairSurface === "slightly_uneven")
    surface.push({ id: "surface_uneven", kind: "observation", weight: 1 })
  if (answers.hairSurface === "smooth")
    surface.push({ id: "surface_smooth", kind: "neutral", weight: 0 })

  const shine: AssessmentEvidence[] = []
  if (hasConcern(answers, "low_shine")) shine.push({ id: "low_shine", kind: "primary", weight: 2 })
  if (answers.hairSurface === "rough")
    shine.push({ id: "surface_rough", kind: "support", weight: 0.5 })
  if (answers.hairSurface === "smooth")
    shine.push({ id: "surface_smooth_context", kind: "neutral", weight: 0 })

  const breakage: AssessmentEvidence[] = []
  if (hasConcern(answers, "breakage")) breakage.push({ id: "breakage", kind: "primary", weight: 2 })
  if (answers.elasticResponse === "snaps")
    breakage.push({ id: "elastic_snaps", kind: "observation", weight: 1 })
  if (answers.elasticResponse === "stretches_stays")
    breakage.push({ id: "elastic_stays", kind: "observation", weight: 1 })
  if (hasHarshTreatment(answers))
    breakage.push({ id: "chemical_stress", kind: "support", weight: 0.5 })
  if (answers.elasticResponse === "stretches_bounces")
    breakage.push({ id: "elastic_bounces", kind: "neutral", weight: 0 })

  const splitEnds: AssessmentEvidence[] = []
  if (hasConcern(answers, "split_ends"))
    splitEnds.push({ id: "split_ends", kind: "primary", weight: 2 })
  if (answers.hairLength === "long" || answers.hairLength === "very_long")
    splitEnds.push({ id: "long_lengths", kind: "support", weight: 0.5 })
  if (hasHarshTreatment(answers))
    splitEnds.push({ id: "chemical_stress", kind: "support", weight: 0.5 })

  const tangling: AssessmentEvidence[] = []
  if (hasConcern(answers, "tangling")) tangling.push({ id: "tangling", kind: "primary", weight: 2 })
  if (answers.hairSurface === "rough")
    tangling.push({ id: "surface_rough", kind: "support", weight: 0.5 })
  if (answers.hairLength === "long" || answers.hairLength === "very_long")
    tangling.push({ id: "long_lengths", kind: "support", weight: 0.5 })

  const shape: AssessmentEvidence[] = []
  if (hasConcern(answers, "lost_shape"))
    shape.push({ id: "lost_shape", kind: "primary", weight: 2 })
  if (hasConcern(answers, "frizz_flyaways"))
    shape.push({ id: "frizz_flyaways", kind: "support", weight: 0.5 })

  const volume: AssessmentEvidence[] = []
  if (hasConcern(answers, "low_volume_or_weighed_down"))
    volume.push({ id: "low_volume_or_weighed_down", kind: "primary", weight: 2 })

  return [
    dimension(
      "scalp_balance",
      answers,
      scalpSignals,
      answers.scalpOiliness === "balanced" && !answers.scalpConcerns?.length,
    ),
    dimension("moisture_softness", answers, moisture),
    dimension("surface_frizz", answers, surface, answers.hairSurface === "smooth"),
    dimension("shine", answers, shine),
    dimension(
      "breakage_stability",
      answers,
      breakage,
      answers.elasticResponse === "stretches_bounces" && !hasConcern(answers, "breakage"),
    ),
    dimension("split_ends", answers, splitEnds),
    dimension("manageability_tangling", answers, tangling),
    dimension("shape_definition", answers, shape),
    dimension("volume_lightness", answers, volume),
  ]
}

function areDisplaySiblings(left: HairAssessmentDimensionId, right: HairAssessmentDimensionId) {
  return (
    (left === "surface_frizz" && right === "shine") ||
    (left === "shine" && right === "surface_frizz")
  )
}

export function assessPersonalPlanHair(answers: PersonalPlanQuizAnswers): HairAssessment {
  const dimensions = evaluateDimensions(answers)
  const active = dimensions.filter((item) => item.active)
  active.sort((left, right) => {
    const priorityDifference =
      right.evidenceScore +
      Number(right.goalMatch) * 0.5 -
      (left.evidenceScore + Number(left.goalMatch) * 0.5)
    if (priorityDifference) return priorityDifference
    const recurrenceDifference =
      (right.recurrence ? RECURRENCE_RANK[right.recurrence] : 0) -
      (left.recurrence ? RECURRENCE_RANK[left.recurrence] : 0)
    if (recurrenceDifference) return recurrenceDifference
    if (left.explicitConcern !== right.explicitConcern) return left.explicitConcern ? -1 : 1
    return (
      HAIR_ASSESSMENT_DIMENSION_IDS.indexOf(left.id) -
      HAIR_ASSESSMENT_DIMENSION_IDS.indexOf(right.id)
    )
  })

  const selected: HairAssessmentDimensionId[] = []
  const explicitSplitEnds = active.some(
    (candidate) => candidate.id === "split_ends" && candidate.explicitConcern,
  )
  const take = (candidate: HairAssessmentDimension) => {
    if (selected.includes(candidate.id)) return
    if (candidate.id === "breakage_stability" && explicitSplitEnds && !candidate.explicitConcern)
      return
    if (selected.length >= 3 || selected.some((id) => areDisplaySiblings(id, candidate.id))) return
    selected.push(candidate.id)
  }
  active.forEach(take)
  dimensions.filter((item) => item.positiveEligible).forEach(take)

  return { modelVersion: "hair_assessment_v1", dimensions, selectedDimensionIds: selected }
}

export function evidenceScoreToSegments(evidenceScore: number): 1 | 2 | 3 {
  if (evidenceScore === 0) return 3
  return evidenceScore < 2 ? 2 : 1
}
