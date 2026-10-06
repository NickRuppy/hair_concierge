import "server-only"
import { createHash } from "node:crypto"
import { computeNeedPlan } from "@/lib/personal-plan/compute-stage1"
import {
  buildLegacyQuizStage1Source,
  parseSupportedStage1Source,
  hashSupportedPersonalPlanQuizEnvelope,
} from "@/lib/personal-plan/input"
import { hashPersonalPlanNeedVersionInput } from "@/lib/personal-plan/persistence"
import { PERSONAL_PLAN_STAGE1_COMPUTATION_VERSION } from "@/lib/personal-plan/persistence/stage1-service"
import {
  resolveAssumedAnswers,
  selectStage2Answers,
} from "@/lib/personal-plan/refinement/assumed-defaults"
import { userAnsweredQuestionIds } from "@/lib/personal-plan/refinement/answer-provenance"
import {
  deriveStage2TriggerContext,
  buildPlanRoutineContextFromCompletedRefinement,
} from "@/lib/personal-plan/refinement/stage1-adapter"
import {
  isStage2QuestionAnswerValid,
  getStage2ModulePathStates,
} from "@/lib/personal-plan/refinement/question-path"
import type {
  PersonalPlanRefinementAnswersV1,
  Stage2AnswerProvenance,
  Stage2QuestionId,
} from "@/lib/personal-plan/refinement/types"
import type { InitialNeedPlanSnapshot, SupportedStage1Source } from "@/lib/personal-plan/types"
import { adaptPersonalPlanAnswersForOffer } from "@/lib/personal-plan-quiz/offer-adapter"
import { hasCompletedQuizDiagnostics } from "@/lib/quiz/completion"
import {
  normalizeStoredQuizAnswers,
  projectQuizAnswersToLegacyVocabulary,
} from "@/lib/quiz/normalization"
import type { QuizAnswers } from "@/lib/quiz/types"
import type { ScanEvaluationContext } from "./profile-context"

export type ScannerNeedSource = {
  id: string
  user_id: string
  personal_plan_id: string
  kind: "initial" | "refined"
  input_snapshot: unknown
  output_snapshot: InitialNeedPlanSnapshot
  schema_version: number
  computation_version: string
  input_hash: string
  parent_need_version_id?: string | null
}
export type ScannerRefinementSource = {
  base_initial_need_version_id: string
  result_refined_need_version_id: string | null
  answers: PersonalPlanRefinementAnswersV1
  completed_question_ids: Stage2QuestionId[]
  answer_provenance: Stage2AnswerProvenance
  module_projections?: Record<string, { needVersionId: string; projectedAtRevision: number }>
  revision: number
  status: "in_progress" | "complete" | "stale"
}
export type ScannerSourceRead = {
  userId: string
  sourceRevision: string
  profileRevision: string
  profile: Record<string, unknown> | null
  plan: {
    id: string
    current_initial_need_version_id: string | null
    current_refined_need_version_id: string | null
  } | null
  initial: ScannerNeedSource | null
  refined: ScannerNeedSource | null
  refinements: ScannerRefinementSource[]
  edit?: {
    profileRevision: string
    quizAnswers: QuizAnswers
    profile?: Record<string, unknown>
    input: {
      source: SupportedStage1Source
      userRefinementAnswers: PersonalPlanRefinementAnswersV1
      userRefinementQuestionIds: Stage2QuestionId[]
    }
  } | null
  paidBindings?: Record<string, string>
  leads: { id: string; user_id: string; quiz_kind: string; quiz_answers: QuizAnswers }[]
}
export type ScannerPaidSourceRejection = {
  needVersionId: string
  boundProfileRevision: string | null
  reason:
    | "missing_profile_binding"
    | "profile_revision_mismatch"
    | "unsupported_paid_source"
    | "basic_answers_mismatch"
}

// Bump when the immutable context input contract changes. Stage-1's engine
// version is independent: adding provenance must not collide with old inputs.
const SCANNER_CONTEXT_INPUT_SCHEMA_VERSION = 2

