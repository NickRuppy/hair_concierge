import "server-only"

import { computeNeedPlan } from "@/lib/personal-plan/compute-stage1"
import { hashPersonalPlanNeedVersionInput, type JsonValue } from "@/lib/personal-plan/persistence"
import { PERSONAL_PLAN_STAGE1_COMPUTATION_VERSION } from "@/lib/personal-plan/persistence/stage1-service"
import { toStage1SourceFromFacts } from "@/lib/user-facts/read"
import { UnsupportedUserFactsSourceError, UserFactsIncompleteError } from "@/lib/user-facts/schema"

import { buildRebaseProjection, RebaseProjectionIncompleteError } from "./rebase-projection"
import type {
  FactsRecomputeDeps,
  PersonalPlanRebaseOnFactsParams,
  SyncPlanWithFactsInput,
  SyncPlanWithFactsResult,
  SyncPlanWithFactsUnavailableReason,
} from "./types"

/** Deadlock / serialization failure: a reopen racing the rebase (R14). Worth one retry. */
const RETRYABLE_SQLSTATES = new Set(["40P01", "40001"])

/**
 * What a swallowed failure may log: the error class and its SQLSTATE, never the message — the
 * facts reader's messages carry the user id (`src/lib/user-facts/read.ts`).
 */
function errorLabel(error: unknown): { error: string; code?: string } {
  const code = (error as { code?: unknown } | null)?.code
  return {
    error: error instanceof Error ? error.name : typeof error,
    ...(typeof code === "string" ? { code } : {}),
  }
}

function unavailable(
  reason: SyncPlanWithFactsUnavailableReason,
  retryable: boolean,
): SyncPlanWithFactsResult {
  return { status: "unavailable", reason, retryable }
}

type Attempt =
  | { kind: "done"; result: SyncPlanWithFactsResult }
  /** `knownInitial`: an `initial_conflict` named the row that owns this hash. */
  | { kind: "retry"; knownInitial?: { inputHash: string; id: string } }

function done(result: SyncPlanWithFactsResult): Attempt {
  return { kind: "done", result }
}

/**
 * The only way an existing Personal Plan moves to new diagnostics (plan §2, §4a): builds the
 * Stage-1 source from the profile facts, and when its hash differs from the plan's current
 * initial version, computes the new initial version and the re-projected refined version and
 * commits both through ONE call of `personal_plan_rebase_on_facts_v1`. It writes nothing
 * else and does not recompute the routine — callers do that from the `rebased` result.
 *
 * Never throws. A conflict (or a deadlock) gets one retry on freshly reloaded inputs, because
 * the facts, the plan revision, the source draft and even the new initial's id may all have
 * moved; a second conflict is reported retryable and left to the next trigger.
 */
export async function syncPlanWithFacts(
  deps: FactsRecomputeDeps,
  input: SyncPlanWithFactsInput,
): Promise<SyncPlanWithFactsResult> {
  try {
    let knownInitial: { inputHash: string; id: string } | undefined
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const outcome = await attemptRebase(deps, input.userId, knownInitial)
      if (outcome.kind === "done") return outcome.result
      knownInitial = outcome.knownInitial
    }
    return unavailable("conflict", true)
  } catch (error) {
    console.error("personal_plan_facts_recompute", {
      event: "unexpected_error",
      ...errorLabel(error),
    })
    return unavailable("unexpected_error", true)
  }
}

