"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/providers/toast-provider"
import { ONBOARDING_GOALS } from "@/lib/vocabulary/onboarding-goals"
import { HAIR_TEXTURE_ADJECTIVE } from "@/lib/vocabulary/hair-types"
import { QuizOptionCard } from "@/components/quiz/quiz-option-card"
import type { HairTexture } from "@/lib/vocabulary"

interface OnboardingGoalsProps {
  hairTexture: HairTexture | null
  existingGoals: string[]
  userId: string
  hasProfile: boolean
}

export function OnboardingGoals({ hairTexture, existingGoals, userId, hasProfile }: OnboardingGoalsProps) {
  const router = useRouter()
  const { toast } = useToast()

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

  return <GoalSelector goals={goals} hairTexture={hairTexture} existingGoals={existingGoals} userId={userId} />
}

function GoalSelector({
  goals,
  hairTexture,
  existingGoals,
  userId,
}: {
  goals: typeof ONBOARDING_GOALS[HairTexture]
  hairTexture: HairTexture
  existingGoals: string[]
  userId: string
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [selected, setSelected] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    for (const goal of goals) {
      if (existingGoals.includes(goal.label)) {
        initial.add(goal.key)
      }
    }
    return initial
  })
  const [saving, setSaving] = useState(false)

  function toggle(key: string) {
    setSelected((prev) => {
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
    if (selected.size === 0) return
    setSaving(true)

    const selectedLabels = goals
      .filter((g) => selected.has(g.key))
      .map((g) => g.label)

    const supabase = createClient()
    const { error } = await supabase
      .from("hair_profiles")
      .update({ goals: selectedLabels })
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
            active={selected.has(goal.key)}
            onClick={() => toggle(goal.key)}
            animationDelay={150 + i * 80}
          />
        ))}
      </div>

      <div
        className="animate-fade-in-up"
        style={{ animationDelay: "450ms" }}
      >
        <button
          onClick={handleSave}
          disabled={selected.size === 0 || saving}
          className="quiz-btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? "SPEICHERN..." : "WEITER"}
        </button>
      </div>
    </div>
  )
}
