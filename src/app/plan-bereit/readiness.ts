import type { SupabaseClient } from "@supabase/supabase-js"
import { hasCompletedQuizDiagnostics } from "@/lib/quiz/completion"
import { HAIR_LENGTH_OPTIONS, HAIR_LENGTHS, type HairLength } from "@/lib/vocabulary/hair-length"
import { buildLegacyQuizStage1Source } from "@/lib/personal-plan/input"
import { canLinkDirectQuizLead } from "@/lib/quiz/link-to-profile"
import {
  buildProfileDataFromPersonalPlanCanonicalProfile,
  buildProfileDataFromQuizAnswers,
} from "@/lib/quiz/link-to-profile"
import type { QuizAnswers } from "@/lib/quiz/types"

type PersonalPlanLead = {
  email: string
  id: string
  quiz_answers?: unknown
  quiz_kind: "legacy" | "personal_plan"
  updated_at?: string | null
  user_id: string | null
}

type PersonalPlanReadiness = {
  ready: boolean
  leadId: string | null
}

type FieldTestEnrollmentRow = {
  id?: unknown
  user_id?: unknown
  lead_id?: unknown
  status?: unknown
  expires_at?: unknown
  revoked_at?: unknown
  manual_access_grant_id?: unknown
  manual_access_grants?: unknown
}

type ManualAccessGrantRow = {
  id?: unknown
  user_id?: unknown
  reason?: unknown
  expires_at?: unknown
  revoked_at?: unknown
}

export type PlanBereitQuizSourceKind = "legacy" | "personal_plan"

export type PlanBereitMissingSourceFact = {
  field: "hair_length"
  question: string
  helper: string
  options: typeof HAIR_LENGTH_OPTIONS
}

export type PlanBereitReadiness =
  | {
      status: "ready"
      leadId: string
      quizSourceKind: PlanBereitQuizSourceKind
      sourceVersion: string | null
    }
  | {
      status: "source_pending"
      leadId: string | null
      quizSourceKind: PlanBereitQuizSourceKind | null
      sourceVersion: string | null
    }
  | {
      status: "missing_source_facts"
      leadId: string
      quizSourceKind: "legacy"
      sourceVersion: string | null
      missingFacts: PlanBereitMissingSourceFact[]
    }
  | {
      status: "invalid_source" | "forbidden" | "transient_error"
      leadId: string | null
      quizSourceKind: PlanBereitQuizSourceKind | null
      sourceVersion: string | null
    }

type ExactReadinessInput = {
  userId: string
  email?: string | null
  leadId?: string | null
  expectedQuizSourceKind?: PlanBereitQuizSourceKind | null
}

type MissingFactPatchInput = ExactReadinessInput & {
  leadId: string
  sourceVersion: string
  field: "hair_length"
  value: HairLength
}

