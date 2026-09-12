import type { SupabaseClient } from "@supabase/supabase-js"
import { hasCompletedQuizDiagnostics } from "@/lib/quiz/completion"
import { HAIR_LENGTH_OPTIONS, HAIR_LENGTHS, type HairLength } from "@/lib/vocabulary/hair-length"
import { buildLegacyQuizStage1Source } from "@/lib/personal-plan/input"
import { canLinkDirectQuizLead } from "@/lib/quiz/link-to-profile"
import { SCAN_FUNNEL_PACKAGE_KEY } from "@/lib/quiz/screen-order"
import { lookupFunnelContextForLead, type FunnelLeadContextLookup } from "@/lib/funnel/server"
import { createStage1PersistenceService } from "@/lib/personal-plan/persistence/stage1-service"
import { createStage1SupabaseDependencies } from "@/lib/personal-plan/persistence/stage1-supabase"
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

type PersonalPlanPreparedArtifact = {
  id: string
  canonical_profile?: unknown
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

/**
 * The server-resolved funnel package of the readiness lead, carried on every
 * outcome so the destination and the copy come from the same resolution that
 * decided provisioning. `null` means organic (no funnel session, or attribution
 * disabled) — never "the lookup failed", which is a `transient_error` instead.
 */
export type PlanBereitResolvedPackage = { funnelPackageKey: string | null }

export type PlanBereitReadiness =
  | ({
      status: "ready"
      leadId: string
      quizSourceKind: PlanBereitQuizSourceKind
      sourceVersion: string | null
    } & PlanBereitResolvedPackage)
  | ({
      status: "source_pending"
      leadId: string | null
      quizSourceKind: PlanBereitQuizSourceKind | null
      sourceVersion: string | null
    } & PlanBereitResolvedPackage)
  | ({
      status: "missing_source_facts"
      leadId: string
      quizSourceKind: "legacy"
      sourceVersion: string | null
      missingFacts: PlanBereitMissingSourceFact[]
    } & PlanBereitResolvedPackage)
  | ({
      status: "invalid_source" | "forbidden" | "transient_error"
      leadId: string | null
      quizSourceKind: PlanBereitQuizSourceKind | null
      sourceVersion: string | null
    } & PlanBereitResolvedPackage)

export type PlanBereitInitialAction = "none" | "link" | "poll"

export type PlanBereitInitialReadiness = {
  status: PlanBereitReadiness["status"] | "checking"
  leadId: string | null
  quizSourceKind: PlanBereitQuizSourceKind | null
  sourceVersion: string | null
  missingFacts: PlanBereitMissingSourceFact[]
  initialAction: PlanBereitInitialAction
} & PlanBereitResolvedPackage

export function needsFreshMigrationQuiz(readiness: {
  status: string
  missingFacts?: readonly { field: string }[]
}): boolean {
  return (
    readiness.status === "invalid_source" ||
    (readiness.status === "missing_source_facts" &&
      !(readiness.missingFacts?.length === 1 && readiness.missingFacts[0].field === "hair_length"))
  )
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

const PROFILE_PROJECTION_FIELDS = [
  "hair_texture",
  "thickness",
  "hair_length",
  "density",
  "cuticle_condition",
  "protein_moisture_balance",
  "scalp_type",
  "scalp_condition",
  "concerns",
  "chemical_treatment",
] as const

type LinkablePlanBereitSource = {
  status: "linkable"
  lead: PersonalPlanLead
  projectedProfile: Record<string, unknown>
  artifact: PersonalPlanPreparedArtifact | null
  funnelPackage: PlanBereitFunnelPackageResolution
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function structurallyEqual(left: unknown, right: unknown): boolean {
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((item, index) => structurallyEqual(item, right[index]))
    )
  }
  if (isRecord(left) || isRecord(right)) {
    if (!isRecord(left) || !isRecord(right)) return false
    const leftKeys = Object.keys(left)
    const rightKeys = Object.keys(right)
    return (
      leftKeys.length === rightKeys.length &&
      leftKeys.every((key) => hasOwn(right, key) && structurallyEqual(left[key], right[key]))
    )
  }
  return Object.is(left, right)
}

function profileMatchesProjected(
  profile: unknown,
  projectedProfile: Record<string, unknown>,
): boolean {
  if (!isRecord(profile)) return false
  return PROFILE_PROJECTION_FIELDS.every((field) => {
    if (!hasOwn(projectedProfile, field)) return true
    return structurallyEqual(projectedProfile[field], profile[field])
  })
}

async function loadProjectedHairProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from("hair_profiles")
    .select(PROFILE_PROJECTION_FIELDS.join(","))
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    throw new Error(`plan-bereit profile readiness failed: ${error.message}`)
  }
  return (data as Record<string, unknown> | null) ?? null
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
  quizSourceKind: PlanBereitQuizSourceKind,
  now: Date = new Date(),
): Promise<boolean> {
  const enrollmentTable =
    quizSourceKind === "legacy" ? "regular_quiz_test_enrollments" : "personal_plan_test_enrollments"
  const { data, error } = await supabase
    .from(enrollmentTable)
    .select(
      "id,user_id,lead_id,status,expires_at,revoked_at,manual_access_grant_id,manual_access_grants!inner(id,user_id,reason,expires_at,revoked_at)",
    )
    .eq("user_id", userId)
    .eq("lead_id", leadId)
    .eq("status", "active")
    .maybeSingle()
  if (error) {
    throw new Error(`${quizSourceKind} field-test enrollment lookup failed: ${error.message}`)
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
      (await hasActiveFieldTestEnrollment(supabase, userId, leadId, "personal_plan"))
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
  if (
    directOwner ||
    (await hasActiveFieldTestEnrollment(supabase, input.userId, input.leadId, lead.quiz_kind))
  ) {
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

async function loadAttachedPersonalPlanArtifact(
  supabase: SupabaseClient,
  leadId: string,
): Promise<PersonalPlanPreparedArtifact | null> {
  const { data, error } = await supabase
    .from("personal_plan_prepared_artifacts")
    .select("id,user_id,canonical_profile")
    .eq("lead_id", leadId)
    .eq("status", "attached")
    .limit(2)

  if (error) {
    throw new Error(`personal plan artifact readiness failed: ${error.message}`)
  }
  const artifacts = Array.isArray(data) ? (data as PersonalPlanPreparedArtifact[]) : []
  if (artifacts.length > 1) {
    throw new Error("personal plan artifact readiness failed: multiple attached artifacts")
  }
  return artifacts[0] ?? null
}

function readinessFromInitial(initial: PlanBereitInitialReadiness): PlanBereitReadiness {
  if (initial.status === "checking") {
    return {
      status: "source_pending",
      leadId: initial.leadId,
      quizSourceKind: initial.quizSourceKind,
      sourceVersion: initial.sourceVersion,
      funnelPackageKey: initial.funnelPackageKey,
    }
  }
  if (initial.status === "missing_source_facts") {
    return {
      status: "missing_source_facts",
      leadId: initial.leadId ?? "",
      quizSourceKind: "legacy",
      sourceVersion: initial.sourceVersion,
      missingFacts: initial.missingFacts,
      funnelPackageKey: initial.funnelPackageKey,
    }
  }
  return {
    status: initial.status,
    leadId: initial.leadId,
    quizSourceKind: initial.quizSourceKind,
    sourceVersion: initial.sourceVersion,
    funnelPackageKey: initial.funnelPackageKey,
  } as PlanBereitReadiness
}

async function loadPlanBereitLinkCandidate(
  supabase: SupabaseClient,
  input: ExactReadinessInput,
  deps: PlanBereitProvisioningDependencies = planBereitProvisioningDefaults,
): Promise<PlanBereitReadiness | LinkablePlanBereitSource> {
  if (!input.leadId) {
    return {
      status: "source_pending",
      leadId: null,
      quizSourceKind: null,
      sourceVersion: null,
      funnelPackageKey: null,
    }
  }

  const { lead, forbidden } = await loadExactPlanBereitLead(supabase, input)
  if (forbidden) {
    return {
      status: "forbidden",
      leadId: input.leadId,
      quizSourceKind: null,
      sourceVersion: null,
      funnelPackageKey: null,
    }
  }
  if (!lead) {
    return {
      status: "invalid_source",
      leadId: input.leadId,
      quizSourceKind: null,
      sourceVersion: null,
      funnelPackageKey: null,
    }
  }

  // Resolved once per readiness pass, before any outcome is built: provisioning and
  // the destination/copy the client renders must never come from two lookups that
  // can disagree.
  const funnelPackage = await resolveLeadFunnelPackage(lead, deps)
  const funnelPackageKey = resolvedPackageKey(funnelPackage)

  if (input.expectedQuizSourceKind && lead.quiz_kind !== input.expectedQuizSourceKind) {
    return {
      status: "invalid_source",
      leadId: lead.id,
      quizSourceKind: lead.quiz_kind,
      sourceVersion: lead.updated_at ?? null,
      funnelPackageKey,
    }
  }

  if (lead.quiz_kind === "personal_plan") {
    const artifact = await loadAttachedPersonalPlanArtifact(supabase, lead.id)
    if (!artifact) {
      return {
        status: "source_pending",
        leadId: lead.id,
        quizSourceKind: lead.quiz_kind,
        sourceVersion: lead.updated_at ?? null,
        funnelPackageKey,
      }
    }
    try {
      return {
        status: "linkable",
        lead,
        artifact,
        projectedProfile: buildProfileDataFromPersonalPlanCanonicalProfile(
          artifact.canonical_profile,
        ),
        funnelPackage,
      }
    } catch {
      return {
        status: "invalid_source",
        leadId: lead.id,
        quizSourceKind: lead.quiz_kind,
        sourceVersion: lead.updated_at ?? null,
        funnelPackageKey,
      }
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
      funnelPackageKey,
    }
  }

  if (source.status === "invalid_source") {
    return {
      status: "invalid_source",
      leadId: lead.id,
      quizSourceKind: "legacy",
      sourceVersion: lead.updated_at ?? null,
      funnelPackageKey,
    }
  }

  return {
    status: "linkable",
    lead,
    artifact: null,
    projectedProfile: buildProfileDataFromQuizAnswers(lead.quiz_answers as QuizAnswers),
    funnelPackage,
  }
}

export async function loadPlanBereitInitialReadiness(
  supabase: SupabaseClient,
  input: ExactReadinessInput,
  deps: PlanBereitProvisioningDependencies = planBereitProvisioningDefaults,
): Promise<PlanBereitInitialReadiness> {
  const candidate = await loadPlanBereitLinkCandidate(supabase, input, deps)
  if (candidate.status !== "linkable") {
    return {
      ...candidate,
      missingFacts: candidate.status === "missing_source_facts" ? candidate.missingFacts : [],
      initialAction: candidate.status === "source_pending" ? "poll" : "none",
    }
  }

  const profile = await loadProjectedHairProfile(supabase, input.userId)
  const alreadyProjected =
    candidate.lead.quiz_kind === "legacy"
      ? candidate.lead.user_id === input.userId &&
        profileMatchesProjected(profile, candidate.projectedProfile)
      : candidate.artifact?.user_id === input.userId &&
        profileMatchesProjected(profile, candidate.projectedProfile)

  if (alreadyProjected) {
    // `ready` is the CTA gate. For a `scan_v1` buyer it must additionally mean "the
    // initial need snapshot exists", so provisioning runs here — the single place
    // every `ready` outcome passes through (first page render, status GET, and the
    // tail of the link POST). A failure reports `transient_error`, whose retry is a
    // plain GET and therefore re-enters exactly this branch.
    const provisioning = await ensureScanBuyerProvisioned(
      supabase,
      {
        userId: input.userId,
        leadId: candidate.lead.id,
        quizSourceKind: candidate.lead.quiz_kind,
        funnelPackage: candidate.funnelPackage,
      },
      deps,
    )
    if (provisioning.status === "failed") {
      return {
        status: "transient_error",
        leadId: candidate.lead.id,
        quizSourceKind: candidate.lead.quiz_kind,
        sourceVersion: candidate.lead.updated_at ?? null,
        missingFacts: [],
        initialAction: "none",
        funnelPackageKey: provisioning.funnelPackageKey,
      }
    }
    return {
      status: "ready",
      leadId: candidate.lead.id,
      quizSourceKind: candidate.lead.quiz_kind,
      sourceVersion: candidate.lead.updated_at ?? null,
      missingFacts: [],
      initialAction: "none",
      funnelPackageKey: provisioning.funnelPackageKey,
    }
  }

  return {
    status: "checking",
    leadId: candidate.lead.id,
    quizSourceKind: candidate.lead.quiz_kind,
    sourceVersion: candidate.lead.updated_at ?? null,
    missingFacts: [],
    initialAction: "link",
    funnelPackageKey: resolvedPackageKey(candidate.funnelPackage),
  }
}

export async function loadPlanBereitReadiness(
  supabase: SupabaseClient,
  input: ExactReadinessInput,
  deps: PlanBereitProvisioningDependencies = planBereitProvisioningDefaults,
): Promise<PlanBereitReadiness> {
  return readinessFromInitial(await loadPlanBereitInitialReadiness(supabase, input, deps))
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

/**
 * Package identity of a readiness lead. `resolved` with a `null` key is an organic
 * buyer (no funnel session, or attribution switched off); `unavailable` is a broken
 * lookup and must never be read as organic — the scanner destination, the arrival
 * copy and the Stage-1 provisioning all hang off this one answer.
 */
export type PlanBereitFunnelPackageResolution =
  | { kind: "resolved"; packageKey: string | null }
  | { kind: "unavailable" }

function resolvedPackageKey(resolution: PlanBereitFunnelPackageResolution): string | null {
  return resolution.kind === "resolved" ? resolution.packageKey : null
}

/**
 * The two server lookups the scanner-first provisioning needs, injected so the
 * readiness tests can drive the `scan_v1` branch without a funnel session or a
 * Stage-1 stack.
 */
export type PlanBereitProvisioningDependencies = {
  /** Package identity of a lead — always server-owned (`funnel_sessions`), never client input. */
  resolveFunnelPackage: (leadId: string) => Promise<PlanBereitFunnelPackageResolution>
  /** The exact provisioning `/plan-start` performs on render; idempotent (reuses an existing plan). */
  provisionStage1Plan: (supabase: SupabaseClient, userId: string) => Promise<{ status: string }>
}

/**
 * The production package lookup: a returned or thrown database error becomes
 * `unavailable`, a missing `funnel_sessions` row becomes `resolved` with a null key.
 */
export async function resolvePlanBereitFunnelPackage(
  leadId: string,
  lookup: (leadId: string) => Promise<FunnelLeadContextLookup> = lookupFunnelContextForLead,
): Promise<PlanBereitFunnelPackageResolution> {
  const result = await lookup(leadId).catch(() => ({ kind: "unavailable" }) as const)
  return result.kind === "resolved"
    ? { kind: "resolved", packageKey: result.context?.packageKey ?? null }
    : { kind: "unavailable" }
}

const planBereitProvisioningDefaults: PlanBereitProvisioningDependencies = {
  resolveFunnelPackage: resolvePlanBereitFunnelPackage,
  provisionStage1Plan: (supabase, userId) =>
    createStage1PersistenceService(
      createStage1SupabaseDependencies(supabase as never),
    ).loadOrCreate({ userId }),
}

/**
 * `personal_plan` sources are never scanner buyers (the `scan_v1` package runs the
 * legacy quiz), so they keep their pre-scanner behaviour: no lookup, organic copy.
 * An injected lookup that throws is an unavailable lookup, not an organic buyer.
 */
async function resolveLeadFunnelPackage(
  lead: PersonalPlanLead,
  deps: PlanBereitProvisioningDependencies,
): Promise<PlanBereitFunnelPackageResolution> {
  if (lead.quiz_kind !== "legacy") return { kind: "resolved", packageKey: null }
  try {
    return await deps.resolveFunnelPackage(lead.id)
  } catch {
    return { kind: "unavailable" }
  }
}

export async function linkExactPlanBereitSourceToProfile(
  supabase: SupabaseClient,
  input: ExactReadinessInput,
  deps: PlanBereitProvisioningDependencies = planBereitProvisioningDefaults,
): Promise<PlanBereitReadiness> {
  const candidate = await loadPlanBereitLinkCandidate(supabase, input, deps)
  if (candidate.status !== "linkable") return candidate
  const { lead } = candidate

  if (lead.quiz_kind === "legacy") {
    await persistProfileOutput(supabase, input.userId, candidate.projectedProfile)
    if (lead.user_id !== input.userId) {
      const linked = await supabase
        .from("leads")
        .update({ user_id: input.userId, status: "linked" })
        .eq("id", lead.id)
      if (linked.error) throw new Error(`leads.user_id update failed: ${linked.error.message}`)
    }
    const provisioning = await ensureScanBuyerProvisioned(
      supabase,
      {
        userId: input.userId,
        leadId: lead.id,
        quizSourceKind: "legacy",
        funnelPackage: candidate.funnelPackage,
      },
      deps,
    )
    if (provisioning.status === "failed") {
      return {
        status: "transient_error",
        leadId: lead.id,
        quizSourceKind: "legacy",
        sourceVersion: lead.updated_at ?? null,
        funnelPackageKey: provisioning.funnelPackageKey,
      }
    }
    return loadPlanBereitReadiness(supabase, input, deps)
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

  return loadPlanBereitReadiness(supabase, input, deps)
}

export type ScanBuyerProvisioningResult =
  | { status: "not_applicable"; funnelPackageKey: string | null }
  | { status: "provisioned"; funnelPackageKey: string }
  | { status: "failed"; reason: string; funnelPackageKey: string | null }

/**
 * A `scan_v1` buyer lands on `/scan`, not `/plan-start` — so the initial need snapshot
 * `/plan-start` used to create on render has to exist before the buyer ever sees the
 * ready CTA, otherwise the scanner opens with no profile (`profile_missing`).
 *
 * Idempotent: it is the same `loadOrCreate` `/plan-start` performs on render and reuses
 * an existing plan. Callers therefore run it on every path that can report `ready`.
 * It must run AFTER the `leads.user_id` link: Stage 1 resolves the entitlement through
 * the enrollment, which needs exactly that link.
 *
 * A failure is reported, never swallowed — the callers turn it into `transient_error`
 * so the buyer sees a retry instead of an empty camera. Other funnel packages and
 * `personal_plan` sources keep the pre-existing behaviour untouched (no lookup, no write).
 */
export async function ensureScanBuyerProvisioned(
  supabase: SupabaseClient,
  input: {
    userId: string
    leadId: string
    quizSourceKind: PlanBereitQuizSourceKind
    funnelPackage: PlanBereitFunnelPackageResolution
  },
  deps: PlanBereitProvisioningDependencies = planBereitProvisioningDefaults,
): Promise<ScanBuyerProvisioningResult> {
  if (input.quizSourceKind !== "legacy") return { status: "not_applicable", funnelPackageKey: null }
  if (input.funnelPackage.kind === "unavailable") {
    // Reading a broken lookup as organic would hand a paid scanner buyer the plan
    // destination and no need snapshot. A retryable error is the safe answer.
    return { status: "failed", reason: "funnel_package_unavailable", funnelPackageKey: null }
  }
  const funnelPackageKey = input.funnelPackage.packageKey
  if (funnelPackageKey !== SCAN_FUNNEL_PACKAGE_KEY) {
    return { status: "not_applicable", funnelPackageKey }
  }
  const provisioned = await deps.provisionStage1Plan(supabase, input.userId)
  return provisioned.status === "completed"
    ? { status: "provisioned", funnelPackageKey: SCAN_FUNNEL_PACKAGE_KEY }
    : { status: "failed", reason: provisioned.status, funnelPackageKey }
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
      funnelPackageKey: null,
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
      funnelPackageKey: readiness.funnelPackageKey,
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
