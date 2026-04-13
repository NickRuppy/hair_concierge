"use client"

import { ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { getOrderedGoals, getGoalLabel } from "@/lib/onboarding/goal-flow"
import type { HairTexture } from "@/lib/vocabulary"

interface GoalsScreenProps {
  hairTexture: HairTexture | null
  selectedGoals: string[]
  onGoalToggle: (goal: string) => void
  onContinue: () => void
  onBack: () => void
  isSaving?: boolean
  maxGoals?: number
}

export function GoalsScreen({
  hairTexture,
  selectedGoals,
  onGoalToggle,
  onContinue,
  onBack,
  isSaving,
  maxGoals = 5,
}: GoalsScreenProps) {
  const goals = hairTexture ? getOrderedGoals(hairTexture) : []

  return (
    <div>
      <button
        onClick={onBack}
        disabled={isSaving}
        aria-label="Zurück"
        className="flex min-h-[44px] min-w-[44px] items-center justify-center text-muted-foreground hover:text-foreground transition-colors mb-2 disabled:opacity-40"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      <h1 className="animate-fade-in-up font-header text-3xl leading-tight text-foreground mb-2">
        Deine Haarziele
      </h1>

      <p
        className="animate-fade-in-up text-sm text-[var(--text-sub)] mb-1"
        style={{ animationDelay: "50ms" }}
      >
        Waehle bis zu {maxGoals} Ziele.
      </p>

      <p
        className="animate-fade-in-up text-sm text-[var(--text-sub)] mb-8"
        style={{ animationDelay: "70ms" }}
      >
        {selectedGoals.length} / {maxGoals} gewaehlt
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
        {goals.map((goal, i) => {
          const isSelected = selectedGoals.includes(goal)
          const isDisabled = isSaving || (!isSelected && selectedGoals.length >= maxGoals)

          return (
            <button
              key={goal}
              onClick={() => onGoalToggle(goal)}
              disabled={isDisabled}
              className={cn(
                "quiz-card flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all",
                "animate-fade-in-up",
                isSelected && "quiz-card-active",
                !isSelected && selectedGoals.length >= maxGoals && "opacity-40 cursor-not-allowed",
              )}
              style={{ animationDelay: `${100 + i * 50}ms` }}
            >
              <span className="text-center">{getGoalLabel(goal, hairTexture!)}</span>
              {isSelected && (
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--brand-plum)] text-primary-foreground">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M2.5 6L5 8.5L9.5 4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )}
            </button>
          )
        })}
      </div>

      <div
        className="animate-fade-in-up"
        style={{ animationDelay: `${100 + goals.length * 50 + 60}ms` }}
      >
        <button
          onClick={onContinue}
          disabled={selectedGoals.length < 1 || isSaving}
          className="quiz-btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSaving ? "Speichern..." : "Weiter"}
        </button>
      </div>
    </div>
  )
}
