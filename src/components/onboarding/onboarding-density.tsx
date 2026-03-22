"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/providers/toast-provider"
import {
  HAIR_DENSITY_LABELS,
  type HairDensity,
  type HairTexture,
} from "@/lib/vocabulary"
import { HAIR_TEXTURE_ADJECTIVE } from "@/lib/vocabulary/hair-types"

interface OnboardingDensityProps {
  hairTexture: HairTexture | null
  existingDensity: HairDensity | null
  userId: string
  hasProfile: boolean
}

const DENSITY_COPY: Record<HairDensity, { title: string; body: string }> = {
  low: {
    title: "Eher wenig Haare",
    body: "Du hast weniger Haare pro Flaeche. Das ist etwas anderes als feine oder dicke einzelne Haare.",
  },
  medium: {
    title: "Mittlere Dichte",
    body: "Du liegst in der Mitte: weder besonders wenig noch besonders viele Haare pro Flaeche.",
  },
  high: {
    title: "Viele Haare",
    body: "Du hast viele Haare pro Flaeche. Produkte duerfen oft etwas mehr Kontrolle und Reichhaltigkeit mitbringen.",
  },
}

export function OnboardingDensity({
  hairTexture,
  existingDensity,
  userId,
  hasProfile,
}: OnboardingDensityProps) {
  const router = useRouter()

  if (!hasProfile) {
    return (
      <div className="animate-fade-in-up py-12 text-center">
        <p className="mb-4 text-lg text-white/70">
          Bitte absolviere zuerst das Haar-Quiz, damit wir dein Profil anlegen koennen.
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

  return (
    <DensitySelector
      hairTexture={hairTexture}
      existingDensity={existingDensity}
      userId={userId}
    />
  )
}

function DensitySelector({
  hairTexture,
  existingDensity,
  userId,
}: {
  hairTexture: HairTexture | null
  existingDensity: HairDensity | null
  userId: string
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [density, setDensity] = useState<HairDensity | "">(existingDensity ?? "")
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!density) return
    setSaving(true)

    const supabase = createClient()
    const { error } = await supabase
      .from("hair_profiles")
      .update({
        density,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)

    if (error) {
      toast({ title: "Fehler beim Speichern. Bitte versuche es erneut.", variant: "destructive" })
      setSaving(false)
      return
    }

    router.push("/onboarding/mechanical-stress")
  }

  const adjective = hairTexture ? HAIR_TEXTURE_ADJECTIVE[hairTexture] : null

  return (
    <div>
      <div className="animate-fade-in-up mb-2">
        <span className="font-header text-xs tracking-[0.2em] text-[#F5C518]">
          DEIN HAARPROFIL
        </span>
      </div>

      <h1
        className="animate-fade-in-up mb-2 font-header text-3xl leading-tight text-white"
        style={{ animationDelay: "50ms" }}
      >
        Wie dicht ist dein {adjective ? `${adjective} Haar` : "Haar"}?
      </h1>

      <p
        className="animate-fade-in-up mb-2 text-sm text-white/70"
        style={{ animationDelay: "100ms" }}
      >
        Gemeint ist die Menge an Haaren pro Flaeche, nicht die Dicke eines einzelnen Haares.
      </p>

      <p
        className="animate-fade-in-up mb-8 text-sm text-white/50"
        style={{ animationDelay: "140ms" }}
      >
        TomBot nutzt das spaeter, um Conditioner und Stylingprodukte leichter oder reichhaltiger einzuordnen.
      </p>

      <div className="space-y-3">
        {(["low", "medium", "high"] as const).map((value, i) => {
          const active = density === value
          const copy = DENSITY_COPY[value]
          return (
            <button
              key={value}
              type="button"
              onClick={() => setDensity(value)}
              className={`animate-fade-in-up w-full rounded-2xl border px-5 py-5 text-left transition-all duration-200 ${
                active
                  ? "border-[#F5C518] bg-[#F5C518]/15 text-white shadow-[0_0_0_1px_rgba(245,197,24,0.18)]"
                  : "border-white/10 bg-white/5 text-white/75 hover:border-white/25 hover:bg-white/8"
              }`}
              style={{ animationDelay: `${180 + i * 60}ms` }}
            >
              <div className="mb-2 text-xs font-semibold tracking-[0.16em] text-[#F5C518]">
                {HAIR_DENSITY_LABELS[value].toUpperCase()}
              </div>
              <div className="mb-1 font-header text-xl text-white">{copy.title}</div>
              <div className="text-sm leading-relaxed text-white/70">{copy.body}</div>
            </button>
          )
        })}
      </div>

      <div
        className="animate-fade-in-up mt-8 flex justify-end"
        style={{ animationDelay: "360ms" }}
      >
        <button
          type="button"
          onClick={handleSave}
          disabled={!density || saving}
          className="quiz-btn-primary disabled:opacity-50"
        >
          {saving ? "SPEICHERT..." : "WEITER"}
        </button>
      </div>
    </div>
  )
}
