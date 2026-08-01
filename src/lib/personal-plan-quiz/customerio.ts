import { identifyCustomerIoServerPerson, logCustomerIoServerResult } from "@/lib/customerio/server"
import type { PersonalPlanQuizSubmissionEnvelope } from "@/lib/personal-plan-quiz/types"

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

const SCALP_TYPE_LABELS: Record<string, string> = {
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

// Kurzform fuer die profile_line, damit sie sich als Satzteil liest:
// "Wellig, fein, mittlere Dichte"
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

const PLAN_RETENTION_DAYS = 7

function labelFor(value: string | undefined, labels: Record<string, string>) {
  return value ? (labels[value] ?? value) : undefined
}

function labelsFor(values: readonly string[] | undefined, labels: Record<string, string>) {
  return values?.map((value) => labels[value] ?? value)
}

// Muss identisch zum Customer.io-Snippet "plan_id" bleiben:
// HP-{{customer.lead_id | slice: 0, 5 | upcase}}
function buildPlanId(leadId: string) {
  return `HP-${leadId.slice(0, 5).toUpperCase()}`
}

function buildProfileLine(answers: PersonalPlanQuizSubmissionEnvelope["answers"]) {
  return [
    labelFor(answers.texture, TEXTURE_LABELS),
    labelFor(answers.thickness, THICKNESS_INLINE),
    labelFor(answers.density, DENSITY_INLINE),
  ]
    .filter(Boolean)
    .join(", ")
}

function planExpiresAt(createdAt: string) {
  const expires = new Date(createdAt)
  if (Number.isNaN(expires.getTime())) return undefined
  expires.setUTCDate(expires.getUTCDate() + PLAN_RETENTION_DAYS)
  return expires.toISOString()
}

export async function syncPersonalPlanLeadToCustomerIo({
  createdAt,
  email,
  leadId,
  marketingConsent,
  quizAnswers,
  planExpiresAtOverride,
}: {
  createdAt: string
  email: string
  leadId: string
  marketingConsent: boolean
  quizAnswers?: PersonalPlanQuizSubmissionEnvelope
  /**
   * Nur fuer den Backfill: Bestandsleads bekommen ein Ablaufdatum ab jetzt,
   * sonst waere der Plan bereits abgelaufen, bevor die Strecke ueberhaupt startet.
   */
  planExpiresAtOverride?: string
}) {
  const answers = quizAnswers?.answers

  const result = await identifyCustomerIoServerPerson({
    userId: email,
    messageId: `identify:personal_plan_lead:${leadId}`,
    timestamp: createdAt,
    traits: {
      email,
      lead_id: leadId,
      quiz_kind: "personal_plan",
      marketing_consent: marketingConsent,
      consent_timestamp: marketingConsent ? createdAt : undefined,

      // Trigger fuer die Haarplan-Strecke. Segment 15 horcht auf die Aenderung
      // dieses Attributs. Ohne das startet keine Automation.
      quiz_completed_at: createdAt,

      // Direkt von der E-Mail-Strecke genutzt.
      plan_id: buildPlanId(leadId),
      plan_expires_at: planExpiresAtOverride ?? planExpiresAt(createdAt),
      profile_line: answers ? buildProfileLine(answers) : undefined,

      // Haarprofil, je einmal roh (fuer Segmente) und einmal als Label (fuer Copy).
      hair_texture: answers?.texture,
      hair_texture_label: labelFor(answers?.texture, TEXTURE_LABELS),
      thickness: answers?.thickness,
      thickness_label: labelFor(answers?.thickness, THICKNESS_LABELS),
      density: answers?.density,
      density_label: labelFor(answers?.density, DENSITY_LABELS),
      hair_length: answers?.hairLength,
      hair_length_label: labelFor(answers?.hairLength, HAIR_LENGTH_LABELS),
      cuticle_condition: answers?.hairSurface,
      cuticle_condition_label: labelFor(answers?.hairSurface, SURFACE_LABELS),
      protein_moisture_balance: answers?.elasticResponse,
      protein_moisture_balance_label: labelFor(answers?.elasticResponse, ELASTICITY_LABELS),
      scalp_type: answers?.scalpOiliness,
      scalp_type_label: labelFor(answers?.scalpOiliness, SCALP_TYPE_LABELS),
      scalp_condition: answers?.scalpConcerns,
      scalp_condition_labels: labelsFor(answers?.scalpConcerns, SCALP_CONCERN_LABELS),
      has_scalp_issue: answers ? (answers.scalpConcerns?.length ?? 0) > 0 : undefined,
      chemical_treatment: answers?.chemicalTreatments,
      chemical_treatment_labels: labelsFor(answers?.chemicalTreatments, TREATMENT_LABELS),
      concerns: answers?.currentConcerns,
      goals: answers?.goals,
      routine_style: answers?.routineStyle,
      routine_clarity: answers?.routineClarity,
    },
  })
  logCustomerIoServerResult(`identify personal-plan lead ${leadId}`, result)
  return result
}
