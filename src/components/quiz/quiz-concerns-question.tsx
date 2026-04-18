"use client"

import { useState, useCallback } from "react"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { QuizOptionCard } from "./quiz-option-card"
import { QuizProgressBar } from "./quiz-progress-bar"
import { getQuestionByStep, QUIZ_TOTAL_QUESTIONS } from "@/lib/quiz/questions"
import { toggleConcernSelection } from "@/lib/quiz/normalization"
import { useQuizStore } from "@/lib/quiz/store"

export function QuizConcernsQuestion() {
  const question = getQuestionByStep(8)
  const { answers, setAnswer, goBack, goNext } = useQuizStore()
  const [localSelection, setLocalSelection] = useState<string[]>(answers.concerns ?? [])

  const handleToggle = useCallback((value: string) => {
    setLocalSelection((current) => toggleConcernSelection(current, value))
  }, [])

  const handleNone = useCallback(() => {
    setLocalSelection([])
    setAnswer("concerns", [])
    window.setTimeout(() => {
      goNext()
    }, 250)
  }, [goNext, setAnswer])

  const handleContinue = useCallback(() => {
    setAnswer("concerns", localSelection)
    goNext()
  }, [goNext, localSelection, setAnswer])

  if (!question) return null

  const hasSelection = localSelection.length > 0

  return (
    <div className="flex flex-col" key="quiz-concerns-question">
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={goBack}
          aria-label="Zurück"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <QuizProgressBar current={question.questionNumber} total={QUIZ_TOTAL_QUESTIONS} />
        </div>
        <span className="text-sm text-[var(--text-caption)] tabular-nums">
          {question.questionNumber}/{QUIZ_TOTAL_QUESTIONS}
        </span>
      </div>

      <h2 className="font-header text-3xl leading-tight text-foreground mb-2">{question.title}</h2>
      <p className="text-sm text-muted-foreground leading-relaxed mb-5">{question.instruction}</p>

      <div className="space-y-3 flex-1">
        {question.options.map((option, index) => {
          const active = localSelection.includes(option.value)
          const disabled =
            !active &&
            typeof question.maxSelections === "number" &&
            localSelection.length >= question.maxSelections

          return (
            <QuizOptionCard
              key={option.value}
              icon={option.icon}
              label={option.label}
              description={option.description}
              active={active}
              disabled={disabled}
              onClick={() => handleToggle(option.value)}
              animationDelay={index * 60}
            />
          )
        })}
      </div>

      <div className="mt-4 space-y-3">
        <Button
          type="button"
          onClick={handleContinue}
          disabled={!hasSelection}
          variant="unstyled"
          className={`w-full h-14 text-base font-bold tracking-wide rounded-xl ${hasSelection ? "quiz-btn-primary" : "disabled:opacity-40"}`}
        >
          Weiter
        </Button>

        <button
          type="button"
          onClick={handleNone}
          className="w-full h-14 rounded-xl border border-border bg-muted text-foreground text-base font-semibold transition-colors hover:bg-muted/80"
        >
          Nichts davon
        </button>
      </div>

      <p className="mt-3 text-center text-sm text-[var(--text-caption)]">{question.motivation}</p>
    </div>
  )
}
