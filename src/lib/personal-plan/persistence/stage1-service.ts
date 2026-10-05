import { computeNeedPlan } from "../compute-stage1"
import type { SyncPlanWithFacts } from "../facts-recompute/types"
import { buildLegacyQuizStage1Source } from "../input"
import type { QuizAnswers } from "@/lib/quiz/types"
import { toStage1SourceFromFacts, type UserFacts } from "@/lib/user-facts/read"
import { UnsupportedUserFactsSourceError, UserFactsIncompleteError } from "@/lib/user-facts/schema"
import { hashPersonalPlanNeedVersionInput, type JsonValue } from "./index"

export const PERSONAL_PLAN_STAGE1_COMPUTATION_VERSION = "stage1-v1"

export type Stage1Entitlement = {
  accessState: "active" | "paid_pending" | "none" | "revoked"
  enrollmentSourceId: string | null
  qualifiedAt: string | null
  artifactLeadId: string | null
  quizSourceKind?: "personal_plan" | "legacy" | null
  /**
   * `"freemium"` is the T14 Premium-sheet admission (see
   * `src/lib/personal-plan/freemium-enrollment.ts`); it is cohort-qualified for the same
   * reason `"field_test"`/`"partner"`/`"migration"` are — there is no historical cohort of
   * freemium buyers the new-buyer cutoff needs to keep out.
   */
  sourceKind?:
    | "one_time"
    | "launch_subscription"
    | "field_test"
    | "partner"
    | "migration"
    | "freemium"
    | "trial"
    | null
}

export type Stage1PreparedArtifact = {
  id: string
  quizAnswers: unknown
}

export type Stage1LegacyLead = {
  id: string
  quizAnswers: QuizAnswers
}

export type CreateInitialNeedRequest = {
  userId: string
  enrollmentPurchaseSourceId: string
  preparedArtifactSourceId: string | null
  stage1SourceKind: "personal_plan_artifact" | "legacy_quiz_lead"
  stage1SourceLeadId: string | null
  schemaVersion: number
  computationVersion: string
  inputHash: string
  inputSnapshot: JsonValue
  outputSnapshot: JsonValue
}

export type CreateInitialNeedResult =
  | {
      outcome: "completed"
      personalPlanId: string
      needVersionId: string
      outputSnapshot: JsonValue
    }
  | { outcome: "invalid_source"; reasonCode?: string }
  | { outcome: "temporarily_unavailable" }

export type Stage1PersistenceDependencies = {
  isEnabled: () => boolean
  migrationEnabled?: () => boolean
  cohortCutoff: () => Date | null
  findEntitlement: (userId: string) => Promise<Stage1Entitlement>
  loadExistingMigrationPlan?: (
    userId: string,
    enrollmentId: string,
  ) => Promise<Extract<Stage1LoadOrCreateResult, { status: "completed" }> | null>
  loadArtifact: (userId: string, artifactLeadId: string) => Promise<Stage1PreparedArtifact | null>
  loadLegacyLead?: (userId: string, leadId: string) => Promise<Stage1LegacyLead | null>
  /** The profile facts the Stage-1 source is built from. Absent = the artifact / lead envelope. */
  loadFacts?: (userId: string) => Promise<UserFacts | null>
  /**
   * The user's existing plan and its current initial version (owner-scoped), or `null` without a
   * plan. With it, a plan whose initial `inputHash` differs from the facts hash is moved by
   * `syncPlanWithFacts` instead of `createOrReuseInitialNeed`. Absent = today's path.
   */
  loadExistingPlan?: (userId: string) => Promise<{
    personalPlanId: string
    currentInitial: { needVersionId: string; inputHash: string; outputSnapshot: JsonValue }
  } | null>
  /** The facts recompute lane (`facts-recompute/`); never throws, callers branch on nothing. */
  syncPlanWithFacts?: SyncPlanWithFacts
  createOrReuseInitialNeed: (request: CreateInitialNeedRequest) => Promise<CreateInitialNeedResult>
  now?: () => Date
}

export type Stage1LoadOrCreateResult =
  | {
      status: "completed"
      personalPlanId: string
      needVersionId: string
      outputSnapshot: JsonValue
    }
  | {
      status:
        | "personal_plan_not_available"
        | "activation_pending"
        | "invalid_source"
        | "temporarily_unavailable"
    }

