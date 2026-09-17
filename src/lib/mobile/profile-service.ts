import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { ScanEvaluationContext } from "@/lib/scan/profile-context"
import { loadSharedScannerContext } from "@/lib/scan/scanner-context-supabase"
import type { PreparedScannerContext } from "@/lib/scan/scanner-context"
import * as vocabulary from "@/lib/vocabulary"
import type { QuizAnswers } from "@/lib/quiz/types"
import { editableScannerQuizAnswers } from "@/lib/scan/scanner-context"
import { mobileEditQuestions } from "./profile-edit-contract"

export type MobileProfileAnswer = { id: string; label: string; values: string[] }
export type MobileProfileResult =
  | { status: "profile_required" }
  | {
      status: "ready"
      context: ScanEvaluationContext
      profileRevision: string
      contextRevision: string
      answers: MobileProfileAnswer[]
    }

const labels: Record<string, string> = {
  hair_texture: "Haarstruktur",
  thickness: "Haarstärke",
  density: "Haardichte",
  hair_length: "Haarlänge",
  cuticle_condition: "Haaroberfläche",
  protein_moisture_balance: "Dehntest",
  scalp_type: "Kopfhaut",
  scalp_condition: "Kopfhaut-Beschwerden",
  chemical_treatment: "Chemische Behandlungen",
  concerns: "Deine Anliegen",
  goals: "Deine Ziele",
  styling_tools: "Stylinggeräte",
  heat_styling: "Hitzestyling",
  desired_volume: "Gewünschtes Volumen",
  routine_preference: "Routine-Wunsch",
  towel_material: "Handtuch",
  towel_technique: "Abtrocknen",
  drying_method: "Haare trocknen",
  brush_type: "Bürste",
  night_protection: "Nachtschutz",
  uses_heat_protection: "Hitzeschutz",
  products_used: "Verwendete Produkte",
  additional_notes: "Deine Notizen",
  wetWashFrequency: "Waschhäufigkeit",
  currentProductCategories: "Verwendete Produktarten",
  scalpIrritationDetail: "Empfindlichkeit der Kopfhaut",
  dryShampooBridgePreference: "Trockenshampoo zwischen Haarwäschen",
  dryShampooVisibleHairColor: "Haarfarbe am Ansatz",
  oilPurposes: "Öl-Anwendung",
  dryingRoutes: "Trocknen",
  additionalHeatTools: "Weitere Hitzegeräte",
  nightProtection: "Nachtschutz",
  towel: "Abtrocknen",
  heatEvents: "Hitzestyling",
  routineClarity: "Überblick über deine Routine",
  resultReliability: "Zuverlässigkeit deiner Ergebnisse",
  adaptationConfidence: "Routine anpassen",
  previousAttempts: "Bisherige Erfahrungen",
  blockers: "Deine Herausforderungen",
  routineStyle: "Dein Routine-Stil",
  meaningfulMoment: "Wichtige Momente",
  blockersOtherText: "Weitere Herausforderungen",
  currentConcernsOtherText: "Weitere Anliegen",
  concernRecurrence: "Wiederkehrendes Anliegen",
}
const common: Record<string, string> = {
  yes: "Ja",
  no: "Nein",
  clear: "Klar",
  partial: "Teilweise",
  trial_and_error: "Ausprobieren",
  none: "Kein Überblick",
  mostly: "Meistens",
  sometimes: "Manchmal",
  rarely: "Selten",
  partly: "Teilweise",
  snaps: "Reißt schnell",
  stretches_bounces: "Dehnt sich und federt zurück",
  stretches_stays: "Bleibt gedehnt",
  smooth: "Glatt",
  slightly_rough: "Leicht uneben",
  slightly_uneven: "Leicht uneben",
  rough: "Rau",
  accept: "Ja",
  decline: "Nein",
  air_dry: "Lufttrocknen",
  ordinary_blow_dry: "Föhnen",
  diffuser_or_airflow_shaping: "Diffusor oder Formen mit Föhn",
  diffuser_airflow_shaping: "Diffusor oder Formen mit Föhn",
  dryer_brush: "Föhnbürste",
  hot_air_styler: "Warmluftstyler",
  straightener: "Glätteisen",
  curling_or_wave_iron: "Lockenstab oder Welleneisen",
  light_blonde: "Hell oder blond",
  brown: "Braun",
  dark: "Dunkel",
  mild_sensitive_or_itchy: "Leicht empfindlich oder juckend",
  burning_painful_or_inflamed: "Brennend, schmerzend oder entzündet",
  does_not_wash: "Ich wasche nicht",
  normal: "Unauffällig",
  prewash_lengths: "Vor der Haarwäsche in den Längen",
  damp_leave_on: "Im feuchten Haar",
  dry_finish: "Im trockenen Haar",
  scalp: "Auf der Kopfhaut",
  always: "Immer",
  unsure: "Unsicher",
  oily_dandruff: "Schuppen",
  dry_dandruff: "Trockene Schuppen",
  lightened: "Blondiert oder aufgehellt",
  dry_lengths: "Trockene Längen",
  frizz_flyaways: "Frizz und fliegende Haare",
  low_shine: "Wenig Glanz",
  lost_shape: "Fehlende Form",
  low_volume_or_weighed_down: "Wenig Volumen oder beschwert",
  hair_loss_or_thinning: "Haarausfall oder dünner werdendes Haar",
  frizz_surface: "Weniger Frizz",
  shape_definition: "Mehr Definition",
  volume_balance: "Passendes Volumen",
  strength_ends: "Stärkere Längen und Spitzen",
  scalp_balance: "Ausgeglichene Kopfhaut",
  manageability_styling: "Leichteres Styling",
  nothing_reliably_worked: "Bisher hat nichts zuverlässig geholfen",
  some_steps_helped: "Einzelne Schritte haben geholfen",
  little_targeted_trial: "Bisher wenig gezielt ausprobiert",
  mostly_works: "Funktioniert meistens",
  conflicting_tips: "Widersprüchliche Tipps",
  product_fit: "Passende Produkte finden",
  application_uncertainty: "Unsicherheit bei der Anwendung",
  different_scalp_and_lengths: "Unterschiedliche Bedürfnisse von Kopfhaut und Längen",
  routine_too_complex: "Routine zu aufwendig",
  time_and_cost: "Zeit und Kosten",
  consistency: "Regelmäßig dranbleiben",
  other: "Sonstiges",
  simple_reliable: "Einfach und zuverlässig",
  intentional_caring: "Bewusst pflegend",
  flexible_versatile: "Flexibel und vielseitig",
  precise_goal_oriented: "Gezielt und präzise",
  everyday: "Im Alltag",
  work: "Bei der Arbeit",
  social: "Unter Menschen",
  going_out: "Beim Ausgehen",
  special_occasions: "Besondere Anlässe",
  often: "Häufig",
  rather_not: "Eher nicht",
  shampoo: "Shampoo",
  conditioner: "Conditioner",
  leave_in: "Leave-in",
  heat_protectant: "Hitzeschutz",
  oil: "Haaröl",
  mask: "Haarmaske",
  scalp_care: "Kopfhautpflege",
  dry_shampoo: "Trockenshampoo",
  bondbuilder: "Bondbuilder",
  deep_cleansing_shampoo: "Tiefenreinigungsshampoo",
  no_towel: "Kein Handtuch",
}
// Existing field dictionaries keep context-dependent values (e.g. normal)
// separate; raw notes remain exactly the user's own text.
const dictionaries: Record<string, Record<string, string>> = {
  hair_texture: vocabulary.HAIR_TEXTURE_LABELS,
  thickness: vocabulary.HAIR_THICKNESS_LABELS,
  density: vocabulary.HAIR_DENSITY_LABELS,
  hair_length: vocabulary.HAIR_LENGTH_LABELS,
  scalp_type: vocabulary.SCALP_TYPE_LABELS,
  scalp_condition: vocabulary.SCALP_CONDITION_LABELS,
  chemical_treatment: vocabulary.CHEMICAL_TREATMENT_LABELS,
  concerns: vocabulary.PROFILE_CONCERN_LABELS,
  goals: vocabulary.GOAL_LABELS,
  styling_tools: vocabulary.STYLING_TOOL_LABELS,
  heat_styling: vocabulary.HEAT_STYLING_LABELS,
  desired_volume: vocabulary.DESIRED_VOLUME_LABELS,
  towel_material: vocabulary.TOWEL_MATERIAL_LABELS,
  towel_technique: vocabulary.TOWEL_TECHNIQUE_LABELS,
  drying_method: vocabulary.DRYING_METHOD_LABELS,
  brush_type: vocabulary.BRUSH_TYPE_LABELS,
  night_protection: vocabulary.NIGHT_PROTECTION_LABELS,
  nightProtection: vocabulary.NIGHT_PROTECTION_LABELS,
  material: vocabulary.TOWEL_MATERIAL_LABELS,
  technique: vocabulary.TOWEL_TECHNIQUE_LABELS,
}
function valuesFor(key: string, value: unknown): string[] {
  if (value === null || value === undefined) return []
  if (typeof value === "boolean") return [value ? "Ja" : "Nein"]
  if (Array.isArray(value))
    return value.length ? value.flatMap((item) => valuesFor(key, item)) : ["Keine"]
  if (typeof value === "object")
    return Object.entries(value).flatMap(([child, item]) => {
      const values = valuesFor(child, item)
      return key === "heatEvents"
        ? [`${common[child.replace(/^heat:/, "")] ?? child}: ${values.join(", ")}`]
        : values
    })
  const text = String(value)
  return [
    dictionaries[key]?.[text] ??
      common[text] ??
      vocabulary.PRODUCT_FREQUENCY_LABELS[
        text as keyof typeof vocabulary.PRODUCT_FREQUENCY_LABELS
      ] ??
      text,
  ]
}

