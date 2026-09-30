import {
  CHEMICAL_TREATMENT_LABELS,
  CUTICLE_CONDITION_LABELS,
  HAIR_DENSITY_OPTIONS,
  HAIR_TEXTURE_OPTIONS,
  HAIR_THICKNESS_OPTIONS,
  HEAT_STYLING_OPTIONS,
  PROTEIN_MOISTURE_LABELS,
  SCALP_TYPE_LABELS,
  STYLING_TOOL_LABELS,
} from "@/lib/types"
import type { HairProfile } from "@/lib/types"
import {
  QUESTION_CONFIGS,
  getConcernOptions,
  getGoalOptions,
  type QuizOption,
} from "@/components/personal-plan-quiz/quiz-data"
import { readProfileDiagnostics } from "@/lib/user-facts/profile-diagnostics"
import type { OnboardingStep } from "@/lib/onboarding/store"
import {
  BRUSH_TYPE_LABELS,
  DRYING_METHOD_LABELS,
  HAIR_LENGTH_OPTIONS,
  NIGHT_PROTECTION_LABELS,
  TOWEL_MATERIAL_LABELS,
  TOWEL_TECHNIQUE_LABELS,
} from "@/lib/vocabulary"
import type {
  AdditionalHeatTool,
  DryingRoute,
  PersonalPlanRefinementAnswersV1,
} from "@/lib/personal-plan/refinement/types"

const PLAN_DRYING_ROUTE_LABELS: Record<DryingRoute, string> = {
  air_dry: "Lufttrocknen",
  ordinary_blow_dry: "Gewöhnlich föhnen",
  diffuser_or_airflow_shaping: "Diffusor oder formender Luftstrom",
}

const PLAN_HEAT_TOOL_LABELS: Record<AdditionalHeatTool, string> = {
  dryer_brush: "Föhnbürste",
  hot_air_styler: "Heißluft-Multistyler",
  straightener: "Glätteisen",
  curling_or_wave_iron: "Lockenstab oder Welleneisen",
  thermal_rollers: "Thermo-Wickler",
}

export type ProfileJourneySectionKey =
  | "quiz"
  | "products"
  | "styling"
  | "routine"
  | "goals"
  | "memory"
export type ProfileFieldValue = string | string[] | null

export type ProfileEditTarget =
  | { kind: "quiz" }
  | { kind: "onboarding"; step: OnboardingStep }
  | { kind: "profile-edit-goals" }

export type ProfileFieldConfig = {
  key: string
  label: string
  sectionKey: Exclude<ProfileJourneySectionKey, "products" | "memory">
  editTarget: ProfileEditTarget
  getValue: (
    profile: HairProfile | null,
    plan?: PersonalPlanRefinementAnswersV1 | null,
  ) => ProfileFieldValue
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
  return Array.from(new Set(values.map((value) => labels[value] ?? value)))
}

// Resolves the towel material + technique as a single unit so the two fields can never mix
// sources: if the legacy profile has any towel signal, both fields read only the legacy values
// (existing legacy fallbacks, e.g. no_towel material implying "Keine Trocknungstechnik", stay
// intact). Otherwise both fields read only the plan overlay, including its own no_towel branch.
function resolveTowelSource(
  profile: HairProfile | null,
  plan?: PersonalPlanRefinementAnswersV1 | null,
): { material: ProfileFieldValue; technique: ProfileFieldValue } {
  const hasLegacyTowelSignal = Boolean(profile?.towel_material || profile?.towel_technique)

  if (hasLegacyTowelSignal) {
    return {
      material: profile?.towel_material
        ? (TOWEL_MATERIAL_LABELS[profile.towel_material] ?? profile.towel_material)
        : null,
      technique: profile?.towel_technique
        ? (TOWEL_TECHNIQUE_LABELS[profile.towel_technique] ?? profile.towel_technique)
        : profile?.towel_material === "no_towel"
          ? "Keine Trocknungstechnik"
          : null,
    }
  }

  const planMaterial = plan?.towel?.material ?? null
  const planTechnique = plan?.towel?.technique ?? null

  return {
    material: planMaterial ? (TOWEL_MATERIAL_LABELS[planMaterial] ?? planMaterial) : null,
    technique: planTechnique
      ? (TOWEL_TECHNIQUE_LABELS[planTechnique] ?? planTechnique)
      : planMaterial === "no_towel"
        ? "Keine Trocknungstechnik"
        : null,
  }
}

