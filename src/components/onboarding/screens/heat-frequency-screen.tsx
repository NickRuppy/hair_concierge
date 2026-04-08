"use client"

import { ArrowLeft } from "lucide-react"
import { PRODUCT_FREQUENCY_OPTIONS } from "@/lib/vocabulary"
import type { ProductFrequency } from "@/lib/vocabulary"

interface HeatFrequencyScreenProps {
  selected: ProductFrequency | null
  onSelect: (freq: ProductFrequency) => void
  onBack: () => void
}

export function HeatFrequencyScreen({
  selected,
  onSelect,
  onBack,
}: HeatFrequencyScreenProps) {
  return (
    <div>
      <button
        onClick={onBack}
        className="flex min-h-[44px] min-w-[44px] items-center justify-center text-white/60 hover:text-white transition-colors mb-2"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      <h1 className="animate-fade-in-up font-header text-3xl leading-tight text-white mb-2">
        Wie oft nutzt du Hitzetools?
      </h1>

      <div
        className="animate-fade-in-up mt-6"
        style={{ animationDelay: "100ms" }}
      >
        <div className="flex flex-wrap gap-2">
          {PRODUCT_FREQUENCY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onSelect(option.value)}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                selected === option.value
                  ? "border-[#F5C518] bg-[#F5C518] text-[#1A1618]"
                  : "border-white/20 text-white/70 hover:border-white/35 hover:text-white"
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
