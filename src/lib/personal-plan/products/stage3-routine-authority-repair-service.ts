import type { SupabaseClient } from "@supabase/supabase-js"

import type { InitialNeedPlanSnapshot } from "@/lib/personal-plan/types"

import { stage3ProductDraftSchema, type Stage3ProductDraft } from "./contracts"
import type { Stage3CategoryRequirement } from "./contracts"
import { buildRoutineAuthorityRepairDraft } from "./routine-authority-repair"
import { Stage3AuthoritySnapshotError } from "./authority/snapshot"

type AdminClient = SupabaseClient

export type Stage3RoutineAuthorityRepairService = {
  createOrLoad(input: {
    userId: string
    personalPlanId: string
    refinedVersionId: string
    routineVersionId: string
  }): Promise<{ requirements: Stage3CategoryRequirement[] }>
}

export function createSupabaseStage3RoutineAuthorityRepairService(
  client: AdminClient,
): Stage3RoutineAuthorityRepairService {
  return {
    async createOrLoad(input) {
      const [planResult, routineResult] = await Promise.all([
        client
          .from("personal_plans")
          .select("id,current_refined_need_version_id,active_routine_version_id")
          .eq("id", input.personalPlanId)
          .eq("user_id", input.userId)
          .maybeSingle(),
        client
          .from("personal_plan_routine_versions")
          .select("id,source_refined_need_version_id,source_product_draft_id")
          .eq("id", input.routineVersionId)
          .eq("personal_plan_id", input.personalPlanId)
          .eq("user_id", input.userId)
          .maybeSingle(),
      ])
      if (planResult.error || routineResult.error) {
        throw new Error("stage3_repair_source_load_failed")
      }
      const plan = planResult.data as
        | {
            current_refined_need_version_id: string | null
            active_routine_version_id: string | null
          }
        | null
      const routine = routineResult.data as
        | {
            source_refined_need_version_id: string
            source_product_draft_id: string
          }
        | null
      if (
        !plan ||
        !routine ||
        plan.active_routine_version_id !== input.routineVersionId ||
        plan.current_refined_need_version_id !== input.refinedVersionId ||
        routine.source_refined_need_version_id !== input.refinedVersionId
      ) {
        throw new Stage3AuthoritySnapshotError("stale_refined_source")
      }

      const [draftResult, needResult] = await Promise.all([
        client
          .from("personal_plan_product_drafts")
          .select("*")
          .eq("id", routine.source_product_draft_id)
          .eq("personal_plan_id", input.personalPlanId)
          .eq("user_id", input.userId)
          .eq("status", "completed")
          .maybeSingle(),
        client
          .from("personal_plan_need_versions")
          .select("output_snapshot")
          .eq("id", input.refinedVersionId)
          .eq("personal_plan_id", input.personalPlanId)
          .eq("user_id", input.userId)
          .eq("kind", "refined")
          .maybeSingle(),
      ])
      if (draftResult.error || needResult.error) throw new Error("stage3_repair_source_load_failed")
      if (!draftResult.data || !needResult.data?.output_snapshot) {
        throw new Stage3AuthoritySnapshotError("stale_refined_source")
      }

      const sourceDraft = mapStage3Draft(draftResult.data)
      const seed = buildRoutineAuthorityRepairDraft({
        sourceDraft,
        refinedNeedSnapshot: needResult.data.output_snapshot as InitialNeedPlanSnapshot,
        userId: input.userId,
        personalPlanId: input.personalPlanId,
        refinedVersionId: input.refinedVersionId,
        now: new Date().toISOString(),
      })
      const { data, error } = await client.rpc(
        "personal_plan_create_or_load_routine_authority_repair_draft",
        {
          p_user_id: input.userId,
          p_personal_plan_id: input.personalPlanId,
          p_routine_version_id: input.routineVersionId,
          p_contract_version: seed.draft.schemaVersion,
          p_category_authority_versions: seed.draft.authorityVersions,
          p_payload: draftPayload(seed.draft),
        },
      )
      if (error || !data) throw new Error("stage3_repair_draft_create_failed")
      if (String((data as Record<string, unknown>).outcome) !== "ready") {
        throw new Stage3AuthoritySnapshotError("stale_refined_source")
      }
      return { requirements: seed.requirements }
    },
  }
}

function draftPayload(draft: Stage3ProductDraft) {
  const payload: Record<string, unknown> = { ...draft }
  for (const key of [
    "draftId",
    "userId",
    "personalPlanId",
    "refinedVersionId",
    "revision",
    "status",
    "createdAt",
    "updatedAt",
  ]) {
    delete payload[key]
  }
  return payload
}

function mapStage3Draft(raw: unknown): Stage3ProductDraft {
  const row = raw as Record<string, unknown>
  const payload = (row.payload ?? row) as Record<string, unknown>
  return stage3ProductDraftSchema.parse({
    ...payload,
    schemaVersion: Number(payload.schemaVersion ?? row.contract_version ?? 1),
    status: String(row.status ?? payload.status ?? "active"),
    authorityVersions: row.category_authority_versions ?? payload.authorityVersions ?? {},
    draftId: String(row.id ?? payload.draftId),
    userId: String(row.user_id ?? payload.userId),
    personalPlanId: String(row.personal_plan_id ?? payload.personalPlanId),
    refinedVersionId: String(row.refined_need_version_id ?? payload.refinedVersionId),
    staleRefinedVersionId: payload.staleRefinedVersionId ?? null,
    revision: Number(row.revision ?? payload.revision ?? 0),
    pass: String(row.pass ?? payload.pass ?? "product_capture"),
    categoryCursor:
      (row.cursor as Record<string, unknown> | null)?.categoryCursor ??
      payload.categoryCursor ??
      null,
    products: payload.products ?? [],
    roleAssignments: payload.roleAssignments ?? [],
    uncoveredRoles: payload.uncoveredRoles ?? [],
    decisions: payload.decisions ?? [],
    orderedCategories: payload.orderedCategories ?? [],
    completedCaptureCategories:
      (row.cursor as Record<string, unknown> | null)?.completedCaptureCategories ??
      payload.completedCaptureCategories ??
      [],
    completedDecisionKeys:
      (row.cursor as Record<string, unknown> | null)?.completedDecisionKeys ??
      payload.completedDecisionKeys ??
      [],
    createdAt: String(row.created_at ?? payload.createdAt),
    updatedAt: String(row.updated_at ?? payload.updatedAt),
  })
}
