"use client"

import { useCallback, useMemo } from "react"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { QuizProgressBar } from "./quiz-progress-bar"
import { QUIZ_TOTAL_QUESTIONS } from "@/lib/quiz/questions"
import { useQuizStore } from "@/lib/quiz/store"
import { posthog } from "@/providers/posthog-provider"
import { cn } from "@/lib/utils"
import { getAvailableGoals, getAvailableGoalLabel } from "@/lib/onboarding/goal-flow"
import type { HairTexture } from "@/lib/vocabulary"

const MAX_GOALS = 5

function toggleGoal(current: string[], goal: string): string[] {
  if (current.includes(goal)) {
    return current.filter((g) => g !== goal)
  }
  if (current.length >= MAX_GOALS) {
    return current
  }
  let next = [...current]
  if (goal === "volume") next = next.filter((g) => g !== "less_volume")
  if (goal === "less_volume") next = next.filter((g) => g !== "volume")
  next.push(goal)
  return next
}

export function QuizGoals() {
  const answers = useQuizStore((s) => s.answers)
  const setAnswer = useQuizStore((s) => s.setAnswer)
  const goNext = useQuizStore((s) => s.goNext)
  const goBack = useQuizStore((s) => s.goBack)

  const selectedGoals = useMemo(
    () => (answers.goals as string[] | undefined) ?? [],
    [answers.goals],
  )
  const hairTexture = (answers.structure as HairTexture | undefined) ?? null
  const goals = useMemo(() => getAvailableGoals(hairTexture), [hairTexture])

  const handleToggle = useCallback(
    (goal: string) => {
      setAnswer("goals", toggleGoal(selectedGoals, goal))
    },
    [selectedGoals, setAnswer],
  )

  const handleContinue = useCallback(() => {
    if (selectedGoals.length < 1) return
    posthog.capture("quiz_goals_selected", { count: selectedGoals.length })
    goNext()
  }, [selectedGoals, goNext])

  const canContinue = selectedGoals.length > 0

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
          <QuizProgressBar current={QUIZ_TOTAL_QUESTIONS} total={QUIZ_TOTAL_QUESTIONS} />
        </div>
        <span className="text-sm text-[var(--text-caption)] tabular-nums">
          {QUIZ_TOTAL_QUESTIONS}/{QUIZ_TOTAL_QUESTIONS}
        </span>
      </div>

      <h2 className="font-header text-3xl leading-tight text-foreground mb-2">
        Was sind deine Haarziele?
      </h2>
      <p className="text-sm text-muted-foreground leading-relaxed mb-5">
        Wähle bis zu {MAX_GOALS} Ziele, an denen wir gemeinsam arbeiten — {selectedGoals.length}/
        {MAX_GOALS} gewählt.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 flex-1">
        {goals.map((goal, i) => {
          const isSelected = selectedGoals.includes(goal)
          const isDisabled = !isSelected && selectedGoals.length >= MAX_GOALS

          return (
            <button
              key={goal}
              type="button"
              onClick={() => handleToggle(goal)}
              disabled={isDisabled}
              className={cn(
                "quiz-card relative flex items-center justify-center px-8 py-3 text-sm font-medium transition-all animate-fade-in-up",
                isSelected && "quiz-card-active",
                !isSelected && selectedGoals.length >= MAX_GOALS && "opacity-40 cursor-not-allowed",
              )}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <span className="text-center leading-tight">
                {getAvailableGoalLabel(goal, hairTexture)}
              </span>
              <div
                className={cn(
                  "absolute right-2 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full transition-opacity",
                  isSelected
                    ? "bg-[var(--brand-plum)] text-primary-foreground opacity-100"
                    : "opacity-0",
                )}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M2.5 6L5 8.5L9.5 4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </button>
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
