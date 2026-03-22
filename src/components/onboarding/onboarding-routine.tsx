"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/providers/toast-provider"
import {
  WASH_FREQUENCY_OPTIONS,
  HEAT_STYLING_OPTIONS,
  POST_WASH_ACTION_OPTIONS,
  ROUTINE_PREFERENCE_OPTIONS,
  ROUTINE_PRODUCT_OPTIONS,
} from "@/lib/types"
import type {
  WashFrequency,
  HeatStyling,
} from "@/lib/vocabulary"

interface OnboardingRoutineProps {
  existingWashFrequency: WashFrequency | null
  existingHeatStyling: HeatStyling | null
  existingPostWashActions: string[]
  existingRoutinePreference: string | null
  existingRoutineProducts: string[]
  userId: string
}

export function OnboardingRoutine({
  existingWashFrequency,
  existingHeatStyling,
  existingPostWashActions,
  existingRoutinePreference,
  existingRoutineProducts,
  userId,
}: OnboardingRoutineProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [washFrequency, setWashFrequency] = useState<WashFrequency | "">(
    existingWashFrequency ?? ""
  )
  const [heatStyling, setHeatStyling] = useState<HeatStyling | "">(
    existingHeatStyling ?? ""
  )
  const [selectedPostWashActions, setSelectedPostWashActions] = useState<Set<string>>(
    () => new Set(existingPostWashActions)
  )
  const [routinePreference, setRoutinePreference] = useState(
    existingRoutinePreference ?? ""
  )
  const [selectedRoutineProducts, setSelectedRoutineProducts] = useState<Set<string>>(
    () => new Set(existingRoutineProducts)
  )
  const [saving, setSaving] = useState(false)

  function toggleSetValue(
    setState: (updater: (prev: Set<string>) => Set<string>) => void,
    key: string
  ) {
    setState((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleSave() {
    if (!washFrequency) return
    setSaving(true)

    const supabase = createClient()
    const { error } = await supabase
      .from("hair_profiles")
      .update({
        wash_frequency: washFrequency,
        heat_styling: heatStyling || null,
        post_wash_actions: [...selectedPostWashActions],
        routine_preference: routinePreference || null,
        current_routine_products: [...selectedRoutineProducts],
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
          DEINE PFLEGEROUTINE
        </span>
      </div>

      <h1
        className="animate-fade-in-up mb-2 font-header text-3xl leading-tight text-white"
        style={{ animationDelay: "50ms" }}
      >
        Wie pflegst du dein Haar aktuell?
      </h1>

      <p
        className="animate-fade-in-up mb-8 text-sm text-white/50"
        style={{ animationDelay: "100ms" }}
      >
        TomBot nutzt das, um deine Routine realistisch einzuordnen und passende Schritte vorzuschlagen.
      </p>

      {/* Section 1: Wash frequency (required) */}
      <div className="mb-8 animate-fade-in-up" style={{ animationDelay: "140ms" }}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-header text-2xl leading-tight text-white">
            Wie oft waeschst du deine Haare?
          </h2>
          <span className="rounded-full border border-[#F5C518]/30 bg-[#F5C518]/10 px-2.5 py-1 text-[11px] font-semibold tracking-[0.14em] text-[#F5C518]">
            PFLICHT
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {WASH_FREQUENCY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setWashFrequency(option.value)}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                washFrequency === option.value
                  ? "border-[#F5C518] bg-[#F5C518] text-[#1A1618]"
                  : "border-white/20 text-white/70 hover:border-white/35 hover:text-white"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Section 2: Products per wash (multi-select) */}
      <div className="mb-8 animate-fade-in-up" style={{ animationDelay: "200ms" }}>
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

      {/* Section 3: Heat tool frequency (single-select) */}
      <div className="mb-8 animate-fade-in-up" style={{ animationDelay: "260ms" }}>
        <h2 className="font-header text-2xl leading-tight text-white mb-2">
          Wie oft nutzt du Hitzetools?
        </h2>
        <div className="flex flex-wrap gap-2">
          {HEAT_STYLING_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setHeatStyling(option.value)}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                heatStyling === option.value
                  ? "border-[#F5C518] bg-[#F5C518] text-[#1A1618]"
                  : "border-white/20 text-white/70 hover:border-white/35 hover:text-white"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Section 4: Post-wash actions (multi-select) */}
      <div className="mb-8 animate-fade-in-up" style={{ animationDelay: "320ms" }}>
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

      {/* Section 5: Routine preference (single-select) */}
      <div className="mb-8 animate-fade-in-up" style={{ animationDelay: "380ms" }}>
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

      {/* Save button */}
      <div className="animate-fade-in-up" style={{ animationDelay: "440ms" }}>
        {!washFrequency && (
          <p className="mb-3 text-sm text-[#F5C518]">
            Bitte waehle zuerst aus, wie oft du deine Haare waeschst.
          </p>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={!washFrequency || saving}
          className="quiz-btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? "SPEICHERN..." : "WEITER ZU DEINEN ZIELEN"}
        </button>
      </div>
    </div>
  )
}