export type PreparedScannerContext = ScanEvaluationContext & {
  sourceHash: string
  source: SupportedStage1Source
  userRefinementAnswers: PersonalPlanRefinementAnswersV1
  assumedQuestionIds: Stage2QuestionId[]
  userRefinementQuestionIds: Stage2QuestionId[]
  /** Observational only; excluded from persisted evaluation inputs and identity. */
  rejectedPaidSources?: ScannerPaidSourceRejection[]
}

export function scannerSourceHash(value: unknown): string {
  const stable = (item: unknown): unknown =>
    Array.isArray(item)
      ? item.map(stable)
      : item && typeof item === "object"
        ? Object.fromEntries(
            Object.entries(item)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, value]) => [key, stable(value)]),
          )
        : item
  return createHash("sha256")
    .update(JSON.stringify(stable(value)))
    .digest("hex")
}

/** Reverse only the persisted legacy projection's lossless factual fields. */
export function currentLegacyAnswers(profile: Record<string, unknown>): QuizAnswers {
  const lookup = (value: unknown, map: Record<string, string>) =>
    typeof value === "string" ? map[value] : undefined
  return {
    structure: profile.hair_texture as string,
    thickness: profile.thickness as string,
    density: profile.density as string,
    hair_length: profile.hair_length as QuizAnswers["hair_length"],
    fingertest: lookup(profile.cuticle_condition, {
      smooth: "glatt",
      slightly_rough: "leicht_uneben",
      rough: "rau",
    }),
    pulltest: profile.protein_moisture_balance as string,
    scalp_type: lookup(profile.scalp_type, {
      oily: "fettig",
      balanced: "ausgeglichen",
      dry: "trocken",
    }),
    has_scalp_issue: profile.scalp_condition !== null,
    scalp_condition: lookup(profile.scalp_condition, {
      dandruff: "schuppen",
      dry_flakes: "trockene_schuppen",
      irritated: "gereizt",
    }),
    treatment: Array.isArray(profile.chemical_treatment)
      ? (profile.chemical_treatment as string[]).map(
          (value) =>
            lookup(value, {
              natural: "natur",
              colored: "gefaerbt",
              bleached: "blondiert",
              permed: "dauerwelle",
              chemically_straightened: "chemisch_geglaettet",
            }) ?? value,
        )
      : undefined,
    goals: profile.goals as QuizAnswers["goals"],
    concerns: profile.concerns as QuizAnswers["concerns"],
  }
}

/** Preserve raw diagnostic selections/text only where their factual projection still matches. */
export function editableScannerQuizAnswers(read: ScannerSourceRead): QuizAnswers {
  if (!hasCompletedQuizDiagnostics(read.profile as never))
    throw new Error("scan_profile_context_unavailable")
  const current = currentLegacyAnswers(read.profile!)
  const paid = [read.refined, read.initial]
    .map((need) =>
      need && need.user_id === read.userId
        ? parseSupportedStage1Source(need.output_snapshot?.sourceQuiz)
        : null,
    )
    .find((parsed) => parsed?.ok && sourceCompatible(parsed.source, current))
  const fromPaid = paid?.ok
    ? ({
        ...adaptPersonalPlanAnswersForOffer(paid.source.answers as never).answers,
        concerns: paid.source.answers.currentConcerns,
        goals: paid.source.answers.goals,
      } as QuizAnswers)
    : undefined
  const raw =
    read.edit?.quizAnswers ??
    read.leads.find(
      (lead) =>
        lead.user_id === read.userId &&
        lead.quiz_kind === "legacy" &&
        scannerSourceHash(normalizedBasics(lead.quiz_answers)) ===
          scannerSourceHash(normalizedBasics(current)),
    )?.quiz_answers ??
    fromPaid
  if (!raw) return current
  // A current paid snapshot retains its explicit diagnostic selections; the
  // offer projection may have inferred additional legacy goals from concerns.
  if (raw === fromPaid) return { ...current, concerns: raw.concerns, goals: raw.goals }
  const before = normalizedBasics(
    read.edit?.profile ? currentLegacyAnswers(read.edit.profile) : raw,
  ) as Record<string, unknown>
  const now = normalizedBasics(current) as Record<string, unknown>
  const result = { ...current } as Record<string, unknown>
  for (const key of Object.keys(current)) {
    if (scannerSourceHash(before[key] ?? null) === scannerSourceHash(now[key] ?? null))
      result[key] = raw[key as keyof QuizAnswers]
  }
  if (scannerSourceHash(before.concerns) === scannerSourceHash(now.concerns))
    result.concerns_other_text = raw.concerns_other_text
  return result as QuizAnswers
}