/** Plan §5 / table M: a stored Welleneisen shows as the combined quiz tool. */
const PROFILE_STYLING_TOOL_LABELS: Record<string, string> = {
  ...STYLING_TOOL_LABELS,
  wave_iron: "Lockenstab / Welleneisen",
}

/** Clean-switch task 8: goals, problems and scalp complaints show the quiz's own wording (per hair
 * texture, in the quiz's order), read from the stored facts — or, for a row the backfill has not
 * reached, from what its columns convert to (`readProfileDiagnostics`). */
function quizLabels(options: QuizOption[], values: readonly string[]): string[] {
  return options.filter((option) => values.includes(option.value)).map((option) => option.label)
}

function profileDiagnostics(profile: HairProfile | null) {
  return readProfileDiagnostics(profile as unknown as Record<string, unknown> | null)
}

function goalLabels(profile: HairProfile | null): string[] | null {
  const diagnostics = profileDiagnostics(profile)
  if (!diagnostics?.goals?.length) return null
  return quizLabels(
    getGoalOptions(diagnostics.texture ?? profile?.hair_texture ?? undefined),
    diagnostics.goals,
  )
}

function problemLabels(profile: HairProfile | null): ProfileFieldValue {
  if (!profile) return null
  const diagnostics = profileDiagnostics(profile)
  if (!diagnostics?.currentConcerns) return null
  const labels = quizLabels(
    getConcernOptions(diagnostics.texture ?? profile.hair_texture ?? undefined),
    diagnostics.currentConcerns,
  )
  const note = diagnostics.currentConcernsOtherText?.trim()
  if (note) labels.push(`Etwas anderes: ${note}`)
  return labels.length > 0 ? labels : "Nichts davon"
}

