import { computeNeedPlan } from "../compute-stage1"
import {
  PERSONAL_PLAN_STAGE1_COMPUTATION_VERSION,
  type CreateInitialNeedResult,
  type Stage1PreparedArtifact,
} from "./stage1-service"
import { hashPersonalPlanNeedVersionInput, type JsonValue } from "./index"

/**
 * Ownership contract — free-tier `personal_plan_need_versions` (kind = "initial").
 *
 * - **Who creates it:** this service, for signed-in users with NO Personal Plan
 *   entitlement (no enrollment/source/qualification/lead). `stage1-service.ts`
 *   remains the sole writer for the paid/enrolled path and is untouched by this
 *   module — the two never write concurrently for the same user because the
 *   underlying `personal_plan_create_or_reuse_initial_need` RPC pins a plan's
 *   `enrollment_purchase_source_id` on first write and rejects a mismatched
 *   value on every later call (see `free-snapshot-supabase.ts`, which always
 *   passes `null`).
 * - **Source:** the user's linked `personal_plan_prepared_artifacts` row
 *   (`status = 'attached'`, `user_id` = the signed-in user) — the same artifact
 *   `src/lib/quiz/link-to-profile.ts` attaches after quiz completion, regardless
 *   of payment. There is no enrollment/qualification gate here by design: a free
 *   account only needs a completed quiz, not a purchase.
 * - **Derivation:** delegates to the exact same pure `computeNeedPlan` (and the
 *   same `PERSONAL_PLAN_STAGE1_COMPUTATION_VERSION`) that `stage1-service.ts`
 *   uses for the paid path. Nothing about the math is forked here.
 * - **When re-provisioned:** every call re-derives from the current artifact and
 *   re-submits it. The RPC is idempotent on `(personal_plan_id, input_hash)` for
 *   `kind = 'initial'` rows, so an unchanged artifact reuses the existing row and
 *   an unrelated caller can safely call this on every scan attempt without
 *   duplicating rows or bumping `personal_plans.revision`.
 * - **Upgrade note (out of scope here, relevant to T14/T18):** because the RPC
 *   pins `enrollment_purchase_source_id` on first write, a user provisioned free
 *   (`null`) who later buys must go through an upgrade path that can move that
 *   column off `null` — calling this same RPC with a real enrollment id for such
 *   a user will currently return `invalid_source` (`enrollment_mismatch`).
 */

export type FreeInitialNeedRequest = {
  userId: string
  preparedArtifactSourceId: string
  schemaVersion: number
  computationVersion: string
  inputHash: string
  inputSnapshot: JsonValue
  outputSnapshot: JsonValue
}

export type ProvisionFreeInitialSnapshotResult =
  | {
      outcome: "provisioned"
      personalPlanId: string
      needVersionId: string
      outputSnapshot: JsonValue
    }
  | { outcome: "no_quiz_artifact" }
  | { outcome: "invalid_source"; reasonCode?: string }
  | { outcome: "temporarily_unavailable" }

export type FreeSnapshotDependencies = {
  loadLinkedQuizArtifact: (userId: string) => Promise<Stage1PreparedArtifact | null>
  createOrReuseInitialNeed: (request: FreeInitialNeedRequest) => Promise<CreateInitialNeedResult>
  now?: () => Date
}

export function createFreeSnapshotService(deps: FreeSnapshotDependencies) {
  return {
    async provisionFreeInitialSnapshot({
      userId,
    }: {
      userId: string
    }): Promise<ProvisionFreeInitialSnapshotResult> {
      let artifact: Stage1PreparedArtifact | null
      try {
        artifact = await deps.loadLinkedQuizArtifact(userId)
      } catch {
        return { outcome: "temporarily_unavailable" }
      }
      if (!artifact) return { outcome: "no_quiz_artifact" }

      const computed = computeNeedPlan({
        rawEnvelope: artifact.quizAnswers,
        artifactId: artifact.id,
        projection: "initial_quiz",
        computationVersion: PERSONAL_PLAN_STAGE1_COMPUTATION_VERSION,
        createdAt: (deps.now ?? (() => new Date()))().toISOString(),
      })
      if (computed.status !== "ready") return { outcome: "invalid_source" }

      const inputSnapshot = computed.snapshot.sourceQuiz as unknown as JsonValue
      const outputSnapshot = computed.snapshot as unknown as JsonValue
      const request: FreeInitialNeedRequest = {
        userId,
        preparedArtifactSourceId: artifact.id,
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

      let result: CreateInitialNeedResult
      try {
        result = await deps.createOrReuseInitialNeed(request)
      } catch {
        return { outcome: "temporarily_unavailable" }
      }
      if (result.outcome === "completed") {
        return {
          outcome: "provisioned",
          personalPlanId: result.personalPlanId,
          needVersionId: result.needVersionId,
          outputSnapshot: result.outputSnapshot,
        }
      }
      return result
    },
  }
}
