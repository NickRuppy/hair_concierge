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
  const [otherText, setOtherText] = useState(answers.concerns_other_text ?? "")
  const [showOtherField, setShowOtherField] = useState(Boolean(answers.concerns_other_text?.trim()))

  const handleToggle = useCallback((value: string) => {
    setLocalSelection((current) => toggleConcernSelection(current, value))
  }, [])

  const handleNone = useCallback(() => {
    setLocalSelection([])
    setAnswer("concerns", [])
    setAnswer("concerns_other_text", otherText.trim() || undefined)
    window.setTimeout(() => {
      goNext()
    }, 250)
  }, [goNext, otherText, setAnswer])

  const handleContinue = useCallback(() => {
    setAnswer("concerns", localSelection)
    setAnswer("concerns_other_text", otherText.trim() || undefined)
    goNext()
  }, [goNext, localSelection, otherText, setAnswer])

  if (!question) return null

  const hasSelection = localSelection.length > 0
  const hasTypedNote = otherText.trim().length > 0
  const canContinue = hasSelection || hasTypedNote

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
      <p className="text-sm text-muted-foreground leading-relaxed">{question.instruction}</p>
      <div className="mb-5 mt-3 flex items-center justify-between gap-3">
        <span className="rounded-full border border-primary/15 bg-primary/[0.05] px-3 py-1 text-xs font-semibold text-[var(--brand-plum)]">
          Bis zu {question.maxSelections}
        </span>
        <span className="text-xs text-[var(--text-caption)]">
          {localSelection.length}/{question.maxSelections} gewählt
        </span>
      </div>

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
        <div className="rounded-2xl border border-border/70 bg-card/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setShowOtherField((current) => !current)}
              className="text-sm font-medium text-[var(--brand-plum)] transition-colors hover:text-[var(--brand-plum-dark)]"
            >
              {showOtherField ? "Zusätzliche Notiz ausblenden" : "Etwas anderes ergänzen"}
            </button>
            {otherText.trim() ? (
              <span className="rounded-full bg-[rgba(var(--brand-plum-rgb),0.08)] px-2.5 py-1 text-[11px] font-medium text-[var(--brand-plum)]">
                Notiz ergänzt
              </span>
            ) : null}
          </div>

          {showOtherField ? (
            <div className="mt-3 animate-fade-in-up">
              <label
                htmlFor="quiz-concerns-other-text"
                className="mb-2 block text-sm font-medium text-foreground"
              >
                Eigene Notiz
              </label>
              <textarea
                id="quiz-concerns-other-text"
                value={otherText}
                onChange={(event) => setOtherText(event.target.value.slice(0, 50))}
                maxLength={50}
                rows={2}
                placeholder="Zum Beispiel: stumpf nach dem Föhnen"
                className="h-[78.75px] min-h-[78.75px] w-full overflow-y-auto rounded-xl border border-border bg-background px-[18px] py-[14px] text-base font-semibold leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
              <p className="mt-2 text-right text-xs text-[var(--text-caption)]">
                {otherText.length}/50
              </p>
            </div>
          ) : null}
        </div>

        <Button
          type="button"
          onClick={handleContinue}
          disabled={!canContinue}
          variant="unstyled"
          className={`w-full h-14 text-base font-bold tracking-wide rounded-xl ${canContinue ? "quiz-btn-primary" : "disabled:opacity-40"}`}
        >
          Weiter
        </Button>

        {!hasSelection && !hasTypedNote ? (
          <button
            type="button"
            onClick={handleNone}
            className="w-full text-center text-sm font-medium text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
          >
            Nichts davon trifft gerade zu
          </button>
        ) : null}
      </div>

      <p className="mt-3 text-center text-sm text-[var(--text-caption)]">{question.motivation}</p>
    </div>
  )
}
