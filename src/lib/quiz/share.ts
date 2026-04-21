export interface QuizShareConfigInput {
  leadId: string | null
  name: string
  shareQuote: string | null
  origin: string
  isMobile: boolean
  canNativeShare: boolean
}

export interface QuizShareConfig {
  label: string
  mode: "native" | "copy"
  title: string
  text: string
  url: string
}

export function buildQuizShareConfig(input: QuizShareConfigInput): QuizShareConfig | null {
  if (!input.leadId) {
    return null
  }

  const firstName = input.name.trim().split(/\s+/)[0] || "Dein"
  const url = `${input.origin}/result/${input.leadId}`

  return {
    label: "ERGEBNIS TEILEN",
    mode: input.isMobile && input.canNativeShare ? "native" : "copy",
    title: `${firstName}s Ergebnis bei Hair Concierge`,
    text: input.shareQuote || `Schau dir ${firstName}s Ergebnis bei Hair Concierge an.`,
    url,
  }
}
