import type { CustomerIoServerProperties } from "@/lib/customerio/server"
import { canonicalizeQuizAnswers } from "@/lib/quiz/normalization"
import type { QuizAnswers } from "@/lib/quiz/types"
import { HAIR_LENGTH_LABELS } from "@/lib/vocabulary"
import { GOAL_LABELS, PROFILE_CONCERN_LABELS } from "@/lib/vocabulary/concerns-goals"

const HAIR_TEXTURE_LABELS: Record<string, string> = {
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

const CUTICLE_CONDITION_LABELS: Record<string, string> = {
  glatt: "Glatt",
  leicht_uneben: "Leicht uneben",
  rau: "Rau",
}

const PROTEIN_MOISTURE_LABELS: Record<string, string> = {
  stretches_bounces: "Ausgewogen",
  stretches_stays: "Proteinmangel",
  snaps: "Feuchtigkeitsmangel",
}

const SCALP_TYPE_LABELS: Record<string, string> = {
  fettig: "Schnell fettend",
  ausgeglichen: "Ausgeglichen",
  trocken: "Trocken",
}

const SCALP_CONDITION_LABELS: Record<string, string> = {
  schuppen: "Schuppen",
  trockene_schuppen: "Trockene Schuppen",
  gereizt: "Gereizte Kopfhaut",
}

const TREATMENT_LABELS: Record<string, string> = {
  natur: "Naturhaar",
  gefaerbt: "Gefärbt / getönt",
  blondiert: "Blondiert / aufgehellt",
  dauerwelle: "Dauerwelle",
  chemisch_geglaettet: "Chemisch geglättet",
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name.trim()
}

function labelFor(value: string | undefined, labels: Record<string, string>) {
  return value ? (labels[value] ?? value) : undefined
}

function labelsFor(values: string[] | undefined, labels: Record<string, string>) {
  return values?.map((value) => labels[value] ?? value)
}

export function buildCustomerIoQuizLeadSync({
  createdAt,
  email,
  leadId,
  marketingConsent,
  name,
  quizAnswers,
  funnelSessionId,
  funnelPackageKey,
}: {
  createdAt: string
  email: string
  leadId: string
  marketingConsent: boolean
  name: string
  quizAnswers: QuizAnswers
  funnelSessionId?: string | null
  funnelPackageKey?: string | null
}) {
  const normalizedEmail = normalizeEmail(email)
  const answers = canonicalizeQuizAnswers(quizAnswers)
  const identifyTraits: CustomerIoServerProperties = {
    email: normalizedEmail,
    first_name: firstName(name),
    lead_id: leadId,
    funnel_session_id: funnelSessionId,
    funnel_package_key: funnelPackageKey,
    marketing_consent: marketingConsent,
    consent_timestamp: marketingConsent ? createdAt : undefined,
    quiz_completed_at: createdAt,
    hair_texture: answers.structure,
    hair_texture_label: labelFor(answers.structure, HAIR_TEXTURE_LABELS),
    thickness: answers.thickness,
    thickness_label: labelFor(answers.thickness, THICKNESS_LABELS),
    density: answers.density,
    density_label: labelFor(answers.density, DENSITY_LABELS),
    hair_length: answers.hair_length,
    hair_length_label: labelFor(answers.hair_length, HAIR_LENGTH_LABELS),
    cuticle_condition: answers.fingertest,
    cuticle_condition_label: labelFor(answers.fingertest, CUTICLE_CONDITION_LABELS),
    protein_moisture_balance: answers.pulltest,
    protein_moisture_balance_label: labelFor(answers.pulltest, PROTEIN_MOISTURE_LABELS),
    scalp_type: answers.scalp_type,
    scalp_type_label: labelFor(answers.scalp_type, SCALP_TYPE_LABELS),
    has_scalp_issue: answers.has_scalp_issue,
    scalp_condition: answers.scalp_condition,
    scalp_condition_label: labelFor(answers.scalp_condition, SCALP_CONDITION_LABELS),
    concerns: answers.concerns,
    concern_labels: labelsFor(answers.concerns, PROFILE_CONCERN_LABELS),
    chemical_treatment: answers.treatment,
    chemical_treatment_labels: labelsFor(answers.treatment, TREATMENT_LABELS),
    goals: answers.goals,
    goal_labels: labelsFor(answers.goals, GOAL_LABELS),
  }

  return {
    userId: normalizedEmail,
    identifyTraits,
    eventName: "quiz_profile_submitted",
    eventProperties: {
      source: "quiz_lead_api",
      lead_id: leadId,
      funnel_session_id: funnelSessionId,
      funnel_package_key: funnelPackageKey,
      marketing_consent: marketingConsent,
    },
    shouldIdentify: true,
    shouldTrackProfileSubmitted: true,
  }
}