function normalizedBasics(answers: QuizAnswers): unknown {
  const normalized = normalizeStoredQuizAnswers(answers)
  const legacy = projectQuizAnswersToLegacyVocabulary(normalized)
  return {
    ...normalized,
    scalp_condition: normalized.has_scalp_issue ? normalized.scalp_condition : undefined,
    goals: [...legacy.goals].sort(),
    concerns: [...legacy.concerns].sort(),
    concerns_other_text: undefined,
  }
}

function sourceCompatible(source: SupportedStage1Source, current: QuizAnswers): boolean {
  const projected =
    source.kind === "legacy_quiz"
      ? {
          // All source answers use the same diagnostic vocabulary. The established
          // offer projection below handles legacy concern/goal aliases consistently.
          ...adaptPersonalPlanAnswersForOffer(source.answers).answers,
        }
      : adaptPersonalPlanAnswersForOffer(source.answers as never).answers
  return (
    scannerSourceHash(normalizedBasics(projected)) === scannerSourceHash(normalizedBasics(current))
  )
}

export function rebaseScannerSource(
  source: SupportedStage1Source,
  current: QuizAnswers,
  previous?: QuizAnswers,
): SupportedStage1Source {
  const fresh = buildLegacyQuizStage1Source({
    leadId: source.kind === "legacy_quiz" ? source.leadId : "profile",
    answers: current,
  })
  const projected = (
    previous
      ? normalizeStoredQuizAnswers(previous)
      : normalizedBasics(adaptPersonalPlanAnswersForOffer(source.answers as never).answers)
  ) as Record<string, unknown>
  const actual = (
    previous ? normalizeStoredQuizAnswers(current) : normalizedBasics(current)
  ) as Record<string, unknown>
  const keys: Record<string, keyof typeof fresh.answers> = {
    structure: "texture",
    thickness: "thickness",
    density: "density",
    hair_length: "hairLength",
    fingertest: "hairSurface",
    pulltest: "elasticResponse",
    scalp_type: "scalpOiliness",
    scalp_condition: "scalpConcerns",
    has_scalp_issue: "scalpConcerns",
    treatment: "chemicalTreatments",
    concerns: "currentConcerns",
    goals: "goals",
  }
  const answers = { ...source.answers } as Record<string, unknown>
  for (const [legacyKey, key] of Object.entries(keys)) {
    if (JSON.stringify(projected[legacyKey]) !== JSON.stringify(actual[legacyKey]))
      answers[key] = fresh.answers[key]
  }
  const recurrence = answers.concernRecurrence as { concernId: string } | undefined
  if (recurrence && !(answers.currentConcerns as string[]).includes(recurrence.concernId))
    delete answers.concernRecurrence
  return { ...source, answers } as SupportedStage1Source
}

