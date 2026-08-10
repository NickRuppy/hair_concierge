import {
  getPersonalPlanNewBuyerCohortCutoff,
  isPersonalPlanAppV1Enabled,
} from "@/lib/personal-plan/release"
import { findPersonalPlanEnrollmentForUser } from "@/lib/personal-plan/enrollment"

import type {
  CreateInitialNeedRequest,
  CreateInitialNeedResult,
  Stage1PersistenceDependencies,
  Stage1PreparedArtifact,
} from "./stage1-service"

type AdminClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string,
      ) => {
        eq: (
          column: string,
          value: string,
        ) => {
          eq: (
            column: string,
            value: string,
          ) => {
            maybeSingle: () => Promise<{ data: unknown; error: unknown }>
          }
        }
      }
    }
  }
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>
}

/**
 * Server-only persistence wiring. The artifact is bound to the entitlement's
 * consent lead rather than selected from a user's historical artifacts.
 */
export function createStage1SupabaseDependencies(
  admin: AdminClient,
): Stage1PersistenceDependencies {
  return {
    isEnabled: isPersonalPlanAppV1Enabled,
    cohortCutoff: getPersonalPlanNewBuyerCohortCutoff,
    async findEntitlement(userId) {
      const enrollment = await findPersonalPlanEnrollmentForUser(admin as never, userId)
      return {
        accessState: enrollment.accessState,
        enrollmentSourceId: enrollment.sourceId,
        qualifiedAt: enrollment.qualifiedAt,
        artifactLeadId: enrollment.artifactLeadId,
      }
    },
    async loadArtifact(userId, artifactLeadId): Promise<Stage1PreparedArtifact | null> {
      const { data, error } = await admin
        .from("personal_plan_prepared_artifacts")
        .select("id, quiz_answers")
        .eq("user_id", userId)
        .eq("lead_id", artifactLeadId)
        .eq("status", "attached")
        .maybeSingle()
      if (error) throw error
      if (!data || typeof data !== "object") return null
      const row = data as { id?: unknown; quiz_answers?: unknown }
      if (typeof row.id !== "string") return null
      return { id: row.id, quizAnswers: row.quiz_answers }
    },
    createOrReuseInitialNeed: (request) => callCreateInitialNeed(admin, request),
  }
}

async function callCreateInitialNeed(
  admin: AdminClient,
  request: CreateInitialNeedRequest,
): Promise<CreateInitialNeedResult> {
  const { data, error } = await admin.rpc("personal_plan_create_or_reuse_initial_need", {
    p_user_id: request.userId,
    p_enrollment_purchase_source_id: request.enrollmentPurchaseSourceId,
    p_prepared_artifact_source_id: request.preparedArtifactSourceId,
    p_schema_version: request.schemaVersion,
    p_computation_version: request.computationVersion,
    p_input_hash: request.inputHash,
    p_input_snapshot: request.inputSnapshot,
    p_output_snapshot: request.outputSnapshot,
  })
  if (error || !data || typeof data !== "object") return { outcome: "temporarily_unavailable" }
  const result = data as Record<string, unknown>
  if (
    result.outcome === "completed" &&
    typeof result.personalPlanId === "string" &&
    typeof result.needVersionId === "string" &&
    result.outputSnapshot !== null &&
    typeof result.outputSnapshot === "object"
  ) {
    return {
      outcome: "completed",
      personalPlanId: result.personalPlanId,
      needVersionId: result.needVersionId,
      outputSnapshot: result.outputSnapshot as never,
    }
  }
  if (result.outcome === "invalid_source") {
    return {
      outcome: "invalid_source",
      ...(typeof result.reasonCode === "string" ? { reasonCode: result.reasonCode } : {}),
    }
  }
  return { outcome: "temporarily_unavailable" }
}
