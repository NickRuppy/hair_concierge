import {
  CHEMICAL_TREATMENT_LABELS,
  CONCERN_LABELS,
  CUTICLE_CONDITION_LABELS,
  DESIRED_VOLUME_LABELS,
  GOAL_LABELS,
  HAIR_DENSITY_LABELS,
  HAIR_TEXTURE_OPTIONS,
  HAIR_THICKNESS_OPTIONS,
  HEAT_STYLING_OPTIONS,
  POST_WASH_ACTION_OPTIONS,
  PROTEIN_MOISTURE_LABELS,
  ROUTINE_PRODUCT_OPTIONS,
  SCALP_CONDITION_LABELS,
  SCALP_TYPE_LABELS,
  STYLING_TOOL_LABELS,
  WASH_FREQUENCY_OPTIONS,
} from "@/lib/types"
import type { HairProfile } from "@/lib/types"
import {
  BRUSH_TYPE_LABELS,
  DRYING_METHOD_LABELS,
  NIGHT_PROTECTION_LABELS,
  TOWEL_MATERIAL_LABELS,
  TOWEL_TECHNIQUE_LABELS,
} from "@/lib/vocabulary"

export type ProfileJourneySectionKey = "baseline" | "goals" | "routine" | "memory"
export type ProfileFieldSourceLabel = "Aus Haar-Check" | "Aus Onboarding" | "Aus Chat"
export type ProfileFieldDisplayMode = "text" | "badges"
export type ProfileFieldEditMode = "read_only" | "inline" | "section"
export type ProfileFieldValue = string | string[] | null

export type ProfileFieldConfig = {
  key: string
  label: string
  helpText: string
  sectionKey: Exclude<ProfileJourneySectionKey, "memory">
  sourceLabel: ProfileFieldSourceLabel
  displayMode: ProfileFieldDisplayMode
  editMode: ProfileFieldEditMode
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
  options: Array<{ value: string; label: string }>,
): string[] | null {
  if (!values || values.length === 0) return null
  return values.map((value) => optionLabel(value, options) ?? value)
}

export const PROFILE_SECTION_META: ProfileSectionMeta[] = [
  {
    key: "baseline",
    title: "Deine Ausgangslage",
    description:
      "Was Hair Concierge aus Haar-Check und Profilbasis über Struktur, Diagnose und Behandlungen weiß.",
  },
  {
    key: "goals",
    title: "Deine Ziele",
    description: "Worauf dein Plan ausgerichtet wird und welche Themen dir aktuell wichtig sind.",
  },
  {
    key: "routine",
    title: "Dein Alltag",
    description: "Wie du dein Haar im Alltag pflegst, trocknest und mit Produkten unterstützt.",
  },
  {
    key: "memory",
    title: "Was Hair Concierge sich merkt",
    description:
      "Langfristige Erinnerungen aus deinem Chat, damit Empfehlungen konsistenter werden.",
  },
]

export const PROFILE_JOURNEY_STEPS = [
  { key: "baseline", label: "Haar-Check" },
  { key: "goals", label: "Ziele" },
  { key: "routine", label: "Alltag" },
  { key: "memory", label: "Merkt sich" },
] as const

