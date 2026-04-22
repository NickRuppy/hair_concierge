import {
  CHEMICAL_TREATMENT_LABELS,
  PROFILE_CONCERN_LABELS,
  CUTICLE_CONDITION_LABELS,
  GOAL_LABELS,
  HAIR_TEXTURE_OPTIONS,
  HAIR_THICKNESS_OPTIONS,
  HEAT_STYLING_OPTIONS,
  PROTEIN_MOISTURE_LABELS,
  SCALP_CONDITION_LABELS,
  SCALP_TYPE_LABELS,
  STYLING_TOOL_LABELS,
} from "@/lib/types"
import type { HairProfile } from "@/lib/types"
import { getGoalLabel, getOrderedGoals } from "@/lib/onboarding/goal-flow"
import type { OnboardingStep } from "@/lib/onboarding/store"
import {
  BRUSH_TYPE_LABELS,
  DRYING_METHOD_LABELS,
  NIGHT_PROTECTION_LABELS,
  TOWEL_MATERIAL_LABELS,
  TOWEL_TECHNIQUE_LABELS,
} from "@/lib/vocabulary"

export type ProfileJourneySectionKey =
  | "quiz"
  | "products"
  | "styling"
  | "routine"
  | "goals"
  | "memory"
export type ProfileFieldSourceLabel = "Aus Haar-Check" | "Aus Onboarding"
export type ProfileFieldValue = string | string[] | null

export type ProfileEditTarget =
  | { kind: "quiz" }
  | { kind: "onboarding"; step: OnboardingStep }
  | { kind: "profile-edit-goals" }

export type ProfileFieldConfig = {
  key: string
  label: string
  sectionKey: Exclude<ProfileJourneySectionKey, "products" | "memory">
  sourceLabel: ProfileFieldSourceLabel
  editTarget: ProfileEditTarget
  getValue: (profile: HairProfile | null) => ProfileFieldValue
}

export type ProfileSectionMeta = {
  key: ProfileJourneySectionKey
  title: string
  description: string
}

function optionLabel(
  value: string | null | undefined,
  options: Array<{ value: string; label: string }>,
): string | null {
  if (!value) return null
  return options.find((option) => option.value === value)?.label ?? value
}

function optionLabels(
  values: string[] | null | undefined,
  labels: Record<string, string>,
): string[] | null {
  if (!values || values.length === 0) return null
  return values.map((value) => labels[value] ?? value)
}

function orderedGoalLabels(profile: HairProfile | null): string[] | null {
  if (!profile) return null

  const selectedGoals = new Set(profile.goals ?? [])

  if (profile.desired_volume === "more") {
    selectedGoals.add("volume")
  }

  if (profile.desired_volume === "less") {
    selectedGoals.add("less_volume")
  }

  if (selectedGoals.size === 0) return null

  const ordered =
    profile.hair_texture != null
      ? getOrderedGoals(profile.hair_texture).filter((goal) => selectedGoals.has(goal))
      : []

  const remainder = Array.from(selectedGoals).filter((goal) => !ordered.includes(goal))
  const goals = [...ordered, ...remainder]

  return goals.map((goal) =>
    profile.hair_texture != null
      ? getGoalLabel(goal, profile.hair_texture)
      : (GOAL_LABELS[goal] ?? goal),
  )
}

export const PROFILE_SECTION_META: ProfileSectionMeta[] = [
  {
    key: "quiz",
    title: "Haar-Check",
    description: "Die Antworten aus deinem Haar-Check in derselben Reihenfolge wie im Quiz.",
  },
  {
    key: "products",
    title: "Produkte",
    description: "Welche Produkte du im Onboarding ausgewählt und genauer beschrieben hast.",
  },
  {
    key: "styling",
    title: "Styling",
    description: "Hitzetools, Frequenz und Hitzeschutz aus dem Styling-Teil des Onboardings.",
  },
  {
    key: "routine",
    title: "Alltag",
    description: "Trocknen, Bürste und Nachtschutz aus dem Alltagsteil deines Onboardings.",
  },
  {
    key: "goals",
    title: "Ziele",
    description: "Deine ausgewählten Haarziele aus dem Haar-Check.",
  },
  {
    key: "memory",
    title: "Erinnerungen",
    description: "Hinweise aus dem Chat, langfristig gespeichert.",
  },
]

export const PROFILE_JOURNEY_STEPS = [
  { key: "quiz", label: "Haar-Check" },
  { key: "products", label: "Produkte" },
  { key: "styling", label: "Styling" },
  { key: "routine", label: "Alltag" },
  { key: "goals", label: "Ziele" },
  { key: "memory", label: "Erinnerungen" },
] as const

