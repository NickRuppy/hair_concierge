"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/providers/toast-provider"
import { mergeAnsweredFields } from "@/lib/onboarding/answered-fields"
import {
  WASH_FREQUENCY_OPTIONS,
  HEAT_STYLING_OPTIONS,
  POST_WASH_ACTION_OPTIONS,
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
  postWashWasAnswered: boolean
  existingRoutineProducts: string[]
  routineProductsWereAnswered: boolean
  userId: string
}

export function OnboardingRoutine({
  existingWashFrequency,
  existingHeatStyling,
  existingPostWashActions,
  postWashWasAnswered,
  existingRoutineProducts,
  routineProductsWereAnswered,
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
  const [selectedRoutineProducts, setSelectedRoutineProducts] = useState<Set<string>>(
    () => new Set(existingRoutineProducts)
  )
  const [saving, setSaving] = useState(false)
  const [touchedPostWash, setTouchedPostWash] = useState(false)
  const [touchedProducts, setTouchedProducts] = useState(false)
  const [nonePostWash, setNonePostWash] = useState(
    postWashWasAnswered && existingPostWashActions.length === 0
  )
  const [noneProducts, setNoneProducts] = useState(
    routineProductsWereAnswered && existingRoutineProducts.length === 0
  )

  function toggleSetValue(
    setState: (updater: (prev: Set<string>) => Set<string>) => void,
    key: string,
    onTouch: () => void
  ) {
    setState((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
    onTouch()
  }

  async function handleSave() {
    if (!washFrequency) return
    setSaving(true)

    const fieldsAnswered: string[] = []
    if (touchedPostWash) fieldsAnswered.push("post_wash_actions")
    if (touchedProducts) fieldsAnswered.push("current_routine_products")

    const supabase = createClient()
    let answeredFieldsUpdate: string[] = []
    if (fieldsAnswered.length > 0) {
      answeredFieldsUpdate = await mergeAnsweredFields(supabase, userId, fieldsAnswered)
    }

    const updatePayload: Record<string, unknown> = {
      wash_frequency: washFrequency,
      heat_styling: heatStyling || null,
      post_wash_actions: [...selectedPostWashActions],
      current_routine_products: [...selectedRoutineProducts],
      updated_at: new Date().toISOString(),
    }
    if (answeredFieldsUpdate.length > 0) {
      updatePayload.answered_fields = answeredFieldsUpdate
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

    // Mark onboarding as complete (moved here from goals page)
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ onboarding_completed: true })
      .eq("id", userId)

    if (profileError) {
      console.error("Failed to mark onboarding_completed:", profileError)
    }

    router.push("/chat")
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

      {/* Section 1: Wash frequency (required, no PFLICHT badge) */}
      <div className="mb-8 animate-fade-in-up" style={{ animationDelay: "140ms" }}>
        <h2 className="font-header text-2xl leading-tight text-white mb-3">
          Wie oft waeschst du deine Haare regelmaessig?
        </h2>
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
          Welche Produkte nutzt du regelmaessig?
        </h2>
        <p className="text-sm text-white/50 mb-4">Mehrfachauswahl moeglich.</p>
        <div className="flex flex-wrap gap-2">
          {ROUTINE_PRODUCT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => toggleSetValue(setSelectedRoutineProducts, option.value, () => { setTouchedProducts(true); setNoneProducts(false) })}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                selectedRoutineProducts.has(option.value)
                  ? "border-[#F5C518] bg-[#F5C518] text-[#1A1618]"
                  : "border-white/20 text-white/70 hover:border-white/35 hover:text-white"
              }`}
            >
              {option.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setSelectedRoutineProducts(new Set())
              setTouchedProducts(true)
              setNoneProducts(true)
            }}
            className={`mt-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
              noneProducts && selectedRoutineProducts.size === 0
                ? "border-[#F5C518] bg-[#F5C518] text-[#1A1618]"
                : "border-white/20 text-white/70 hover:border-white/35 hover:text-white"
            }`}
          >
            Nichts davon regelmaessig
          </button>
        </div>
      </div>

      {/* Section 3: Post-wash actions (multi-select) */}
      <div className="mb-8 animate-fade-in-up" style={{ animationDelay: "260ms" }}>
        <h2 className="font-header text-2xl leading-tight text-white mb-2">
          Was machst du regelmaessig nach dem Waschen?
        </h2>
        <p className="text-sm text-white/50 mb-4">Mehrfachauswahl moeglich.</p>
        <div className="flex flex-wrap gap-2">
          {POST_WASH_ACTION_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => toggleSetValue(setSelectedPostWashActions, option.value, () => { setTouchedPostWash(true); setNonePostWash(false) })}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                selectedPostWashActions.has(option.value)
                  ? "border-[#F5C518] bg-[#F5C518] text-[#1A1618]"
                  : "border-white/20 text-white/70 hover:border-white/35 hover:text-white"
              }`}
            >
              {option.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setSelectedPostWashActions(new Set())
              setTouchedPostWash(true)
              setNonePostWash(true)
            }}
            className={`mt-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
              nonePostWash && selectedPostWashActions.size === 0
                ? "border-[#F5C518] bg-[#F5C518] text-[#1A1618]"
                : "border-white/20 text-white/70 hover:border-white/35 hover:text-white"
            }`}
          >
            Nichts davon regelmaessig
          </button>
        </div>
      </div>

      {/* Section 4: Heat tool frequency (single-select) */}
      <div className="mb-8 animate-fade-in-up" style={{ animationDelay: "320ms" }}>
        <h2 className="font-header text-2xl leading-tight text-white mb-2">
          Wie oft nutzt du regelmaessig Hitzetools?
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
          {saving ? "SPEICHERN..." : "PROFIL ABSCHLIESSEN"}
        </button>
      </div>
    </div>
  )
}
