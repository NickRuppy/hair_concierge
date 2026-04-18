export type QuizStep =
  | 1 // landing
  | 2 // haartextur
  | 3 // haarstaerke
  | 4 // oberflaeche
  | 5 // zugtest
  | 6 // kopfhaut
  | 7 // chemische behandlung
  | 8 // haar-bedenken
  | 9 // lead capture
  | 10 // analysis
  | 11 // results
  | 14 // welcome

export type LeadCaptureSubStep = "name" | "email" | "consent"

export type SelectionMode = "single" | "multi"

import type { IconName } from "@/components/ui/icon"
import type { ProfileConcern } from "@/lib/vocabulary"

export interface QuizOption {
  value: string
  label: string
  description?: string
  icon: IconName
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
  scalp_type?: string
  has_scalp_issue?: boolean
  scalp_condition?: string
  concerns?: ProfileConcern[]
  treatment?: string[]
}

export interface LeadData {
  name: string
  email: string
  marketingConsent: boolean
}