const HAIR_LENGTH_FACT: PlanBereitMissingSourceFact = {
  field: "hair_length",
  question: "Wie lang sind deine Haare aktuell?",
  helper: "Bei Wellen, Locken und krausem Haar zählt die sanft gestreckte Länge einer Strähne.",
  options: HAIR_LENGTH_OPTIONS,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isSupportedQuizKind(value: unknown): value is PlanBereitQuizSourceKind {
  return value === "legacy" || value === "personal_plan"
}

function isHairLength(value: unknown): value is HairLength {
  return typeof value === "string" && (HAIR_LENGTHS as readonly string[]).includes(value)
}

function remainsActiveAfter(value: unknown, now: Date): boolean {
  return (
    typeof value === "string" &&
    !Number.isNaN(new Date(value).getTime()) &&
    new Date(value).getTime() > now.getTime()
  )
}

async function hasActiveFieldTestEnrollment(
  supabase: SupabaseClient,
  userId: string,
  leadId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const { data, error } = await supabase
    .from("personal_plan_test_enrollments")
    .select(
      "id,user_id,lead_id,status,expires_at,revoked_at,manual_access_grant_id,manual_access_grants!inner(id,user_id,reason,expires_at,revoked_at)",
    )
    .eq("user_id", userId)
    .eq("lead_id", leadId)
    .eq("status", "active")
    .maybeSingle()
  if (error) {
    throw new Error(`personal plan field-test enrollment lookup failed: ${error.message}`)
  }
  const enrollment = (data as FieldTestEnrollmentRow | null) ?? null
  const grant = enrollment?.manual_access_grants as ManualAccessGrantRow | null
  return Boolean(
    enrollment &&
    typeof enrollment.id === "string" &&
    enrollment.user_id === userId &&
    enrollment.lead_id === leadId &&
    enrollment.status === "active" &&
    enrollment.revoked_at === null &&
    remainsActiveAfter(enrollment.expires_at, now) &&
    typeof enrollment.manual_access_grant_id === "string" &&
    grant &&
    grant.id === enrollment.manual_access_grant_id &&
    grant.user_id === userId &&
    grant.reason === "tester" &&
    grant.revoked_at === null &&
    remainsActiveAfter(grant.expires_at, now),
  )
}

export async function findPersonalPlanLead(
  supabase: SupabaseClient,
  userId: string,
  email?: string | null,
  leadId?: string | null,
): Promise<PersonalPlanLead | null> {
  if (leadId) {
    const exact = await supabase
      .from("leads")
      .select("id, email, quiz_kind, user_id")
      .eq("id", leadId)
      .eq("quiz_kind", "personal_plan")
      .maybeSingle()

    if (exact.error) {
      throw new Error(`personal plan exact lead lookup failed: ${exact.error.message}`)
    }
    if (!exact.data) return null
    const lead = exact.data as PersonalPlanLead
    if (
      canLinkDirectQuizLead(
        { email: lead.email, userId: lead.user_id },
        { email: email ?? undefined, userId },
      ) ||
      (await hasActiveFieldTestEnrollment(supabase, userId, leadId))
    ) {
      return exact.data as PersonalPlanLead
    }
    return null
  }

  const owned = await supabase
    .from("leads")
    .select("id, email, quiz_kind, user_id")
    .eq("quiz_kind", "personal_plan")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (owned.error) {
    throw new Error(`personal plan lead lookup failed: ${owned.error.message}`)
  }
  if (owned.data) return owned.data as PersonalPlanLead
  return null
}

async function loadExactPlanBereitLead(
  supabase: SupabaseClient,
  input: ExactReadinessInput,
): Promise<{ lead: PersonalPlanLead | null; forbidden: boolean }> {
  if (!input.leadId) {
    return { lead: null, forbidden: false }
  }

  const exact = await supabase
    .from("leads")
    .select("id,email,quiz_kind,quiz_answers,user_id,updated_at")
    .eq("id", input.leadId)
    .maybeSingle()

  if (exact.error) {
    throw new Error(`plan-bereit exact lead lookup failed: ${exact.error.message}`)
  }
  if (!exact.data || !isSupportedQuizKind((exact.data as { quiz_kind?: unknown }).quiz_kind)) {
    return { lead: null, forbidden: false }
  }

  const lead = exact.data as PersonalPlanLead
  const directOwner = canLinkDirectQuizLead(
    { email: lead.email, userId: lead.user_id },
    { email: input.email ?? undefined, userId: input.userId },
  )
  if (directOwner || (await hasActiveFieldTestEnrollment(supabase, input.userId, input.leadId))) {
    return { lead, forbidden: false }
  }

  return { lead: null, forbidden: true }
}

function classifyLegacySource(
  lead: PersonalPlanLead,
):
  | { status: "ready" }
  | { status: "missing_source_facts"; missingFacts: PlanBereitMissingSourceFact[] }
  | { status: "invalid_source" } {
  if (!isRecord(lead.quiz_answers)) {
    return { status: "invalid_source" }
  }

  const source = buildLegacyQuizStage1Source({
    leadId: lead.id,
    answers: lead.quiz_answers as QuizAnswers,
  })
  const answers = source.answers
  const missing = {
    texture: !answers.texture,
    thickness: !answers.thickness,
    density: !answers.density,
    hairLength: !answers.hairLength,
    hairSurface: !answers.hairSurface,
    elasticResponse: !answers.elasticResponse,
    scalpOiliness: !answers.scalpOiliness,
    goals: !answers.goals?.length,
    chemicalTreatments: !answers.chemicalTreatments?.length,
  }
  const missingEntries = Object.entries(missing).filter(([, value]) => value)
  if (missingEntries.length === 0) return { status: "ready" }
  if (missingEntries.length === 1 && missing.hairLength) {
    return { status: "missing_source_facts", missingFacts: [HAIR_LENGTH_FACT] }
  }
  return { status: "invalid_source" }
}

export async function loadPlanBereitReadiness(
  supabase: SupabaseClient,
  input: ExactReadinessInput,
): Promise<PlanBereitReadiness> {
  if (!input.leadId) {
    return {
      status: "source_pending",
      leadId: null,
      quizSourceKind: null,
      sourceVersion: null,
    }
  }

  const { lead, forbidden } = await loadExactPlanBereitLead(supabase, input)
  if (forbidden) {
    return {
      status: "forbidden",
      leadId: input.leadId,
      quizSourceKind: null,
      sourceVersion: null,
    }
  }
  if (!lead) {
    return {
      status: "invalid_source",
      leadId: input.leadId,
      quizSourceKind: null,
      sourceVersion: null,
    }
  }
  if (input.expectedQuizSourceKind && lead.quiz_kind !== input.expectedQuizSourceKind) {
    return {
      status: "invalid_source",
      leadId: lead.id,
      quizSourceKind: lead.quiz_kind,
      sourceVersion: lead.updated_at ?? null,
    }
  }

  if (lead.quiz_kind === "personal_plan") {
    const artifact = await supabase
      .from("personal_plan_prepared_artifacts")
      .select("id")
      .eq("lead_id", lead.id)
      .eq("user_id", input.userId)
      .eq("status", "attached")
      .maybeSingle()

    if (artifact.error) {
      throw new Error(`personal plan artifact readiness failed: ${artifact.error.message}`)
    }

    return {
      status: artifact.data ? "ready" : "source_pending",
      leadId: lead.id,
      quizSourceKind: lead.quiz_kind,
      sourceVersion: lead.updated_at ?? null,
    }
  }

  const source = classifyLegacySource(lead)
  if (source.status === "missing_source_facts") {
    return {
      status: "missing_source_facts",
      leadId: lead.id,
      quizSourceKind: "legacy",
      sourceVersion: lead.updated_at ?? null,
      missingFacts: source.missingFacts,
    }
  }

  return {
    status: source.status,
    leadId: lead.id,
    quizSourceKind: "legacy",
    sourceVersion: lead.updated_at ?? null,
  }
}

async function persistProfileOutput(
  supabase: SupabaseClient,
  userId: string,
  profileData: Record<string, unknown>,
) {
  const output: Record<string, unknown> = { ...profileData, user_id: userId }
  delete output.goals

  const persisted = await supabase.from("hair_profiles").upsert(output, { onConflict: "user_id" })
  if (persisted.error) {
    throw new Error(`hair_profiles upsert failed: ${persisted.error.message}`)
  }
}

export async function linkExactPlanBereitSourceToProfile(
  supabase: SupabaseClient,
  input: ExactReadinessInput,
): Promise<PlanBereitReadiness> {
  const readiness = await loadPlanBereitReadiness(supabase, input)
  if (readiness.status !== "ready" || !readiness.leadId) return readiness

  const { lead } = await loadExactPlanBereitLead(supabase, input)
  if (!lead) return readiness

  if (lead.quiz_kind === "legacy") {
    if (!isRecord(lead.quiz_answers)) return readiness
    await persistProfileOutput(
      supabase,
      input.userId,
      buildProfileDataFromQuizAnswers(lead.quiz_answers as QuizAnswers),
    )
    if (lead.user_id !== input.userId) {
      const linked = await supabase
        .from("leads")
        .update({ user_id: input.userId, status: "linked" })
        .eq("id", lead.id)
      if (linked.error) throw new Error(`leads.user_id update failed: ${linked.error.message}`)
    }
    return readiness
  }

  const artifactLink = await supabase.rpc("link_personal_plan_artifact_to_user", {
    p_lead_id: lead.id,
    p_user_id: input.userId,
  })
  if (artifactLink.error) {
    throw new Error(`personal plan artifact link failed: ${artifactLink.error.message}`)
  }
  const result = Array.isArray(artifactLink.data) ? artifactLink.data[0] : artifactLink.data
  if (isRecord(result) && "canonical_profile" in result) {
    await persistProfileOutput(
      supabase,
      input.userId,
      buildProfileDataFromPersonalPlanCanonicalProfile(result.canonical_profile),
    )
  }

  return readiness
}

export async function updateMissingPlanBereitSourceFact(
  supabase: SupabaseClient,
  input: MissingFactPatchInput,
): Promise<PlanBereitReadiness> {
  if (input.field !== "hair_length" || !isHairLength(input.value)) {
    return {
      status: "invalid_source",
      leadId: input.leadId,
      quizSourceKind: null,
      sourceVersion: null,
    }
  }

  const readiness = await loadPlanBereitReadiness(supabase, input)
  if (readiness.status !== "missing_source_facts") return readiness

  const { lead } = await loadExactPlanBereitLead(supabase, input)
  if (!lead || lead.quiz_kind !== "legacy" || !isRecord(lead.quiz_answers)) return readiness

  const nextAnswers = { ...lead.quiz_answers, hair_length: input.value }
  const updated = await supabase
    .from("leads")
    .update({
      quiz_answers: nextAnswers,
      user_id: input.userId,
      status: "linked",
    })
    .eq("id", input.leadId)
    .eq("user_id", input.userId)
    .eq("quiz_kind", "legacy")
    .eq("updated_at", input.sourceVersion)
    .select("id,email,quiz_kind,quiz_answers,user_id,updated_at")
    .maybeSingle()

  if (updated.error) {
    throw new Error(`plan-bereit source update failed: ${updated.error.message}`)
  }
  if (!updated.data) {
    return {
      status: "source_pending",
      leadId: input.leadId,
      quizSourceKind: "legacy",
      sourceVersion: null,
    }
  }

  await persistProfileOutput(
    supabase,
    input.userId,
    buildProfileDataFromQuizAnswers(nextAnswers as QuizAnswers),
  )

  return loadPlanBereitReadiness(supabase, input)
}

export async function loadPersonalPlanReadiness(
  supabase: SupabaseClient,
  userId: string,
  email?: string | null,
  leadId?: string | null,
): Promise<PersonalPlanReadiness> {
  const lead = await findPersonalPlanLead(supabase, userId, email, leadId)
  if (!lead) return { ready: false, leadId: null }

  const [artifact, profile] = await Promise.all([
    supabase
      .from("personal_plan_prepared_artifacts")
      .select("id")
      .eq("lead_id", lead.id)
      .eq("user_id", userId)
      .eq("status", "attached")
      .maybeSingle(),
    supabase
      .from("hair_profiles")
      .select(
        "hair_texture, thickness, density, cuticle_condition, protein_moisture_balance, scalp_type, scalp_condition, chemical_treatment, concerns",
      )
      .eq("user_id", userId)
      .maybeSingle(),
  ])

  if (artifact.error) {
    throw new Error(`personal plan artifact readiness failed: ${artifact.error.message}`)
  }
  if (profile.error) {
    throw new Error(`personal plan profile readiness failed: ${profile.error.message}`)
  }

  return {
    ready: Boolean(artifact.data) && hasCompletedQuizDiagnostics(profile.data),
    leadId: lead.id,
  }
}
