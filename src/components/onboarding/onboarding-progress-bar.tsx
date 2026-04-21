"use client"

import type { OnboardingStep } from "@/lib/onboarding/store"
import { buildOnboardingProgressState } from "@/lib/onboarding/progress"

const SECTION_LABELS = ["Produkte", "Styling", "Alltag"] as const

interface OnboardingProgressBarProps {
  currentStep: OnboardingStep
  currentDrilldownIndex: number
  drilldownCount: number
  selectedHeatTools: string[]
}

export function OnboardingProgressBar({
  currentStep,
  currentDrilldownIndex,
  drilldownCount,
  selectedHeatTools,
}: OnboardingProgressBarProps) {
  const progress = buildOnboardingProgressState({
    currentStep,
    currentDrilldownIndex,
    drilldownCount,
    selectedHeatTools,
  })

  return (
    <div className="w-full">
      <div className="relative h-4">
        <div className="absolute inset-x-0 top-1/2 h-[6px] -translate-y-1/2 rounded-full bg-border">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${progress.progressPercent}%`,
              background: "linear-gradient(90deg, var(--brand-plum), var(--brand-plum-dark))",
            }}
          />
        </div>

        {progress.milestones.map((milestone, index) => {
          const isActive = progress.progressPercent >= milestone.percent
          const isLast = index === progress.milestones.length - 1
          const left = isLast ? "100%" : `${milestone.percent}%`

          return (
            <div
              key={milestone.label}
              className="pointer-events-none absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2"
              style={{ left }}
            >
              <div
                className="size-3.5 rounded-full border-2 bg-background transition-all duration-300"
                style={{
                  borderColor: isActive ? "var(--brand-plum)" : "rgba(var(--brand-plum-rgb), 0.18)",
                  backgroundColor: isActive ? "var(--brand-plum)" : "var(--background)",
                }}
              />
            </div>
          )
        })}
      </div>

      <div className="mt-3 flex justify-between gap-2">
        {SECTION_LABELS.map((label, index) => {
          const isActive = index <= progress.currentSectionIndex

          return (
            <div key={label} className="flex-1 text-center">
              <span
                className="text-[11px] font-medium transition-colors duration-300"
                style={{
                  color: isActive ? "var(--brand-plum)" : "var(--text-caption)",
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
