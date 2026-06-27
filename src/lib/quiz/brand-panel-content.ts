import type { LeadCaptureSubStep, QuizStep } from "./types"
import { getQuizQuestionNumber, QUIZ_TOTAL_QUESTIONS } from "./questions"

export interface QuizBrandPanelContent {
  eyebrow: string | null
  description: string
  progressCurrent: number | null
  progressComplete: boolean
  variant: "landing" | "journey"
}

const QUESTION_PANEL_DESCRIPTIONS: Partial<Record<QuizStep, string>> = {
  2: "Deine natürliche Haarstruktur.",
  3: "Dicke einzelner Haare.",
  13: "Wie voll dein Haar insgesamt ist.",
  15: "Wie lang deine Haare aktuell sind.",
  4: "Wie sich die Oberfläche anfühlt.",
  5: "Wie belastbar die Längen sind.",
  7: "Wie stark dein Haar behandelt ist.",
  6: "Was an der Kopfhaut mitspielt.",
  8: "Was dich gerade ausbremst.",
  12: "Worauf wir hinarbeiten.",
}

export function getQuizBrandPanelContent(
  step: QuizStep,
  leadCaptureSubStep: LeadCaptureSubStep,
): QuizBrandPanelContent {
  void leadCaptureSubStep

  const questionDescription = QUESTION_PANEL_DESCRIPTIONS[step]
  const questionNumber = getQuizQuestionNumber(step)
  if (questionDescription && questionNumber) {
    return {
      eyebrow: `FRAGE ${questionNumber} VON ${QUIZ_TOTAL_QUESTIONS}`,
      description: questionDescription,
      progressCurrent: questionNumber,
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
