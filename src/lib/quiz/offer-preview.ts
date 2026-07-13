import { deriveTargetWeightFromHair } from "@/lib/recommendation-engine/categories/shared"
import { deriveBaseShampooCadenceTarget } from "@/lib/recommendation-engine/shampoo-cadence"
import { getProductFrequencyMetadata } from "@/lib/vocabulary"
import type { HairDensity, HairThickness, ScalpCondition, ScalpType } from "@/lib/vocabulary"

import { resolveQuizNeed, type QuizNeedLane } from "./need-lane"
import { canonicalizeQuizAnswers } from "./normalization"
import { selectOfferPreviewProduct } from "./offer-preview-products"
import type {
  OfferPreviewCadence,
  OfferPreviewCategory,
  OfferPreviewNeedProfile,
  OfferPreviewProductCard,
  OfferPreviewScalpRoute,
  OfferPreviewSignal,
  QuizOfferPreview,
} from "./offer-preview-types"
import type { QuizAnswers } from "./types"

const SCALP_TYPE_MAP: Record<string, ScalpType> = {
  fettig: "oily",
  ausgeglichen: "balanced",
  trocken: "dry",
}

const SCALP_CONDITION_MAP: Record<string, ScalpCondition> = {
  schuppen: "dandruff",
  trockene_schuppen: "dry_flakes",
  gereizt: "irritated",
}

const EXTRA_CATEGORY_BY_LANE: Partial<
  Record<QuizNeedLane, Exclude<OfferPreviewCategory, "shampoo" | "conditioner">>
> = {
  bond_repair: "bondbuilder",
  protein: "protein_mask",
  deep_moisture: "moisture_mask",
  surface_support: "leave_in",
  ends_protection: "oil",
}

const LANE_HEADLINES: Record<QuizNeedLane, { headline: string; summary: string }> = {
  scalp_focus: {
    headline: "Deine Pflegebasis beginnt bei der Kopfhaut.",
    summary:
      "Das passende Shampoo übernimmt den Fokus; die Längen bekommen eine abgestimmte Basispflege.",
  },
  bond_repair: {
    headline: "Deine Längen brauchen gezielteren Struktur-Schutz.",
    summary:
      "Neben Shampoo und Conditioner ist ein Bondbuilder der plausibelste zusätzliche Fokus.",
  },
  protein: {
    headline: "Deine Längen können von gezieltem Strukturaufbau profitieren.",
    summary: "Die Basis bleibt einfach; eine Protein-Maske ergänzt sie in größeren Abständen.",
  },
  deep_moisture: {
    headline: "Deine Längen brauchen mehr Feuchtigkeits-Unterstützung.",
    summary: "Eine Feuchtigkeitsmaske ergänzt Shampoo und Conditioner als gezielter Zusatzschritt.",
  },
  surface_support: {
    headline: "Deine Längen brauchen Schutz, der zwischen den Wäschen bleibt.",
    summary:
      "Ein Leave-in ergänzt die Pflegebasis, ohne daraus eine unnötig lange Routine zu machen.",
  },
  ends_protection: {
    headline: "Deine Spitzen verdienen einen eigenen Schutzschritt.",
    summary: "Ein leichtes Öl ergänzt die Basis dort, wo Längen und Spitzen es brauchen.",
  },
  base: {
    headline: "Eine passende Pflegebasis ist für dich der sinnvollste Start.",
    summary:
      "Aus dem Quiz lassen sich Shampoo und Conditioner schon sinnvoll eingrenzen; alles Weitere klärt Chaarlie mit dir.",
  },
}

function deriveScalpRoute(answers: QuizAnswers): OfferPreviewScalpRoute {
  if (answers.scalp_condition === "schuppen") return "dandruff"
  if (answers.scalp_condition === "gereizt") return "irritated"
  if (answers.scalp_condition === "trockene_schuppen") return "dry"
  if (answers.scalp_type === "fettig") return "oily"
  if (answers.scalp_type === "trocken") return "dry"
  return "balanced"
}

function deriveWashCadence(answers: QuizAnswers): OfferPreviewCadence {
  const scalpType = answers.scalp_type ? (SCALP_TYPE_MAP[answers.scalp_type] ?? null) : null
  const scalpCondition = answers.scalp_condition
    ? (SCALP_CONDITION_MAP[answers.scalp_condition] ?? null)
    : null
  const target = deriveBaseShampooCadenceTarget({ scalpType, scalpCondition })
  const frequency = target?.preferredFrequency ?? "weekly_2x"

  return {
    label: getProductFrequencyMetadata(frequency).label,
    qualifier: "Startpunkt aus deinem Quiz",
  }
}

function deriveExtraCadence(
  category: NonNullable<OfferPreviewNeedProfile["extra"]>["category"],
): OfferPreviewCadence {
  if (category === "protein_mask" || category === "moisture_mask") {
    return { label: "Alle 2–3 Haarwäschen", qualifier: "vorsichtiger Startpunkt" }
  }
  if (category === "leave_in") return { label: "Nach jeder Haarwäsche" }
  if (category === "oil")
    return { label: "Nach Bedarf", qualifier: "sparsam in Längen und Spitzen" }
  return { label: "Nach Produktprotokoll", qualifier: "wird im finalen Plan festgelegt" }
}

