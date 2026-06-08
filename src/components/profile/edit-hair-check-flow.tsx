"use client"

import { useCallback, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { QuizOptionCard } from "@/components/quiz/quiz-option-card"
import { createClient } from "@/lib/supabase/client"
import {
  toggleChemicalTreatmentValue,
  toggleConcernValue,
  type HairCheckEditConfig,
  type HairCheckProfileKey,
} from "@/lib/profile/hair-check-edit-config"
import type { ChemicalTreatment, HairProfile, ProfileConcern } from "@/lib/types"
import { useToast } from "@/providers/toast-provider"

type DraftState = {
  singleValue: string
  multiValues: string[]
  scalpType: string
  scalpCondition: string | null
}

type HairCheckSavePayload = {
  [K in HairCheckProfileKey]?: HairProfile[K]
} & {
  user_id: string
  updated_at: string
}

interface EditHairCheckFlowProps {
  userId: string
  config: HairCheckEditConfig
  hairProfile: HairProfile | null
  returnTo: string
}

function readStringValue(profile: HairProfile | null, key: HairCheckProfileKey): string {
  const value = profile?.[key]
  return typeof value === "string" ? value : ""
}

function readStringArray(profile: HairProfile | null, key: HairCheckProfileKey): string[] {
  const value = profile?.[key]
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : []
}

function hasOptionValue(
  options: readonly { value: string }[],
  value: string | null | undefined,
): value is string {
  return typeof value === "string" && options.some((option) => option.value === value)
}

function filterOptionValues(
  options: readonly { value: string }[],
  values: readonly string[],
  maxSelected?: number,
): string[] {
  const allowedValues = new Set(options.map((option) => option.value))
  const filteredValues: string[] = []

  for (const value of values) {
    if (!allowedValues.has(value) || filteredValues.includes(value)) continue

    filteredValues.push(value)
    if (maxSelected && filteredValues.length >= maxSelected) break
  }

  return filteredValues
}

function initialDraft(config: HairCheckEditConfig, profile: HairProfile | null): DraftState {
  if (config.mode === "scalp") {
    const scalpType = readStringValue(profile, "scalp_type")
    const scalpCondition = readStringValue(profile, "scalp_condition")

    return {
      singleValue: "",
      multiValues: [],
      scalpType: hasOptionValue(config.optionGroups[0].options, scalpType) ? scalpType : "",
      scalpCondition: hasOptionValue(config.optionGroups[1].options, scalpCondition)
        ? scalpCondition
        : null,
    }
  }

  if (config.mode === "multi") {
    return {
      singleValue: "",
      multiValues: filterOptionValues(
        config.options,
        readStringArray(profile, config.profileKeys[0]),
        config.maxSelected,
      ),
      scalpType: "",
      scalpCondition: null,
    }
  }

  const singleValue = readStringValue(profile, config.profileKeys[0])

  return {
    singleValue: hasOptionValue(config.options, singleValue) ? singleValue : "",
    multiValues: [],
    scalpType: "",
    scalpCondition: null,
  }
}

function buildSavePayload(
  userId: string,
  config: HairCheckEditConfig,
  draft: DraftState,
): HairCheckSavePayload {
  const base = {
    user_id: userId,
    updated_at: new Date().toISOString(),
  }

  if (config.mode === "scalp") {
    return {
      ...base,
      scalp_type: (draft.scalpType || null) as HairProfile["scalp_type"],
      scalp_condition: (draft.scalpCondition || null) as HairProfile["scalp_condition"],
    }
  }

  if (config.mode === "multi") {
    if (config.field === "chemical_treatment") {
      return {
        ...base,
        chemical_treatment: draft.multiValues as HairProfile["chemical_treatment"],
      }
    }

    return {
      ...base,
      concerns: draft.multiValues as HairProfile["concerns"],
    }
  }

  const key = config.profileKeys[0]
  return {
    ...base,
    [key]: (draft.singleValue || null) as HairProfile[typeof key],
  } as HairCheckSavePayload
}

export function EditHairCheckFlow({
  userId,
  config,
  hairProfile,
  returnTo,
}: EditHairCheckFlowProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [draft, setDraft] = useState<DraftState>(() => initialDraft(config, hairProfile))
  const [saving, setSaving] = useState(false)

  const canSave = useMemo(() => {
    if (config.mode === "single") return draft.singleValue.length > 0
    if (config.mode === "scalp") return draft.scalpType.length > 0
    if (config.field === "concerns") return true
    return draft.multiValues.length > 0
  }, [config, draft])

  const scalpConditionHasEmptyOption =
    config.mode === "scalp" &&
    config.optionGroups[1].options.some((option) => String(option.value) === "")

  const handleBack = useCallback(() => {
    router.push(returnTo)
  }, [router, returnTo])

  const handleSave = useCallback(async () => {
    if (saving || !canSave) return

    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("hair_profiles")
        .upsert(buildSavePayload(userId, config, draft), { onConflict: "user_id" })

      if (error) throw error

      toast({ title: "Profil aktualisiert" })
      router.push(returnTo)
    } catch (error) {
      console.error("[edit-hair-check-flow] save failed:", error)
      toast({
        title: "Speichern fehlgeschlagen. Bitte versuche es erneut.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }, [saving, canSave, userId, config, draft, toast, router, returnTo])

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={handleBack}
        className="mb-8 text-sm font-semibold text-primary underline-offset-4 hover:underline"
      >
        Zurück zum Profil
      </button>

      <div className="mb-7">
        <p className="type-overline text-primary">Haar-Check bearbeiten</p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-medium leading-[0.96] tracking-tight text-[var(--text-heading)] sm:text-5xl">
          {config.title}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">{config.description}</p>
      </div>

      {config.mode === "single" ? (
        <div className="space-y-3">
          {config.options.map((option, index) => (
            <QuizOptionCard
              key={option.value}
              icon={option.icon}
              label={option.label}
              description={option.description}
              active={draft.singleValue === option.value}
              onClick={() => setDraft((current) => ({ ...current, singleValue: option.value }))}
              animationDelay={index * 35}
            />
          ))}
        </div>
      ) : null}

      {config.mode === "multi" ? (
        <div className="space-y-3">
          {config.field === "concerns" ? (
            <QuizOptionCard
              icon="check"
              label="Nichts davon"
              active={draft.multiValues.length === 0}
              onClick={() => setDraft((current) => ({ ...current, multiValues: [] }))}
            />
          ) : null}

          {config.options.map((option, index) => {
            const active = draft.multiValues.includes(option.value)
            const disabled =
              config.field === "concerns" &&
              !active &&
              draft.multiValues.length >= (config.maxSelected ?? 3)

            return (
              <QuizOptionCard
                key={option.value}
                icon={option.icon}
                label={option.label}
                description={option.description}
                active={active}
                disabled={disabled}
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    multiValues:
                      config.field === "chemical_treatment"
                        ? toggleChemicalTreatmentValue(
                            current.multiValues as ChemicalTreatment[],
                            option.value as ChemicalTreatment,
                          )
                        : toggleConcernValue(
                            current.multiValues as ProfileConcern[],
                            option.value as ProfileConcern,
                            config.maxSelected,
                          ),
                  }))
                }
                animationDelay={(index + (config.field === "concerns" ? 1 : 0)) * 35}
              />
            )
          })}
        </div>
      ) : null}

      {config.mode === "scalp" ? (
        <div className="space-y-8">
          <div>
            <h2 className="mb-3 text-sm font-semibold text-[var(--text-heading)]">
              {config.optionGroups[0].title}
            </h2>
            <div className="space-y-3">
              {config.optionGroups[0].options.map((option, index) => (
                <QuizOptionCard
                  key={option.value}
                  icon={option.icon}
                  label={option.label}
                  description={option.description}
                  active={draft.scalpType === option.value}
                  onClick={() => setDraft((current) => ({ ...current, scalpType: option.value }))}
                  animationDelay={index * 35}
                />
              ))}
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold text-[var(--text-heading)]">
              {config.optionGroups[1].title}
            </h2>
            <div className="space-y-3">
              {!scalpConditionHasEmptyOption ? (
                <QuizOptionCard
                  icon="check"
                  label="Keine Beschwerden"
                  active={draft.scalpCondition === null}
                  onClick={() => setDraft((current) => ({ ...current, scalpCondition: null }))}
                />
              ) : null}

              {config.optionGroups[1].options.map((option, index) => (
                <QuizOptionCard
                  key={option.value}
                  icon={option.icon}
                  label={option.label}
                  description={option.description}
                  active={draft.scalpCondition === option.value}
                  onClick={() =>
                    setDraft((current) => ({ ...current, scalpCondition: option.value }))
                  }
                  animationDelay={(index + 1) * 35}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button type="button" variant="outline" className="sm:w-auto" onClick={handleBack}>
          Abbrechen
        </Button>
        <Button
          type="button"
          className="sm:flex-1"
          disabled={!canSave || saving}
          onClick={handleSave}
        >
          {saving ? "Speichern..." : "Speichern und zurück zum Profil"}
        </Button>
      </div>
    </div>
  )
}
