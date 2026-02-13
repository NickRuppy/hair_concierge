export type QuizStep =
  | 1   // landing
  | 2   // haartextur
  | 3   // haarstaerke
  | 4   // oberflaeche
  | 5   // zugtest
  | 6   // kopfhaut
  | 7   // chemische behandlung
  | 8   // ziele
  | 9   // lead capture
  | 10  // analysis
  | 11  // results
  | 14  // welcome

export type LeadCaptureSubStep = "name" | "email" | "consent"

export type SelectionMode = "single" | "multi"

export interface QuizOption {
  value: string
  label: string
  description?: string
  emoji: string
}

export interface QuizQuestion {
  step: QuizStep
  questionNumber: number
  title: string
  instruction: string
  options: QuizOption[]
  selectionMode: SelectionMode
  maxSelections?: number
  motivation: string
}

export interface QuizAnswers {
  structure?: string
  thickness?: string
  fingertest?: string
  pulltest?: string
  scalp?: string
  treatment?: string[]
  goals?: string[]
}

export interface LeadData {
  name: string
  email: string
  marketingConsent: boolean
}