export function deriveOfferPreviewNeedProfile(answers: QuizAnswers): OfferPreviewNeedProfile {
  const resolution = resolveQuizNeed(answers)
  const thickness = (answers.thickness as HairThickness | undefined) ?? "normal"
  const density = (answers.density as HairDensity | undefined) ?? "medium"
  const scalpRoute = deriveScalpRoute(answers)
  const washCadence = deriveWashCadence(answers)
  const extraCategory = EXTRA_CATEGORY_BY_LANE[resolution.lane]

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
    extra: extraCategory
      ? {
          category: extraCategory,
          cadence: deriveExtraCadence(extraCategory),
          ...(extraCategory === "leave_in"
            ? {
                variant: answers.goals?.includes("curl_definition")
                  ? ("curl" as const)
                  : ("general" as const),
              }
            : {}),
        }
      : null,
  }
}

function scalpSignal(
  route: OfferPreviewScalpRoute,
  cadence: OfferPreviewCadence,
): OfferPreviewSignal {
  const label: Record<OfferPreviewScalpRoute, string> = {
    balanced: "Ausgeglichene Kopfhaut",
    oily: "Schnell fettender Ansatz",
    dry: "Trockene Kopfhaut",
    dandruff: "Kopfhaut mit Schuppen",
    irritated: "Empfindliche, gereizte Kopfhaut",
  }
  const conclusion: Record<OfferPreviewScalpRoute, string> = {
    balanced: "Eine ausgewogene Reinigung reicht als Basis.",
    oily: "Die Reinigung darf regelmäßiger sein, ohne die Längen zu überladen.",
    dry: "Eine milde Reinigung ist der vorsichtige Startpunkt.",
    dandruff: "Das Shampoo übernimmt den Kopfhaut-Fokus.",
    irritated: "Milde Reinigung steht vor zusätzlichen Kopfhautprodukten.",
  }
  return { label: label[route], conclusion: `${conclusion[route]} ${cadence.label}.` }
}

function careSignal(needs: OfferPreviewNeedProfile, answers: QuizAnswers): OfferPreviewSignal {
  const texture =
    answers.thickness === "fine"
      ? "Feine Haarstärke"
      : answers.thickness === "coarse"
        ? "Kräftige Haarstärke"
        : "Mittlere Haarstärke"
  const conclusion = {
    protein: "Ein Conditioner mit Protein-Fokus ist der passende Ausgangspunkt.",
    moisture: "Ein Conditioner mit Feuchtigkeits-Fokus ist der passende Ausgangspunkt.",
    balanced: "Ein ausgewogener Conditioner ist der passende Ausgangspunkt.",
  }[needs.conditioner.balance]
  return { label: texture, conclusion }
}

function focusSignal(lane: QuizNeedLane): OfferPreviewSignal {
  const copy: Record<QuizNeedLane, OfferPreviewSignal> = {
    scalp_focus: {
      label: "Kopfhaut-Fokus",
      conclusion: "Kein pauschales Serum: der Fokus bleibt beim passenden Shampoo.",
    },
    bond_repair: {
      label: "Mehrere Struktur-Signale",
      conclusion: "Ein Bondbuilder ist als zusätzlicher Fokus plausibel.",
    },
    protein: {
      label: "Dehntest plus Reparatur-Signal",
      conclusion: "Eine Protein-Maske ergänzt den Conditioner in Abständen.",
    },
    deep_moisture: {
      label: "Bruchtest plus Trockenheits-Signal",
      conclusion: "Eine Feuchtigkeitsmaske ist der gezielte Zusatzschritt.",
    },
    surface_support: {
      label: "Oberfläche und Längen",
      conclusion: "Ein Leave-in hält Schutz und Geschmeidigkeit zwischen den Wäschen.",
    },
    ends_protection: {
      label: "Längen und Spitzen",
      conclusion: "Ein leichtes Öl ergänzt die Basis nach Bedarf.",
    },
    base: {
      label: "Keine eindeutige Zusatzkategorie",
      conclusion:
        "Shampoo und Conditioner sind die sinnvolle Mini-Routine; Chaarlie klärt den Rest mit dir.",
    },
  }
  return copy[lane]
}

function toCard(
  module: ReturnType<typeof selectOfferPreviewProduct>,
  cadence: OfferPreviewCadence,
  suggested: boolean,
): OfferPreviewProductCard {
  return {
    key: module.key,
    category: module.category,
    categoryLabel: module.approvedCopy.categoryLabel,
    name: module.name,
    imageUrl: module.imageUrl,
    note: module.approvedCopy.productNote,
    cadence,
    suggested,
  }
}

export function buildQuizOfferPreview(rawAnswers: QuizAnswers): QuizOfferPreview {
  const answers = canonicalizeQuizAnswers(rawAnswers)
  const resolution = resolveQuizNeed(answers)
  const needs = deriveOfferPreviewNeedProfile(answers)
  const products = [
    toCard(selectOfferPreviewProduct("shampoo", needs), needs.shampoo.cadence, false),
    toCard(selectOfferPreviewProduct("conditioner", needs), needs.conditioner.cadence, false),
  ]

  if (needs.extra) {
    products.push(
      toCard(selectOfferPreviewProduct(needs.extra.category, needs), needs.extra.cadence, true),
    )
  }

  return {
    lane: resolution.lane,
    ...LANE_HEADLINES[resolution.lane],
    signals: [
      scalpSignal(needs.shampoo.scalpRoute, needs.shampoo.cadence),
      careSignal(needs, answers),
      focusSignal(resolution.lane),
    ],
    needs,
    products,
  }
}
