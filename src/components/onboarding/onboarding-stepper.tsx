"use client"

import { usePathname } from "next/navigation"
import { Check } from "lucide-react"

const STEPS = [
  { label: "Ziele", path: "/onboarding/goals" },
  { label: "Profil", path: "/onboarding/profile" },
  { label: "Alltag", path: "/onboarding/routine" },
] as const

export default function OnboardingStepper() {
  const pathname = usePathname()
  const activeIndex = STEPS.findIndex((s) => pathname.startsWith(s.path))

  return (
    <div className="mb-8 flex items-center justify-center gap-0">
      {STEPS.map((step, i) => {
        const isActive = i === activeIndex
        const isCompleted = i < activeIndex

        return (
          <div key={step.path} className="flex items-center">
            {/* Connecting line before (skip first) */}
            {i > 0 && (
              <div
                className={`h-px w-8 sm:w-12 ${
                  isCompleted || isActive ? "bg-[#F5C518]" : "bg-white/30"
                }`}
              />
            )}

            {/* Step circle + label */}
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs font-semibold ${
                  isCompleted
                    ? "border-[#F5C518] bg-[#F5C518] text-[#231F20]"
                    : isActive
                      ? "border-[#F5C518] bg-[#F5C518] text-[#231F20]"
                      : "border-white/30 text-white/30"
                }`}
              >
                {isCompleted ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span
                className={`text-xs ${
                  isCompleted || isActive ? "text-[#F5C518]" : "text-white/30"
                }`}
              >
                {step.label}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
