"use client"

import { ArrowLeft } from "lucide-react"
import { QuizOptionCard } from "@/components/quiz/quiz-option-card"
import { getOnboardingGoalCards } from "@/lib/onboarding/goal-flow"
import { DESIRED_VOLUME_LABELS } from "@/lib/types"
import type { HairTexture, DesiredVolume } from "@/lib/vocabulary"

interface GoalsScreenProps {
  hairTexture: HairTexture | null
  selectedGoals: string[]
  desiredVolume: DesiredVolume | null
  onGoalToggle: (goal: string) => void
  onVolumeChange: (vol: DesiredVolume) => void
  onContinue: () => void
  onBack: () => void
}

export function GoalsScreen({
  hairTexture,
  selectedGoals,
  desiredVolume,
  onGoalToggle,
  onVolumeChange,
  onContinue,
  onBack,
}: GoalsScreenProps) {
  const goals = hairTexture ? getOnboardingGoalCards(hairTexture) : []

  return (
    <div>
      <button
        onClick={onBack}
        className="flex min-h-[44px] min-w-[44px] items-center justify-center text-white/60 hover:text-white transition-colors mb-2"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      <h1 className="animate-fade-in-up font-header text-3xl leading-tight text-white mb-2">
        Deine Haarziele
      </h1>

      <p
        className="animate-fade-in-up text-sm text-white/50 mb-8"
        style={{ animationDelay: "50ms" }}
      >
        Erst das Wunsch-Volumen, dann die Details, die dir sonst noch wichtig sind.
      </p>

      {/* Volume picker */}
      <div className="mb-8 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-header text-2xl leading-tight text-white">
            Wie viel Volumen willst du?
          </h2>
          <span className="rounded-full border border-[#F5C518]/30 bg-[#F5C518]/10 px-2.5 py-1 text-[11px] font-semibold tracking-[0.14em] text-[#F5C518]">
            PFLICHT
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(["less", "balanced", "more"] as const).map((value, i) => {
            const active = desiredVolume === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => onVolumeChange(value)}
                className={`rounded-2xl border px-4 py-4 text-left transition-all duration-200 ${
                  active
                    ? "border-[#F5C518] bg-[#F5C518]/15 text-white shadow-[0_0_0_1px_rgba(245,197,24,0.18)]"
                    : "border-white/10 bg-white/5 text-white/75 hover:border-white/25 hover:bg-white/8"
                }`}
                style={{ animationDelay: `${140 + i * 60}ms` }}
              >
                <div className="mb-2 text-xs font-semibold tracking-[0.16em] text-[#F5C518]">
                  {DESIRED_VOLUME_LABELS[value].toUpperCase()}
                </div>
                <div className="text-sm leading-relaxed">
                  {value === "less" && "Ruhiger, glatter und kompakter im Fall."}
                  {value === "balanced" && "Natuerlich, kontrolliert und ohne Extreme."}
                  {value === "more" && "Mehr Fuelle, Lift und sichtbare Bewegung."}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Goal cards */}
      {goals.length > 0 && (
        <>
          <div className="mb-3 animate-fade-in-up" style={{ animationDelay: "340ms" }}>
            <h2 className="font-header text-2xl leading-tight text-white mb-2">
              Was ist dir ausserdem wichtig?
            </h2>
            <p className="text-sm text-white/50">
              Optional. Diese Auswahl hilft beim ersten Plan.
            </p>
          </div>

          <div className="space-y-3 mb-8">
            {goals.map((goal, i) => (
              <QuizOptionCard
                key={goal.key}
                emoji={goal.emoji}
                label={goal.label}
                description={goal.description}
                active={selectedGoals.includes(goal.key)}
                onClick={() => onGoalToggle(goal.key)}
                animationDelay={380 + i * 80}
              />
            ))}
          </div>
        </>
      )}

      <div
        className="animate-fade-in-up"
        style={{ animationDelay: `${380 + goals.length * 80 + 60}ms` }}
      >
        {!desiredVolume && (
          <p className="mb-3 text-sm text-[#F5C518]">
            Bitte waehle zuerst aus, wie viel Volumen du dir wuenschst.
          </p>
        )}
        <button
          onClick={onContinue}
          disabled={!desiredVolume}
          className="quiz-btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
        >
          WEITER
        </button>
      </div>
    </div>
  )
}
