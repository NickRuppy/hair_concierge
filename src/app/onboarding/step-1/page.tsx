"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/providers/auth-provider"
import { createClient } from "@/lib/supabase/client"
import { hairProfileStep1Schema } from "@/lib/validators"
import {
  HAIR_TYPE_OPTIONS,
  HAIR_TEXTURE_OPTIONS,
  type HairType,
  type HairTexture,
} from "@/lib/types"
import { ProgressBar } from "@/components/onboarding/progress-bar"
import {
  HairTypeCard,
  GlattSVG,
  WelligSVG,
  LockigSVG,
  KrausSVG,
  FeinSVG,
  MittelSVG,
  DickSVG,
} from "@/components/onboarding/hair-type-card"
import { Button } from "@/components/ui/button"

const HAIR_TYPE_ILLUSTRATIONS: Record<HairType, React.ReactNode> = {
  glatt: <GlattSVG />,
  wellig: <WelligSVG />,
  lockig: <LockigSVG />,
  kraus: <KrausSVG />,
}

const HAIR_TEXTURE_ILLUSTRATIONS: Record<HairTexture, React.ReactNode> = {
  fein: <FeinSVG />,
  mittel: <MittelSVG />,
  dick: <DickSVG />,
}

export default function OnboardingStep1() {
  const router = useRouter()
  const { user, loading: authLoading, refreshProfile } = useAuth()
  const supabase = createClient()

  const [hairType, setHairType] = useState<HairType | null>(null)
  const [hairTexture, setHairTexture] = useState<HairTexture | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loadingData, setLoadingData] = useState(true)

  // Load existing data on mount
  useEffect(() => {
    if (authLoading || !user) return

    const loadExistingData = async () => {
      try {
        const { data } = await supabase
          .from("hair_profiles")
          .select("hair_type, hair_texture")
          .eq("user_id", user.id)
          .maybeSingle()

        if (data) {
          if (data.hair_type) setHairType(data.hair_type as HairType)
          if (data.hair_texture) setHairTexture(data.hair_texture as HairTexture)
        }
      } catch (err) {
        console.error("Error loading hair profile:", err)
      } finally {
        setLoadingData(false)
      }
    }

    loadExistingData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading])

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth")
    }
  }, [user, authLoading, router])

  const handleNext = async () => {
    setError(null)

    const result = hairProfileStep1Schema.safeParse({
      hair_type: hairType,
      hair_texture: hairTexture,
    })

    if (!result.success) {
      setError("Bitte waehle deinen Haartyp und deine Haarstruktur aus.")
      return
    }

    setSaving(true)

    try {
      // Upsert hair profile
      const { error: upsertError } = await supabase
        .from("hair_profiles")
        .upsert(
          {
            user_id: user!.id,
            hair_type: result.data.hair_type,
            hair_texture: result.data.hair_texture,
          },
          { onConflict: "user_id" }
        )

      if (upsertError) throw upsertError

      // Update onboarding step
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ onboarding_step: 2 })
        .eq("id", user!.id)

      if (profileError) throw profileError

      await refreshProfile()
      router.push("/onboarding/step-2")
    } catch (err) {
      console.error("Error saving step 1:", err)
      setError("Fehler beim Speichern. Bitte versuche es erneut.")
    } finally {
      setSaving(false)
    }
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
      <ProgressBar currentStep={1} />

      <div>
        <h2 className="text-xl font-bold text-foreground">
          Schritt 1: Dein Haartyp
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Waehle deinen Haartyp und deine Haarstruktur aus.
        </p>
      </div>

      {/* Hair Type Selection */}
      <div>
        <h3 className="mb-3 text-base font-semibold text-foreground">
          Haartyp
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {HAIR_TYPE_OPTIONS.map((option) => (
            <HairTypeCard
              key={option.value}
              label={option.label}
              value={option.value}
              selected={hairType === option.value}
              onClick={() => setHairType(option.value)}
              illustration={HAIR_TYPE_ILLUSTRATIONS[option.value]}
            />
          ))}
        </div>
      </div>

      {/* Hair Texture Selection */}
      <div>
        <h3 className="mb-3 text-base font-semibold text-foreground">
          Haarstruktur
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {HAIR_TEXTURE_OPTIONS.map((option) => (
            <HairTypeCard
              key={option.value}
              label={option.label}
              value={option.value}
              selected={hairTexture === option.value}
              onClick={() => setHairTexture(option.value)}
              illustration={HAIR_TEXTURE_ILLUSTRATIONS[option.value]}
            />
          ))}
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="flex justify-end">
        <Button onClick={handleNext} disabled={saving} size="lg">
          {saving ? "Speichern..." : "Weiter"}
        </Button>
      </div>
    </div>
  )
}
