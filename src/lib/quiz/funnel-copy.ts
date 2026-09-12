/**
 * Copy that swaps by the funnel package the running quiz belongs to
 * (`useQuizStore.funnelPackageKey`). Every string here already exists in the
 * quiz today; a package only substitutes a handful of them — it never adds a
 * new element. An unrecognized or `null` key always resolves to today's
 * copy, byte-identical.
 */
export interface QuizFunnelCopy {
  readonly infoStripLead: string
  readonly infoStripBody: string
  readonly leadCaptureHeadline: string
  readonly commitHeading: (name: string) => string
  readonly commitButton: string
  readonly analysisLoadingHeadline: string
}

function defaultCommitHeading(name: string): string {
  const normalized = name.trim()
  return normalized
    ? `${normalized}, bereit für den nächsten Schritt mit deinem Haar?`
    : "Bereit für den nächsten Schritt mit deinem Haar?"
}

function scanV1CommitHeading(name: string): string {
  const normalized = name.trim()
  return normalized
    ? `${normalized}, bereit für deinen ersten Scan?`
    : "Bereit für deinen ersten Scan?"
}

const DEFAULT_QUIZ_FUNNEL_COPY: QuizFunnelCopy = {
  infoStripLead: "Lass uns deine Haare verstehen — Schritt für Schritt.",
  infoStripBody: "10 schnelle Fragen zur Basis, dann gehts an deine Routine und Produkte.",
  leadCaptureHeadline: "Dein persönlicher Pflegeplan ist bereit!",
  commitHeading: defaultCommitHeading,
  commitButton: "Ja, zeig mir meine Analyse",
  analysisLoadingHeadline: "Deine Haaranalyse wird erstellt.",
}

const QUIZ_FUNNEL_COPY: Record<string, QuizFunnelCopy> = {
  scan_v1: {
    ...DEFAULT_QUIZ_FUNNEL_COPY,
    infoStripBody: "10 schnelle Fragen zur Basis, dann prüft der Scanner deine Produkte.",
    leadCaptureHeadline: "Dein Haarprofil ist fertig.",
    commitHeading: scanV1CommitHeading,
    commitButton: "Ja, zeig mir meinen Scanner",
    analysisLoadingHeadline: "Wir richten deinen Scanner ein.",
  },
}

export function getQuizFunnelCopy(packageKey: string | null): QuizFunnelCopy {
  if (!packageKey) return DEFAULT_QUIZ_FUNNEL_COPY
  return QUIZ_FUNNEL_COPY[packageKey] ?? DEFAULT_QUIZ_FUNNEL_COPY
}