function validNeed(
  read: ScannerSourceRead,
  need: ScannerNeedSource | null,
  kind: "initial" | "refined",
): SupportedStage1Source | null {
  if (
    !need ||
    !read.plan ||
    need.user_id !== read.userId ||
    need.personal_plan_id !== read.plan.id ||
    need.kind !== kind ||
    need.id !==
      (kind === "refined"
        ? read.plan.current_refined_need_version_id
        : read.plan.current_initial_need_version_id)
  )
    return null
  const parsed = parseSupportedStage1Source(need.output_snapshot?.sourceQuiz)
  if (
    !parsed.ok ||
    need.schema_version !== 1 ||
    need.computation_version !== PERSONAL_PLAN_STAGE1_COMPUTATION_VERSION ||
    need.output_snapshot.schemaVersion !== need.schema_version ||
    need.output_snapshot.computationVersion !== need.computation_version ||
    need.output_snapshot.snapshotKind !== "initial_need" ||
    need.output_snapshot.inputHash !== hashSupportedPersonalPlanQuizEnvelope(parsed.source) ||
    !Array.isArray(need.output_snapshot.decisions) ||
    !Array.isArray(need.output_snapshot.renderedOrder) ||
    !need.output_snapshot.profile?.hair ||
    !need.output_snapshot.profile.scalp ||
    !need.output_snapshot.assessments
  )
    throw new Error("scan_profile_context_unavailable")
  if (
    kind === "initial" &&
    scannerSourceHash(need.input_snapshot) !== scannerSourceHash(parsed.source)
  )
    throw new Error("scan_profile_context_unavailable")
  if (
    kind === "refined" &&
    need.parent_need_version_id !== read.plan.current_initial_need_version_id
  )
    throw new Error("scan_profile_context_unavailable")
  const inputHash = hashPersonalPlanNeedVersionInput({
    schemaVersion: need.schema_version,
    computationVersion: need.computation_version,
    inputSnapshot: need.input_snapshot as never,
    ...(kind === "refined" ? { parentNeedVersionId: need.parent_need_version_id! } : {}),
  })
  if (inputHash !== need.input_hash) throw new Error("scan_profile_context_unavailable")
  return parsed.source
}

