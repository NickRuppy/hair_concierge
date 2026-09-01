"use client"

import { useState, useCallback, useMemo, useRef, type FocusEvent } from "react"
import { ArrowLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { QuizOptionCard } from "./quiz-option-card"
import { QuizProgressBar } from "./quiz-progress-bar"
import { getQuestionByStep, QUIZ_TOTAL_QUESTIONS } from "@/lib/quiz/questions"
import { useQuizStore } from "@/lib/quiz/store"
import { resolveVisibleDiagnosticConcerns } from "@/lib/quiz/diagnostic-input"
import { QuizMobileBottomAction, QuizMobileBottomClearance } from "./quiz-mobile-bottom-action"
import { useQuizBrowserBack } from "./quiz-browser-history"
import { getConcernOptions } from "@/components/personal-plan-quiz/quiz-data"
import type { HairTexture } from "@/lib/vocabulary"
import { getLegacyQuizConcernIcon } from "./legacy-quiz-visuals"

function toggleConcern(current: string[], value: string): string[] {
  if (value === "none") return []
  if (current.includes(value)) return current.filter((item) => item !== value)
  return [...current, value]
}

export function QuizConcernsQuestion() {
  const question = getQuestionByStep(8)
  const { answers, setAnswer, goNext } = useQuizStore()
  const requestBack = useQuizBrowserBack()
  const [localSelection, setLocalSelection] = useState<string[]>(
    resolveVisibleDiagnosticConcerns(answers.concerns ?? []),
  )
  const [otherText, setOtherText] = useState(answers.concerns_other_text ?? "")
  const [showOtherField, setShowOtherField] = useState(Boolean(answers.concerns_other_text?.trim()))
  const otherTextRef = useRef<HTMLTextAreaElement>(null)
  const hairTexture = (answers.structure as HairTexture | undefined) ?? null
  const concerns = useMemo(() => getConcernOptions(hairTexture ?? undefined), [hairTexture])

  const handleToggle = useCallback((value: string) => {
    setLocalSelection((current) => toggleConcern(current, value))
  }, [])

  const handleContinue = useCallback(() => {
    setAnswer("concerns", localSelection)
    setAnswer("concerns_other_text", showOtherField ? otherText.trim() || undefined : undefined)
    goNext()
  }, [goNext, localSelection, otherText, setAnswer, showOtherField])

  const handleOtherFocus = useCallback((event: FocusEvent<HTMLTextAreaElement>) => {
    if (!window.matchMedia("(max-width: 639px), (max-height: 700px)").matches) return
    const target = event.currentTarget
    const revealAboveFooter = (behavior: ScrollBehavior) => {
      if (!target.isConnected || document.activeElement !== target) return
      const footer = document.querySelector<HTMLElement>('[data-quiz-bottom-action="viewport"]')
      if (!footer) return
      const overlap =
        target.getBoundingClientRect().bottom - footer.getBoundingClientRect().top + 16
      if (overlap > 0) {
        window.scrollBy({ top: overlap, behavior })
      }
    }
    window.requestAnimationFrame(() => revealAboveFooter("auto"))
    window.setTimeout(
      () =>
        revealAboveFooter(
          window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        ),
      250,
    )
  }, [])

  const handleToggleOtherField = () => {
    if (showOtherField) {
      setAnswer("concerns_other_text", undefined)
      setShowOtherField(false)
      return
    }
    setShowOtherField(true)
    window.requestAnimationFrame(() => otherTextRef.current?.focus())
  }

  if (!question) return null

  const hasSelection = localSelection.length > 0
  const hasTypedNote = otherText.trim().length > 0
  const activeTypedNote = showOtherField && hasTypedNote
  const canContinue = hasSelection || activeTypedNote
  const selectedCount = localSelection.length + (activeTypedNote ? 1 : 0)
  const instruction = "Wähle alles aus, was immer wieder eine Rolle spielt."

  return (
    <div className="flex flex-col" key="quiz-concerns-question">
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={requestBack}
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

      <h2 className="text-balance text-center font-header text-[1.625rem] font-medium leading-[1.12] text-foreground outline-none focus:outline-none sm:text-[2.4rem]">
        Was beschäftigt dich gerade?
      </h2>
      <p className="mx-auto mt-2 max-w-xl text-center text-[15px] leading-6 text-muted-foreground">
        {instruction}
      </p>
      <div className="mt-5 flex-1 space-y-3">
        {concerns.map((option, index) => {
          const active = localSelection.includes(option.value)

          return (
            <QuizOptionCard
              key={option.value}
              icon={getLegacyQuizConcernIcon(option.value)}
              label={option.label}
              description={option.description}
              active={active}
              multi
              onClick={() => handleToggle(option.value)}
              animationDelay={index * 60}
            />
          )
        })}
        <div>
          <QuizOptionCard
            icon="help"
            label="Etwas anderes"
            description="Wenn dein Thema nicht in der Liste steht, beschreib es kurz selbst."
            active={showOtherField}
            multi
            onClick={handleToggleOtherField}
            animationDelay={concerns.length * 60}
          />
          {showOtherField ? (
            <div className="mt-3 animate-fade-in-up rounded-2xl border border-[rgba(var(--brand-plum-rgb),0.22)] bg-card/80 p-4">
              <label
                htmlFor="quiz-concerns-other-text"
                className="mb-2 block text-sm font-medium text-foreground"
              >
                Eigene Notiz
              </label>
              <textarea
                ref={otherTextRef}
                id="quiz-concerns-other-text"
                value={otherText}
                onChange={(event) => setOtherText(event.target.value.slice(0, 50))}
                onFocus={handleOtherFocus}
                maxLength={50}
                rows={2}
                placeholder="Zum Beispiel: stumpf nach dem Föhnen"
                className="h-[78.75px] min-h-[78.75px] w-full overflow-y-auto rounded-xl border border-border bg-background px-[18px] py-[14px] text-base font-semibold leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
              <div className="mt-2 flex items-center justify-end gap-3">
                <p className="text-xs text-[var(--text-caption)]">{otherText.length}/50</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <QuizMobileBottomAction className="mt-4">
        <Button
          type="button"
          onClick={handleContinue}
          disabled={!canContinue}
          className="h-12 w-full text-base"
          variant="cta"
        >
          <span className="personal-plan-multi-count" key={selectedCount}>
            {selectedCount > 0 ? `${selectedCount} ausgewählt · Weiter` : "Weiter"}
          </span>
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </QuizMobileBottomAction>
      <QuizMobileBottomClearance />
    </div>
  )
}
