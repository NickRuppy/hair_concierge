import type { LeadCaptureSubStep, QuizStep } from "./types"

export interface QuizBrandPanelContent {
  eyebrow: string | null
  description: string
  progressCurrent: number | null
  progressComplete: boolean
  variant: "landing" | "journey"
}

const QUESTION_PANEL_CONTENT: Partial<
  Record<QuizStep, { questionNumber: number; description: string }>
> = {
  2: { questionNumber: 1, description: "Deine natürliche Basis." },
  3: { questionNumber: 2, description: "Wie fein dein Haar ist." },
  4: { questionNumber: 3, description: "Wie sich die Oberfläche anfühlt." },
  5: { questionNumber: 4, description: "Wie belastbar die Längen sind." },
  7: { questionNumber: 5, description: "Wie stark dein Haar behandelt ist." },
  6: { questionNumber: 6, description: "Was an der Kopfhaut mitspielt." },
  8: { questionNumber: 7, description: "Was dich gerade ausbremst." },
  12: { questionNumber: 8, description: "Worauf wir hinarbeiten." },
}

export function getQuizBrandPanelContent(
  step: QuizStep,
  leadCaptureSubStep: LeadCaptureSubStep,
): QuizBrandPanelContent {
  void leadCaptureSubStep

  if (step === 1) {
    return {
      eyebrow: null,
      description: "Dein Haar verdient mehr als Raten. Finde heraus, was es wirklich braucht.",
      progressCurrent: null,
      progressComplete: false,
      variant: "landing",
    }
  }

  const questionContent = QUESTION_PANEL_CONTENT[step]
  if (questionContent) {
    return {
      eyebrow: `FRAGE ${questionContent.questionNumber} VON 8`,
      description: questionContent.description,
      progressCurrent: questionContent.questionNumber,
      progressComplete: false,
      variant: "journey",
    }
  }

  if (step === 9) {
    return {
      eyebrow: "FAST GESCHAFFT",
      description: "Gleich zeigen wir dir dein Profil.",
      progressCurrent: 8,
      progressComplete: true,
      variant: "journey",
    }
  }

  if (step === 10) {
    return {
      eyebrow: "ANALYSE",
      description: "Wir setzen alles zusammen.",
      progressCurrent: 8,
      progressComplete: true,
      variant: "journey",
    }
  }

  if (step === 14) {
    return {
      eyebrow: "WILLKOMMEN",
      description: "Dein nächster Schritt.",
      progressCurrent: 8,
      progressComplete: true,
      variant: "journey",
    }
  }

  return {
    eyebrow: null,
    description: "Hair Concierge",
    progressCurrent: null,
    progressComplete: false,
    variant: "journey",
  }
}
