"use client"

import { useState, useCallback, useEffect } from "react"
import { useQuizStore } from "@/lib/quiz/store"
import type { QuizQuestion as QuizQuestionType } from "@/lib/quiz/types"
import { QuizOptionCard } from "./quiz-option-card"
import { QuizProgressBar } from "./quiz-progress-bar"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

const ANSWER_KEY_MAP: Record<number, keyof import("@/lib/quiz/types").QuizAnswers> = {
  2: "structure",
  3: "thickness",
  4: "fingertest",
  5: "pulltest",
  6: "scalp",
  7: "treatment",
  8: "goals",
}

interface QuizQuestionProps {
  question: QuizQuestionType
}

export function QuizQuestion({ question }: QuizQuestionProps) {
  const { answers, setAnswer, goNext, goBack } = useQuizStore()
  const answerKey = ANSWER_KEY_MAP[question.step]
  const currentValue = answers[answerKey]

  const [localSelection, setLocalSelection] = useState<string | string[]>(
    currentValue ?? (question.selectionMode === "multi" ? [] : "")
  )
  const [advancing, setAdvancing] = useState(false)

  // Reset local selection when question changes
  useEffect(() => {
    const val = answers[answerKey]
    setLocalSelection(val ?? (question.selectionMode === "multi" ? [] : ""))
    setAdvancing(false)
  }, [question.step, answerKey, answers])

  const handleSingleSelect = useCallback(
    (value: string) => {
      if (advancing) return
      setLocalSelection(value)
      setAnswer(answerKey, value)
      setAdvancing(true)
      setTimeout(() => {
        goNext()
      }, 400)
    },
    [answerKey, setAnswer, goNext, advancing]
  )

  const handleMultiSelect = useCallback(
    (value: string) => {
      setLocalSelection((prev) => {
        const arr = Array.isArray(prev) ? prev : []
        if (arr.includes(value)) {
          return arr.filter((v) => v !== value)
        }
        if (question.maxSelections && arr.length >= question.maxSelections) {
          return arr
        }
        return [...arr, value]
      })
    },
    [question.maxSelections]
  )

  const handleMultiContinue = () => {
    setAnswer(answerKey, localSelection as string[])
    goNext()
  }

  const isSelected = (value: string) => {
    if (question.selectionMode === "single") return localSelection === value
    return Array.isArray(localSelection) && localSelection.includes(value)
  }

  const multiHasSelection = Array.isArray(localSelection) && localSelection.length > 0

  return (
    <div className="flex min-h-[80dvh] flex-col" key={question.step}>
      {/* Back button + progress */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={goBack} className="text-white/60 hover:text-white transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <QuizProgressBar current={question.questionNumber} total={7} />
        </div>
        <span className="text-xs text-white/38 tabular-nums">
          {question.questionNumber}/7
        </span>
      </div>

      {/* Title */}
      <h2 className="font-header text-2xl leading-tight text-white mb-2">
        {question.title}
      </h2>

      {/* Instruction */}
      <p className="text-xs text-white/60 leading-relaxed mb-5">
        {question.instruction}
      </p>

      {/* Options */}
      <div className="space-y-2.5 flex-1">
        {question.options.map((opt, i) => (
          <QuizOptionCard
            key={opt.value}
            emoji={opt.emoji}
            label={opt.label}
            description={opt.description}
            active={isSelected(opt.value)}
            onClick={() =>
              question.selectionMode === "single"
                ? handleSingleSelect(opt.value)
                : handleMultiSelect(opt.value)
            }
            animationDelay={i * 60}
          />
        ))}
      </div>

      {/* Multi-select continue button */}
      {question.selectionMode === "multi" && (
        <div className="mt-4">
          <Button
            onClick={handleMultiContinue}
            disabled={!multiHasSelection}
            className="w-full h-12 text-base font-bold tracking-wide rounded-xl disabled:opacity-40"
            style={{ background: multiHasSelection ? "linear-gradient(135deg, #F5C518, #D4A800)" : undefined }}
          >
            WEITER
          </Button>
        </div>
      )}

      {/* Motivation text */}
      <p className="mt-3 text-center text-xs text-white/38">
        {question.motivation}
      </p>
    </div>
  )
}
