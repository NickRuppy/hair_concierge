"use client"

import { ArrowLeft } from "lucide-react"
import { QuizOptionCard } from "@/components/quiz/quiz-option-card"

interface ProductChecklistScreenProps {
  title: string
  subtitle: string
  options: { value: string; label: string; emoji: string }[]
  selected: string[]
  onToggle: (value: string) => void
  onContinue: () => void
  onBack: () => void
  noneLabel?: string
  onNone?: () => void
}

export function ProductChecklistScreen({
  title,
  subtitle,
  options,
  selected,
  onToggle,
  onContinue,
  onBack,
  noneLabel,
  onNone,
}: ProductChecklistScreenProps) {
  const hasSelection = selected.length > 0

  return (
    <div>
      <button
        onClick={onBack}
        className="flex min-h-[44px] min-w-[44px] items-center justify-center text-white/60 hover:text-white transition-colors mb-2"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      <h1 className="animate-fade-in-up font-header text-3xl leading-tight text-white mb-2">
        {title}
      </h1>

      <p
        className="animate-fade-in-up text-sm text-white/50 mb-6"
        style={{ animationDelay: "50ms" }}
      >
        {subtitle}
      </p>

      <div className="space-y-3 mb-6">
        {options.map((option, i) => (
          <QuizOptionCard
            key={option.value}
            emoji={option.emoji}
            label={option.label}
            active={selected.includes(option.value)}
            onClick={() => onToggle(option.value)}
            animationDelay={100 + i * 60}
          />
        ))}
      </div>

      {noneLabel && onNone && (
        <div
          className="animate-fade-in-up mb-6"
          style={{ animationDelay: `${100 + options.length * 60}ms` }}
        >
          <button
            type="button"
            onClick={onNone}
            className="rounded-full border border-white/20 px-3 py-1.5 text-sm text-white/70 transition-colors hover:border-white/35 hover:text-white"
          >
            {noneLabel}
          </button>
        </div>
      )}

      <div
        className="animate-fade-in-up"
        style={{ animationDelay: `${100 + (options.length + 1) * 60}ms` }}
      >
        <button
          onClick={onContinue}
          disabled={!hasSelection}
          className="quiz-btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
        >
          WEITER
        </button>
      </div>
    </div>
  )
}