export function createStage1PersistenceService(deps: Stage1PersistenceDependencies) {
  return {
    async loadOrCreate({ userId }: { userId: string }): Promise<Stage1LoadOrCreateResult> {
      // The disabled feature must be inert: no entitlement/artifact reads and no writes.
      if (!deps.isEnabled()) return { status: "personal_plan_not_available" }

      let entitlement: Stage1Entitlement
      try {
        entitlement = await deps.findEntitlement(userId)
      } catch {
        return { status: "temporarily_unavailable" }
      }

      if (entitlement.accessState === "paid_pending") return { status: "activation_pending" }
      if (
        !isEligibleQualifiedOwner(
          entitlement,
          deps.cohortCutoff(),
          deps.migrationEnabled?.() ?? false,
        )
      ) {
        return { status: "personal_plan_not_available" }
      }

      if (entitlement.sourceKind === "migration" && deps.loadExistingMigrationPlan) {
        try {
          let existing = await deps.loadExistingMigrationPlan(
            userId,
            entitlement.enrollmentSourceId!,
          )
          // This branch returns before any source read, so it must run the lane itself (R07):
          // a migrated plan whose profile changed is rebased here, then re-read. The lane is a
          // cheap no-op when nothing differs.
          if (existing && deps.syncPlanWithFacts) {
            await runPlanSync(deps.syncPlanWithFacts, userId)
            existing =
              (await deps.loadExistingMigrationPlan(userId, entitlement.enrollmentSourceId!)) ??
              existing
          }
          if (existing) return existing
        } catch {
          return { status: "temporarily_unavailable" }
        }
      }

      let artifact: Stage1PreparedArtifact | null = null
      let legacyLead: Stage1LegacyLead | null = null
      try {
        if (entitlement.quizSourceKind === "legacy") {
          legacyLead = (await deps.loadLegacyLead?.(userId, entitlement.artifactLeadId!)) ?? null
        } else {
          artifact = await deps.loadArtifact(userId, entitlement.artifactLeadId!)
        }
      } catch {
        return { status: "temporarily_unavailable" }
      }
      if (!artifact && !legacyLead) return { status: "activation_pending" }

      // The artifact / lead above proves ownership and supplies the source ids; the Stage-1
      // source itself comes from the profile facts when they can produce one.
      let factsSource: unknown = null
      if (deps.loadFacts) {
        try {
          const facts = await deps.loadFacts(userId)
          factsSource = facts ? toStage1SourceFromFacts(facts) : null
        } catch (error) {
          if (
            !(error instanceof UnsupportedUserFactsSourceError) &&
            !(error instanceof UserFactsIncompleteError)
          ) {
            return { status: "temporarily_unavailable" }
          }
        }
      }
      const stage1Source =
        factsSource ??
        (legacyLead
          ? buildLegacyQuizStage1Source({ leadId: legacyLead.id, answers: legacyLead.quizAnswers })
          : artifact!.quizAnswers)
      const sourceId = legacyLead?.id ?? artifact!.id

      const computed = computeNeedPlan({
        rawEnvelope: stage1Source,
        artifactId: sourceId,
        projection: "initial_quiz",
        computationVersion: PERSONAL_PLAN_STAGE1_COMPUTATION_VERSION,
        createdAt: (deps.now ?? (() => new Date()))().toISOString(),
      })
      if (computed.status !== "ready") return { status: "invalid_source" }

      const inputSnapshot = computed.snapshot.sourceQuiz as unknown as JsonValue
      const outputSnapshot = computed.snapshot as unknown as JsonValue
      const request: CreateInitialNeedRequest = {
        userId,
        enrollmentPurchaseSourceId: entitlement.enrollmentSourceId!,
        preparedArtifactSourceId: artifact?.id ?? null,
        stage1SourceKind: legacyLead ? "legacy_quiz_lead" : "personal_plan_artifact",
        stage1SourceLeadId: legacyLead?.id ?? null,
        schemaVersion: computed.snapshot.schemaVersion,
        computationVersion: computed.snapshot.computationVersion,
        inputHash: hashPersonalPlanNeedVersionInput({
          schemaVersion: computed.snapshot.schemaVersion,
          computationVersion: computed.snapshot.computationVersion,
          inputSnapshot,
        }),
        inputSnapshot,
        outputSnapshot,
      }

      // A plan that already exists and differs from the facts is the lane's to move, never
      // `createOrReuseInitialNeed`'s: its "initial changed" branch stales the open refinement
      // draft and nulls the refined head without a clone or a routine recompute. Whatever the
      // lane returns (a failed lane leaves the old initial, which is still the plan's truth),
      // the caller gets the plan's current initial version.
      if (deps.loadExistingPlan) {
        try {
          const existing = await deps.loadExistingPlan(userId)
          if (existing && existing.currentInitial.inputHash !== request.inputHash) {
            if (deps.syncPlanWithFacts) await runPlanSync(deps.syncPlanWithFacts, userId)
            const current = (await deps.loadExistingPlan(userId)) ?? existing
            return {
              status: "completed",
              personalPlanId: current.personalPlanId,
              needVersionId: current.currentInitial.needVersionId,
              outputSnapshot: current.currentInitial.outputSnapshot,
            }
          }
        } catch {
          return { status: "temporarily_unavailable" }
        }
      }

      let result: CreateInitialNeedResult
      try {
        result = await deps.createOrReuseInitialNeed(request)
      } catch {
        return { status: "temporarily_unavailable" }
      }
      if (result.outcome === "completed") {
        return {
          status: "completed",
          personalPlanId: result.personalPlanId,
          needVersionId: result.needVersionId,
          outputSnapshot: result.outputSnapshot,
        }
      }
      return { status: result.outcome }
    },
  }
}

/** The lane never throws; a plan problem must not turn into a Stage-1 failure if it ever did. */
async function runPlanSync(syncPlanWithFacts: SyncPlanWithFacts, userId: string): Promise<void> {
  try {
    await syncPlanWithFacts({ userId })
  } catch {
    // The caller re-reads the plan and serves what is persisted.
  }
}

function isEligibleQualifiedOwner(
  entitlement: Stage1Entitlement,
  cutoff: Date | null,
  migrationEnabled: boolean,
): boolean {
  if (
    entitlement.accessState !== "active" ||
    !entitlement.enrollmentSourceId ||
    !entitlement.qualifiedAt ||
    !entitlement.artifactLeadId
  )
    return false
  const qualifiedAt = new Date(entitlement.qualifiedAt)
  if (Number.isNaN(qualifiedAt.getTime())) return false
  return entitlement.sourceKind === "field_test" ||
    entitlement.sourceKind === "partner" ||
    entitlement.sourceKind === "migration" ||
    entitlement.sourceKind === "freemium"
    ? true
    : isMigrationPaidSource(entitlement.sourceKind) && migrationEnabled
      ? true
      : Boolean(cutoff && qualifiedAt.getTime() >= cutoff.getTime())
}

function isMigrationPaidSource(sourceKind: Stage1Entitlement["sourceKind"]): boolean {
  return sourceKind === "one_time" || sourceKind === "launch_subscription"
}
