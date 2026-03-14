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

export interface CardData {
  haartypLabel: string
  cards: { emoji: string; title: string; description: string }[]
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
    (scalpConditionResults[answers.scalp_condition ?? ""] ?? "") ||
    "Keine Angaben zur Kopfhaut."

  const cards = [
    {
      emoji: "\uD83E\uDDEC",
      title: "Haartyp",
      description: getHaartypLabel(answers),
    },
    {
      emoji: "\uD83D\uDCD0",
      title: "Haarstaerke",
      description: thicknessResults[answers.thickness ?? ""] ?? "",
    },
    {
      emoji: "\uD83D\uDD2C",
      title: "Oberflaeche",
      description: surfaceResults[answers.fingertest ?? ""] ?? "",
    },
    {
      emoji: "\u2696\uFE0F",
      title: "Protein vs. Feuchtigkeit",
      description: pullTestResults[answers.pulltest ?? ""] ?? "",
    },
    {
      emoji: "\uD83E\uDDF4",
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
