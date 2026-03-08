"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/providers/toast-provider"
import { ONBOARDING_GOALS } from "@/lib/vocabulary/onboarding-goals"
import { HAIR_TEXTURE_ADJECTIVE } from "@/lib/vocabulary/hair-types"
import { QuizOptionCard } from "@/components/quiz/quiz-option-card"
import {
  POST_WASH_ACTION_OPTIONS,
  ROUTINE_PREFERENCE_OPTIONS,
  ROUTINE_PRODUCT_OPTIONS,
} from "@/lib/types"
import type { HairTexture } from "@/lib/vocabulary"

interface OnboardingGoalsProps {
  hairTexture: HairTexture | null
  existingGoals: string[]
  existingPostWashActions: string[]
  existingRoutinePreference: string | null
  existingRoutineProducts: string[]
  userId: string
  hasProfile: boolean
}

export function OnboardingGoals({
  hairTexture,
  existingGoals,
  existingPostWashActions,
  existingRoutinePreference,
  existingRoutineProducts,
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

  const goals = ONBOARDING_GOALS[hairTexture]

  return (
    <GoalSelector
      goals={goals}
      hairTexture={hairTexture}
      existingGoals={existingGoals}
      existingPostWashActions={existingPostWashActions}
      existingRoutinePreference={existingRoutinePreference}
      existingRoutineProducts={existingRoutineProducts}
      userId={userId}
    />
  )
}

function GoalSelector({
  goals,
  hairTexture,
  existingGoals,
  existingPostWashActions,
  existingRoutinePreference,
  existingRoutineProducts,
  userId,
}: {
  goals: typeof ONBOARDING_GOALS[HairTexture]
  hairTexture: HairTexture
  existingGoals: string[]
  existingPostWashActions: string[]
  existingRoutinePreference: string | null
  existingRoutineProducts: string[]
  userId: string
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [selectedGoals, setSelectedGoals] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    for (const goal of goals) {
      if (existingGoals.includes(goal.key)) {
        initial.add(goal.key)
      }
    }
    return initial
  })
  const [selectedPostWashActions, setSelectedPostWashActions] = useState<Set<string>>(
    () => new Set(existingPostWashActions)
  )
  const [selectedRoutineProducts, setSelectedRoutineProducts] = useState<Set<string>>(
    () => new Set(existingRoutineProducts)
  )
  const [routinePreference, setRoutinePreference] = useState(
    existingRoutinePreference ?? ""
  )
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

  function toggleSetValue(
    setState: (updater: (prev: Set<string>) => Set<string>) => void,
    key: string
  ) {
    setState((prev) => {
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
    if (selectedGoals.size === 0) return
    setSaving(true)

    const selectedKeys = goals
      .filter((g) => selectedGoals.has(g.key))
      .map((g) => g.key)

    const supabase = createClient()
    const { error } = await supabase
      .from("hair_profiles")
      .update({
        goals: selectedKeys,
        post_wash_actions: [...selectedPostWashActions],
        routine_preference: routinePreference || null,
        current_routine_products: [...selectedRoutineProducts],
      })
      .eq("user_id", userId)

    if (error) {
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
        Waehle 1–3 Ziele aus.
      </p>

      <div className="space-y-3 mb-8">
        {goals.map((goal, i) => (
          <QuizOptionCard
            key={goal.key}
            emoji={goal.emoji}
            label={goal.label}
            description={goal.description}
            active={selectedGoals.has(goal.key)}
            onClick={() => toggleGoal(goal.key)}
            animationDelay={150 + i * 80}
          />
        ))}
      </div>

      <div className="mb-8 animate-fade-in-up" style={{ animationDelay: "480ms" }}>
        <h2 className="font-header text-2xl leading-tight text-white mb-2">
          Was machst du nach dem Waschen?
        </h2>
        <p className="text-sm text-white/50 mb-4">Mehrfachauswahl moeglich.</p>
        <div className="flex flex-wrap gap-2">
          {POST_WASH_ACTION_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => toggleSetValue(setSelectedPostWashActions, option.value)}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                selectedPostWashActions.has(option.value)
                  ? "border-[#F5C518] bg-[#F5C518] text-[#1A1618]"
                  : "border-white/20 text-white/70 hover:border-white/35 hover:text-white"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-8 animate-fade-in-up" style={{ animationDelay: "520ms" }}>
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

      <div className="mb-8 animate-fade-in-up" style={{ animationDelay: "560ms" }}>
        <h2 className="font-header text-2xl leading-tight text-white mb-2">
          Welche Produkte nutzt du aktuell?
        </h2>
        <p className="text-sm text-white/50 mb-4">Mehrfachauswahl moeglich.</p>
        <div className="flex flex-wrap gap-2">
          {ROUTINE_PRODUCT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => toggleSetValue(setSelectedRoutineProducts, option.value)}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                selectedRoutineProducts.has(option.value)
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
        style={{ animationDelay: "620ms" }}
      >
        <button
          onClick={handleSave}
          disabled={selectedGoals.size === 0 || saving}
          className="quiz-btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? "SPEICHERN..." : "WEITER"}
        </button>
      </div>
    </div>
  )
}
