"use client"

import { useRef, useState } from "react"
import { ArrowLeft } from "lucide-react"
import { QuizOptionCard } from "@/components/quiz/quiz-option-card"

interface SingleSelectScreenProps {
  title: string
  subtitle?: string
  options: { value: string; label: string; emoji: string }[]
  selected: string | null
  onSelect: (value: string) => void
  onBack: () => void
}

export function SingleSelectScreen({
  title,
  subtitle,
  options,
  selected,
  onSelect,
  onBack,
}: SingleSelectScreenProps) {
  const advancingRef = useRef(false)
  const [localSelected, setLocalSelected] = useState(selected)

  function handleSelect(value: string) {
    if (advancingRef.current) return
    advancingRef.current = true
    setLocalSelected(value)
    setTimeout(() => {
      onSelect(value)
      advancingRef.current = false
    }, 400)
  }

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

      {subtitle && (
        <p
          className="animate-fade-in-up text-sm text-white/50 mb-6"
          style={{ animationDelay: "50ms" }}
        >
          {subtitle}
        </p>
      )}

      <div className="space-y-3 mt-4">
        {options.map((option, i) => (
          <QuizOptionCard
            key={option.value}
            emoji={option.emoji}
            label={option.label}
            active={localSelected === option.value}
            onClick={() => handleSelect(option.value)}
            animationDelay={100 + i * 60}
          />
        ))}
      </div>
    </div>
  )
}
