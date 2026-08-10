import {
  identifyCustomerIoServerPerson,
  logCustomerIoServerResult,
  trackCustomerIoServerEvent,
  type CustomerIoServerProperties,
} from "@/lib/customerio/server"
import type { PersonalPlanQuizSubmissionEnvelope } from "@/lib/personal-plan-quiz/types"

export const PERSONAL_PLAN_LEGACY_CONCERNS = [
  "dry_dull_lengths",
  "frizz_flyaways",
  "low_shine",
  "lost_shape",
  "low_volume_or_weighed_down",
  "breakage_or_split_ends",
  "tangling",
  "scalp_imbalance",
] as const

export type PersonalPlanLegacyConcern = (typeof PERSONAL_PLAN_LEGACY_CONCERNS)[number]

export type PersonalPlanCustomerIoEnvelope =
  | PersonalPlanQuizSubmissionEnvelope
  | {
      kind: PersonalPlanQuizSubmissionEnvelope["kind"]
      version: 2
      answers: Omit<
        PersonalPlanQuizSubmissionEnvelope["answers"],
        "currentConcerns" | "concernRecurrence"
      > & {
        currentConcerns?: PersonalPlanLegacyConcern[]
      }
    }

const TEXTURE_LABELS: Record<string, string> = {
  straight: "Glatt",
  wavy: "Wellig",
  curly: "Lockig",
  coily: "Kraus",
}

const THICKNESS_LABELS: Record<string, string> = {
  fine: "Fein",
  normal: "Mittel",
  coarse: "Dick",
}

const DENSITY_LABELS: Record<string, string> = {
  low: "Wenig Haare",
  medium: "Mittlere Dichte",
  high: "Viele Haare",
}

const HAIR_LENGTH_LABELS: Record<string, string> = {
  very_short: "Sehr kurz",
  short: "Kurz",
  medium: "Mittellang",
  long: "Lang",
  very_long: "Sehr lang",
}

const SURFACE_LABELS: Record<string, string> = {
  smooth: "Glatt",
  slightly_uneven: "Leicht uneben",
  rough: "Rau",
}

const ELASTICITY_LABELS: Record<string, string> = {
  stretches_bounces: "Ausgewogen",
  stretches_stays: "Proteinmangel",
  snaps: "Feuchtigkeitsmangel",
}

const SCALP_OILINESS_LABELS: Record<string, string> = {
  oily: "Schnell fettend",
  balanced: "Ausgeglichen",
  dry: "Trocken",
}

const SCALP_CONCERN_LABELS: Record<string, string> = {
  oily_dandruff: "Fettige Schuppen",
  dry_dandruff: "Trockene Schuppen",
  irritated: "Gereizte Kopfhaut",
}

const TREATMENT_LABELS: Record<string, string> = {
  natural: "Naturhaar",
  colored: "Gefärbt / getönt",
  lightened: "Blondiert / aufgehellt",
  permed: "Dauerwelle",
  chemically_straightened: "Chemisch geglättet",
}

const CONCERN_LABELS: Record<string, string> = {
  dry_dull_lengths: "Trockene oder raue Längen",
  dry_lengths: "Trockene oder strohige Längen",
  frizz_flyaways: "Frizz oder viele abstehende Haare",
  low_shine: "Wenig Glanz",
  hair_damage: "Mein Haar wirkt insgesamt strapaziert oder geschädigt",
  hair_loss_or_thinning: "Haarausfall oder dünner werdendes Haar",
  lost_shape: "Form oder Definition hält nicht",
  low_volume_or_weighed_down: "Zu wenig Volumen oder schnell beschwert",
  breakage_or_split_ends: "Haarbruch oder Spliss",
  breakage: "Haarbruch in den Längen",
  split_ends: "Sichtbar gespaltene oder ausgefranste Spitzen",
  tangling: "Schnelles Verknoten",
  scalp_imbalance: "Kopfhaut gerät schnell aus dem Gleichgewicht",
}

const GOAL_LABELS: Record<string, string> = {
  moisture: "Mehr Feuchtigkeit",
  frizz_surface: "Weniger Frizz und eine glattere Oberfläche",
  shine: "Mehr Glanz",
  shape_definition: "Mehr Form und Definition",
  volume_balance: "Ausgewogenes Volumen",
  strength_ends: "Weniger Haarbruch und Spliss",
  scalp_balance: "Ausgeglichene Kopfhaut",
  manageability_styling: "Leichteres Styling",
}

const ROUTINE_STYLE_LABELS: Record<string, string> = {
  simple_reliable: "Einfach und verlässlich",
  intentional_caring: "Bewusst und pflegend",
  flexible_versatile: "Flexibel und vielseitig",
  precise_goal_oriented: "Präzise und zielgerichtet",
}

const ROUTINE_CLARITY_LABELS: Record<string, string> = {
  clear: "Klare Routine",
  partial: "Einzelne Schritte funktionieren",
  trial_and_error: "Viel Ausprobieren ohne klares System",
  none: "Noch keine feste Routine",
}

const THICKNESS_INLINE: Record<string, string> = {
  fine: "fein",
  normal: "mittel",
  coarse: "dick",
}

const DENSITY_INLINE: Record<string, string> = {
  low: "wenig Haare",
  medium: "mittlere Dichte",
  high: "viele Haare",
}

