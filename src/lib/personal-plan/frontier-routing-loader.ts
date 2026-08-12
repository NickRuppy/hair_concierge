import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  type PersonalPlanRoutingFrontier,
  resolvePersonalPlanRoutingFrontier,
} from "./frontier-routing"
import {
  getPersonalPlanNewBuyerCohortCutoff,
  isPersonalPlanLegacyQuizCutoverEnabled,
} from "./release"
import { isPersonalPlanAppV1AllowedForUser } from "./rollout-access"

type RoutingClient = Pick<SupabaseClient, "rpc" | "from">

type RoutingReleaseDependencies = {
  cohortCutoff: () => Date | null
  legacyQuizCutoverEnabled: () => boolean
  appAllowedForUser: (userId: string, client: RoutingClient) => Promise<boolean>
}

const releaseDefaults: RoutingReleaseDependencies = {
  cohortCutoff: getPersonalPlanNewBuyerCohortCutoff,
  legacyQuizCutoverEnabled: isPersonalPlanLegacyQuizCutoverEnabled,
  appAllowedForUser: (userId, client) => isPersonalPlanAppV1AllowedForUser(userId, client as never),
}

type RoutingSource = {
  qualifiedAt: string
  quizSourceKind: "legacy" | "personal_plan"
  plan: {
    currentInitialNeedVersionId: string | null
    currentRefinedNeedVersionId: string | null
    pendingRoutineProposalId: string | null
    activeRoutineVersionId: string | null
  } | null
}

export async function loadPersonalPlanRoutingFrontierForUser(
  client: RoutingClient,
  userId: string,
  release: RoutingReleaseDependencies = releaseDefaults,
): Promise<PersonalPlanRoutingFrontier> {
  if (!(await release.appAllowedForUser(userId, client))) return { kind: "legacy" }

  const { data, error } = await client.rpc("personal_plan_get_own_routing_source")
  if (error) throw error
  const source = parseRoutingSource(data)
  if (!source) return { kind: "legacy" }

  const cutoff = release.cohortCutoff()
  const qualifiedAt = new Date(source.qualifiedAt)
  const eligible = Boolean(
    cutoff &&
    !Number.isNaN(qualifiedAt.getTime()) &&
    qualifiedAt.getTime() >= cutoff.getTime() &&
    (source.quizSourceKind === "personal_plan" || release.legacyQuizCutoverEnabled()),
  )

  return resolvePersonalPlanRoutingFrontier({
    eligible,
    // Before Stage 1 exists the reviewed recovery handoff remains authoritative.
    // Once it exists, its immutable source provenance proves readiness.
    sourceReady: Boolean(source.plan?.currentInitialNeedVersionId),
    plan: source.plan,
  })
}

function parseRoutingSource(value: unknown): RoutingSource | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  if (
    typeof row.qualified_at !== "string" ||
    (row.quiz_source_kind !== "legacy" && row.quiz_source_kind !== "personal_plan")
  ) {
    return null
  }
  if (row.plan === null || row.plan === undefined) {
    return {
      qualifiedAt: row.qualified_at,
      quizSourceKind: row.quiz_source_kind,
      plan: null,
    }
  }
  if (typeof row.plan !== "object" || Array.isArray(row.plan)) return null
  const plan = row.plan as Record<string, unknown>
  const currentInitialNeedVersionId = optionalId(plan.current_initial_need_version_id)
  const currentRefinedNeedVersionId = optionalId(plan.current_refined_need_version_id)
  const pendingRoutineProposalId = optionalId(plan.pending_routine_proposal_id)
  const activeRoutineVersionId = optionalId(plan.active_routine_version_id)
  if (
    currentInitialNeedVersionId === undefined ||
    currentRefinedNeedVersionId === undefined ||
    pendingRoutineProposalId === undefined ||
    activeRoutineVersionId === undefined
  ) {
    return null
  }
  return {
    qualifiedAt: row.qualified_at,
    quizSourceKind: row.quiz_source_kind,
    plan: {
      currentInitialNeedVersionId,
      currentRefinedNeedVersionId,
      pendingRoutineProposalId,
      activeRoutineVersionId,
    },
  }
}

function optionalId(value: unknown): string | null | undefined {
  return value === null || value === undefined
    ? null
    : typeof value === "string"
      ? value
      : undefined
}