function scalpConcernLabels(profile: HairProfile | null): ProfileFieldValue {
  const scalpConcerns = profileDiagnostics(profile)?.scalpConcerns
  if (!scalpConcerns) return null
  if (scalpConcerns.length === 0) return "Keine Beschwerden"
  return quizLabels(QUESTION_CONFIGS.scalp_concerns?.options ?? [], scalpConcerns)
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
    description: "Trocknen, Bürste/Kamm und Nachtschutz aus dem Alltagsteil deines Onboardings.",
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

export const PROFILE_FIELD_CONFIG: ProfileFieldConfig[] = [
  {
    key: "hair_texture",
    label: "Haarstruktur",
    sectionKey: "quiz",
    editTarget: { kind: "quiz" },
    getValue: (profile) => optionLabel(profile?.hair_texture, HAIR_TEXTURE_OPTIONS),
  },
  {
    key: "thickness",
    label: "Haardicke",
    sectionKey: "quiz",
    editTarget: { kind: "quiz" },
    getValue: (profile) => optionLabel(profile?.thickness, HAIR_THICKNESS_OPTIONS),
  },
  {
    key: "density",
    label: "Haardichte",
    sectionKey: "quiz",
    editTarget: { kind: "quiz" },
    getValue: (profile) => optionLabel(profile?.density, HAIR_DENSITY_OPTIONS),
  },
  {
    key: "hair_length",
    label: "Haarlänge",
    sectionKey: "quiz",
    editTarget: { kind: "quiz" },
    getValue: (profile) => optionLabel(profile?.hair_length, HAIR_LENGTH_OPTIONS),
  },
  {
    key: "cuticle_condition",
    label: "Oberfläche",
    sectionKey: "quiz",
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
    editTarget: { kind: "quiz" },
    getValue: (profile) =>
      profile?.scalp_type ? (SCALP_TYPE_LABELS[profile.scalp_type] ?? profile.scalp_type) : null,
  },
  {
    key: "scalp_condition",
    label: "Kopfhaut-Beschwerden",
    sectionKey: "quiz",
    editTarget: { kind: "quiz" },
    getValue: (profile) => scalpConcernLabels(profile),
  },
  {
    key: "concerns",
    label: "Haar-Bedenken",
    sectionKey: "quiz",
    editTarget: { kind: "quiz" },
    getValue: (profile) => problemLabels(profile),
  },
  {
    key: "styling_tools",
    label: "Hitzetools",
    sectionKey: "styling",
    editTarget: { kind: "onboarding", step: "heat_tools" },
    getValue: (profile, plan) => {
      if (profile?.styling_tools?.length) {
        return optionLabels(profile.styling_tools, PROFILE_STYLING_TOOL_LABELS)
      }

      if (profile?.heat_styling === "never") {
        return "Keine Hitzetools"
      }

      if (plan?.additionalHeatTools) {
        if (plan.additionalHeatTools.length === 0) return "Keine Hitzetools"
        return optionLabels(plan.additionalHeatTools, PLAN_HEAT_TOOL_LABELS)
      }

      return null
    },
  },
  {
    key: "heat_styling",
    label: "Styling-Frequenz",
    sectionKey: "styling",
    editTarget: { kind: "onboarding", step: "heat_frequency" },
    getValue: (profile) => optionLabel(profile?.heat_styling, HEAT_STYLING_OPTIONS),
  },
  {
    key: "uses_heat_protection",
    label: "Hitzeschutz",
    sectionKey: "styling",
    editTarget: { kind: "onboarding", step: "heat_protection" },
    getValue: (profile) =>
      profile?.uses_heat_protection != null ? (profile.uses_heat_protection ? "Ja" : "Nein") : null,
  },
  {
    key: "towel_material",
    label: "Handtuch-Material",
    sectionKey: "routine",
    editTarget: { kind: "onboarding", step: "towel_material" },
    getValue: (profile, plan) => resolveTowelSource(profile, plan).material,
  },
  {
    key: "towel_technique",
    label: "Trocknungstechnik",
    sectionKey: "routine",
    editTarget: { kind: "onboarding", step: "towel_technique" },
    getValue: (profile, plan) => resolveTowelSource(profile, plan).technique,
  },
  {
    key: "drying_method",
    label: "Trocknungsmethode",
    sectionKey: "routine",
    editTarget: { kind: "onboarding", step: "drying_method" },
    getValue: (profile, plan) => {
      if (profile?.drying_method) {
        return DRYING_METHOD_LABELS[profile.drying_method] ?? profile.drying_method
      }

      if (plan?.dryingRoutes) {
        if (plan.dryingRoutes.length === 0) return "Nichts davon"
        return plan.dryingRoutes.map((route) => PLAN_DRYING_ROUTE_LABELS[route] ?? route).join(", ")
      }

      return null
    },
  },
  {
    key: "brush_type",
    label: "Bürste / Kamm",
    sectionKey: "routine",
    editTarget: { kind: "onboarding", step: "brush_type" },
    getValue: (profile) => {
      if (profile?.brush_type?.length) {
        return optionLabels(profile.brush_type, BRUSH_TYPE_LABELS)
      }

      if (profile?.brush_type && profile.brush_type.length === 0) {
        return "Keine regelmäßige Bürste"
      }

      return null
    },
  },
  {
    key: "night_protection",
    label: "Nachtschutz",
    sectionKey: "routine",
    editTarget: { kind: "onboarding", step: "night_protection" },
    getValue: (profile, plan) => {
      if (profile?.night_protection?.length) {
        return optionLabels(profile.night_protection, NIGHT_PROTECTION_LABELS)
      }
      if (Array.isArray(profile?.night_protection)) {
        return "Nichts davon"
      }

      if (plan?.nightProtection) {
        if (plan.nightProtection.length === 0) return "Nichts davon"
        return optionLabels(plan.nightProtection, NIGHT_PROTECTION_LABELS)
      }

      return null
    },
  },
  {
    key: "goals",
    label: "Deine Haarziele",
    sectionKey: "goals",
    editTarget: { kind: "profile-edit-goals" },
    getValue: (profile) => goalLabels(profile),
  },
]
