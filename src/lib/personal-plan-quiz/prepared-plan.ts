import {
  buildGuidedStoryProductCards,
  deriveGuidedStoryNeedProfile,
} from "@/lib/quiz/guided-story-products"
import {
  rankGuidedStoryPriorities,
  type GuidedStoryPriority,
} from "@/lib/quiz/guided-story-priorities"
import type {
  OfferPreviewNeedProfile,
  OfferPreviewProductCard,
} from "@/lib/quiz/offer-preview-types"
import type { QuizAnswers } from "@/lib/quiz/types"

import {
  adaptPersonalPlanAnswersForOffer,
  type PersonalPlanFallbackMetadata,
} from "./offer-adapter"
import {
  buildPersonalPlanAssessmentRows,
  type PersonalPlanExplanationPart,
} from "./assessment-copy"
import { assessPersonalPlanHair, type HairAssessment } from "./hair-assessment"
import type { PersonalPlanQuizSubmissionEnvelope } from "./types"

export type PersonalPlanVisibleSegments = 1 | 2 | 3

export type PersonalPlanDiagnosticRow = {
  id: string
  title: string
  todayLabel: string
  potentialLabel: string
  todaySegments: PersonalPlanVisibleSegments
  potentialSegments: 3
  summary: string
  explanationParts: PersonalPlanExplanationPart[]
}

export type PersonalPlanPrimaryMessage = {
  kind: "concern" | "goal" | "positive"
  label: string
}

export type PersonalPlanPublicOfferModel = {
  modelVersion: "personal_plan_offer_v2"
  planTitle: string
  profileLine: string
  diagnosticRows: [PersonalPlanDiagnosticRow, PersonalPlanDiagnosticRow, PersonalPlanDiagnosticRow]
  primaryMessage: PersonalPlanPrimaryMessage
  planFitStatement: string
}

export type PersonalPlanLockedPlan = {
  modelVersion: "personal_plan_locked_v1"
  products: OfferPreviewProductCard[]
  needs: OfferPreviewNeedProfile
  toolsStyling: {
    direction: string
    focus: string[]
  }
  routine: {
    order: string[]
    applicationGuidance: string[]
    targetFrequency: Array<{ category: string; cadence: string; qualifier?: string }>
  }
}

export type PersonalPlanCanonicalProfile = QuizAnswers & {
  modelVersion: "personal_plan_canonical_v1"
}

export type PersonalPlanPreparedArtifact = {
  modelVersion: "personal_plan_prepared_v1"
  canonicalProfile: PersonalPlanCanonicalProfile
  fallbackMetadata: PersonalPlanFallbackMetadata
  priorities: ReturnType<typeof rankGuidedStoryPriorities>
  diagnosticScores: HairAssessment
  publicOfferModel: PersonalPlanPublicOfferModel
  lockedPlan: PersonalPlanLockedPlan
}

function planTitle(answers: QuizAnswers): string {
  const texture = {
    straight: "glattes",
    wavy: "welliges",
    curly: "lockiges",
    coily: "stark gelocktes",
  }[answers.structure ?? ""]
  return texture
    ? `Dein persönlicher Plan für gesundes, schönes ${texture} Haar`
    : "Dein persönlicher Plan für gesundes, schönes Haar"
}

function planFitStatement(
  answers: PersonalPlanQuizSubmissionEnvelope["answers"],
): PersonalPlanPublicOfferModel["planFitStatement"] {
  if (
    answers.routineClarity === "none" ||
    answers.routineClarity === "trial_and_error" ||
    answers.blockers?.includes("conflicting_tips")
  ) {
    return "Ein klarer Plan statt widersprüchlicher Tipps: Du bekommst eine feste Reihenfolge, die zu deinem Haar passt und im Alltag leicht nachvollziehbar bleibt."
  }
  if (
    answers.resultReliability === "rarely" ||
    answers.adaptationConfidence === "no" ||
    answers.blockers?.includes("product_fit")
  ) {
    return "Abgestimmt statt weiter auszuprobieren: Dein Plan verbindet passende Produkte mit einer Routine, deren Anpassungen du verstehen kannst."
  }
  if (
    answers.blockers?.includes("routine_too_complex") ||
    answers.blockers?.includes("time_and_cost") ||
    answers.blockers?.includes("consistency")
  ) {
    return "Wirksam, aber alltagstauglich: Dein Plan konzentriert sich auf die Schritte, die für dein Haar wirklich zählen."
  }
  return "Eine verlässliche Richtung für dein Haar: Dein Plan baut auf deiner Ausgangslage auf und macht die nächsten Pflegeschritte klar."
}

