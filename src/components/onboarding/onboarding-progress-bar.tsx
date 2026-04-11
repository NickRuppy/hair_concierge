"use client"

import type { OnboardingStep } from "@/lib/onboarding/store"

const SECTION_LABELS = ["Produkte", "Styling", "Alltag", "Ziele"] as const

const STEP_SECTIONS: Record<OnboardingStep, number> = {
  // Section 0: Produkte
  welcome: 0,
  products_basics: 0,
  products_extras: 0,
  product_drilldown: 0,
  // Section 1: Styling
  heat_tools: 1,
  heat_frequency: 1,
  heat_protection: 1,
  interstitial: 1,
  // Section 2: Alltag
  towel_material: 2,
  towel_technique: 2,
  drying_method: 2,
  brush_type: 2,
  night_protection: 2,
  // Section 3: Ziele
  goals: 3,
  celebration: 3,
}

interface OnboardingProgressBarProps {
  currentStep: OnboardingStep
}

export function OnboardingProgressBar({ currentStep }: OnboardingProgressBarProps) {
  const currentSection = STEP_SECTIONS[currentStep]

  return (
    <div className="w-full">
      {/* Bar segments */}
      <div className="flex gap-1">
        {SECTION_LABELS.map((_, index) => {
          const isCompleted = index < currentSection
          const isCurrent = index === currentSection

          return (
            <div key={index} className="h-[4px] flex-1 rounded-full overflow-hidden bg-white/10">
              {(isCompleted || isCurrent) && (
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: isCompleted ? "100%" : "60%",
                    background: "linear-gradient(90deg, var(--brand-plum), var(--brand-plum-dark))",
                  }}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Labels */}
      <div className="flex mt-2">
        {SECTION_LABELS.map((label, index) => {
          const isCompleted = index < currentSection
          const isCurrent = index === currentSection

          return (
            <div key={index} className="flex-1 text-center">
              <span
                className="text-[11px] font-medium transition-colors duration-300"
                style={{
                  color: isCompleted || isCurrent ? "var(--brand-plum)" : "var(--text-caption)",
                }}
              >
                {label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
