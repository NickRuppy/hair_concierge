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
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Wähle bis zu {MAX_GOALS} Ziele, die wir in deinem Plan priorisieren sollen.
        </p>
        <span className="shrink-0 rounded-full border border-primary/15 bg-primary/[0.05] px-3 py-1 text-xs font-semibold text-[var(--brand-plum)]">
          {selectedGoals.length}/{MAX_GOALS} gewählt
        </span>
      </div>

      <div className="grid auto-rows-fr grid-cols-2 gap-3 flex-1">
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
                "animate-fade-in-up flex h-full min-h-[104px] flex-col rounded-2xl border px-4 py-4 text-left transition-all duration-200",
                isSelected
                  ? "border-[var(--brand-plum)] bg-[rgba(var(--brand-plum-rgb),0.08)] shadow-[0_14px_36px_-28px_rgba(var(--brand-plum-rgb),0.45)]"
                  : "border-border bg-card hover:border-primary/30 hover:bg-muted/40",
                isDisabled && "cursor-not-allowed opacity-40",
              )}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
                    isSelected
                      ? "bg-white/85 text-[var(--brand-plum)]"
                      : "bg-muted text-[var(--text-caption)]",
                  )}
                >
                  {isSelected ? "Ausgewählt" : "Ziel"}
                </span>
                <div
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full border transition-colors",
                    isSelected
                      ? "border-[var(--brand-plum)] bg-[var(--brand-plum)] text-primary-foreground"
                      : "border-border bg-white text-transparent",
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
              </div>
              <span className="text-[15px] font-semibold leading-snug text-foreground sm:text-base">
                {getAvailableGoalLabel(goal, hairTexture)}
              </span>
            </button>
          )
        })}
      </div>

      <p className="mt-4 text-center text-sm text-[var(--text-caption)]">
        Du kannst deine Ziele später im Profil jederzeit anpassen.
      </p>

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
