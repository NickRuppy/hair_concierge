"use client"

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import { GoalsScreen } from "@/components/goals/goals-screen"
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
  let next = current
  if (goal === "volume") next = next.filter((g) => g !== "less_volume")
  if (goal === "less_volume") next = next.filter((g) => g !== "volume")
  if (next.length >= MAX_GOALS) {
    return current
  }
  return [...next, goal]
}

export function EditGoalsFlow({ initialGoals, hairTexture, returnTo }: EditGoalsFlowProps) {
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
      // The route keeps this prior upsert behavior for an owner whose scanner
      // source is incomplete, and atomically publishes a complete source.
      const response = await fetch("/api/profile/answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goals: selectedGoals }),
        cache: "no-store",
      })
      if (!response.ok) throw new Error("goals save failed")

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
  }, [saving, selectedGoals, router, returnTo, toast])

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
