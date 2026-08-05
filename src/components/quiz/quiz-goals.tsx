"use client"

import { useCallback, useMemo } from "react"
import { ArrowLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { QuizProgressBar } from "./quiz-progress-bar"
import { QuizOptionCard } from "./quiz-option-card"
import { getQuizQuestionNumber, QUIZ_TOTAL_QUESTIONS } from "@/lib/quiz/questions"
import { useQuizStore } from "@/lib/quiz/store"
import { trackAppEvent } from "@/lib/analytics/track-app-event"
import { getGoalOptions } from "@/components/personal-plan-quiz/quiz-data"
import type { HairTexture } from "@/lib/vocabulary"
import { resolveVisibleDiagnosticGoals } from "@/lib/quiz/diagnostic-input"
import { getLegacyQuizGoalIcon } from "./legacy-quiz-visuals"
import { QuizMobileBottomAction, QuizMobileBottomClearance } from "./quiz-mobile-bottom-action"
import { useQuizBrowserBack } from "./quiz-browser-history"
import { TEXTURE_COPY } from "@/components/personal-plan-quiz/quiz-data"

function toggleGoal(current: string[], goal: string): string[] {
  if (current.includes(goal)) {
    return current.filter((g) => g !== goal)
  }
  return [...current, goal]
}

export function QuizGoals() {
  const answers = useQuizStore((s) => s.answers)
  const setAnswer = useQuizStore((s) => s.setAnswer)
  const goNext = useQuizStore((s) => s.goNext)
  const requestBack = useQuizBrowserBack()

  const selectedGoals = useMemo(
    () => resolveVisibleDiagnosticGoals((answers.goals as string[] | undefined) ?? []),
    [answers.goals],
  )
  const hairTexture = (answers.structure as HairTexture | undefined) ?? null
  const goals = useMemo(() => getGoalOptions(hairTexture ?? undefined), [hairTexture])

  const handleToggle = useCallback(
    (goal: string) => {
      setAnswer("goals", toggleGoal(selectedGoals, goal))
    },
    [selectedGoals, setAnswer],
  )

  const handleContinue = useCallback(() => {
    if (selectedGoals.length < 1) return
    trackAppEvent("quiz_goals_selected", { count: selectedGoals.length })
    goNext()
  }, [selectedGoals, goNext])

  const canContinue = selectedGoals.length > 0
  const questionNumber = getQuizQuestionNumber(12) ?? QUIZ_TOTAL_QUESTIONS

  return (
    <div className="flex flex-col" key="quiz-goals">
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={requestBack}
          aria-label="Zurück"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <QuizProgressBar current={questionNumber} total={QUIZ_TOTAL_QUESTIONS} />
        </div>
        <span className="text-sm text-[var(--text-caption)] tabular-nums">
          {questionNumber}/{QUIZ_TOTAL_QUESTIONS}
        </span>
      </div>

      <h2 className="text-balance text-center font-header text-[1.625rem] font-medium leading-[1.12] text-foreground outline-none focus:outline-none sm:text-[2.4rem]">
        Was wünschst du dir für {TEXTURE_COPY[hairTexture ?? "wavy"].possessive}?
      </h2>
      <p className="mx-auto mb-5 mt-2 max-w-xl text-center text-[15px] leading-6 text-muted-foreground">
        Wähle alles aus, was sich für deinen Plan wichtig anfühlt. Wir priorisieren daraus die
        Reihenfolge.
      </p>

      <div className="flex flex-1 flex-col gap-3">
        {goals.map((goal, i) => {
          const isSelected = selectedGoals.some((value) => value === goal.value)

          return (
            <QuizOptionCard
              key={goal.value}
              icon={getLegacyQuizGoalIcon(goal.value)}
              label={goal.label}
              active={isSelected}
              multi
              onClick={() => handleToggle(goal.value)}
              animationDelay={i * 40}
            />
          )
        })}
      </div>

      <QuizMobileBottomAction className="mt-4">
        <Button
          type="button"
          onClick={handleContinue}
          disabled={!canContinue}
          className="h-12 w-full text-base"
          variant="cta"
        >
          <span className="personal-plan-multi-count" key={selectedGoals.length}>
            {selectedGoals.length > 0 ? `${selectedGoals.length} ausgewählt · Weiter` : "Weiter"}
          </span>
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </QuizMobileBottomAction>
      <QuizMobileBottomClearance />
    </div>
  )
}
