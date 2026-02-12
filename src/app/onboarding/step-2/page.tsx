"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/providers/auth-provider"
import { createClient } from "@/lib/supabase/client"
import { hairProfileStep2Schema } from "@/lib/validators"
import { CONCERN_OPTIONS, type Concern } from "@/lib/types"
import { ProgressBar } from "@/components/onboarding/progress-bar"
import { SelectableChip } from "@/components/onboarding/selectable-chip"
import { Button } from "@/components/ui/button"

export default function OnboardingStep2() {
  const router = useRouter()
  const { user, loading: authLoading, refreshProfile } = useAuth()
  const supabase = createClient()

  const [concerns, setConcerns] = useState<Concern[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loadingData, setLoadingData] = useState(true)

  // Load existing data on mount
  useEffect(() => {
    if (authLoading || !user) return

    const loadExistingData = async () => {
      const { data } = await supabase
        .from("hair_profiles")
        .select("concerns")
        .eq("user_id", user.id)
        .single()

      if (data?.concerns && Array.isArray(data.concerns)) {
        setConcerns(data.concerns as Concern[])
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

  const toggleConcern = (concern: Concern) => {
    setConcerns((prev) =>
      prev.includes(concern)
        ? prev.filter((c) => c !== concern)
        : [...prev, concern]
    )
  }

  const handleNext = async () => {
    setError(null)

    const result = hairProfileStep2Schema.safeParse({ concerns })

    if (!result.success) {
      setError(result.error.issues[0]?.message || "Bitte waehle mindestens ein Problem aus.")
      return
    }

    setSaving(true)

    try {
      const { error: upsertError } = await supabase
        .from("hair_profiles")
        .upsert(
          {
            user_id: user!.id,
            concerns: result.data.concerns,
          },
          { onConflict: "user_id" }
        )

      if (upsertError) throw upsertError

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ onboarding_step: 3 })
        .eq("id", user!.id)

      if (profileError) throw profileError

      await refreshProfile()
      router.push("/onboarding/step-3")
    } catch (err) {
      console.error("Error saving step 2:", err)
      setError("Fehler beim Speichern. Bitte versuche es erneut.")
    } finally {
      setSaving(false)
    }
  }

  const handleBack = () => {
    router.push("/onboarding/step-1")
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
      <ProgressBar currentStep={2} />

      <div>
        <h2 className="text-xl font-bold text-foreground">
          Schritt 2: Deine Haarprobleme
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Welche Probleme moechtest du angehen? Waehle mindestens eins.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {CONCERN_OPTIONS.map((concern) => (
          <SelectableChip
            key={concern}
            label={concern}
            selected={concerns.includes(concern)}
            onClick={() => toggleConcern(concern)}
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
        <Button onClick={handleNext} disabled={saving} size="lg">
          {saving ? "Speichern..." : "Weiter"}
        </Button>
      </div>
    </div>
  )
}
