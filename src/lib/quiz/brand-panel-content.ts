import type { LeadCaptureSubStep, QuizStep } from "./types"
import { QUIZ_TOTAL_QUESTIONS } from "./questions"

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
  13: { questionNumber: 3, description: "Wie voll dein Haar insgesamt ist." },
  4: { questionNumber: 4, description: "Wie sich die Oberfläche anfühlt." },
  5: { questionNumber: 5, description: "Wie belastbar die Längen sind." },
  7: { questionNumber: 6, description: "Wie stark dein Haar behandelt ist." },
  6: { questionNumber: 7, description: "Was an der Kopfhaut mitspielt." },
  8: { questionNumber: 8, description: "Was dich gerade ausbremst." },
  12: { questionNumber: 9, description: "Worauf wir hinarbeiten." },
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
      eyebrow: `FRAGE ${questionContent.questionNumber} VON ${QUIZ_TOTAL_QUESTIONS}`,
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
      progressCurrent: QUIZ_TOTAL_QUESTIONS,
      progressComplete: true,
      variant: "journey",
    }
  }

  if (step === 10) {
    return {
      eyebrow: "ANALYSE",
      description: "Wir setzen alles zusammen.",
      progressCurrent: QUIZ_TOTAL_QUESTIONS,
      progressComplete: true,
      variant: "journey",
    }
  }

  if (step === 14) {
    return {
      eyebrow: "WILLKOMMEN",
      description: "Dein nächster Schritt.",
      progressCurrent: QUIZ_TOTAL_QUESTIONS,
      progressComplete: true,
      variant: "journey",
    }
  }

  return {
    eyebrow: null,
    description: "chaarlie",
    progressCurrent: null,
    progressComplete: false,
    variant: "journey",
  }
}
