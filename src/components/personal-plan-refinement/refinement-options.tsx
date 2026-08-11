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
import { PRODUCT_FREQUENCIES, PRODUCT_FREQUENCY_LABELS } from "@/lib/vocabulary/frequencies"
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
  "personal_plan_stage2_handoff_failed",
] as const

export const REFINEMENT_CATEGORY_OPTIONS = [
  {
    value: "shampoo",
    label: "Shampoo",
    description: "Reinigung für Kopfhaut und Haar.",
    icon: "product-shampoo",
  },
  {
    value: "conditioner",
    label: "Conditioner",
    description: "Ausspülbare Pflege nach der Haarwäsche.",
    icon: "product-conditioner",
  },
  {
    value: "leave_in",
    label: "Leave-in",
    description: "Pflege, die im Haar bleibt und nicht ausgespült wird.",
    icon: "product-leave-in",
  },
  {
    value: "heat_protectant",
    label: "Hitzeschutz",
    description: "Produkt, das du vor Föhn, Glätteisen oder anderer direkter Hitze verwendest.",
    icon: "heat-protection-yes",
  },
  {
    value: "oil",
    label: "Öl",
    description: "Öl für Längen, Spitzen oder als Vorwäsche.",
    icon: "product-oil",
  },
  {
    value: "mask",
    label: "Maske",
    description: "Intensivere, meist ausspülbare Pflege.",
    icon: "product-mask",
  },
  {
    value: "scalp_care",
    label: "Kopfhautpflege",
    description: "Serum, Tonic oder Peeling, das direkt auf die Kopfhaut kommt.",
    icon: "scalp-sensitive",
  },
  {
    value: "dry_shampoo",
    label: "Trockenshampoo",
    description: "Frischt den Ansatz zwischen Haarwäschen auf.",
    icon: "product-dry-shampoo",
  },
  {
    value: "bondbuilder",
    label: "Bondbuilder",
    description: "Spezielle Strukturpflege, zum Beispiel für chemisch behandeltes Haar.",
    icon: "product-bond-builder",
  },
  {
    value: "deep_cleansing_shampoo",
    label: "Tiefenreinigungsshampoo",
    description: "Stärkere Reinigung gegen hartnäckige Rückstände.",
    icon: "product-deep-cleansing",
  },
] as const satisfies readonly RefinementOption<Stage2ProductCategory>[]

export const WET_WASH_FREQUENCY_OPTIONS = [
  ...[...PRODUCT_FREQUENCIES].reverse().map((value) => ({
    value: value as ProductFrequency,
    label: PRODUCT_FREQUENCY_LABELS[value],
    icon: "clock" as const,
  })),
  {
    value: "does_not_wash",
    label: "Ich wasche meine Haare nicht nass / mit Shampoo",
    icon: "heat-protection-no",
  },
] as const satisfies readonly RefinementOption<WetWashFrequency>[]

export const SCALP_IRRITATION_OPTIONS = [
  {
    value: "normal",
    label: "Fühlt sich normal an",
    description: "Aktuell bemerkst du keine Reizung oder Schmerzen.",
    icon: "scalp-normal",
  },
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
    label: "Ja, gelegentlich zwischen den Wäschen",
    description: "Ein konkretes Produkt prüfen wir später getrennt.",
    icon: "check",
  },
  {
    value: "decline",
    label: "Nein, lieber nicht",
    description: "Dann planen wir ohne Trockenshampoo weiter.",
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
    label: "Im feuchten Haar als Leave-in",
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
  noneAriaLabel,
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
  noneAriaLabel?: string
  className?: string
}) {
  const selectedValues = Array.isArray(value) ? value : []

  return (
    <div className={cn("grid grid-cols-1 gap-2.5", className)}>
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
        <div className="mt-1 opacity-[0.92]" data-refinement-none-option>
          <QuizOptionCard
            ariaLabel={noneAriaLabel}
            label={noneLabel}
            description={noneDescription}
            active={Array.isArray(value) && value.length === 0}
            multi
            onClick={() => (onNoneChange ? onNoneChange() : onChange([]))}
          />
        </div>
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