export function mobileProfileAnswers(
  profile: Record<string, unknown>,
  prepared: PreparedScannerContext,
  editedAnswers?: QuizAnswers,
): MobileProfileAnswer[] {
  const rows = Object.entries(profile).flatMap(([id, value]) =>
    labels[id] && value !== null && value !== undefined
      ? [{ id, label: labels[id], values: valuesFor(id, value) }]
      : [],
  )
  // Detailed questionnaire answers stay raw and do not turn inferred defaults
  // into saved answers. Include all explicit extra fields beyond the legacy projection.
  if (prepared.source.kind === "personal_plan") {
    const rawBasics: Record<string, string> = {
      currentConcerns: "concerns",
      goals: "goals",
      scalpConcerns: "scalp_condition",
      chemicalTreatments: "chemical_treatment",
    }
    for (const [id, value] of Object.entries(prepared.source.answers)) {
      if (rawBasics[id]) {
        const target = rawBasics[id]
        const row = { id: target, label: labels[target], values: valuesFor(target, value) }
        const index = rows.findIndex((row) => row.id === target)
        if (index >= 0) rows[index] = row
        else rows.push(row)
      }
      if (labels[id] && !rows.some((row) => row.id === id))
        rows.push({ id, label: labels[id], values: valuesFor(id, value) })
    }
  }
  for (const [id, value] of Object.entries(prepared.userRefinementAnswers)) {
    if (labels[id])
      rows.push({ id: `refinement.${id}`, label: labels[id], values: valuesFor(id, value) })
  }
  if (editedAnswers) {
    const fields: Record<string, string> = {
      structure: "hair_texture",
      thickness: "thickness",
      density: "density",
      hair_length: "hair_length",
      fingertest: "cuticle_condition",
      pulltest: "protein_moisture_balance",
      treatment: "chemical_treatment",
      scalp_type: "scalp_type",
      concerns: "concerns",
      goals: "goals",
    }
    const replace = (id: string, label: string, values: string[]) => {
      const row = { id, label, values }
      const index = rows.findIndex((row) => row.id === id)
      if (index >= 0) rows[index] = row
      else rows.push(row)
    }
    for (const question of mobileEditQuestions(editedAnswers)) {
      const value = editedAnswers[question.id as keyof QuizAnswers]
      const values = Array.isArray(value) ? value : typeof value === "string" ? [value] : []
      replace(
        fields[question.id],
        labels[fields[question.id]],
        values.length
          ? values.map(
              (value) => question.options.find((option) => option.value === value)?.label ?? value,
            )
          : ["Keine"],
      )
      if (question.id === "scalp_type") {
        const condition = editedAnswers.scalp_condition
        replace(
          "scalp_condition",
          labels.scalp_condition,
          editedAnswers.has_scalp_issue && condition
            ? [
                question.conditionOptions?.find((option) => option.value === condition)?.label ??
                  condition,
              ]
            : ["Keine"],
        )
      }
    }
    if (editedAnswers.concerns_other_text)
      replace("concerns_other_text", "Weitere Anliegen", [editedAnswers.concerns_other_text])
  }
  return rows
}

export async function loadMobileProfile(
  client: SupabaseClient,
  userId: string,
): Promise<MobileProfileResult> {
  const loaded = await loadSharedScannerContext(client, userId)
  if (!loaded) return { status: "profile_required" }
  return {
    status: "ready",
    context: loaded.prepared,
    profileRevision: loaded.source.profileRevision,
    contextRevision: loaded.contextRevision,
    answers: mobileProfileAnswers(
      loaded.source.profile!,
      loaded.prepared,
      loaded.source.edit ? editableScannerQuizAnswers(loaded.source) : undefined,
    ),
  }
}
