"use client"

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import { GoalsScreen } from "@/components/goals/goals-screen"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/providers/toast-provider"
import type { HairTexture } from "@/lib/vocabulary"

const MAX_GOALS = 5

interface EditGoalsFlowProps {
  userId: string
  initialGoals: string[]
  hairTexture: HairTexture | null
  returnTo: string
}

function toggleGoal(current: string[], goal: string): string[] {
  if (current.includes(goal)) {
    return current.filter((g) => g !== goal)
  }
  if (current.length >= MAX_GOALS) {
    return current
  }
  let next = [...current]
  if (goal === "volume") next = next.filter((g) => g !== "less_volume")
  if (goal === "less_volume") next = next.filter((g) => g !== "volume")
  next.push(goal)
  return next
}

export function EditGoalsFlow({ userId, initialGoals, hairTexture, returnTo }: EditGoalsFlowProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [selectedGoals, setSelectedGoals] = useState<string[]>(initialGoals)
  const [saving, setSaving] = useState(false)

  const handleToggle = useCallback((goal: string) => {
    setSelectedGoals((prev) => toggleGoal(prev, goal))
  }, [])

  const handleSave = useCallback(async () => {
    if (saving) return
    if (selectedGoals.length < 1) return

    setSaving(true)
    try {
      const supabase = createClient()
      // Upsert (not update) so a user landing here without a hair_profiles
      // row still gets one created — update().eq() would no-op silently and
      // redirect as if save succeeded.
      const { error } = await supabase
        .from("hair_profiles")
        .upsert(
          { user_id: userId, goals: selectedGoals, desired_volume: null },
          { onConflict: "user_id" },
        )

      if (error) throw error

      router.push(returnTo)
    } catch (err) {
      console.error("[edit-goals-flow] save failed:", err)
      toast({
        title: "Speichern fehlgeschlagen. Bitte versuche es erneut.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }, [saving, selectedGoals, userId, router, returnTo, toast])

  const handleBack = useCallback(() => {
    router.push(returnTo)
  }, [router, returnTo])

  return (
    <GoalsScreen
      hairTexture={hairTexture}
      selectedGoals={selectedGoals}
      onGoalToggle={handleToggle}
      onContinue={handleSave}
      onBack={handleBack}
      isSaving={saving}
      continueLabel="Speichern und zurück zum Profil"
    />
  )
}
