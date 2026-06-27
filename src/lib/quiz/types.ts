export type QuizStep =
  // step 1 (in-app landing) was removed when the marketing landing at /
  // took over the funnel intro. Quiz now starts at step 2.
  | 2 // haartextur
  | 3 // haarstaerke
  | 13 // haardichte
  | 15 // haarlaenge
  | 4 // oberflaeche
  | 5 // zugtest
  | 6 // kopfhaut
  | 7 // chemische behandlung
  | 8 // haar-bedenken
  | 9 // lead capture
  | 10 // analysis
  | 11 // results
  | 12 // goals
  | 14 // welcome

export type LeadCaptureSubStep = "name" | "email" | "consent"

export type SelectionMode = "single" | "multi"

import type { IconName } from "@/components/ui/icon"
import type { InfoTipId } from "@/lib/help/info-tips"
import type { HairLength, ProfileConcern } from "@/lib/vocabulary"

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
  infoTipId?: InfoTipId
  options: QuizOption[]
  selectionMode: SelectionMode
  maxSelections?: number
  motivation: string
}

export interface QuizAnswers {
  structure?: string
  thickness?: string
  density?: string
  hair_length?: HairLength
  fingertest?: string
  pulltest?: string
  scalp_type?: string
  has_scalp_issue?: boolean
  scalp_condition?: string
  concerns?: ProfileConcern[]
  concerns_other_text?: string
  treatment?: string[]
  goals?: string[]
}

export interface LeadData {
  name: string
  email: string
  marketingConsent: boolean
}
