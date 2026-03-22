"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/providers/toast-provider"
import {
  MECHANICAL_STRESS_FACTOR_OPTIONS,
  type MechanicalStressFactor,
} from "@/lib/vocabulary"

interface OnboardingMechanicalStressProps {
  existingFactors: MechanicalStressFactor[]
  userId: string
}

const FACTOR_DESCRIPTIONS: Record<MechanicalStressFactor, string> = {
  tight_hairstyles:
    "Frisuren mit Zug am Ansatz — zum Beispiel straffe Zoepfe, enge Dutts, Braids oder Extensions.",
  rough_brushing:
    "Haeufiges Buersten oder grobes Durchkaemmen, besonders bei knotigen oder nassen Haaren.",
  towel_rubbing:
    "Haare nach dem Waschen mit dem Handtuch trockenrubbeln statt sanft auszudruecken.",
}

export function OnboardingMechanicalStress({
  existingFactors,
  userId,
}: OnboardingMechanicalStressProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [selected, setSelected] = useState<Set<MechanicalStressFactor>>(
    new Set(existingFactors),
  )
  const [saving, setSaving] = useState(false)

  function toggle(factor: MechanicalStressFactor) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(factor)) next.delete(factor)
      else next.add(factor)
      return next
    })
  }

  async function handleSave() {
    setSaving(true)

    const supabase = createClient()
    const { error } = await supabase
      .from("hair_profiles")
      .update({
        mechanical_stress_factors: [...selected],
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)

    if (error) {
      toast({ title: "Fehler beim Speichern. Bitte versuche es erneut.", variant: "destructive" })
      setSaving(false)
      return
    }

    router.push("/onboarding/goals")
  }

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
        Wie beanspruchst du dein Haar mechanisch?
      </h1>

      <p
        className="animate-fade-in-up mb-2 text-sm text-white/70"
        style={{ animationDelay: "100ms" }}
      >
        Optional. Mehrfachauswahl moeglich.
      </p>

      <p
        className="animate-fade-in-up mb-8 text-sm text-white/50"
        style={{ animationDelay: "140ms" }}
      >
        Mechanische Belastung beeinflusst, wie reichhaltig deine Pflege sein sollte.
      </p>

      <div className="space-y-3">
        {MECHANICAL_STRESS_FACTOR_OPTIONS.map(({ value, label }, i) => {
          const active = selected.has(value)
          return (
            <button
              key={value}
              type="button"
              onClick={() => toggle(value)}
              className={`animate-fade-in-up w-full rounded-2xl border px-5 py-5 text-left transition-all duration-200 ${
                active
                  ? "border-[#F5C518] bg-[#F5C518]/15 text-white shadow-[0_0_0_1px_rgba(245,197,24,0.18)]"
                  : "border-white/10 bg-white/5 text-white/75 hover:border-white/25 hover:bg-white/8"
              }`}
              style={{ animationDelay: `${180 + i * 60}ms` }}
            >
              <div className="mb-1 font-header text-xl text-white">{label}</div>
              <div className="text-sm leading-relaxed text-white/70">
                {FACTOR_DESCRIPTIONS[value]}
              </div>
            </button>
          )
        })}
      </div>

      <div
        className="animate-fade-in-up mt-8 flex items-center justify-between"
        style={{ animationDelay: "360ms" }}
      >
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="text-sm text-white/50 hover:text-white/80 transition-colors"
        >
          UEBERSPRINGEN
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="quiz-btn-primary disabled:opacity-50"
        >
          {saving ? "SPEICHERT..." : "WEITER ZU DEINEN ZIELEN"}
        </button>
      </div>
    </div>
  )
}
