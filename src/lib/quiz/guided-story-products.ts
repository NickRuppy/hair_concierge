import { deriveTargetWeightFromHair } from "@/lib/recommendation-engine/categories/shared"
import { deriveBaseShampooCadenceTarget } from "@/lib/recommendation-engine/shampoo-cadence"
import { getProductFrequencyMetadata } from "@/lib/vocabulary"
import type { HairDensity, HairThickness } from "@/lib/vocabulary"

import { canonicalizeQuizAnswers } from "./normalization"
import { selectOfferPreviewProduct } from "./offer-preview-products"
import type {
  OfferPreviewCadence,
  OfferPreviewCategory,
  OfferPreviewNeedProfile,
  OfferPreviewProductCard,
  OfferPreviewScalpRoute,
} from "./offer-preview-types"
import type { GuidedStoryPriority } from "./guided-story-priorities"
import type { QuizAnswers } from "./types"

type PriorityEvidence = Pick<
  GuidedStoryPriority,
  "family" | "tier" | "matchedConcerns" | "matchedGoals" | "isFallback"
>

type ExtraCategory = Exclude<OfferPreviewCategory, "shampoo" | "conditioner">

function deriveScalpRoute(answers: QuizAnswers): OfferPreviewScalpRoute {
  if (answers.scalp_condition === "schuppen") return "dandruff"
  if (answers.scalp_condition === "gereizt") return "irritated"
  if (answers.scalp_condition === "trockene_schuppen") return "dry"
  if (answers.scalp_type === "fettig") return "oily"
  if (answers.scalp_type === "trocken") return "dry"
  return "balanced"
}

function deriveWashCadence(answers: QuizAnswers): OfferPreviewCadence {
  const scalpType =
    answers.scalp_type === "fettig"
      ? "oily"
      : answers.scalp_type === "trocken"
        ? "dry"
        : answers.scalp_type === "ausgeglichen"
          ? "balanced"
          : null
  const scalpCondition =
    answers.scalp_condition === "schuppen"
      ? "dandruff"
      : answers.scalp_condition === "trockene_schuppen"
        ? "dry_flakes"
        : answers.scalp_condition === "gereizt"
          ? "irritated"
          : null
  const frequency =
    deriveBaseShampooCadenceTarget({ scalpType, scalpCondition })?.preferredFrequency ?? "weekly_2x"

  return {
    label: getProductFrequencyMetadata(frequency).label,
    qualifier: "Startpunkt aus deinem Quiz",
  }
}

function deriveExtraCadence(category: ExtraCategory): OfferPreviewCadence {
  if (category === "protein_mask" || category === "moisture_mask") {
    return { label: "Gelegentlich", qualifier: "Rhythmus nach Produktangabe" }
  }
  if (category === "leave_in") return { label: "Nach jeder Haarwäsche" }
  if (category === "oil")
    return { label: "Nach Bedarf", qualifier: "sparsam in Längen und Spitzen" }
  return { label: "Nach Produktprotokoll", qualifier: "wird im finalen Plan festgelegt" }
}

export function deriveGuidedStoryNeedProfile(
  rawAnswers: QuizAnswers,
  orderedPriorities: readonly PriorityEvidence[],
): OfferPreviewNeedProfile {
  const answers = canonicalizeQuizAnswers(rawAnswers)
  const thickness = (answers.thickness as HairThickness | undefined) ?? "normal"
  const density = (answers.density as HairDensity | undefined) ?? "medium"
  const extra = selectExtra(answers, orderedPriorities)
  const scalpRoute = deriveScalpRoute(answers)
  const washCadence = deriveWashCadence(answers)

  return {
    shampoo: {
      scalpRoute,
      thickness,
      cleansingIntensity: scalpRoute === "dry" || scalpRoute === "irritated" ? "gentle" : "regular",
      cadence: washCadence,
    },
    conditioner: {
      weight: deriveTargetWeightFromHair(thickness, density) ?? "medium",
      balance:
        answers.pulltest === "stretches_stays"
          ? "protein"
          : answers.pulltest === "snaps"
            ? "moisture"
            : "balanced",
      cadence: { label: "Bei jeder Haarwäsche", qualifier: washCadence.label },
    },
    extra: extra
      ? {
          category: extra,
          cadence: deriveExtraCadence(extra),
          ...(extra === "leave_in"
            ? {
                variant:
                  answers.structure === "wavy" ||
                  answers.structure === "curly" ||
                  answers.structure === "coily"
                    ? ("curl" as const)
                    : ("general" as const),
              }
            : {}),
        }
      : null,
  }
}

function hasChemicalTreatment(answers: QuizAnswers): boolean {
  return (answers.treatment ?? []).some((treatment) => treatment !== "natur")
}

