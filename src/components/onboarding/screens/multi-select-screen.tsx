"use client"

import { ArrowLeft } from "lucide-react"
import { QuizOptionCard } from "@/components/quiz/quiz-option-card"
import type { IconName } from "@/components/ui/icon"
import { InfoTip } from "@/components/ui/info-tip"
import { INFO_TIPS, type InfoTipId } from "@/lib/help/info-tips"

interface MultiSelectScreenProps {
  title: string
  subtitle?: string
  titleInfoTipId?: InfoTipId
  titleInfoLabel?: string
  options: { value: string; label: string; icon: IconName; infoTipId?: InfoTipId }[]
  selected: string[]
  onToggle: (value: string) => void
  onContinue: () => void
  onBack: () => void
  noneLabel?: string
  onNone?: () => void
  isSaving?: boolean
  continueLabel?: string
}

export function MultiSelectScreen({
  title,
  subtitle,
  titleInfoTipId,
  titleInfoLabel,
  options,
  selected,
  onToggle,
  onContinue,
  onBack,
  noneLabel,
  onNone,
  isSaving,
  continueLabel = "Weiter",
}: MultiSelectScreenProps) {
  const hasSelection = selected.length > 0
  const titleTip = titleInfoTipId ? INFO_TIPS[titleInfoTipId] : null

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

      <div className="animate-fade-in-up mb-2 flex items-start justify-between gap-3">
        <h1 className="min-w-0 flex-1 font-header text-3xl leading-tight text-foreground">
          {title}
        </h1>
        {titleTip && (
          <div className="mt-1 flex shrink-0 justify-end">
            <InfoTip
              title={titleTip.title}
              body={titleTip.body}
              label={titleInfoLabel ?? `Info zu ${title}`}
              buttonClassName="h-7 w-7"
            />
          </div>
        )}
      </div>

      {subtitle && (
        <p
          className="animate-fade-in-up text-sm text-[var(--text-sub)] mb-6"
          style={{ animationDelay: "50ms" }}
        >
          {subtitle}
        </p>
      )}

      <div className="space-y-3 mb-6 mt-4">
        {options.map((option, i) => {
          const tip = option.infoTipId ? INFO_TIPS[option.infoTipId] : null

          return (
            <QuizOptionCard
              key={option.value}
              icon={option.icon}
              label={option.label}
              active={selected.includes(option.value)}
              disabled={isSaving}
              onClick={() => onToggle(option.value)}
              animationDelay={100 + i * 60}
              trailing={
                tip ? (
                  <InfoTip
                    title={tip.title}
                    body={tip.body}
                    label={`Info zu ${option.label}`}
                    buttonClassName="h-7 w-7"
                  />
                ) : undefined
              }
            />
          )
        })}
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
          {isSaving ? "Speichern..." : continueLabel}
        </button>
      </div>
    </div>
  )
}
