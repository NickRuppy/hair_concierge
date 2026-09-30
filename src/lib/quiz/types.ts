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
  // Funnel-package screens. They carry no question and only run for the package
  // that declares them (see `screen-order.ts`).
  | 16 // scan_insert_problem (scan_v1, after 13)
  | 17 // scan_insert_solution (scan_v1, after 6)
  | 18 // scan_insert_home (scan_v1, after 12)

export type LeadCaptureSubStep = "name" | "email" | "consent"
/**
 * Who the quiz is capturing. `regular` asks for name and e-mail; the other two
 * are invitation-bound identities the server already knows and the quiz must not
 * let the visitor edit. See `hasLockedLeadIdentity` in `lead-capture-mode.ts` —
 * every screen that branches on this type handles all three explicitly.
 */
export type LeadCaptureMode = "regular" | "partner" | "discovery"

export type SelectionMode = "single" | "multi"

import type { IconName } from "@/components/ui/icon"
import type { InfoTipId } from "@/lib/help/info-tips"
import type { HairLength, ProfileConcern } from "@/lib/vocabulary"
import type { Goal } from "@/lib/vocabulary/concerns-goals"
import type { DiagnosticConcern, DiagnosticGoal } from "./diagnostic-input"

/** Values accepted by the legacy quiz persistence boundary. */
export type QuizConcern = ProfileConcern | DiagnosticConcern
export type QuizGoal = Goal | DiagnosticGoal

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
  /** Quiz-owned values; legacy profile consumers use an explicit projection. */
  concerns?: QuizConcern[]
  /**
   * Her stated main problem — asked only when she selected two or more concerns. Always
   * one of `concerns`; a stale value is dropped. See `primary-concern.ts`.
   */
  primary_concern?: QuizConcern
  concerns_other_text?: string
  treatment?: string[]
  /** Quiz-owned values; legacy profile consumers use an explicit projection. */
  goals?: QuizGoal[]
}

export interface LeadData {
  name: string
  email: string
  marketingConsent: boolean
}