function includesConcern(
  priority: PriorityEvidence,
  concern: PriorityEvidence["matchedConcerns"][number],
): boolean {
  return priority.matchedConcerns.includes(concern)
}

function includesGoal(
  priority: PriorityEvidence,
  goal: PriorityEvidence["matchedGoals"][number],
): boolean {
  return priority.matchedGoals.includes(goal)
}

function priorityFor(
  priorities: readonly PriorityEvidence[],
  predicate: (priority: PriorityEvidence) => boolean,
): number | null {
  const index = priorities.findIndex((priority) => !priority.isFallback && predicate(priority))
  return index === -1 ? null : index
}

function selectExtra(
  answers: QuizAnswers,
  priorities: readonly PriorityEvidence[],
): ExtraCategory | null {
  const strengthPriority = (priority: PriorityEvidence) =>
    priority.family === "strength_damage" ||
    includesConcern(priority, "breakage") ||
    includesConcern(priority, "hair_damage") ||
    includesGoal(priority, "anti_breakage") ||
    includesGoal(priority, "strengthen")
  const moisturePriority = (priority: PriorityEvidence) =>
    priority.family === "moisture_dryness" ||
    includesConcern(priority, "dryness") ||
    includesGoal(priority, "moisture")
  const surfacePriority = (priority: PriorityEvidence) =>
    includesConcern(priority, "frizz") ||
    includesConcern(priority, "tangling") ||
    includesGoal(priority, "curl_definition")
  const endsPriority = (priority: PriorityEvidence) =>
    priority.family === "ends_protection" ||
    includesConcern(priority, "split_ends") ||
    includesGoal(priority, "less_split_ends")

  const bondIndex = priorityFor(
    priorities,
    (priority) => priority.tier === 1 && strengthPriority(priority),
  )
  if (bondIndex !== null && hasChemicalTreatment(answers)) return "bondbuilder"

  const candidates: Array<{ category: ExtraCategory; index: number; order: number }> = []
  const proteinIndex =
    answers.pulltest === "stretches_stays" ? priorityFor(priorities, strengthPriority) : null
  if (proteinIndex !== null)
    candidates.push({ category: "protein_mask", index: proteinIndex, order: 1 })

  const moistureIndex =
    answers.pulltest === "snaps" ? priorityFor(priorities, moisturePriority) : null
  const roughSurface = answers.fingertest === "rau"
  const roughSurfaceComplementsMoisture =
    roughSurface && moistureIndex !== null && priorities[moistureIndex]?.tier === 2
  const leaveInIndex = priorityFor(priorities, surfacePriority)
  if (leaveInIndex !== null || roughSurface) {
    // A rough surface is an approved complement to a Tier-2 moisture priority. Otherwise the
    // derived signal remains below explicit ranked priorities.
    candidates.push({
      category: "leave_in",
      index: leaveInIndex ?? (roughSurfaceComplementsMoisture ? moistureIndex : priorities.length),
      order: 0,
    })
  }
  if (moistureIndex !== null) {
    candidates.push({
      category: "moisture_mask",
      index: roughSurfaceComplementsMoisture ? moistureIndex + 1 : moistureIndex,
      order: 2,
    })
  }

  const oilIndex = priorityFor(priorities, endsPriority)
  if (oilIndex !== null) candidates.push({ category: "oil", index: oilIndex, order: 3 })

  return (
    [...candidates].sort((left, right) => left.index - right.index || left.order - right.order)[0]
      ?.category ?? null
  )
}

function toCard(
  category: OfferPreviewCategory,
  needs: OfferPreviewNeedProfile,
  cadence: OfferPreviewCadence,
  suggested: boolean,
): OfferPreviewProductCard {
  const productModule = selectOfferPreviewProduct(category, needs)
  return {
    key: productModule.key,
    category: productModule.category,
    categoryLabel: productModule.approvedCopy.categoryLabel,
    name: productModule.name,
    imageUrl: productModule.imageUrl,
    note: productModule.approvedCopy.productNote,
    cadence,
    suggested,
  }
}

export function buildGuidedStoryProductCards(
  rawAnswers: QuizAnswers,
  orderedPriorities: readonly PriorityEvidence[],
): OfferPreviewProductCard[] {
  const needs = deriveGuidedStoryNeedProfile(rawAnswers, orderedPriorities)
  const cards = [
    toCard("shampoo", needs, needs.shampoo.cadence, false),
    toCard("conditioner", needs, needs.conditioner.cadence, false),
  ]
  if (needs.extra) cards.push(toCard(needs.extra.category, needs, needs.extra.cadence, true))
  return cards
}
