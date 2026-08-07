"use client"

import type { ReactNode } from "react"

import { QuizOptionCard } from "@/components/quiz/quiz-option-card"
import type { IconName } from "@/components/ui/icon"
import type {
  AdditionalHeatTool,
  DryingRoute,
  DryShampooBridgePreference,
  DryShampooVisibleHairColor,
  HeatProtectionConsistency,
  NightProtection,
  OilPurpose,
  ProductFrequency,
  ScalpIrritationDetail,
  Stage2ProductCategory,
  TowelMaterial,
  TowelTechnique,
  WetWashFrequency,
} from "@/lib/personal-plan/refinement/types"
import { PRODUCT_FREQUENCY_LABELS } from "@/lib/vocabulary/frequencies"
import {
  NIGHT_PROTECTION_LABELS,
  TOWEL_MATERIAL_LABELS,
  TOWEL_TECHNIQUE_LABELS,
} from "@/lib/vocabulary/onboarding-care"
import { cn } from "@/lib/utils"

export type RefinementOption<T extends string> = {
  value: T
  label: string
  description?: string
  icon?: IconName
}

export const REFINEMENT_TELEMETRY_EVENTS = [
  "personal_plan_stage2_started",
  "personal_plan_stage2_question_viewed",
  "personal_plan_stage2_answer_saved",
  "personal_plan_stage2_save_failed",
  "personal_plan_stage2_resumed",
  "personal_plan_stage2_completed",
  "personal_plan_stage2_bridge_viewed",
] as const

export const REFINEMENT_CATEGORY_OPTIONS = [
  { value: "shampoo", label: "Shampoo", icon: "product-shampoo" },
  { value: "conditioner", label: "Conditioner", icon: "product-conditioner" },
  { value: "leave_in", label: "Leave-in", icon: "product-leave-in" },
  { value: "heat_protectant", label: "Hitzeschutz", icon: "heat-protection-yes" },
  { value: "oil", label: "Öl", icon: "product-oil" },
  { value: "mask", label: "Maske", icon: "product-mask" },
  { value: "scalp_care", label: "Kopfhautpflege", icon: "scalp-sensitive" },
  { value: "dry_shampoo", label: "Trockenshampoo", icon: "product-dry-shampoo" },
  { value: "bondbuilder", label: "Bondbuilder", icon: "product-bond-builder" },
  {
    value: "deep_cleansing_shampoo",
    label: "Tiefenreinigungsshampoo",
    icon: "product-deep-cleansing",
  },
] as const satisfies readonly RefinementOption<Stage2ProductCategory>[]

export const WET_WASH_FREQUENCY_OPTIONS = [
  {
    value: "does_not_wash",
    label: "Ich wasche meine Haare nicht nass / mit Shampoo",
    description: "Das bleibt eine eigene Antwort und wird nicht als seltene Wäsche gewertet.",
    icon: "heat-protection-no",
  },
  ...Object.entries(PRODUCT_FREQUENCY_LABELS).map(([value, label]) => ({
    value: value as ProductFrequency,
    label,
    icon: "clock" as const,
  })),
] as const satisfies readonly RefinementOption<WetWashFrequency>[]

export const SCALP_IRRITATION_OPTIONS = [
  {
    value: "mild_sensitive_or_itchy",
    label: "Leicht empfindlich oder juckend",
    description: "Kosmetische Kopfhautpflege bleibt vorsichtig möglich.",
    icon: "scalp-sensitive",
  },
  {
    value: "burning_painful_or_inflamed",
    label: "Brennend, schmerzhaft oder entzündet",
    description: "Wir pausieren kosmetische Kopfhaut-Empfehlungen und halten die Grenze klar.",
    icon: "scalp-irritated",
  },
] as const satisfies readonly RefinementOption<ScalpIrritationDetail>[]

export const DRY_SHAMPOO_BRIDGE_OPTIONS = [
  {
    value: "accept",
    label: "Ja, als gelegentliche Brücke",
    description: "Später wird ein konkretes Produkt nur erfasst, wenn es wirklich passt.",
    icon: "check",
  },
  {
    value: "decline",
    label: "Nein, lieber nicht",
    description: "Dann planen wir ohne Trockenshampoo-Brücke weiter.",
    icon: "heat-protection-no",
  },
] as const satisfies readonly RefinementOption<DryShampooBridgePreference>[]

