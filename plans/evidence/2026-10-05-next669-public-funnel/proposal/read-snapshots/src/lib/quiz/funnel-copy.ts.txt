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
  infoStripBody: "10 schnelle Fragen zur Basis, dann geht’s an deine Routine und Produkte.",
  leadCaptureHeadline: "Dein persönlicher Pflegeplan ist bereit!",
  commitHeading: defaultCommitHeading,
  commitButton: "Ja, zeig mir meine Analyse",
  analysisLoadingHeadline: "Deine Haaranalyse wird erstellt.",
}

function discoveryCallCommitHeading(name: string): string {
  const normalized = name.trim()
  return normalized
    ? `${normalized}, bereit für dein persönliches Gespräch?`
    : "Bereit für dein persönliches Gespräch?"
}

const QUIZ_FUNNEL_COPY: Record<string, QuizFunnelCopy> = {
  discovery_call_v1: {
    ...DEFAULT_QUIZ_FUNNEL_COPY,
    infoStripLead: "Deine Vorbereitung auf unser Gespräch.",
    infoStripBody:
      "10 kurze Fragen zu deinem Haar. So sprechen wir im Gespräch direkt über deine Situation – nicht über Basics.",
    leadCaptureHeadline: "Dein Haarprofil ist fertig.",
    commitHeading: discoveryCallCommitHeading,
    commitButton: "Ja, Termin aussuchen",
    analysisLoadingHeadline: "Wir bereiten dein Haarprofil für das Gespräch vor.",
  },
  scan_v1: {
    ...DEFAULT_QUIZ_FUNNEL_COPY,
    infoStripBody: "10 schnelle Fragen zur Basis, dann prüft der Scanner deine Produkte.",
    leadCaptureHeadline: "Dein Haarprofil ist fertig.",
    commitHeading: scanV1CommitHeading,
    commitButton: "Ja, zeig mir meinen Scanner",
    // The post-purchase arrival page owns "Wir richten deinen Scanner ein."
    // (`plan-ready-arrival.tsx`). Here nothing is bought yet, so the line says
    // what the ten answers were for instead of promising a set-up scanner.
    analysisLoadingHeadline:
      "Wir legen dein Haarprofil an. Damit misst der Scanner jedes Produkt an deinem Haar – nicht am Durchschnitt.",
  },
}

export function getQuizFunnelCopy(packageKey: string | null): QuizFunnelCopy {
  if (!packageKey) return DEFAULT_QUIZ_FUNNEL_COPY
  return QUIZ_FUNNEL_COPY[packageKey] ?? DEFAULT_QUIZ_FUNNEL_COPY
}
