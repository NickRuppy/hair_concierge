import type { QuizAnswers } from "./types"
import {
  getHaartypLabel,
  thicknessResults,
  surfaceResults,
  pullTestResults,
  scalpTypeResults,
  scalpConditionResults,
} from "./results-lookup"
import { normalizeStoredQuizAnswers } from "./normalization"

import type { IconName } from "@/components/ui/icon"

export interface CardData {
  haartypLabel: string
  cards: { icon: IconName; title: string; description: string }[]
  /** Short summary line: "Wellig · Fein · Trocken" */
  summaryLine: string
}

const structureSummary: Record<string, string> = {
  straight: "Glatt",
  wavy: "Wellig",
  curly: "Lockig",
  coily: "Kraus",
}

const thicknessSummary: Record<string, string> = {
  fine: "Fein",
  normal: "Mittel",
  coarse: "Dick",
}

const scalpSummary: Record<string, string> = {
  fettig: "Fettig",
  ausgeglichen: "Ausgeglichen",
  trocken: "Trocken",
}

export function buildCardData(rawAnswers: QuizAnswers): CardData {
  const answers = normalizeStoredQuizAnswers(rawAnswers)

  const scalpDesc =
    (scalpTypeResults[answers.scalp_type ?? ""] ?? "") +
      (scalpConditionResults[answers.scalp_condition ?? ""] ?? "") || "Keine Angaben zur Kopfhaut."

  const cards = [
    {
      icon: "result-dna" as const,
      title: "Haartyp",
      description: getHaartypLabel(answers),
    },
    {
      icon: "result-clipboard" as const,
      title: "Haarstärke",
      description: thicknessResults[answers.thickness ?? ""] ?? "",
    },
    {
      icon: "result-microscope" as const,
      title: "Oberflaeche",
      description: surfaceResults[answers.fingertest ?? ""] ?? "",
    },
    {
      icon: "result-balance" as const,
      title: "Protein vs. Feuchtigkeit",
      description: pullTestResults[answers.pulltest ?? ""] ?? "",
    },
    {
      icon: "result-scalp" as const,
      title: "Kopfhaut",
      description: scalpDesc,
    },
  ]

  const parts = [
    structureSummary[answers.structure ?? ""],
    thicknessSummary[answers.thickness ?? ""],
    scalpSummary[answers.scalp_type ?? ""],
  ].filter(Boolean)
  const summaryLine = parts.join(" \u00B7 ")

  return {
    haartypLabel: getHaartypLabel(answers),
    cards,
    summaryLine,
  }
}
