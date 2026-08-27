export interface QuizResultCta {
  lead: string
  label: string
  subline: string
}

/**
 * The one result CTA that still reaches a screen. The former locked-out variant
 * was dead code: both call sites return an offer or a loading state before that
 * copy could render, and its three-step unlock promise described the retired
 * onboarding ceremony (founder ruling 27.08.2026).
 */
export const QUIZ_RESULT_CTA: QuizResultCta = {
  lead: "Als Nächstes: dein persönlicher Plan",
  label: "MEINE ROUTINE STARTEN",
  subline: "Mit passenden Produkten, Reihenfolge und Anwendung.",
}
