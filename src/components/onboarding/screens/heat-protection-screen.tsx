"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowLeft } from "lucide-react"
import { QuizOptionCard } from "@/components/quiz/quiz-option-card"
import { InfoTip } from "@/components/ui/info-tip"
import { INFO_TIPS } from "@/lib/help/info-tips"

interface HeatProtectionScreenProps {
  selected: boolean | null
  onSelect: (val: boolean) => void
  onBack: () => void
}

export function HeatProtectionScreen({ selected, onSelect, onBack }: HeatProtectionScreenProps) {
  const advancingRef = useRef(false)
  const [localSelected, setLocalSelected] = useState(selected)
  const tip = INFO_TIPS["routine.heat_protection"]

  useEffect(() => {
    setLocalSelected(selected)
  }, [selected])

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
        aria-label="Zurück"
        className="flex min-h-[44px] min-w-[44px] items-center justify-center text-muted-foreground hover:text-foreground transition-colors mb-2"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      <div className="animate-fade-in-up mb-6 flex items-start justify-between gap-3">
        <h1 className="min-w-0 flex-1 font-header text-3xl leading-tight text-foreground">
          Benutzt du Hitzeschutz?
        </h1>
        <div className="mt-1 flex shrink-0 justify-end">
          <InfoTip
            title={tip.title}
            body={tip.body}
            label="Info zu Hitzeschutz"
            buttonClassName="h-7 w-7"
          />
        </div>
      </div>

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
