"use client"

import { useRef, useState } from "react"
import { ArrowLeft } from "lucide-react"
import { HEAT_STYLING_OPTIONS } from "@/lib/vocabulary"
import type { HeatStyling } from "@/lib/vocabulary"

interface HeatFrequencyScreenProps {
  selected: HeatStyling | null
  onSelect: (freq: HeatStyling) => void
  onBack: () => void
}

export function HeatFrequencyScreen({ selected, onSelect, onBack }: HeatFrequencyScreenProps) {
  const advancingRef = useRef(false)
  const [localSelected, setLocalSelected] = useState(selected)

  function handleSelect(freq: HeatStyling) {
    if (advancingRef.current) return
    advancingRef.current = true
    setLocalSelected(freq)
    setTimeout(() => {
      onSelect(freq)
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

      <h1 className="animate-fade-in-up font-header text-3xl leading-tight text-foreground mb-2">
        Wie oft nutzt du Hitzetools?
      </h1>

      <div className="animate-fade-in-up mt-6" style={{ animationDelay: "100ms" }}>
        <div className="flex flex-wrap gap-2">
          {HEAT_STYLING_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                localSelected === option.value
                  ? "border-secondary bg-secondary text-secondary-foreground"
                  : "border-border text-muted-foreground hover:border-border hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
