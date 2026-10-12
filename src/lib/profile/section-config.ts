import { HEAT_STYLING_OPTIONS, STYLING_TOOL_LABELS } from "@/lib/types"
import type { HairProfile } from "@/lib/types"
import {
  CURRENT_PROBLEMS_TITLE,
  QUESTION_CONFIGS,
  getConcernOptions,
  getGoalOptions,
  type QuizOption,
} from "@/components/personal-plan-quiz/quiz-data"
import { TEXTURE_OPTIONS } from "@/components/personal-plan-quiz/texture-question"
import { readProfileDiagnostics } from "@/lib/user-facts/profile-diagnostics"
import {
  BRUSH_TYPE_LABELS,
  DRYING_METHOD_LABELS,
  NIGHT_PROTECTION_LABELS,
  TOWEL_MATERIAL_LABELS,
  TOWEL_TECHNIQUE_LABELS,
} from "@/lib/vocabulary"
import { getSelectedStage2HeatEventSources } from "@/lib/personal-plan/refinement/heat-events"
import { nightWearFromNightProtection } from "@/lib/personal-plan/tools/facts"
import type {
  AdditionalHeatTool,
  DryingRoute,
  NightWear,
  PersonalPlanRefinementAnswersV1,
  Stage2Module,
} from "@/lib/personal-plan/refinement/types"
import type { ProfileToolsBlock } from "@/lib/personal-plan/tools/profile-block"

const PLAN_DRYING_ROUTE_LABELS: Record<DryingRoute, string> = {
  air_dry: "Lufttrocknen",
  ordinary_blow_dry: "Gewöhnlich föhnen",
  diffuser_or_airflow_shaping: "Mit Diffusor",
}

