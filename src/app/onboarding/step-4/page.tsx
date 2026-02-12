"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/providers/auth-provider"
import { createClient } from "@/lib/supabase/client"
import { hairProfileStep4Schema } from "@/lib/validators"
import { GOAL_OPTIONS, type Goal } from "@/lib/types"
import { ProgressBar } from "@/components/onboarding/progress-bar"
import { SelectableChip } from "@/components/onboarding/selectable-chip"
import { Button } from "@/components/ui/button"

export default function OnboardingStep4() {
  const router = useRouter()
  const { user, loading: authLoading, refreshProfile } = useAuth()
  const supabase = createClient()

  const [goals, setGoals] = useState<Goal[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loadingData, setLoadingData] = useState(true)

  // Load existing data on mount
  useEffect(() => {
    if (authLoading || !user) return

    const loadExistingData = async () => {
      const { data } = await supabase
        .from("hair_profiles")
        .select("goals")
        .eq("user_id", user.id)
        .maybeSingle()

      if (data?.goals && Array.isArray(data.goals)) {
        setGoals(data.goals as Goal[])
      }
      setLoadingData(false)
    }

    loadExistingData()
  }, [user, authLoading, supabase])

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth")
    }
  }, [user, authLoading, router])

  const toggleGoal = (goal: Goal) => {
    setGoals((prev) =>
      prev.includes(goal)
        ? prev.filter((g) => g !== goal)
        : [...prev, goal]
    )
  }

  const handleComplete = async () => {
    setError(null)

    const result = hairProfileStep4Schema.safeParse({ goals })

    if (!result.success) {
      setError(result.error.issues[0]?.message || "Bitte waehle mindestens ein Ziel aus.")
      return
    }

    setSaving(true)

    try {
      // Save goals to hair profile
      const { error: upsertError } = await supabase
        .from("hair_profiles")
        .upsert(
          {
            user_id: user!.id,
            goals: result.data.goals,
          },
          { onConflict: "user_id" }
        )

      if (upsertError) throw upsertError

      // Mark onboarding as completed
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          onboarding_step: 4,
          onboarding_completed: true,
        })
        .eq("id", user!.id)

      if (profileError) throw profileError

      await refreshProfile()
      router.push("/start")
    } catch (err) {
      console.error("Error saving step 4:", err)
      setError("Fehler beim Speichern. Bitte versuche es erneut.")
    } finally {
      setSaving(false)
    }
  }

  const handleBack = () => {
    router.push("/onboarding/step-3")
  }

  if (authLoading || loadingData) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <ProgressBar currentStep={4} />

      <div>
        <h2 className="text-xl font-bold text-foreground">
          Schritt 4: Deine Haarziele
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Was moechtest du fuer deine Haare erreichen? Waehle mindestens ein Ziel.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {GOAL_OPTIONS.map((goal) => (
          <SelectableChip
            key={goal}
            label={goal}
            selected={goals.includes(goal)}
            onClick={() => toggleGoal(goal)}
          />
        ))}
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={handleBack} size="lg">
          Zurueck
        </Button>
        <Button onClick={handleComplete} disabled={saving} size="lg">
          {saving ? "Speichern..." : "Profil erstellen"}
        </Button>
      </div>
    </div>
  )
}
