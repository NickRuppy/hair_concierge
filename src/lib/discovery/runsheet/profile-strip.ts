import type { DiscoveryHeatStylingSummary } from "../heat-styling"
import type { DiscoveryQuizAnswerGroupTitle, DiscoveryQuizAnswers } from "../quiz-answers"

/**
 * Her profile at a glance (cockpit call-ready E1): the facts that decide the plan, at the top
 * of the page instead of inside the closed „Alle Antworten" fold. Pure; it only re-arranges
 * labels the page already shows (quiz answers, heat summary, her stated wash frequency) —
 * nothing is interpreted. Rows without content are left out.
 */

export type RunsheetProfileItem = { text: string; main?: true }
export type RunsheetProfileRow = { label: string; items: RunsheetProfileItem[] }

function answersOf(
  quiz: DiscoveryQuizAnswers | null,
  ...titles: DiscoveryQuizAnswerGroupTitle[]
): RunsheetProfileItem[] {
  if (quiz?.status !== "ready") return []
  return titles.flatMap((title) =>
    (quiz.groups.find((group) => group.title === title)?.rows ?? []).flatMap((row) =>
      row.answers.map((answer) =>
        answer.main ? { text: answer.label, main: true as const } : { text: answer.label },
      ),
    ),
  )
}

export function runsheetProfileStrip(input: {
  quiz: DiscoveryQuizAnswers | null
  heat: DiscoveryHeatStylingSummary | null
  /** Her stated shampoo frequency („2× pro Woche"); null when not asked. */
  washFrequencyLabel: string | null
}): RunsheetProfileRow[] {
  const problems = answersOf(input.quiz, "Probleme")
  const routine: RunsheetProfileItem[] = [
    ...(input.washFrequencyLabel ? [{ text: `Waschen ${input.washFrequencyLabel}` }] : []),
    ...(input.heat?.tools ?? []).map((tool) => ({
      // `protection` is already worded („Hitzeschutz: manchmal").
      text: `${tool.label} ${tool.frequency}${tool.protection ? ` · ${tool.protection}` : ""}`,
    })),
  ]
  const rows: RunsheetProfileRow[] = [
    { label: "Haar", items: answersOf(input.quiz, "Haar", "Behandlung") },
    { label: "Kopfhaut", items: answersOf(input.quiz, "Kopfhaut") },
    { label: "Routine", items: routine },
    // The main problem leads.
    {
      label: "Probleme",
      items: [...problems.filter((item) => item.main), ...problems.filter((item) => !item.main)],
    },
    { label: "Ziele", items: answersOf(input.quiz, "Ziele") },
  ]
  return rows.filter((row) => row.items.length > 0)
}