/** Rev. 6 — the Gewohnheiten „Nachts" row (same labels as the question). */
export const PLAN_NIGHT_WEAR_LABELS: Record<NightWear, string> = {
  open: "Offen",
  loose_tied: "Locker zusammengebunden",
  pineapple: "Pineapple",
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
  | "habits"
  | "tools"
  | "memory"
export type ProfileFieldValue = string | string[] | null

export type ProfileEditTarget =
  | { kind: "quiz" }
  | { kind: "refine"; module: Stage2Module }
  | { kind: "onboarding-step"; step: "brush_type" }
  | { kind: "profile-edit-goals" }

export type ProfileFieldConfig = {
  key: string
  label: string
  sectionKey: Exclude<ProfileJourneySectionKey, "products" | "memory">
  editTarget: ProfileEditTarget
  getValue: (
    profile: HairProfile | null,
    plan?: PersonalPlanRefinementAnswersV1 | null,
    tools?: ProfileToolsBlock | null,
  ) => ProfileFieldValue
}

export type ProfileSectionMeta = {
  key: ProfileJourneySectionKey
  title: string
  description: string
  descriptionWithoutPlan?: string
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

/** Clean-switch task 8 + fix round 2: every Haar-Check field and the goals show the quiz's own
 * wording (per hair texture, in the quiz's order), read from the stored facts — or, for a row the
 * backfill has not reached, from what its columns convert to (`readProfileDiagnostics`). The one
 * option source is the quiz (`quiz-data.ts`, `texture-question.ts`); no profile label tables. */
function quizLabels(options: QuizOption[], values: readonly string[]): string[] {
  return options.filter((option) => values.includes(option.value)).map((option) => option.label)
}

function quizLabel(options: QuizOption[], value: string | undefined): string | null {
  if (!value) return null
  return options.find((option) => option.value === value)?.label ?? null
}

function quizQuestionOptions(key: keyof typeof QUESTION_CONFIGS): QuizOption[] {
  return QUESTION_CONFIGS[key]?.options ?? []
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

/** No problem and no note is an open answer (the quiz has no „Nichts davon" here). */
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
  return labels.length > 0 ? labels : null
}

function scalpConcernLabels(profile: HairProfile | null): ProfileFieldValue {
  const scalpConcerns = profileDiagnostics(profile)?.scalpConcerns
  if (!scalpConcerns) return null
  if (scalpConcerns.length === 0) return "Nichts davon"
  return quizLabels(quizQuestionOptions("scalp_concerns"), scalpConcerns)
}

function chemicalTreatmentLabels(profile: HairProfile | null): ProfileFieldValue {
  const treatments = profileDiagnostics(profile)?.chemicalTreatments
  if (!treatments?.length) return null
  return quizLabels(quizQuestionOptions("chemical_treatments"), treatments)
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
    description:
      "Welche Produktkategorien du aktuell nutzt und welche Produkte in deinem Plan stehen.",
    descriptionWithoutPlan: "Welche Produkte du aktuell nutzt.",
  },
  {
    key: "styling",
    title: "Styling",
    description: "Hitzetools, Häufigkeit und Hitzeschutz aus deinem Feinschliff.",
    descriptionWithoutPlan: "Hitzetools, Häufigkeit und Hitzeschutz.",
  },
  {
    key: "routine",
    title: "Alltag",
    description: "Handtuch, Trocknen, Bürste/Kamm und Nachtschutz aus deinem Feinschliff.",
    descriptionWithoutPlan: "Handtuch, Trocknen, Bürste/Kamm und Nachtschutz.",
  },
  {
    key: "habits",
    title: "Gewohnheiten",
    description: "Wie du trocknest und stylst, aus deinem Feinschliff.",
  },
  {
    key: "tools",
    title: "Deine Tools",
    description: "Was du schon hast, aus deinem Feinschliff.",
  },
  {
    key: "memory",
    title: "Erinnerungen",
    description: "Hinweise aus dem Chat, langfristig gespeichert.",
  },
]

const BASE_FIELD_CONFIG: ProfileFieldConfig[] = [
  {
    key: "hair_texture",
    label: "Haarstruktur",
    sectionKey: "quiz",
    editTarget: { kind: "quiz" },
    getValue: (profile) => quizLabel(TEXTURE_OPTIONS, profileDiagnostics(profile)?.texture),
  },
  {
    key: "thickness",
    label: "Haardicke",
    sectionKey: "quiz",
    editTarget: { kind: "quiz" },
    getValue: (profile) =>
      quizLabel(quizQuestionOptions("thickness"), profileDiagnostics(profile)?.thickness),
  },
  {
    key: "density",
    label: "Haardichte",
    sectionKey: "quiz",
    editTarget: { kind: "quiz" },
    getValue: (profile) =>
      quizLabel(quizQuestionOptions("density"), profileDiagnostics(profile)?.density),
  },
  {
    key: "hair_length",
    label: "Haarlänge",
    sectionKey: "quiz",
    editTarget: { kind: "quiz" },
    getValue: (profile) =>
      quizLabel(quizQuestionOptions("hair_length"), profileDiagnostics(profile)?.hairLength),
  },
  {
    key: "cuticle_condition",
    label: "Oberfläche",
    sectionKey: "quiz",
    editTarget: { kind: "quiz" },
    getValue: (profile) =>
      quizLabel(quizQuestionOptions("hair_surface"), profileDiagnostics(profile)?.hairSurface),
  },
  {
    key: "protein_moisture_balance",
    label: "Elastizität",
    sectionKey: "quiz",
    editTarget: { kind: "quiz" },
    getValue: (profile) =>
      quizLabel(
        quizQuestionOptions("elastic_response"),
        profileDiagnostics(profile)?.elasticResponse,
      ),
  },
  {
    key: "chemical_treatment",
    label: "Chemische Behandlungen",
    sectionKey: "quiz",
    editTarget: { kind: "quiz" },
    getValue: (profile) => chemicalTreatmentLabels(profile),
  },
  {
    key: "scalp_type",
    label: "Kopfhauttyp",
    sectionKey: "quiz",
    editTarget: { kind: "quiz" },
    getValue: (profile) =>
      quizLabel(quizQuestionOptions("scalp_oiliness"), profileDiagnostics(profile)?.scalpOiliness),
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
    label: CURRENT_PROBLEMS_TITLE,
    sectionKey: "quiz",
    editTarget: { kind: "quiz" },
    getValue: (profile) => problemLabels(profile),
  },
  {
    // The Ziele card is gone; the goals are the closing row of the Haar-Check grid and keep their
    // own editor as a row-level link.
    key: "goals",
    label: "Deine Haarziele",
    sectionKey: "quiz",
    editTarget: { kind: "profile-edit-goals" },
    getValue: (profile) => goalLabels(profile),
  },
  {
    key: "styling_tools",
    label: "Hitzetools",
    sectionKey: "styling",
    editTarget: { kind: "refine", module: "habits" },
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
    label: "Hitze-Häufigkeit",
    sectionKey: "styling",
    editTarget: { kind: "refine", module: "habits" },
    getValue: (profile) => optionLabel(profile?.heat_styling, HEAT_STYLING_OPTIONS),
  },
  {
    key: "uses_heat_protection",
    label: "Hitzeschutz",
    sectionKey: "styling",
    editTarget: { kind: "refine", module: "habits" },
    getValue: (profile) =>
      profile?.uses_heat_protection != null ? (profile.uses_heat_protection ? "Ja" : "Nein") : null,
  },
  {
    key: "towel_material",
    label: "Handtuch-Material",
    sectionKey: "routine",
    editTarget: { kind: "refine", module: "habits" },
    getValue: (profile, plan) => resolveTowelSource(profile, plan).material,
  },
  {
    key: "towel_technique",
    label: "Abtrocknen",
    sectionKey: "routine",
    editTarget: { kind: "refine", module: "habits" },
    getValue: (profile, plan) => resolveTowelSource(profile, plan).technique,
  },
  {
    key: "drying_method",
    label: "Trocknen",
    sectionKey: "routine",
    editTarget: { kind: "refine", module: "habits" },
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
    editTarget: { kind: "onboarding-step", step: "brush_type" },
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
    editTarget: { kind: "refine", module: "habits" },
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
]

/**
 * Gewohnheiten (tools applicable): the four rows of the old Styling/Alltag cards that Hair Tools
 * leaves to the habits module. They read exactly what those rows read; only the section differs.
 *
 * Contract: these four `key`s therefore appear TWICE in `PROFILE_FIELD_CONFIG` — once in their old
 * section (`BASE_FIELD_CONFIG`, shown when tools do not apply) and once under `habits` (shown when
 * they do). A row is identified by `(key, sectionKey)`, never by `key` alone: consumers select
 * with `field.sectionKey === …` (the page) or read `profileHabitsRows`, and the section-config
 * test pins the pair as unique.
 */
const HABITS_FIELD_KEYS = [
  "towel_technique",
  "drying_method",
  "heat_styling",
  "uses_heat_protection",
] as const

const HABITS_FIELD_CONFIG: ProfileFieldConfig[] = HABITS_FIELD_KEYS.map((key) => {
  const base = BASE_FIELD_CONFIG.find((field) => field.key === key)
  if (!base) throw new Error(`profile habits field ${key} has no base config`)
  return { ...base, sectionKey: "habits" }
})

/**
 * Deine Tools: one row. Its value is the list of owned-tool labels from the presentation API's
 * `tools` block (`null` until the member has confirmed something); the page renders the photo
 * chips from the same block.
 */
const TOOLS_FIELD_CONFIG: ProfileFieldConfig[] = [
  {
    key: "owned_tools",
    label: "Deine Tools",
    sectionKey: "tools",
    editTarget: { kind: "refine", module: "tools" },
    getValue: (_profile, _plan, tools) => {
      if (!tools) return null
      const labels = tools.groups.flatMap((group) => group.items.map((item) => item.label))
      return labels.length > 0 ? labels : "Nichts davon"
    },
  },
]

export const PROFILE_FIELD_CONFIG: ProfileFieldConfig[] = [
  ...BASE_FIELD_CONFIG,
  ...HABITS_FIELD_CONFIG,
  ...TOOLS_FIELD_CONFIG,
]

/**
 * True only when the member's own answers say no heat source is used: the derived heat column
 * reads „never", or the plan answered both the drying routes and the extra heat tools and
 * selected no heat event. Not yet answered is not „no heat".
 */
function usesNoHeatSource(
  profile: HairProfile | null,
  plan?: PersonalPlanRefinementAnswersV1 | null,
): boolean {
  if (profile?.heat_styling === "never") return true
  if (profile?.heat_styling || profile?.styling_tools?.length) return false
  if (plan?.dryingRoutes !== undefined && plan.additionalHeatTools !== undefined) {
    return getSelectedStage2HeatEventSources(plan).length === 0
  }
  return false
}

/**
 * The „Nachts" row (Rev. 6): the night question's answer, or — before it was asked — the
 * technique the member's earlier night answer names. Without either it is still open (an
 * earlier list without a technique cannot say „Offen").
 */
const NIGHT_WEAR_FIELD: ProfileFieldConfig = {
  key: "night_wear",
  label: "Nachts",
  sectionKey: "habits",
  editTarget: { kind: "refine", module: "habits" },
  getValue: (profile, plan) => {
    const wear =
      plan?.nightWear ??
      nightWearFromNightProtection(plan?.nightProtection) ??
      nightWearFromNightProtection(profile?.night_protection)
    return wear ? PLAN_NIGHT_WEAR_LABELS[wear] : null
  },
}

/** Hair that cannot be tied is never asked how it is worn at night, so it gets no row. */
function hairCanBeTied(profile: HairProfile | null): boolean {
  const length = profileDiagnostics(profile)?.hairLength
  return length !== "very_short" && length !== "short"
}

export type ProfileHabitsRow = {
  key: string
  label: string
  editTarget: ProfileEditTarget
  value: ProfileFieldValue
}

/**
 * The Gewohnheiten rows in display order (Abtrocknen → Trocknen → Hitze → Nachts). Without a heat
 * source, Hitze-Häufigkeit and Hitzeschutz have nothing to say and collapse into the single row
 * „Keine Hitze". „Nachts" closes the card, except for hair that cannot be tied.
 */
export function profileHabitsRows(
  profile: HairProfile | null,
  plan?: PersonalPlanRefinementAnswersV1 | null,
): ProfileHabitsRow[] {
  const toRow = (field: ProfileFieldConfig): ProfileHabitsRow => ({
    key: field.key,
    label: field.label,
    editTarget: field.editTarget,
    value: field.getValue(profile, plan),
  })
  const rows: ProfileHabitsRow[] = HABITS_FIELD_CONFIG.map(toRow)
  const heatRows = usesNoHeatSource(profile, plan)
    ? [
        ...rows.filter((row) => row.key !== "heat_styling" && row.key !== "uses_heat_protection"),
        {
          key: "no_heat",
          label: "Hitze",
          editTarget: { kind: "refine", module: "habits" } as const,
          value: "Keine Hitze",
        },
      ]
    : rows
  return hairCanBeTied(profile) ? [...heatRows, toRow(NIGHT_WEAR_FIELD)] : heatRows
}
