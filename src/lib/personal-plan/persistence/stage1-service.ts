import { computeNeedPlan } from "../compute-stage1"
import { hashPersonalPlanNeedVersionInput, type JsonValue } from "./index"

export const PERSONAL_PLAN_STAGE1_COMPUTATION_VERSION = "stage1-v1"

export type Stage1Entitlement = {
  accessState: "active" | "paid_pending" | "none" | "revoked"
  purchaseId: string | null
  paidAt: string | null
  artifactLeadId: string | null
}

export type Stage1PreparedArtifact = {
  id: string
  quizAnswers: unknown
}

export type CreateInitialNeedRequest = {
  userId: string
  enrollmentPurchaseSourceId: string
  preparedArtifactSourceId: string
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
  cohortCutoff: () => Date | null
  findEntitlement: (userId: string) => Promise<Stage1Entitlement>
  loadArtifact: (userId: string, artifactLeadId: string) => Promise<Stage1PreparedArtifact | null>
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
      if (!isEligibleNewBuyer(entitlement, deps.cohortCutoff())) {
        return { status: "personal_plan_not_available" }
      }

      let artifact: Stage1PreparedArtifact | null
      try {
        artifact = await deps.loadArtifact(userId, entitlement.artifactLeadId!)
      } catch {
        return { status: "temporarily_unavailable" }
      }
      if (!artifact) return { status: "activation_pending" }

      const computed = computeNeedPlan({
        rawEnvelope: artifact.quizAnswers,
        artifactId: artifact.id,
        projection: "initial_quiz",
        computationVersion: PERSONAL_PLAN_STAGE1_COMPUTATION_VERSION,
        createdAt: (deps.now ?? (() => new Date()))().toISOString(),
      })
      if (computed.status !== "ready") return { status: "invalid_source" }

      const inputSnapshot = computed.snapshot.sourceQuiz as unknown as JsonValue
      const outputSnapshot = computed.snapshot as unknown as JsonValue
      const request: CreateInitialNeedRequest = {
        userId,
        enrollmentPurchaseSourceId: entitlement.purchaseId!,
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

function isEligibleNewBuyer(entitlement: Stage1Entitlement, cutoff: Date | null): boolean {
  if (
    entitlement.accessState !== "active" ||
    !entitlement.purchaseId ||
    !entitlement.paidAt ||
    !entitlement.artifactLeadId ||
    !cutoff
  )
    return false
  const paidAt = new Date(entitlement.paidAt)
  return !Number.isNaN(paidAt.getTime()) && paidAt.getTime() >= cutoff.getTime()
}