export const ROOT_COLOR_OPTIONS = [
  { value: "light_blonde", label: "Hell / blond", icon: "goal-shine" },
  { value: "brown", label: "Braun", icon: "treatment-colored" },
  { value: "dark", label: "Dunkel", icon: "night-silk-pillow" },
] as const satisfies readonly RefinementOption<DryShampooVisibleHairColor>[]

export const OIL_PURPOSE_OPTIONS = [
  {
    value: "prewash_lengths",
    label: "Vor der Wäsche in Längen oder Spitzen",
    description: "Als Pre-Wash-Schritt, nicht als Finish.",
    icon: "goal-time-saving",
  },
  {
    value: "damp_leave_on",
    label: "Im feuchten Haar als Leave-on",
    description: "Für Längen, Definition oder geschmeidigeres Gefühl.",
    icon: "goal-moisture",
  },
  {
    value: "dry_finish",
    label: "Im trockenen Haar als Finish",
    description: "Zum Glätten, Bündeln oder für Glanz.",
    icon: "surface-smooth",
  },
  {
    value: "scalp",
    label: "Auf der Kopfhaut",
    description: "Die Anwendung wird später getrennt geprüft.",
    icon: "scalp-normal",
  },
] as const satisfies readonly RefinementOption<OilPurpose>[]

export const TOWEL_MATERIAL_OPTIONS = (
  ["frottee", "mikrofaser", "tshirt", "turban_mikrofaser", "no_towel"] as const
).map((value) => ({
  value,
  label:
    value === "no_towel"
      ? "Kein Handtuch oder Tuch"
      : TOWEL_MATERIAL_LABELS[value as keyof typeof TOWEL_MATERIAL_LABELS],
  icon:
    value === "frottee"
      ? "towel-frottee"
      : value === "mikrofaser"
        ? "towel-mikrofaser"
        : value === "tshirt"
          ? "towel-tshirt"
          : value === "turban_mikrofaser"
            ? "towel-turban"
            : "heat-protection-no",
})) as readonly RefinementOption<TowelMaterial>[]

export const TOWEL_TECHNIQUE_OPTIONS = (["gentle_press", "rough_rubbing"] as const).map(
  (value) => ({
    value,
    label: TOWEL_TECHNIQUE_LABELS[value],
    icon: value === "gentle_press" ? "technique-gentle-press" : "technique-rough-rubbing",
  }),
) as readonly RefinementOption<TowelTechnique>[]

export const DRYING_ROUTE_OPTIONS = [
  { value: "air_dry", label: "Lufttrocknen", icon: "drying-air" },
  { value: "ordinary_blow_dry", label: "Gewöhnlich föhnen", icon: "drying-blow" },
  {
    value: "diffuser_or_airflow_shaping",
    label: "Diffusor oder formender Luftstrom",
    icon: "drying-diffuser",
  },
] as const satisfies readonly RefinementOption<DryingRoute>[]

export const ADDITIONAL_HEAT_TOOL_OPTIONS = [
  { value: "dryer_brush", label: "Föhnbürste", icon: "brush-round" },
  {
    value: "hot_air_styler",
    label: "Heißluft-Multistyler",
    description: "Zum Beispiel Airwrap-ähnliche Tools.",
    icon: "heat-multi-tool",
  },
  { value: "straightener", label: "Glätteisen", icon: "heat-tool" },
  {
    value: "curling_or_wave_iron",
    label: "Lockenstab oder Welleneisen",
    icon: "heat-curling-iron",
  },
  { value: "thermal_rollers", label: "Thermo-Wickler", icon: "heat-thermal-rollers" },
] as const satisfies readonly RefinementOption<AdditionalHeatTool>[]