/** One deterministic scanner projection; paid storage is source evidence only. */
export function prepareScannerContext(read: ScannerSourceRead): PreparedScannerContext | null {
  if (!hasCompletedQuizDiagnostics(read.profile as never)) return null
  const current = currentLegacyAnswers(read.profile!)
  const rejectedPaidSources: ScannerPaidSourceRejection[] = []
  const eligiblePaid = (need: ScannerNeedSource | null) => {
    if (!read.edit) return true
    if (!need) return false
    const boundProfileRevision = read.paidBindings?.[need.id] ?? null
    const reject = (reason: ScannerPaidSourceRejection["reason"]) => {
      rejectedPaidSources.push({ needVersionId: need.id, boundProfileRevision, reason })
      return false
    }
    if (boundProfileRevision === null) return reject("missing_profile_binding")
    if (boundProfileRevision !== read.profileRevision) return reject("profile_revision_mismatch")
    const parsed = parseSupportedStage1Source(need.output_snapshot?.sourceQuiz)
    if (!parsed.ok) return reject("unsupported_paid_source")
    const fresh = buildLegacyQuizStage1Source({
      leadId: "profile",
      answers: editableScannerQuizAnswers(read),
    })
    const basicKeys = [
      "texture",
      "thickness",
      "density",
      "hairLength",
      "hairSurface",
      "elasticResponse",
      "scalpOiliness",
      "scalpConcerns",
      "chemicalTreatments",
      "currentConcerns",
      "goals",
    ] as const
    const basics = (answers: SupportedStage1Source["answers"]) =>
      Object.fromEntries(
        basicKeys.map((key) => {
          const value = answers[key]
          return [key, Array.isArray(value) ? [...value].sort() : value]
        }),
      )
    if (
      scannerSourceHash(basics(parsed.source.answers)) !== scannerSourceHash(basics(fresh.answers))
    )
      return reject("basic_answers_mismatch")
    return true
  }
  const initial = eligiblePaid(read.initial) ? validNeed(read, read.initial, "initial") : null
  const refined = eligiblePaid(read.refined) ? validNeed(read, read.refined, "refined") : null
  const edited = read.edit ? parseSupportedStage1Source(read.edit.input.source) : null
  if (edited && !edited.ok) throw new Error("scan_profile_context_unavailable")
  const paidSource =
    refined && sourceCompatible(refined, current)
      ? refined
      : initial && sourceCompatible(initial, current)
        ? initial
        : null
  let source: SupportedStage1Source | null =
    paidSource ??
    (edited?.ok
      ? rebaseScannerSource(edited.source, editableScannerQuizAnswers(read), read.edit!.quizAnswers)
      : null)
  // A completed owner source is required even if a legacy profile row happens
  // to contain all diagnostics. No email matching, arbitrary newest lead or defaults.
  const eligible = read.leads
    .filter(
      (lead) =>
        lead.user_id === read.userId &&
        lead.quiz_kind === "legacy" &&
        Array.isArray(lead.quiz_answers?.concerns) &&
        Array.isArray(lead.quiz_answers.goals) &&
        // Normalization otherwise fills omitted scalp issue answers with false.
        typeof lead.quiz_answers.has_scalp_issue === "boolean" &&
        (!lead.quiz_answers.has_scalp_issue || Boolean(lead.quiz_answers.scalp_condition)),
    )
    .map((lead) => ({
      id: lead.id,
      source: buildLegacyQuizStage1Source({
        leadId: lead.id,
        answers: normalizeStoredQuizAnswers(lead.quiz_answers),
      }),
    }))
    .filter((entry) => parseSupportedStage1Source(entry.source).ok)
  if (!source && !initial && !refined && eligible.length === 0) return null
  if (!source) {
    const candidates = eligible.filter((entry) => sourceCompatible(entry.source, current))
    if (
      !initial &&
      !refined &&
      new Set(candidates.map((entry) => scannerSourceHash(entry.source.answers))).size > 1
    )
      throw new Error("scan_profile_context_unavailable")
    const prior =
      refined ?? initial ?? candidates.sort((a, b) => a.id.localeCompare(b.id))[0]?.source
    source = prior
      ? rebaseScannerSource(prior, current)
      : buildLegacyQuizStage1Source({
          leadId: eligible.map((entry) => entry.id).sort()[0],
          answers: current,
        })
    if (!parseSupportedStage1Source(source).ok) return null
  }
  const base = computeNeedPlan({
    rawEnvelope: source,
    artifactId:
      source.kind === "legacy_quiz"
        ? source.leadId
        : // The edit publisher deliberately detaches old paid pointers. Reads
          // must retain that same artifact identity for immutable output equality.
          !paidSource && edited?.ok
          ? "profile"
          : (read.initial?.id ?? read.refined?.id ?? "profile"),
    projection: "initial_quiz",
    computationVersion: PERSONAL_PLAN_STAGE1_COMPUTATION_VERSION,
    createdAt: "1970-01-01T00:00:00.000Z",
  })
  if (base.status !== "ready") throw new Error("scan_profile_context_unavailable")
  let snapshot = base.snapshot
  let userRefinementAnswers: PersonalPlanRefinementAnswersV1 = {}
  let assumedQuestionIds: Stage2QuestionId[] = []
  let userRefinementQuestionIds: Stage2QuestionId[] = []
  let retainedAnswers = read.edit?.input.userRefinementAnswers
  let retainedIds = read.edit?.input.userRefinementQuestionIds ?? []
  let snapshotSource: "initial" | "refined" = "initial"
  if (refined) {
    const need = read.refined!
    const matching = read.refinements.filter(
      (draft) =>
        draft.base_initial_need_version_id === read.plan!.current_initial_need_version_id &&
        (draft.result_refined_need_version_id === need.id ||
          Object.values(draft.module_projections ?? {}).some(
            (projection) => projection.needVersionId === need.id,
          )),
    )
    if (matching.length !== 1) throw new Error("scan_profile_context_unavailable")
    const draft = matching[0]
    const terminalPublication =
      draft.status === "complete" && draft.result_refined_need_version_id === need.id
    const currentModulePublication =
      draft.status === "in_progress" &&
      Object.values(draft.module_projections ?? {}).some(
        (projection) =>
          projection.needVersionId === need.id && projection.projectedAtRevision === draft.revision,
      )
    // Module publication deliberately leaves answers/revision untouched. Its
    // persisted revision is proof that the mutable provenance still describes
    // this version; after any save, use retry until another version is published.
    if (!terminalPublication && !currentModulePublication)
      throw new Error("scan_profile_context_unavailable")
    // A draft may already be editing the next publication. Never consume its
    // unpublished answers under the current immutable version's identity.
    const published = need.input_snapshot as {
      answers?: PersonalPlanRefinementAnswersV1
      completedQuestionIds?: Stage2QuestionId[]
    }
    if (!published.answers || !Array.isArray(published.completedQuestionIds))
      throw new Error("scan_profile_context_unavailable")
    if (
      terminalPublication &&
      published.completedQuestionIds.some((id) => !draft.completed_question_ids.includes(id))
    )
      throw new Error("scan_profile_context_unavailable")
    const ids = userAnsweredQuestionIds(
      draft.completed_question_ids,
      draft.answer_provenance,
    ).filter((id) => published.completedQuestionIds!.includes(id))
    if (
      ids.some(
        (id) =>
          !isStage2QuestionAnswerValid(id, published.answers!) ||
          scannerSourceHash(selectStage2Answers(draft.answers, [id])) !==
            scannerSourceHash(selectStage2Answers(published.answers!, [id])),
      )
    )
      throw new Error("scan_profile_context_unavailable")
    retainedAnswers = selectStage2Answers(published.answers, ids)
    retainedIds = ids
  }
  if (retainedAnswers) {
    const ids = retainedIds
    if (ids.some((id) => !isStage2QuestionAnswerValid(id, retainedAnswers!)))
      throw new Error("scan_profile_context_unavailable")
    const triggerContext = deriveStage2TriggerContext(base.snapshot)
    const resolved = resolveAssumedAnswers({
      triggerContext,
      answers: retainedAnswers,
      userAnsweredQuestionIds: ids,
    })
    userRefinementAnswers = selectStage2Answers(
      resolved.answers,
      ids.filter((id) => resolved.orderedQuestionIds.includes(id)),
    )
    userRefinementQuestionIds = ids.filter((id) => resolved.orderedQuestionIds.includes(id))
    assumedQuestionIds = resolved.assumedQuestionIds
    const moduleStates = getStage2ModulePathStates(resolved.orderedQuestionIds, ids)
    const computed = computeNeedPlan({
      rawEnvelope: source,
      artifactId: base.snapshot.profile.source.artifactId,
      projection: "refined_post_plan",
      computationVersion: PERSONAL_PLAN_STAGE1_COMPUTATION_VERSION,
      createdAt: base.snapshot.createdAt,
      routine: buildPlanRoutineContextFromCompletedRefinement({
        triggerContext,
        answers: resolved.answers,
        completedQuestionIds: resolved.orderedQuestionIds,
        habitsModuleUserComplete: moduleStates.habits.status === "complete",
      }),
    })
    if (computed.status !== "ready") throw new Error("scan_profile_context_unavailable")
    snapshot = computed.snapshot
    snapshotSource = "refined"
  }
  const sourceHash = scannerSourceHash({
    inputSchemaVersion: SCANNER_CONTEXT_INPUT_SCHEMA_VERSION,
    source,
    userRefinementAnswers,
    userRefinementQuestionIds,
    assumedQuestionIds,
    routine: snapshot.profile.routine,
    engine: snapshot.computationVersion,
  })
  return {
    snapshot,
    snapshotSource,
    sourceHash,
    source,
    userRefinementAnswers,
    assumedQuestionIds,
    userRefinementQuestionIds,
    rejectedPaidSources,
    refinedVersionId: read.refined?.id ?? read.initial?.id ?? sourceHash,
    refinedInputHash: sourceHash,
  }
}
