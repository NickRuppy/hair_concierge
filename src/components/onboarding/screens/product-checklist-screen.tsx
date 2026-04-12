"use client"

import { ArrowLeft } from "lucide-react"
import { QuizOptionCard } from "@/components/quiz/quiz-option-card"
import type { IconName } from "@/components/ui/icon"

interface ProductChecklistScreenProps {
  title: string
  subtitle: string
  options: { value: string; label: string; icon: IconName }[]
  selected: string[]
  onToggle: (value: string) => void
  onContinue: () => void
  onBack: () => void
  noneLabel?: string
  onNone?: () => void
  isSaving?: boolean
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
  isSaving,
}: ProductChecklistScreenProps) {
  const hasSelection = selected.length > 0

  return (
    <div>
      <button
        onClick={onBack}
        disabled={isSaving}
        aria-label="Zurück"
        className="flex min-h-[44px] min-w-[44px] items-center justify-center text-muted-foreground hover:text-foreground transition-colors mb-2 disabled:opacity-40"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      <h1 className="animate-fade-in-up font-header text-3xl leading-tight text-foreground mb-2">
        {title}
      </h1>

      <p
        className="animate-fade-in-up text-sm text-[var(--text-sub)] mb-6"
        style={{ animationDelay: "50ms" }}
      >
        {subtitle}
      </p>

      <div className="space-y-3 mb-6">
        {options.map((option, i) => (
          <QuizOptionCard
            key={option.value}
            icon={option.icon}
            label={option.label}
            active={selected.includes(option.value)}
            disabled={isSaving}
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
            disabled={isSaving}
            className="rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-border hover:text-foreground disabled:opacity-40"
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
          disabled={!hasSelection || isSaving}
          className="quiz-btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSaving ? "Speichern..." : "Weiter"}
        </button>
      </div>
    </div>
  )
}
