"use client"

import { useCallback, useMemo } from "react"
import { ArrowLeft } from "lucide-react"
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
  const goBack = useQuizStore((s) => s.goBack)

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
          onClick={goBack}
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

      <h2 className="font-header text-3xl leading-tight text-foreground mb-2">
        Was sind deine Haarziele?
      </h2>
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Wähle alles aus, was sich für deinen Plan wichtig anfühlt. Wir priorisieren daraus die
          Reihenfolge.
        </p>
        <span className="shrink-0 rounded-full border border-primary/15 bg-primary/[0.05] px-3 py-1 text-xs font-semibold text-[var(--brand-plum)]">
          {selectedGoals.length} gewählt
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3">
        {goals.map((goal, i) => {
          const isSelected = selectedGoals.some((value) => value === goal.value)

          return (
            <QuizOptionCard
              key={goal.value}
              icon={getLegacyQuizGoalIcon(goal.value)}
              label={goal.label}
              active={isSelected}
              onClick={() => handleToggle(goal.value)}
              animationDelay={i * 40}
            />
          )
        })}
      </div>

      <div className="mt-4">
        <Button
          type="button"
          onClick={handleContinue}
          disabled={!canContinue}
          variant="unstyled"
          className={`w-full h-14 text-base font-bold tracking-wide rounded-xl ${canContinue ? "quiz-btn-primary" : "disabled:opacity-40"}`}
        >
          Weiter
        </Button>
      </div>

      <p className="mt-3 text-center text-sm text-[var(--text-caption)]">
        Letzte Frage — dein Pflegeplan ist gleich da.
      </p>
    </div>
  )
}