export const HEAT_PROTECTION_OPTIONS = [
  { value: "always", label: "Immer", icon: "heat-protection-yes" },
  { value: "sometimes", label: "Manchmal", icon: "help" },
  { value: "no", label: "Nein", icon: "heat-protection-no" },
  { value: "unsure", label: "Unsicher", icon: "help" },
] as const satisfies readonly RefinementOption<HeatProtectionConsistency>[]

export const NIGHT_PROTECTION_OPTIONS = Object.entries(NIGHT_PROTECTION_LABELS).map(
  ([value, label]) => ({
    value: value as NightProtection,
    label:
      value === "silk_satin_pillow"
        ? "Satin- oder Seidenkissenbezug"
        : value === "silk_satin_bonnet"
          ? "Satin- oder Seidenhaube"
          : label,
    icon:
      value === "silk_satin_pillow"
        ? "night-silk-pillow"
        : value === "silk_satin_bonnet"
          ? "night-silk-bonnet"
          : value === "loose_tied"
            ? "night-loose-braid"
            : value === "pineapple"
              ? "night-pineapple"
              : "night-length-accessory",
  }),
) as readonly RefinementOption<NightProtection>[]

export function orderValues<T extends string>(
  values: readonly T[],
  order: readonly RefinementOption<T>[],
): T[] {
  const selected = new Set(values)
  return order.map((option) => option.value).filter((value) => selected.has(value))
}

export function mergeGroupedCategorySelection({
  currentSelection,
  groupValues,
  nextGroupSelection,
}: {
  currentSelection: readonly Stage2ProductCategory[]
  groupValues: readonly Stage2ProductCategory[]
  nextGroupSelection: readonly Stage2ProductCategory[]
}): Stage2ProductCategory[] {
  const group = new Set(groupValues)
  return orderValues(
    [...currentSelection.filter((value) => !group.has(value)), ...nextGroupSelection],
    REFINEMENT_CATEGORY_OPTIONS,
  )
}

export function RefinementOptions<T extends string>({
  options,
  value,
  multi,
  onChange,
  onNoneChange,
  allowNone,
  noneLabel = "Nichts davon",
  noneDescription = "Diese Frage bewusst leer abschließen.",
  className,
}: {
  options: readonly RefinementOption<T>[]
  value: T | T[] | undefined
  multi?: boolean
  onChange: (value: T | T[]) => void
  onNoneChange?: () => void
  allowNone?: boolean
  noneLabel?: string
  noneDescription?: string
  className?: string
}) {
  const selectedValues = Array.isArray(value) ? value : []

  return (
    <div className={cn("grid gap-2.5", className)}>
      {options.map((option, index) => {
        const active = multi ? selectedValues.includes(option.value) : value === option.value
        return (
          <QuizOptionCard
            key={option.value}
            icon={option.icon}
            label={option.label}
            description={option.description}
            active={active}
            multi={multi}
            animationDelay={index * 18}
            onClick={() => {
              if (!multi) {
                onChange(option.value)
                return
              }
              const next = active
                ? selectedValues.filter((current) => current !== option.value)
                : orderValues([...selectedValues, option.value], options)
              onChange(next)
            }}
          />
        )
      })}
      {multi && allowNone ? (
        <button
          type="button"
          aria-pressed={Array.isArray(value) && value.length === 0}
          aria-label={`${noneLabel}; andere Auswahl wird gelöscht`}
          onClick={() => (onNoneChange ? onNoneChange() : onChange([]))}
          className={cn(
            "mt-1 min-h-11 rounded-full border px-4 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-plum-rgb),0.35)]",
            Array.isArray(value) && value.length === 0
              ? "border-[var(--brand-plum)] bg-[var(--brand-plum-ice)] text-[var(--brand-plum-darkest)]"
              : "border-border bg-transparent text-[var(--text-sub)] hover:border-[var(--brand-plum-light)]",
          )}
        >
          <span className="block">{noneLabel}</span>
          <span className="block text-xs font-normal leading-5">{noneDescription}</span>
        </button>
      ) : null}
    </div>
  )
}

export function RefinementInlineNote({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 rounded-xl bg-[var(--brand-plum-ice)] px-3 py-2.5 text-xs leading-5 text-[var(--text-sub)]">
      {children}
    </p>
  )
}
