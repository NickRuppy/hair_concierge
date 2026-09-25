"use client"

import { BottomSheet, BottomSheetContent, BottomSheetTitle } from "@/components/ui/bottom-sheet"
import type { IconName } from "@/components/ui/icon"

import { QuizOptionCard } from "./quiz-option-card"

/**
 * „Hauptproblem" (discovery batch 7, F1): with two or more concerns selected, Weiter
 * opens this sheet instead of advancing. It lists only her selected concerns, with the
 * step's own labels; one tap is the answer — it stores the pick and the step advances.
 * Shared by the standard `/quiz` concerns step and the personal-plan `current_problems`
 * screen. Dismissing it keeps her on the step with her selection intact.
 */

export const MAIN_PROBLEM_SHEET_TITLE =
  "Wenn du dich auf eins konzentrieren müsstest – was stört dich am meisten?"

export type MainProblemOption = {
  value: string
  label: string
  icon?: IconName
}

/** The sheet body without the modal shell — what the markup tests render. */
export function QuizMainProblemSheetBody({
  options,
  selected,
  onPick,
}: {
  options: readonly MainProblemOption[]
  /** Her current pick, highlighted so confirming it again is one tap. */
  selected: string | undefined
  onPick: (value: string) => void
}) {
  return (
    <div>
      <BottomSheetTitle className="mb-4 pr-10 font-header text-[22px] font-medium leading-tight text-[var(--brand-plum-darkest)]">
        {MAIN_PROBLEM_SHEET_TITLE}
      </BottomSheetTitle>
      <div className="space-y-3">
        {options.map((option, index) => (
          <QuizOptionCard
            key={option.value}
            icon={option.icon}
            label={option.label}
            active={selected === option.value}
            onClick={() => onPick(option.value)}
            animationDelay={index * 40}
          />
        ))}
      </div>
    </div>
  )
}

export function QuizMainProblemSheet({
  open,
  options,
  selected,
  onPick,
  onClose,
}: {
  open: boolean
  options: readonly MainProblemOption[]
  selected: string | undefined
  onPick: (value: string) => void
  onClose: () => void
}) {
  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <BottomSheetContent className="max-h-[85vh]" contentClassName="px-5 pb-7 pt-1">
        <QuizMainProblemSheetBody options={options} selected={selected} onPick={onPick} />
      </BottomSheetContent>
    </BottomSheet>
  )
}
