"use client"

import { ArrowLeft } from "lucide-react"
import { QuizOptionCard } from "@/components/quiz/quiz-option-card"

interface HeatProtectionScreenProps {
  selected: boolean | null
  onSelect: (val: boolean) => void
  onBack: () => void
}

export function HeatProtectionScreen({
  selected,
  onSelect,
  onBack,
}: HeatProtectionScreenProps) {
  return (
    <div>
      <button
        onClick={onBack}
        className="flex min-h-[44px] min-w-[44px] items-center justify-center text-white/60 hover:text-white transition-colors mb-2"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      <h1 className="animate-fade-in-up font-header text-3xl leading-tight text-white mb-6">
        Benutzt du Hitzeschutz?
      </h1>

      <div className="space-y-3">
        <QuizOptionCard
          emoji={"\u{1F6E1}\uFE0F"}
          label="Ja"
          active={selected === true}
          onClick={() => onSelect(true)}
          animationDelay={100}
        />
        <QuizOptionCard
          emoji={"\u274C"}
          label="Nein"
          active={selected === false}
          onClick={() => onSelect(false)}
          animationDelay={160}
        />
      </div>
    </div>
  )
}