export const PROFILE_FIELD_CONFIG: ProfileFieldConfig[] = [
  {
    key: "hair_texture",
    label: "Haartextur",
    sectionKey: "quiz",
    sourceLabel: "Aus Haar-Check",
    editTarget: { kind: "quiz" },
    getValue: (profile) => optionLabel(profile?.hair_texture, HAIR_TEXTURE_OPTIONS),
  },
  {
    key: "thickness",
    label: "Haar-Dicke",
    sectionKey: "quiz",
    sourceLabel: "Aus Haar-Check",
    editTarget: { kind: "quiz" },
    getValue: (profile) => optionLabel(profile?.thickness, HAIR_THICKNESS_OPTIONS),
  },
  {
    key: "cuticle_condition",
    label: "Oberfläche",
    sectionKey: "quiz",
    sourceLabel: "Aus Haar-Check",
    editTarget: { kind: "quiz" },
    getValue: (profile) =>
      profile?.cuticle_condition
        ? (CUTICLE_CONDITION_LABELS[profile.cuticle_condition] ?? profile.cuticle_condition)
        : null,
  },
  {
    key: "protein_moisture_balance",
    label: "Elastizität",
    sectionKey: "quiz",
    sourceLabel: "Aus Haar-Check",
    editTarget: { kind: "quiz" },
    getValue: (profile) =>
      profile?.protein_moisture_balance
        ? (PROTEIN_MOISTURE_LABELS[profile.protein_moisture_balance] ??
          profile.protein_moisture_balance)
        : null,
  },
  {
    key: "chemical_treatment",
    label: "Chemische Behandlungen",
    sectionKey: "quiz",
    sourceLabel: "Aus Haar-Check",
    editTarget: { kind: "quiz" },
    getValue: (profile) =>
      profile?.chemical_treatment?.length
        ? profile.chemical_treatment.map(
            (treatment) => CHEMICAL_TREATMENT_LABELS[treatment] ?? treatment,
          )
        : null,
  },
  {
    key: "scalp_type",
    label: "Kopfhauttyp",
    sectionKey: "quiz",
    sourceLabel: "Aus Haar-Check",
    editTarget: { kind: "quiz" },
    getValue: (profile) =>
      profile?.scalp_type ? (SCALP_TYPE_LABELS[profile.scalp_type] ?? profile.scalp_type) : null,
  },
  {
    key: "scalp_condition",
    label: "Kopfhaut-Beschwerden",
    sectionKey: "quiz",
    sourceLabel: "Aus Haar-Check",
    editTarget: { kind: "quiz" },
    getValue: (profile) =>
      profile?.scalp_condition
        ? (SCALP_CONDITION_LABELS[profile.scalp_condition] ?? profile.scalp_condition)
        : profile?.scalp_type
          ? "Keine Beschwerden"
          : null,
  },
  {
    key: "concerns",
    label: "Haar-Bedenken",
    sectionKey: "quiz",
    sourceLabel: "Aus Haar-Check",
    editTarget: { kind: "quiz" },
    getValue: (profile) => {
      if (!profile) return null
      if (profile.concerns.length === 0) return "Nichts davon"
      return optionLabels(profile.concerns, PROFILE_CONCERN_LABELS)
    },
  },
  {
    key: "styling_tools",
    label: "Hitzetools",
    sectionKey: "styling",
    sourceLabel: "Aus Onboarding",
    editTarget: { kind: "onboarding", step: "heat_tools" },
    getValue: (profile) => {
      if (profile?.styling_tools?.length) {
        return optionLabels(profile.styling_tools, STYLING_TOOL_LABELS)
      }

      if (profile?.heat_styling === "never") {
        return "Keine Hitzetools"
      }

      return null
    },
  },
  {
    key: "heat_styling",
    label: "Styling-Frequenz",
    sectionKey: "styling",
    sourceLabel: "Aus Onboarding",
    editTarget: { kind: "onboarding", step: "heat_frequency" },
    getValue: (profile) => optionLabel(profile?.heat_styling, HEAT_STYLING_OPTIONS),
  },
  {
    key: "uses_heat_protection",
    label: "Hitzeschutz",
    sectionKey: "styling",
    sourceLabel: "Aus Onboarding",
    editTarget: { kind: "onboarding", step: "heat_protection" },
    getValue: (profile) =>
      profile?.uses_heat_protection != null ? (profile.uses_heat_protection ? "Ja" : "Nein") : null,
  },
  {
    key: "towel_material",
    label: "Handtuch-Material",
    sectionKey: "routine",
    sourceLabel: "Aus Onboarding",
    editTarget: { kind: "onboarding", step: "towel_material" },
    getValue: (profile) =>
      profile?.towel_material
        ? (TOWEL_MATERIAL_LABELS[profile.towel_material] ?? profile.towel_material)
        : null,
  },
  {
    key: "towel_technique",
    label: "Trocknungstechnik",
    sectionKey: "routine",
    sourceLabel: "Aus Onboarding",
    editTarget: { kind: "onboarding", step: "towel_technique" },
    getValue: (profile) =>
      profile?.towel_technique
        ? (TOWEL_TECHNIQUE_LABELS[profile.towel_technique] ?? profile.towel_technique)
        : null,
  },
  {
    key: "drying_method",
    label: "Trocknungsmethode",
    sectionKey: "routine",
    sourceLabel: "Aus Onboarding",
    editTarget: { kind: "onboarding", step: "drying_method" },
    getValue: (profile) =>
      profile?.drying_method
        ? (DRYING_METHOD_LABELS[profile.drying_method] ?? profile.drying_method)
        : null,
  },
  {
    key: "brush_type",
    label: "Bürste",
    sectionKey: "routine",
    sourceLabel: "Aus Onboarding",
    editTarget: { kind: "onboarding", step: "brush_type" },
    getValue: (profile) =>
      profile?.brush_type ? (BRUSH_TYPE_LABELS[profile.brush_type] ?? profile.brush_type) : null,
  },
  {
    key: "night_protection",
    label: "Nachtschutz",
    sectionKey: "routine",
    sourceLabel: "Aus Onboarding",
    editTarget: { kind: "onboarding", step: "night_protection" },
    getValue: (profile) => {
      if (profile?.night_protection?.length) {
        return optionLabels(profile.night_protection, NIGHT_PROTECTION_LABELS)
      }
      if (Array.isArray(profile?.night_protection)) {
        return "Nichts davon"
      }

      return null
    },
  },
  {
    key: "goals",
    label: "Deine Haarziele",
    sectionKey: "goals",
    sourceLabel: "Aus Haar-Check",
    editTarget: { kind: "profile-edit-goals" },
    getValue: (profile) => orderedGoalLabels(profile),
  },
]
