"use client"

import { useRef, useState } from "react"
import { ArrowLeft } from "lucide-react"
import { QuizOptionCard } from "@/components/quiz/quiz-option-card"

interface HeatProtectionScreenProps {
  selected: boolean | null
  onSelect: (val: boolean) => void
  onBack: () => void
}

export function HeatProtectionScreen({ selected, onSelect, onBack }: HeatProtectionScreenProps) {
  const advancingRef = useRef(false)
  const [localSelected, setLocalSelected] = useState(selected)

  function handleSelect(val: boolean) {
    if (advancingRef.current) return
    advancingRef.current = true
    setLocalSelected(val)
    setTimeout(() => {
      onSelect(val)
      advancingRef.current = false
    }, 400)
  }

  return (
    <div>
      <button
        onClick={onBack}
        className="flex min-h-[44px] min-w-[44px] items-center justify-center text-muted-foreground hover:text-foreground transition-colors mb-2"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      <h1 className="animate-fade-in-up font-header text-3xl leading-tight text-foreground mb-6">
        Benutzt du Hitzeschutz?
      </h1>

      <div className="space-y-3">
        <QuizOptionCard
          icon="heat-protection-yes"
          label="Ja"
          active={localSelected === true}
          onClick={() => handleSelect(true)}
          animationDelay={100}
        />
        <QuizOptionCard
          icon="heat-protection-no"
          label="Nein"
          active={localSelected === false}
          onClick={() => handleSelect(false)}
          animationDelay={160}
        />
      </div>
    </div>
  )
}
