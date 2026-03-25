"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/providers/toast-provider"
import { mergeAnsweredFields } from "@/lib/onboarding/answered-fields"
import {
  HAIR_DENSITY_LABELS,
  MECHANICAL_STRESS_FACTOR_OPTIONS,
  type HairDensity,
  type HairTexture,
  type MechanicalStressFactor,
} from "@/lib/vocabulary"
import { HAIR_TEXTURE_ADJECTIVE } from "@/lib/vocabulary/hair-types"

interface OnboardingProfileProps {
  hairTexture: HairTexture | null
  existingDensity: HairDensity | null
  existingFactors: MechanicalStressFactor[]
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

const FACTOR_DESCRIPTIONS: Record<MechanicalStressFactor, string> = {
  tight_hairstyles:
    "Frisuren mit Zug am Ansatz — zum Beispiel straffe Zoepfe, enge Dutts, Braids oder Extensions.",
  rough_brushing:
    "Haeufiges Buersten oder grobes Durchkaemmen, besonders bei knotigen oder nassen Haaren.",
  towel_rubbing:
    "Haare nach dem Waschen mit dem Handtuch trockenrubbeln statt sanft auszudruecken.",
}

export function OnboardingProfile({
  hairTexture,
  existingDensity,
  existingFactors,
  userId,
  hasProfile,
}: OnboardingProfileProps) {
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
    <ProfileForm
      hairTexture={hairTexture}
      existingDensity={existingDensity}
      existingFactors={existingFactors}
      userId={userId}
    />
  )
}

function ProfileForm({
  hairTexture,
  existingDensity,
  existingFactors,
  userId,
}: {
  hairTexture: HairTexture | null
  existingDensity: HairDensity | null
  existingFactors: MechanicalStressFactor[]
  userId: string
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [density, setDensity] = useState<HairDensity | "">(existingDensity ?? "")
  const [selected, setSelected] = useState<Set<MechanicalStressFactor>>(
    new Set(existingFactors),
  )
  const [touchedMechStress, setTouchedMechStress] = useState(false)
  const [noneMechStress, setNoneMechStress] = useState(false)
  const [saving, setSaving] = useState(false)

  function toggleFactor(factor: MechanicalStressFactor) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(factor)) next.delete(factor)
      else next.add(factor)
      return next
    })
    setTouchedMechStress(true)
    setNoneMechStress(false)
  }

  async function handleSave() {
    if (!density) return
    setSaving(true)

    const supabase = createClient()
    const updatePayload: Record<string, unknown> = {
      density,
      mechanical_stress_factors: [...selected],
      updated_at: new Date().toISOString(),
    }

    // Only mark mech stress as answered if user interacted with it
    if (touchedMechStress) {
      updatePayload.answered_fields = await mergeAnsweredFields(supabase, userId, ["mechanical_stress_factors"])
    }

    const { error } = await supabase
      .from("hair_profiles")
      .update(updatePayload)
      .eq("user_id", userId)

    if (error) {
      toast({ title: "Fehler beim Speichern. Bitte versuche es erneut.", variant: "destructive" })
      setSaving(false)
      return
    }

    router.push("/onboarding/routine")
  }

  const adjective = hairTexture ? HAIR_TEXTURE_ADJECTIVE[hairTexture] : null

  return (
    <div>
      {/* ── Section 1: Density ── */}
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

      {/* ── Section 2: Mechanical Stress (optional) ── */}
      <div
        className="animate-fade-in-up my-10 border-t border-white/10"
        style={{ animationDelay: "380ms" }}
      />

      <div
        className="animate-fade-in-up mb-1 flex items-center gap-2"
        style={{ animationDelay: "400ms" }}
      >
        <h2 className="font-header text-2xl leading-tight text-white">
          Mechanische Belastung
        </h2>
        <span className="rounded-full border border-white/15 px-2.5 py-0.5 text-[11px] tracking-wide text-white/40">
          Optional
        </span>
      </div>

      <p
        className="animate-fade-in-up mb-2 text-sm text-white/70"
        style={{ animationDelay: "420ms" }}
      >
        Mehrfachauswahl moeglich.
      </p>

      <p
        className="animate-fade-in-up mb-6 text-sm text-white/50"
        style={{ animationDelay: "440ms" }}
      >
        Mechanische Belastung beeinflusst, wie reichhaltig deine Pflege sein sollte.
      </p>

      <div className="space-y-3">
        {MECHANICAL_STRESS_FACTOR_OPTIONS.map(({ value, label }, i) => {
          const active = selected.has(value) && !noneMechStress
          return (
            <button
              key={value}
              type="button"
              onClick={() => toggleFactor(value)}
              className={`animate-fade-in-up w-full rounded-2xl border px-5 py-5 text-left transition-all duration-200 ${
                active
                  ? "border-[#F5C518] bg-[#F5C518]/15 text-white shadow-[0_0_0_1px_rgba(245,197,24,0.18)]"
                  : "border-white/10 bg-white/5 text-white/75 hover:border-white/25 hover:bg-white/8"
              }`}
              style={{ animationDelay: `${460 + i * 60}ms` }}
            >
              <div className="mb-1 font-header text-xl text-white">{label}</div>
              <div className="text-sm leading-relaxed text-white/70">
                {FACTOR_DESCRIPTIONS[value]}
              </div>
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => {
          setSelected(new Set())
          setTouchedMechStress(true)
          setNoneMechStress(true)
        }}
        disabled={saving}
        className={`animate-fade-in-up mt-4 w-full rounded-2xl border px-5 py-4 text-center text-sm transition-all ${
          noneMechStress
            ? "border-[#F5C518] bg-[#F5C518]/15 text-white/80 shadow-[0_0_0_1px_rgba(245,197,24,0.18)]"
            : "border-white/10 bg-white/5 text-white/60 hover:border-white/25 hover:text-white/80"
        }`}
        style={{ animationDelay: "640ms" }}
      >
        Nichts davon regelmaessig
      </button>

      {/* ── Save button ── */}
      <div
        className="animate-fade-in-up mt-8 flex justify-end"
        style={{ animationDelay: "700ms" }}
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
