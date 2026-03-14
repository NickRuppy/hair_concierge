import type { QuizAnswers } from "./types"
import {
  areQuizAnswersEqual,
  normalizeStoredQuizAnswers,
} from "./normalization"

export type LeadStatus = "captured" | "analyzed" | "linked"

export interface ReusableLeadCandidate {
  id: string
  quiz_answers: Record<string, unknown> | null
  marketing_consent?: boolean
}

export function findReusableLead(
  candidates: ReusableLeadCandidate[] | null | undefined,
  quizAnswers: QuizAnswers
): ReusableLeadCandidate | null {
  if (!candidates?.length) return null

  return (
    candidates.find((candidate) =>
      areQuizAnswersEqual(
        normalizeStoredQuizAnswers(candidate.quiz_answers),
        quizAnswers
      )
    ) ?? null
  )
}

export function getLeadStatusAfterAnalyze(
  userId: string | null | undefined
): LeadStatus {
  return userId ? "linked" : "analyzed"
}
