import { NextResponse } from "next/server"

import { effectiveRoutineCadenceCopyDe } from "@/lib/personal-plan/routine/cadence"
import type { RoutinePayload } from "@/lib/personal-plan/routine/contracts"
import { routineCategoryLabel, routinePurposeLabel } from "@/lib/personal-plan/routine/labels"
import { loadPersonalPlanRoutineView } from "@/lib/personal-plan/routine/load-view"
import type { PersonalPlanRoutineReadClient } from "@/lib/personal-plan/routine/repository"
import type { PersonalPlanRefinementAnswersV1 } from "@/lib/personal-plan/refinement/types"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

type Query = {
  select: (columns: string) => Query
  eq: (column: string, value: unknown) => Query
  order: (column: string, options: { ascending: boolean }) => Query
  limit: (count: number) => Query
  maybeSingle: () => Promise<{ data: unknown; error: unknown }>
}

export type RefinementPresentationReadClient = { from: (table: string) => Query }

export type RoutineProductSummary = {
  categoryLabel: string
  name: string
  purposeLabel: string
  state: "owned" | "planned"
  cadenceLabel: string | null
}

export type RefinementPresentationRouteDeps = {
  getUserId: () => Promise<string | null>
  client: () => RefinementPresentationReadClient
}

const response = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })

type RoutineItem = RoutinePayload["items"][number]

function routineProductSummary(item: RoutineItem): RoutineProductSummary | null {
  if (item.product.kind !== "owned" && item.product.kind !== "planned") return null
  const state: RoutineProductSummary["state"] = item.product.kind
  return {
    categoryLabel: routineCategoryLabel(item.category),
    name: item.product.displayName,
    purposeLabel: routinePurposeLabel(item.purposeKey),
    state,
    cadenceLabel: effectiveRoutineCadenceCopyDe({
      recommended: item.cadence.recommended,
      userOverride:
        typeof item.cadence.userOverride === "string" ? item.cadence.userOverride : null,
      resolved: item.cadence.resolved,
      role: item.role,
      displayKey: item.cadence.displayKey,
    }),
  }
}

type OwnerPlanRow = {
  id: string
  current_refined_need_version_id: string | null
  active_routine_version_id: string | null
}

async function loadOwnerPlan(
  client: RefinementPresentationReadClient,
  userId: string,
): Promise<OwnerPlanRow | null> {
  const { data, error } = await client
    .from("personal_plans")
    .select("id,current_refined_need_version_id,active_routine_version_id")
    .eq("user_id", userId)
    .maybeSingle()
  if (error) throw error
  return data as OwnerPlanRow | null
}

async function loadCompletedDraft(
  client: RefinementPresentationReadClient,
  planId: string,
  refinedNeedVersionId: string,
): Promise<{ answers: unknown; completed_question_ids: unknown } | null> {
  const { data, error } = await client
    .from("personal_plan_refinement_drafts")
    .select("answers,completed_question_ids,updated_at")
    .eq("personal_plan_id", planId)
    .eq("status", "complete")
    // Authority: bound to the plan's current_refined_need_version_id pointer, which
    // personal_plan_complete_refinement_draft() updates atomically on completion — not
    // "the most recently updated complete draft".
    .eq("result_refined_need_version_id", refinedNeedVersionId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data as { answers: unknown; completed_question_ids: unknown } | null
}

export function createRefinementPresentationRouteHandlers(deps: RefinementPresentationRouteDeps) {
  return {
    async GET() {
      const userId = await deps.getUserId()
      if (!userId) return response({ error: "unauthorized" }, 401)
      try {
        const client = deps.client()
        const plan = await loadOwnerPlan(client, userId)

        let answers: PersonalPlanRefinementAnswersV1 | null = null
        let completedQuestionIds: string[] = []
        if (plan?.current_refined_need_version_id) {
          const draft = await loadCompletedDraft(
            client,
            plan.id,
            plan.current_refined_need_version_id,
          )
          if (draft) {
            answers = (draft.answers ?? {}) as PersonalPlanRefinementAnswersV1
            completedQuestionIds = Array.isArray(draft.completed_question_ids)
              ? (draft.completed_question_ids as string[])
              : []
          }
        }

        // Reuse the same server loader that feeds the Routine page's `view` prop
        // (src/lib/personal-plan/routine/load-view.ts). This keeps /profile and /routine
        // consistent: when the frozen active Routine no longer matches its immutable source
        // (authority_repair_required), the loader nulls out activeVersion rather than
        // returning a possibly-stale product list, and /profile must not show it as confirmed
        // either.
        const view = await loadPersonalPlanRoutineView({
          client: client as unknown as PersonalPlanRoutineReadClient,
          userId,
          enabled: true,
          includePendingProposal: false,
        })
        const activeRoutinePayload =
          view.status === "no_personal_plan" ? null : (view.activeVersion?.payload ?? null)
        const routineProducts: RoutineProductSummary[] | null = activeRoutinePayload
          ? activeRoutinePayload.items
              .filter((item) => item.state.inclusion === "included")
              .map(routineProductSummary)
              .filter((summary): summary is RoutineProductSummary => summary !== null)
          : null

        return response({ answers, completedQuestionIds, routineProducts })
      } catch {
        return response({ error: "temporarily_unavailable" }, 503)
      }
    },
  }
}

const handlers = createRefinementPresentationRouteHandlers({
  getUserId: async () => (await (await createClient()).auth.getUser()).data.user?.id ?? null,
  client: () => createAdminClient() as unknown as RefinementPresentationReadClient,
})

export const GET = () => handlers.GET()