type PersonalPlanCustomerIoInput = {
  createdAt: string
  email: string
  leadId: string
  marketingConsent: boolean
  quizAnswers: PersonalPlanCustomerIoEnvelope
  funnelSessionId?: string | null
  funnelPackageKey?: string | null
  testKind?: "field_test" | null
}

function labelFor(value: string | undefined, labels: Record<string, string>) {
  return value ? (labels[value] ?? value) : undefined
}

function labelsFor(values: readonly string[] | undefined, labels: Record<string, string>) {
  return values?.map((value) => labels[value] ?? value)
}

function buildProfileLine(answers: PersonalPlanCustomerIoEnvelope["answers"]) {
  return [
    labelFor(answers.texture, TEXTURE_LABELS),
    labelFor(answers.thickness, THICKNESS_INLINE),
    labelFor(answers.density, DENSITY_INLINE),
  ]
    .filter(Boolean)
    .join(", ")
}

export function buildPersonalPlanCustomerIoTraits(
  input: PersonalPlanCustomerIoInput,
): CustomerIoServerProperties {
  const answers = input.quizAnswers.answers
  return {
    email: input.email,
    lead_id: input.leadId,
    quiz_kind: "personal_plan",
    marketing_consent: input.marketingConsent,
    consent_timestamp: input.marketingConsent ? input.createdAt : undefined,
    personal_plan_completed_at: input.createdAt,
    personal_plan_profile_version: input.quizAnswers.version,
    funnel_session_id: input.funnelSessionId,
    funnel_package_key: input.funnelPackageKey,
    test_kind: input.testKind,
    commercial_automation_eligible: input.testKind !== "field_test",
    profile_line: buildProfileLine(answers),

    // These fields have the same primitive type and vocabulary as the legacy quiz.
    hair_texture: answers.texture,
    hair_texture_label: labelFor(answers.texture, TEXTURE_LABELS),
    thickness: answers.thickness,
    thickness_label: labelFor(answers.thickness, THICKNESS_LABELS),
    density: answers.density,
    density_label: labelFor(answers.density, DENSITY_LABELS),
    hair_length: answers.hairLength,
    hair_length_label: labelFor(answers.hairLength, HAIR_LENGTH_LABELS),
    protein_moisture_balance: answers.elasticResponse,
    protein_moisture_balance_label: labelFor(answers.elasticResponse, ELASTICITY_LABELS),

    // Personal Plan names avoid changing legacy scalar/array types or raw vocabularies.
    personal_plan_hair_surface: answers.hairSurface,
    personal_plan_hair_surface_label: labelFor(answers.hairSurface, SURFACE_LABELS),
    personal_plan_scalp_oiliness: answers.scalpOiliness,
    personal_plan_scalp_oiliness_label: labelFor(answers.scalpOiliness, SCALP_OILINESS_LABELS),
    personal_plan_scalp_concerns: answers.scalpConcerns,
    personal_plan_scalp_concern_labels: labelsFor(answers.scalpConcerns, SCALP_CONCERN_LABELS),
    personal_plan_has_scalp_concern: (answers.scalpConcerns?.length ?? 0) > 0,
    personal_plan_chemical_treatments: answers.chemicalTreatments,
    personal_plan_chemical_treatment_labels: labelsFor(
      answers.chemicalTreatments,
      TREATMENT_LABELS,
    ),
    personal_plan_concerns: answers.currentConcerns,
    personal_plan_concern_labels: labelsFor(answers.currentConcerns, CONCERN_LABELS),
    personal_plan_goals: answers.goals,
    personal_plan_goal_labels: labelsFor(answers.goals, GOAL_LABELS),
    personal_plan_routine_style: answers.routineStyle,
    personal_plan_routine_style_label: labelFor(answers.routineStyle, ROUTINE_STYLE_LABELS),
    personal_plan_routine_clarity: answers.routineClarity,
    personal_plan_routine_clarity_label: labelFor(answers.routineClarity, ROUTINE_CLARITY_LABELS),
  }
}

export async function syncPersonalPlanLeadToCustomerIo(
  input: PersonalPlanCustomerIoInput & {
    identifyTimestamp?: string
    profileSyncRevision: number
    sendCompletionEvent: boolean
  },
) {
  const identify = await identifyCustomerIoServerPerson({
    userId: input.email,
    messageId: `identify:personal_plan_lead:${input.leadId}:${input.profileSyncRevision}`,
    timestamp: input.identifyTimestamp ?? input.createdAt,
    traits: buildPersonalPlanCustomerIoTraits(input),
  })
  logCustomerIoServerResult(`identify personal-plan lead ${input.leadId}`, identify)

  if (!identify.ok || !input.sendCompletionEvent) return { identify }

  const completionEvent = await trackCustomerIoServerEvent({
    userId: input.email,
    event: "personal_plan_profile_submitted",
    messageId: `personal_plan_profile_submitted:${input.leadId}`,
    timestamp: input.createdAt,
    properties: {
      source: "personal_plan_lead_api",
      lead_id: input.leadId,
      funnel_session_id: input.funnelSessionId,
      funnel_package_key: input.funnelPackageKey,
      marketing_consent: input.marketingConsent,
    },
  })
  logCustomerIoServerResult(
    `track personal_plan_profile_submitted ${input.leadId}`,
    completionEvent,
  )

  return { identify, completionEvent }
}