export const PROFILE_FIELD_CONFIG: ProfileFieldConfig[] = [
  {
    key: "hair_texture",
    label: "Haartyp",
    helpText: "Grundlage für die Kategorie- und Stylinglogik.",
    sectionKey: "baseline",
    sourceLabel: "Aus Haar-Check",
    displayMode: "badges",
    editMode: "read_only",
    getValue: (profile) => optionLabel(profile?.hair_texture, HAIR_TEXTURE_OPTIONS),
  },
  {
    key: "thickness",
    label: "Haarstruktur",
    helpText: "Steuert vor allem Gewicht und Reichhaltigkeit von Empfehlungen.",
    sectionKey: "baseline",
    sourceLabel: "Aus Haar-Check",
    displayMode: "badges",
    editMode: "read_only",
    getValue: (profile) => optionLabel(profile?.thickness, HAIR_THICKNESS_OPTIONS),
  },
  {
    key: "density",
    label: "Haardichte",
    helpText: "Hilft bei Volumen- und Gewichtsentscheidungen.",
    sectionKey: "baseline",
    sourceLabel: "Aus Onboarding",
    displayMode: "badges",
    editMode: "read_only",
    getValue: (profile) =>
      profile?.density ? (HAIR_DENSITY_LABELS[profile.density] ?? profile.density) : null,
  },
  {
    key: "cuticle_condition",
    label: "Schuppenschicht",
    helpText: "Zeigt, wie glatt oder aufgeraut die Haaroberfläche ist.",
    sectionKey: "baseline",
    sourceLabel: "Aus Haar-Check",
    displayMode: "badges",
    editMode: "read_only",
    getValue: (profile) =>
      profile?.cuticle_condition
        ? (CUTICLE_CONDITION_LABELS[profile.cuticle_condition] ?? profile.cuticle_condition)
        : null,
  },
  {
    key: "protein_moisture_balance",
    label: "Protein / Feuchtigkeit",
    helpText: "Signal für Balance zwischen Stabilität und Hydration.",
    sectionKey: "baseline",
    sourceLabel: "Aus Haar-Check",
    displayMode: "badges",
    editMode: "read_only",
    getValue: (profile) =>
      profile?.protein_moisture_balance
        ? (PROTEIN_MOISTURE_LABELS[profile.protein_moisture_balance] ??
          profile.protein_moisture_balance)
        : null,
  },
  {
    key: "scalp_type",
    label: "Kopfhauttyp",
    helpText: "Bestimmt mit, wie sanft oder regulierend Shampoo ausfallen sollte.",
    sectionKey: "baseline",
    sourceLabel: "Aus Haar-Check",
    displayMode: "badges",
    editMode: "read_only",
    getValue: (profile) =>
      profile?.scalp_type ? (SCALP_TYPE_LABELS[profile.scalp_type] ?? profile.scalp_type) : null,
  },
  {
    key: "scalp_condition",
    label: "Kopfhautbeschwerden",
    helpText: "Spezifische Beschwerden werden gesondert berücksichtigt.",
    sectionKey: "baseline",
    sourceLabel: "Aus Haar-Check",
    displayMode: "badges",
    editMode: "read_only",
    getValue: (profile) =>
      profile?.scalp_condition && profile.scalp_condition !== "none"
        ? (SCALP_CONDITION_LABELS[profile.scalp_condition as keyof typeof SCALP_CONDITION_LABELS] ??
          profile.scalp_condition)
        : null,
  },
  {
    key: "chemical_treatment",
    label: "Behandlungen",
    helpText: "Zeigt, ob Farbe, Blondierung oder andere chemische Prozesse mitspielen.",
    sectionKey: "baseline",
    sourceLabel: "Aus Haar-Check",
    displayMode: "badges",
    editMode: "read_only",
    getValue: (profile) =>
      profile?.chemical_treatment?.length
        ? profile.chemical_treatment.map(
            (treatment) => CHEMICAL_TREATMENT_LABELS[treatment] ?? treatment,
          )
        : null,
  },
  {
    key: "concerns",
    label: "Probleme",
    helpText: "Themen, die Hair Concierge sichtbar priorisieren soll.",
    sectionKey: "goals",
    sourceLabel: "Aus Haar-Check",
    displayMode: "badges",
    editMode: "inline",
    getValue: (profile) =>
      profile?.concerns?.length
        ? profile.concerns.map((concern) => CONCERN_LABELS[concern] ?? concern)
        : null,
  },
  {
    key: "desired_volume",
    label: "Gewünschtes Volumen",
    helpText: "Legt fest, ob eher Ruhe, Balance oder mehr Fülle bevorzugt wird.",
    sectionKey: "goals",
    sourceLabel: "Aus Onboarding",
    displayMode: "badges",
    editMode: "read_only",
    getValue: (profile) => {
      const fallback =
        profile?.desired_volume ?? (profile?.goals?.includes("volume") ? "more" : null)

      return fallback ? (DESIRED_VOLUME_LABELS[fallback] ?? fallback) : null
    },
  },
  {
    key: "goals",
    label: "Weitere Ziele",
    helpText: "Zusätzliche Ziele für den ersten Plan und spätere Empfehlungen.",
    sectionKey: "goals",
    sourceLabel: "Aus Onboarding",
    displayMode: "badges",
    editMode: "inline",
    getValue: (profile) => {
      const goals = profile?.goals ?? []
      return goals.length ? goals.map((goal) => GOAL_LABELS[goal] ?? goal) : null
    },
  },
  {
    key: "wash_frequency",
    label: "Wasch-Häufigkeit",
    helpText: "Ein wichtiger Taktgeber für Routine- und Shampoo-Empfehlungen.",
    sectionKey: "routine",
    sourceLabel: "Aus Onboarding",
    displayMode: "badges",
    editMode: "inline",
    getValue: (profile) => optionLabel(profile?.wash_frequency, WASH_FREQUENCY_OPTIONS),
  },
  {
    key: "heat_styling",
    label: "Hitze-Styling",
    helpText: "Zeigt, wie stark Hitze den Pflegebedarf beeinflusst.",
    sectionKey: "routine",
    sourceLabel: "Aus Onboarding",
    displayMode: "badges",
    editMode: "inline",
    getValue: (profile) => optionLabel(profile?.heat_styling, HEAT_STYLING_OPTIONS),
  },
  {
    key: "uses_heat_protection",
    label: "Hitzeschutz",
    helpText: "Wichtig für die Bewertung von Belastung und Schutzlücken.",
    sectionKey: "routine",
    sourceLabel: "Aus Onboarding",
    displayMode: "badges",
    editMode: "inline",
    getValue: (profile) =>
      profile?.uses_heat_protection != null ? (profile.uses_heat_protection ? "Ja" : "Nein") : null,
  },
  {
    key: "styling_tools",
    label: "Styling-Tools",
    helpText: "Welche Tools regelmäßig genutzt werden, beeinflusst Styling- und Schutz-Tipps.",
    sectionKey: "routine",
    sourceLabel: "Aus Onboarding",
    displayMode: "badges",
    editMode: "section",
    getValue: (profile) =>
      profile?.styling_tools?.length
        ? profile.styling_tools.map((tool) => STYLING_TOOL_LABELS[tool] ?? tool)
        : null,
  },
  {
    key: "towel_material",
    label: "Handtuch",
    helpText: "Das Material kann Frizz und mechanische Reibung beeinflussen.",
    sectionKey: "routine",
    sourceLabel: "Aus Onboarding",
    displayMode: "badges",
    editMode: "section",
    getValue: (profile) =>
      profile?.towel_material
        ? (TOWEL_MATERIAL_LABELS[profile.towel_material] ?? profile.towel_material)
        : null,
  },
  {
    key: "towel_technique",
    label: "Trocknungstechnik",
    helpText: "Wie du trocknest, beeinflusst Frizz, Spannkraft und Schutz.",
    sectionKey: "routine",
    sourceLabel: "Aus Onboarding",
    displayMode: "badges",
    editMode: "section",
    getValue: (profile) =>
      profile?.towel_technique
        ? (TOWEL_TECHNIQUE_LABELS[profile.towel_technique] ?? profile.towel_technique)
        : null,
  },
  {
    key: "drying_method",
    label: "Trocknungsmethode",
    helpText: "Zeigt, ob Lufttrocknen, Föhnen oder beides dominieren.",
    sectionKey: "routine",
    sourceLabel: "Aus Onboarding",
    displayMode: "badges",
    editMode: "section",
    getValue: (profile) =>
      profile?.drying_method?.length
        ? profile.drying_method.map((method) => DRYING_METHOD_LABELS[method] ?? method)
        : null,
  },
  {
    key: "brush_type",
    label: "Bürste",
    helpText: "Die Bürstenwahl beeinflusst Spannung, Glätte und mechanische Belastung.",
    sectionKey: "routine",
    sourceLabel: "Aus Onboarding",
    displayMode: "badges",
    editMode: "section",
    getValue: (profile) =>
      profile?.brush_type ? (BRUSH_TYPE_LABELS[profile.brush_type] ?? profile.brush_type) : null,
  },
  {
    key: "night_protection",
    label: "Nachtschutz",
    helpText: "Wie du dein Haar nachts schützt, beeinflusst Reibung und Formhaltbarkeit.",
    sectionKey: "routine",
    sourceLabel: "Aus Onboarding",
    displayMode: "badges",
    editMode: "section",
    getValue: (profile) =>
      profile?.night_protection?.length
        ? profile.night_protection.map(
            (protection) => NIGHT_PROTECTION_LABELS[protection] ?? protection,
          )
        : null,
  },
  {
    key: "post_wash_actions",
    label: "Nach dem Waschen",
    helpText: "Hilft bei Leave-in-, Schutz- und Styling-Empfehlungen.",
    sectionKey: "routine",
    sourceLabel: "Aus Onboarding",
    displayMode: "badges",
    editMode: "section",
    getValue: (profile) => optionLabels(profile?.post_wash_actions, POST_WASH_ACTION_OPTIONS),
  },
  {
    key: "current_routine_products",
    label: "Produkte in Routine",
    helpText: "Verhindert doppelte Vorschläge und zeigt, was schon im Alltag verankert ist.",
    sectionKey: "routine",
    sourceLabel: "Aus Onboarding",
    displayMode: "badges",
    editMode: "section",
    getValue: (profile) => optionLabels(profile?.current_routine_products, ROUTINE_PRODUCT_OPTIONS),
  },
  {
    key: "products_used",
    label: "Verwendete Produkte",
    helpText: "Freie Produkthinweise aus deinem Profil oder aus Gesprächen.",
    sectionKey: "routine",
    sourceLabel: "Aus Chat",
    displayMode: "text",
    editMode: "section",
    getValue: (profile) => profile?.products_used || null,
  },
  {
    key: "additional_notes",
    label: "Zusätzliche Hinweise",
    helpText: "Freitext für Dinge, die in den Standardfeldern keinen guten Platz haben.",
    sectionKey: "routine",
    sourceLabel: "Aus Chat",
    displayMode: "text",
    editMode: "section",
    getValue: (profile) => profile?.additional_notes || null,
  },
]