async function attemptRebase(
  deps: FactsRecomputeDeps,
  userId: string,
  knownInitial: { inputHash: string; id: string } | undefined,
): Promise<Attempt> {
  const plan = await deps.loadPlan(userId)
  if (!plan) return done({ status: "no_plan" })
  if (!plan.currentInitialNeedVersionId) return done(unavailable("invalid_source", false))
  const current = await deps.loadInitialVersion({
    userId,
    needVersionId: plan.currentInitialNeedVersionId,
  })
  // The computation input `mapDraft` uses for refined versions; the new initial copies it.
  const sourceId = current?.preparedArtifactSourceId ?? current?.stage1SourceLeadId ?? null
  if (!current || !sourceId) return done(unavailable("invalid_source", false))

  const facts = await deps.loadFacts(userId)
  let stage1Source: ReturnType<typeof toStage1SourceFromFacts> = null
  try {
    stage1Source = facts ? toStage1SourceFromFacts(facts) : null
  } catch (error) {
    if (
      error instanceof UnsupportedUserFactsSourceError ||
      error instanceof UserFactsIncompleteError
    ) {
      return done(unavailable("facts_not_computable", false))
    }
    throw error
  }
  if (!facts || !stage1Source) return done(unavailable("facts_not_computable", false))

  // Exactly Stage 1 (`stage1-service.ts`): same projection, version, snapshots and hash.
  const computed = computeNeedPlan({
    rawEnvelope: stage1Source,
    artifactId: sourceId,
    projection: "initial_quiz",
    computationVersion: PERSONAL_PLAN_STAGE1_COMPUTATION_VERSION,
    createdAt: deps.now().toISOString(),
  })
  if (computed.status !== "ready") return done(unavailable("facts_not_computable", false))
  const inputSnapshot = computed.snapshot.sourceQuiz as unknown as JsonValue
  const inputHash = hashPersonalPlanNeedVersionInput({
    schemaVersion: computed.snapshot.schemaVersion,
    computationVersion: computed.snapshot.computationVersion,
    inputSnapshot,
  })
  if (inputHash === current.inputHash) return done({ status: "unchanged", personalPlanId: plan.id })

  // The refined hash contains the parent id, so the id must be settled before projecting.
  const initialId =
    knownInitial?.inputHash === inputHash
      ? knownInitial.id
      : ((await deps.findInitialVersionId({ personalPlanId: plan.id, inputHash })) ?? deps.newId())
  const sourceDraft = await deps.loadSourceDraft({
    personalPlanId: plan.id,
    initialNeedVersionId: current.id,
  })

  const params: PersonalPlanRebaseOnFactsParams = {
    p_user_id: userId,
    p_personal_plan_id: plan.id,
    p_expected_plan_revision: plan.revision,
    p_expected_facts_revision: facts.revision,
    p_initial_id: initialId,
    p_schema_version: computed.snapshot.schemaVersion,
    p_computation_version: computed.snapshot.computationVersion,
    p_initial_input_hash: inputHash,
    p_initial_input_snapshot: inputSnapshot,
    p_initial_output_snapshot: computed.snapshot as unknown as JsonValue,
  }
  // No source draft: no clone and no refined parameters. A plan with a refined head but no
  // draft is the RPC's to refuse (`invalid_source`), not this lane's to guess around.
  if (sourceDraft) {
    let projection: ReturnType<typeof buildRebaseProjection>
    try {
      projection = buildRebaseProjection({
        sourceDraft,
        newInitial: { id: initialId, inputSnapshot, outputSnapshot: computed.snapshot },
        sourceId,
        hasRefinedHead: plan.currentRefinedNeedVersionId !== null,
        now: deps.now(),
      })
    } catch (error) {
      if (error instanceof RebaseProjectionIncompleteError) {
        return done(unavailable("invalid_source", false))
      }
      throw error
    }
    params.p_source_draft_id = sourceDraft.id
    params.p_expected_draft_revision = sourceDraft.revision
    params.p_clone_answers = projection.clone.answers as JsonValue
    params.p_clone_completed_question_ids = [...projection.clone.completedQuestionIds]
    params.p_clone_answer_provenance = projection.clone.answerProvenance as JsonValue
    if (projection.refined && projection.careHabits) {
      params.p_care_habits_patch = projection.careHabits.patch as JsonValue
      params.p_care_habits_provenance = projection.careHabits.provenance as JsonValue
      params.p_refined_schema_version = projection.refined.schemaVersion
      params.p_refined_computation_version = projection.refined.computationVersion
      params.p_refined_input_hash = projection.refined.inputHash
      params.p_refined_input_snapshot = projection.refined.inputSnapshot as JsonValue
      params.p_refined_output_snapshot = projection.refined.outputSnapshot as unknown as JsonValue
    }
  }

  let result: Awaited<ReturnType<FactsRecomputeDeps["rebase"]>>
  try {
    result = await deps.rebase(params)
  } catch (error) {
    const code = (error as { code?: unknown } | null)?.code
    if (typeof code === "string" && RETRYABLE_SQLSTATES.has(code)) return { kind: "retry" }
    throw error
  }

  switch (result.status) {
    case "rebased":
      return done({
        status: "rebased",
        personalPlanId: plan.id,
        initialNeedVersionId: result.initialNeedVersionId,
        refinedVersionId: result.refinedNeedVersionId ?? null,
        activeRoutineVersionId: plan.activeRoutineVersionId,
      })
    case "unchanged":
      return done({ status: "unchanged", personalPlanId: plan.id })
    case "plan_revision_conflict":
    case "facts_revision_conflict":
    case "draft_conflict":
      return { kind: "retry" }
    case "initial_conflict":
      return { kind: "retry", knownInitial: { inputHash, id: result.existingId } }
    case "invalid_source":
      return done(unavailable("invalid_source", false))
    default:
      throw new Error(
        `personal_plan_rebase_on_facts_v1 returned an unknown status: ${String((result as { status?: unknown }).status)}`,
      )
  }
}