function profileLine(answers: QuizAnswers): string {
  const texture = {
    straight: "glattes",
    wavy: "welliges",
    curly: "lockiges",
    coily: "stark gelocktes",
  }[answers.structure ?? ""]
  const thickness = {
    fine: "feines",
    normal: "mittelstarkes",
    coarse: "kräftiges",
  }[answers.thickness ?? ""]
  if (texture && thickness) return `Für ${texture}, ${thickness} Haar`
  return "Für dein persönliches Haarprofil"
}

function toolsStyling(answers: PersonalPlanQuizSubmissionEnvelope["answers"]) {
  const focus: string[] = ["Schonendes Entwirren", "Passende Dosierung"]
  if (answers.texture === "wavy" || answers.texture === "curly" || answers.texture === "coily") {
    focus.push("Definition ohne unnötige Beschwerung")
  } else {
    focus.push("Kontrolliertes Styling ohne unnötigen Produktfilm")
  }
  if (answers.goals?.includes("volume_balance")) focus.push("Volumen gezielt ausbalancieren")
  if (answers.goals?.includes("frizz_surface")) focus.push("Reibung und Frizz reduzieren")
  return {
    direction:
      answers.routineStyle === "precise_goal_oriented"
        ? "Präzise Techniken mit klarer Reihenfolge"
        : "Wenige, wiederholbare Techniken für deinen Alltag",
    focus: [...new Set(focus)],
  }
}

const SCOREABLE_POSITIVE_FALLBACKS: readonly GuidedStoryPriority[] = [
  {
    family: "scalp_comfort",
    tier: "positive",
    variantId: "scalp_comfort.ausgeglichene_kopfhaut",
    title: "Ausgeglichene Kopfhaut als gute Basis",
    finding: "Deine Kopfhaut zeigt aktuell keine eindeutige Belastung.",
    why: "Diese stabile Ausgangslage soll erhalten bleiben.",
    helps: "Der Plan hält die Reinigung passend und vermeidet unnötige zusätzliche Reize.",
    matchedConcerns: [],
    matchedGoals: [],
    isCentral: false,
    isFallback: true,
  },
  {
    family: "moisture_dryness",
    tier: "positive",
    variantId: "moisture_dryness.trockenheit_basis",
    title: "Ausgeglichene Pflege als gute Basis",
    finding: "Deine Angaben zeigen hier keine eindeutige Schwachstelle.",
    why: "Die passende Pflegeintensität hilft, diese Balance zu erhalten.",
    helps: "Der Plan hält Pflege und Haargefühl im Gleichgewicht.",
    matchedConcerns: [],
    matchedGoals: [],
    isCentral: false,
    isFallback: true,
  },
  {
    family: "surface_manageability",
    tier: "positive",
    variantId: "surface_manageability.nur_glanz_ziel",
    title: "Oberfläche und Kämmbarkeit als gute Basis",
    finding: "Deine Angaben zeigen hier keine eindeutige Schwachstelle.",
    why: "Schonende Anwendung hilft, diese Ausgangslage zu erhalten.",
    helps: "Der Plan hält Reibung gering und die Oberfläche gepflegt.",
    matchedConcerns: [],
    matchedGoals: [],
    isCentral: false,
    isFallback: true,
  },
  {
    family: "strength_damage",
    tier: "positive",
    variantId: "strength_damage.haarbruch_schaden_basis",
    title: "Stabilität als gute Basis",
    finding: "Deine Angaben zeigen hier keine eindeutige Schwachstelle.",
    why: "Eine passende Routine soll diese Stabilität erhalten.",
    helps: "Der Plan vermeidet unnötige Belastung und hält die Pflege ausgewogen.",
    matchedConcerns: [],
    matchedGoals: [],
    isCentral: false,
    isFallback: true,
  },
]

