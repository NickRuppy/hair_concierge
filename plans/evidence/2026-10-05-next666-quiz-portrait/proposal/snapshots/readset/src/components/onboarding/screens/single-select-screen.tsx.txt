"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowLeft } from "lucide-react"
import { QuizOptionCard } from "@/components/quiz/quiz-option-card"
import type { IconName } from "@/components/ui/icon"
import { InfoTip } from "@/components/ui/info-tip"
import { INFO_TIPS, type InfoTipId } from "@/lib/help/info-tips"

interface SingleSelectScreenProps {
  title: string
  subtitle?: string
  titleInfoTipId?: InfoTipId
  titleInfoLabel?: string
  options: { value: string; label: string; icon: IconName; infoTipId?: InfoTipId }[]
  selected: string | null
  onSelect: (value: string) => void
  onBack: () => void
}

export function SingleSelectScreen({
  title,
  subtitle,
  titleInfoTipId,
  titleInfoLabel,
  options,
  selected,
  onSelect,
  onBack,
}: SingleSelectScreenProps) {
  const advancingRef = useRef(false)
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [localSelected, setLocalSelected] = useState(selected)

  useEffect(() => {
    setLocalSelected(selected)
  }, [selected])

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current)
    }
  }, [])

  const titleTip = titleInfoTipId ? INFO_TIPS[titleInfoTipId] : null

  function cancelPendingAdvance() {
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current)
    advanceTimerRef.current = null
    advancingRef.current = false
  }

  function handleSelect(value: string) {
    if (advancingRef.current) return
    advancingRef.current = true
    setLocalSelected(value)
    advanceTimerRef.current = setTimeout(() => {
      onSelect(value)
      advanceTimerRef.current = null
      advancingRef.current = false
    }, 400)
  }

  function handleBack() {
    cancelPendingAdvance()
    onBack()
  }

  return (
    <div>
      <button
        onClick={handleBack}
        aria-label="Zurück"
        className="flex min-h-[44px] min-w-[44px] items-center justify-center text-muted-foreground hover:text-foreground transition-colors mb-2"
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

      <div className="space-y-3 mt-4">
        {options.map((option, i) => {
          const tip = option.infoTipId ? INFO_TIPS[option.infoTipId] : null

          return (
            <QuizOptionCard
              key={option.value}
              icon={option.icon}
              label={option.label}
              active={localSelected === option.value}
              onClick={() => handleSelect(option.value)}
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
    </div>
  )
}
