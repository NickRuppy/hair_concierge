"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/providers/toast-provider"
import { HAIR_TEXTURE_ADJECTIVE } from "@/lib/vocabulary/hair-types"
import { QuizOptionCard } from "@/components/quiz/quiz-option-card"
import { deriveOnboardingGoals, getOnboardingGoalCards } from "@/lib/onboarding/goal-flow"
import { DESIRED_VOLUME_LABELS, ROUTINE_PREFERENCE_OPTIONS } from "@/lib/types"
import type { HairTexture, DesiredVolume } from "@/lib/vocabulary"

interface OnboardingGoalsProps {
  hairTexture: HairTexture | null
  existingGoals: string[]
  existingDesiredVolume: DesiredVolume | null
  existingRoutinePreference: string | null
  userId: string
  hasProfile: boolean
}

export function OnboardingGoals({
  hairTexture,
  existingGoals,
  existingDesiredVolume,
  existingRoutinePreference,
  userId,
  hasProfile,
}: OnboardingGoalsProps) {
  const router = useRouter()

  if (!hairTexture || !hasProfile) {
    return (
      <div className="animate-fade-in-up text-center py-12">
        <p className="text-white/70 text-lg mb-4">
          Bitte absolviere zuerst das Haar-Quiz, damit wir deine Ziele personalisieren koennen.
        </p>
        <button
          onClick={() => router.push("/quiz")}
          className="quiz-btn-primary"
        >
          ZUM QUIZ
        </button>
      </div>
    )
  }

  const goals = getOnboardingGoalCards(hairTexture)

  return (
    <GoalSelector
      goals={goals}
      hairTexture={hairTexture}
      existingGoals={existingGoals}
      existingDesiredVolume={existingDesiredVolume}
      existingRoutinePreference={existingRoutinePreference}
      userId={userId}
    />
  )
}

function GoalSelector({
  goals,
  hairTexture,
  existingGoals,
  existingDesiredVolume,
  existingRoutinePreference,
  userId,
}: {
  goals: ReturnType<typeof getOnboardingGoalCards>
  hairTexture: HairTexture
  existingGoals: string[]
  existingDesiredVolume: DesiredVolume | null
  existingRoutinePreference: string | null
  userId: string
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [desiredVolume, setDesiredVolume] = useState<DesiredVolume | "">(
    existingDesiredVolume ?? (existingGoals.includes("volume") ? "more" : "")
  )
  const [selectedGoals, setSelectedGoals] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    for (const goal of goals) {
      if (existingGoals.includes(goal.key)) {
        initial.add(goal.key)
      }
    }
    return initial
  })
  const [routinePreference, setRoutinePreference] = useState(existingRoutinePreference ?? "")
  const [saving, setSaving] = useState(false)

  function toggleGoal(key: string) {
    setSelectedGoals((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  async function handleSave() {
    if (!desiredVolume) return
    setSaving(true)

    const selectedSecondaryGoals = goals
      .filter((g) => selectedGoals.has(g.key))
      .map((g) => g.key)
    const derivedGoals = deriveOnboardingGoals(selectedSecondaryGoals, desiredVolume)

    const supabase = createClient()
    const { error: hairProfileError } = await supabase
      .from("hair_profiles")
      .update({
        goals: derivedGoals,
        desired_volume: desiredVolume,
        routine_preference: routinePreference || null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)

    if (hairProfileError) {
      toast({ title: "Fehler beim Speichern. Bitte versuche es erneut.", variant: "destructive" })
      setSaving(false)
      return
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ onboarding_completed: true })
      .eq("id", userId)

    if (profileError) {
      toast({ title: "Fehler beim Speichern. Bitte versuche es erneut.", variant: "destructive" })
      setSaving(false)
      return
    }

    router.push("/chat")
  }

  const adjective = HAIR_TEXTURE_ADJECTIVE[hairTexture]

  return (
    <div>
      <div className="animate-fade-in-up mb-2">
        <span className="font-header text-xs tracking-[0.2em] text-[#F5C518]">
          DEINE HAARZIELE
        </span>
      </div>

      <h1
        className="animate-fade-in-up font-header text-3xl leading-tight text-white mb-2"
        style={{ animationDelay: "50ms" }}
      >
        Was moechtest du fuer dein {adjective} Haar erreichen?
      </h1>

      <p
        className="animate-fade-in-up text-sm text-white/50 mb-8"
        style={{ animationDelay: "100ms" }}
      >
        Erst das Wunsch-Volumen, dann die Details, die dir sonst noch wichtig sind.
      </p>

      <div className="mb-8 animate-fade-in-up" style={{ animationDelay: "140ms" }}>
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
                onClick={() => setDesiredVolume(value)}
                className={`rounded-2xl border px-4 py-4 text-left transition-all duration-200 ${
                  active
                    ? "border-[#F5C518] bg-[#F5C518]/15 text-white shadow-[0_0_0_1px_rgba(245,197,24,0.18)]"
                    : "border-white/10 bg-white/5 text-white/75 hover:border-white/25 hover:bg-white/8"
                }`}
                style={{ animationDelay: `${160 + i * 60}ms` }}
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

      <div className="mb-3 animate-fade-in-up" style={{ animationDelay: "220ms" }}>
        <h2 className="font-header text-2xl leading-tight text-white mb-2">
          Was ist dir ausserdem wichtig?
        </h2>
        <p className="text-sm text-white/50">
          Optional. TomBot nutzt diese Auswahl fuer deinen ersten Plan.
        </p>
      </div>

      <div className="space-y-3 mb-8">
        {goals.map((goal, i) => (
          <QuizOptionCard
            key={goal.key}
            emoji={goal.emoji}
            label={goal.label}
            description={goal.description}
            active={selectedGoals.has(goal.key)}
            onClick={() => toggleGoal(goal.key)}
            animationDelay={260 + i * 80}
          />
        ))}
      </div>

      {/* Routine preference */}
      <div className="mb-8 animate-fade-in-up" style={{ animationDelay: "620ms" }}>
        <h2 className="font-header text-2xl leading-tight text-white mb-2">
          Wie detailliert soll deine Routine sein?
        </h2>
        <div className="flex flex-wrap gap-2">
          {ROUTINE_PREFERENCE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setRoutinePreference(option.value)}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                routinePreference === option.value
                  ? "border-[#F5C518] bg-[#F5C518] text-[#1A1618]"
                  : "border-white/20 text-white/70 hover:border-white/35 hover:text-white"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div
        className="animate-fade-in-up"
        style={{ animationDelay: "740ms" }}
      >
        {!desiredVolume && (
          <p className="mb-3 text-sm text-[#F5C518]">
            Bitte waehle zuerst aus, wie viel Volumen du dir wuenschst.
          </p>
        )}
        <button
          onClick={handleSave}
          disabled={!desiredVolume || saving}
          className="quiz-btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? "SPEICHERN..." : "ZU TOMBOT"}
        </button>
      </div>
    </div>
  )
}