const PERSONAL_PLAN_EMAIL_PRIORITY_LABELS: Readonly<Record<string, string>> = {
  "surface_manageability.frizz": "Frizz und viele abstehende Haare",
}

type PersonalPlanPrimaryMessagePriority = {
  isFallback?: boolean
  matchedConcerns: readonly unknown[]
  tier: GuidedStoryPriority["tier"]
  title: string
  variantId: string
}

export function derivePersonalPlanPrimaryMessage(
  priority: PersonalPlanPrimaryMessagePriority,
): PersonalPlanPrimaryMessage {
  const kind =
    priority.tier === "positive" || priority.isFallback
      ? "positive"
      : priority.tier === 1 || priority.tier === 2 || priority.matchedConcerns.length > 0
        ? "concern"
        : "goal"

  return {
    kind,
    label: PERSONAL_PLAN_EMAIL_PRIORITY_LABELS[priority.variantId] ?? priority.title,
  }
}

function replaceUnscoreableLegacyFallbacks(
  ranked: readonly GuidedStoryPriority[],
): GuidedStoryPriority[] {
  const selected = ranked.filter((priority) => !priority.variantId.startsWith("legacy."))
  for (const fallback of SCOREABLE_POSITIVE_FALLBACKS) {
    if (selected.length >= 3) break
    if (selected.some((priority) => priority.family === fallback.family)) continue
    selected.push(fallback)
  }
  return selected.slice(0, 3).map((priority, index) => ({
    ...priority,
    isCentral: index === 0,
  }))
}

export function buildPersonalPlanPreparedArtifact(
  envelope: PersonalPlanQuizSubmissionEnvelope,
): PersonalPlanPreparedArtifact {
  const adapted = adaptPersonalPlanAnswersForOffer(envelope.answers)
  const priorities = replaceUnscoreableLegacyFallbacks(rankGuidedStoryPriorities(adapted.answers))
  const assessment = assessPersonalPlanHair(envelope.answers)
  const needs = deriveGuidedStoryNeedProfile(adapted.answers, priorities)
  const products = buildGuidedStoryProductCards(adapted.answers, priorities)
  const diagnosticRows = buildPersonalPlanAssessmentRows(assessment, envelope.answers)
  const centralPriority = priorities.find((priority) => priority.isCentral) ?? priorities[0]
  if (!centralPriority) {
    throw new Error("Personal-plan answers could not produce a central priority")
  }

  return {
    modelVersion: "personal_plan_prepared_v1",
    canonicalProfile: {
      modelVersion: "personal_plan_canonical_v1",
      ...adapted.answers,
    },
    fallbackMetadata: adapted.fallbackMetadata,
    priorities,
    diagnosticScores: assessment,
    publicOfferModel: {
      modelVersion: "personal_plan_offer_v2",
      planTitle: planTitle(adapted.answers),
      profileLine: profileLine(adapted.answers),
      diagnosticRows,
      primaryMessage: derivePersonalPlanPrimaryMessage(centralPriority),
      planFitStatement: planFitStatement(envelope.answers),
    },
    lockedPlan: {
      modelVersion: "personal_plan_locked_v1",
      products,
      needs,
      toolsStyling: toolsStyling(envelope.answers),
      routine: {
        order: products.map((product) => product.category),
        applicationGuidance: [
          "Produkte in der empfohlenen Reihenfolge und Menge anwenden.",
          "Reinigung auf die Kopfhaut, Pflege auf Längen und Spitzen konzentrieren.",
          "Den Startpunkt nach dem obligatorischen Onboarding mit vorhandenen Produkten verfeinern.",
        ],
        targetFrequency: products.map((product) => ({
          category: product.category,
          cadence: product.cadence.label,
          ...(product.cadence.qualifier ? { qualifier: product.cadence.qualifier } : {}),
        })),
      },
    },
  }
}
