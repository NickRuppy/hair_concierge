import "server-only"

import {
  findOneTimePurchaseEntitlementForUser,
  resolveOneTimePurchaseAccessState,
} from "@/lib/billing/purchases"
import { createAdminClient } from "@/lib/supabase/admin"
import { buildStage3EntryContext } from "./products/stage2-entry-adapter"
import { requireCurrentAuthoritySnapshot } from "./products/authority/snapshot"
import type { PersonalPlanCategory, Stage3AuthoritySnapshotV1 } from "./products/contracts"
import type { InitialNeedPlanSnapshot } from "./types"
import {
  getPersonalPlanNewBuyerCohortCutoff,
  isPersonalPlanAppV1Enabled,
  isPersonalPlanStage2Enabled,
  isPersonalPlanStage3Enabled,
  isPersonalPlanStage4Enabled,
} from "./release"
import { canAccessPersonalPlanStage5, resolvePersonalPlanStage5Rollout } from "./stage5-rollout"
import {
  resolvePersonalPlanJourneyAccess,
  type PersonalPlanJourneyAccess,
  type PersonalPlanJourneyAccessInput,
} from "./journey-access"

type AccessState = PersonalPlanJourneyAccessInput["accessState"]

type JourneyPlanRow = NonNullable<PersonalPlanJourneyAccessInput["plan"]>

type JourneyDraft = {
  status: "active" | "completed" | "stale"
  refinedVersionId: string
  orderedCategories: readonly PersonalPlanCategory[]
  authorityVersions: Partial<Record<PersonalPlanCategory, string>>
  authoritySnapshot: Stage3AuthoritySnapshotV1 | null
}

export type PersonalPlanJourneyAccessLoaderDeps = {
  loadEntitlement: (userId: string) => Promise<{
    accessState: AccessState
    paidAt: string | null
    artifactLeadId: string | null
  }>
  cohortCutoff: () => Date | null
  appEnabled: () => boolean
  stage2Enabled: () => boolean
  stage3Enabled: () => boolean
  stage4Enabled: () => boolean
  stage5Rollout: () => "off" | "internal" | "all"
  loadPreparedArtifact: (userId: string, leadId: string) => Promise<{ id: string } | null>
  loadPlan: (userId: string) => Promise<JourneyPlanRow | null>
  loadCurrentRefinedNeed: (
    userId: string,
    planId: string,
    refinedVersionId: string,
  ) => Promise<InitialNeedPlanSnapshot | null>
  loadCurrentProductDraft: (
    userId: string,
    planId: string,
    refinedVersionId: string,
  ) => Promise<JourneyDraft | null>
  loadIsInternal: (userId: string) => Promise<boolean>
}

function isNewBuyerCohort(paidAt: string | null, cutoff: Date | null): boolean {
  if (!paidAt || !cutoff) return false
  const parsed = new Date(paidAt)
  return !Number.isNaN(parsed.getTime()) && parsed.getTime() >= cutoff.getTime()
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function sameStringRecord(
  left: Readonly<Record<string, string>>,
  right: Readonly<Record<string, string>>,
): boolean {
  const leftEntries = Object.entries(left).sort(([leftKey], [rightKey]) =>
    leftKey.localeCompare(rightKey),
  )
  const rightEntries = Object.entries(right).sort(([leftKey], [rightKey]) =>
    leftKey.localeCompare(rightKey),
  )
  return sameJson(leftEntries, rightEntries)
}

function hasCurrentAuthority(
  draft: JourneyDraft | null,
  context: ReturnType<typeof buildStage3EntryContext>,
): boolean {
  if (!draft || draft.status === "stale" || !draft.authoritySnapshot) return false
  try {
    requireCurrentAuthoritySnapshot({
      refinedVersionId: draft.refinedVersionId,
      orderedCategories: [...draft.orderedCategories],
      authorityVersions: draft.authorityVersions as Record<PersonalPlanCategory, string>,
      authoritySnapshot: draft.authoritySnapshot,
    } as never)
  } catch {
    return false
  }

  const expected = context.authoritySnapshot
  const actual = draft.authoritySnapshot
  return (
    actual.refinedNeedVersionId === expected.refinedNeedVersionId &&
    actual.refinedInputHash === expected.refinedInputHash &&
    sameJson(actual.orderedCategories, expected.orderedCategories) &&
    sameJson(actual.categoryDecisions, expected.categoryDecisions) &&
    sameJson(actual.coverage, expected.coverage) &&
    sameStringRecord(actual.authorityVersions, expected.authorityVersions)
  )
}

/**
 * Server-only, owner-scoped source of journey reachability. This intentionally
 * throws on database or malformed-source failures so routes cannot accidentally
 * turn an unavailable authorization read into access.
 */
export async function loadPersonalPlanJourneyAccessWithDeps(
  deps: PersonalPlanJourneyAccessLoaderDeps,
  userId = "user-id-required",
): Promise<PersonalPlanJourneyAccess> {
  if (!userId.trim() || userId === "user-id-required")
    throw new Error("journey_access_user_required")
  const entitlement = await deps.loadEntitlement(userId)
  const newBuyer = isNewBuyerCohort(entitlement.paidAt, deps.cohortCutoff())

  if (entitlement.accessState !== "active") {
    return resolvePersonalPlanJourneyAccess({
      accessState: entitlement.accessState,
      isNewBuyerCohort: newBuyer,
      appEnabled: deps.appEnabled(),
      stage2Enabled: deps.stage2Enabled(),
      stage3Enabled: deps.stage3Enabled(),
      stage4Enabled: deps.stage4Enabled(),
      stage5Allowed: false,
      preparedSourceReady: false,
      plan: null,
    })
  }

  if (!newBuyer || !entitlement.artifactLeadId) {
    return resolvePersonalPlanJourneyAccess({
      accessState: "active",
      isNewBuyerCohort: false,
      appEnabled: deps.appEnabled(),
      stage2Enabled: deps.stage2Enabled(),
      stage3Enabled: deps.stage3Enabled(),
      stage4Enabled: deps.stage4Enabled(),
      stage5Allowed: false,
      preparedSourceReady: false,
      plan: null,
    })
  }

  const artifact = await deps.loadPreparedArtifact(userId, entitlement.artifactLeadId)
  if (!artifact) {
    return resolvePersonalPlanJourneyAccess({
      accessState: "active",
      isNewBuyerCohort: true,
      appEnabled: deps.appEnabled(),
      stage2Enabled: deps.stage2Enabled(),
      stage3Enabled: deps.stage3Enabled(),
      stage4Enabled: deps.stage4Enabled(),
      stage5Allowed: false,
      preparedSourceReady: false,
      plan: null,
    })
  }

  const loadedPlan = await deps.loadPlan(userId)
  const plan = loadedPlan ? { ...loadedPlan } : null
  const appEnabled = deps.appEnabled()
  const stage2Enabled = deps.stage2Enabled()
  const stage3Enabled = deps.stage3Enabled()
  const stage4Enabled = deps.stage4Enabled()
  const rollout = deps.stage5Rollout()
  const isInternal = rollout === "internal" ? await deps.loadIsInternal(userId) : false
  const stage5Allowed = canAccessPersonalPlanStage5({
    rollout,
    isEligiblePersonalPlanOwner: true,
    isInternal,
  })

  let stage3AuthorityReady = false
  if (stage2Enabled && stage3Enabled && plan?.currentRefinedNeedVersionId) {
    try {
      const refined = await deps.loadCurrentRefinedNeed(
        userId,
        plan.id,
        plan.currentRefinedNeedVersionId,
      )
      if (!refined) throw new Error("journey_access_current_refined_unavailable")
      const context = buildStage3EntryContext(refined, {
        personalPlanId: plan.id,
        refinedVersionId: plan.currentRefinedNeedVersionId,
      })
      const draft = await deps.loadCurrentProductDraft(
        userId,
        plan.id,
        plan.currentRefinedNeedVersionId,
      )
      stage3AuthorityReady = !draft || hasCurrentAuthority(draft, context)
      plan.productDraftCompleted = draft?.status === "completed" && stage3AuthorityReady
    } catch (error) {
      // A Routine that was explicitly accepted is immutable evidence for
      // Stage 4/5. A broken later successor must degrade Stage 3 only; an
      // unaccepted pending proposal remains fail-closed.
      if (!plan.activeRoutineVersionId) throw error
    }
  }

  return resolvePersonalPlanJourneyAccess({
    accessState: "active",
    isNewBuyerCohort: true,
    appEnabled,
    stage2Enabled,
    stage3Enabled,
    stage4Enabled,
    stage5Allowed,
    preparedSourceReady: true,
    stage3AuthorityReady,
    plan,
  })
}

type QueryResult = Promise<{ data: unknown; error: unknown }>
type QueryBuilder = {
  select: (columns: string) => QueryBuilder
  eq: (column: string, value: unknown) => QueryBuilder
  neq: (column: string, value: unknown) => QueryBuilder
  maybeSingle: () => QueryResult
}
export type PersonalPlanJourneyAccessSupabaseClient = {
  from: (table: string) => QueryBuilder
}

function required(result: QueryResult) {
  return result.then(({ data, error }) => {
    if (error) throw error
    return data as Record<string, unknown> | null
  })
}

export function createSupabasePersonalPlanJourneyAccessLoader(
  admin: PersonalPlanJourneyAccessSupabaseClient,
): PersonalPlanJourneyAccessLoaderDeps {
  return {
    async loadEntitlement(userId) {
      const entitlement = await findOneTimePurchaseEntitlementForUser(admin as never, userId)
      return {
        accessState: resolveOneTimePurchaseAccessState(entitlement),
        paidAt: entitlement?.purchase.paid_at ?? null,
        artifactLeadId: entitlement?.consent?.lead_id ?? null,
      }
    },
    cohortCutoff: getPersonalPlanNewBuyerCohortCutoff,
    appEnabled: isPersonalPlanAppV1Enabled,
    stage2Enabled: isPersonalPlanStage2Enabled,
    stage3Enabled: isPersonalPlanStage3Enabled,
    stage4Enabled: isPersonalPlanStage4Enabled,
    stage5Rollout: resolvePersonalPlanStage5Rollout,
    async loadPreparedArtifact(userId, leadId) {
      const data = await required(
        admin
          .from("personal_plan_prepared_artifacts")
          .select("id")
          .eq("user_id", userId)
          .eq("lead_id", leadId)
          .eq("status", "attached")
          .maybeSingle(),
      )
      return data && typeof data.id === "string" ? { id: data.id } : null
    },
    async loadPlan(userId) {
      const data = await required(
        admin
          .from("personal_plans")
          .select(
            "id,current_initial_need_version_id,current_refined_need_version_id,pending_routine_proposal_id,active_routine_version_id",
          )
          .eq("user_id", userId)
          .maybeSingle(),
      )
      if (!data) return null
      if (typeof data.id !== "string") throw new Error("journey_access_plan_malformed")
      return {
        id: data.id,
        currentInitialNeedVersionId:
          typeof data.current_initial_need_version_id === "string"
            ? data.current_initial_need_version_id
            : null,
        currentRefinedNeedVersionId:
          typeof data.current_refined_need_version_id === "string"
            ? data.current_refined_need_version_id
            : null,
        productDraftCompleted: false,
        pendingRoutineProposalId:
          typeof data.pending_routine_proposal_id === "string"
            ? data.pending_routine_proposal_id
            : null,
        activeRoutineVersionId:
          typeof data.active_routine_version_id === "string"
            ? data.active_routine_version_id
            : null,
      }
    },
    async loadCurrentRefinedNeed(userId, planId, refinedVersionId) {
      const data = await required(
        admin
          .from("personal_plan_need_versions")
          .select("output_snapshot")
          .eq("id", refinedVersionId)
          .eq("user_id", userId)
          .eq("personal_plan_id", planId)
          .eq("kind", "refined")
          .maybeSingle(),
      )
      return (data?.output_snapshot as InitialNeedPlanSnapshot | undefined) ?? null
    },
    async loadCurrentProductDraft(userId, planId, refinedVersionId) {
      const data = await required(
        admin
          .from("personal_plan_product_drafts")
          .select("status,refined_need_version_id,category_authority_versions,payload")
          .eq("user_id", userId)
          .eq("personal_plan_id", planId)
          .eq("refined_need_version_id", refinedVersionId)
          .neq("status", "stale")
          .maybeSingle(),
      )
      if (!data) return null
      const payload = data.payload
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw new Error("journey_access_draft_malformed")
      }
      const status = data.status
      if (status !== "active" && status !== "completed" && status !== "stale") {
        throw new Error("journey_access_draft_malformed")
      }
      const refined = data.refined_need_version_id
      if (typeof refined !== "string") throw new Error("journey_access_draft_malformed")
      const payloadRecord = payload as Record<string, unknown>
      return {
        status,
        refinedVersionId: refined,
        orderedCategories: Array.isArray(payloadRecord.orderedCategories)
          ? (payloadRecord.orderedCategories as PersonalPlanCategory[])
          : [],
        authorityVersions: (data.category_authority_versions ?? {}) as Partial<
          Record<PersonalPlanCategory, string>
        >,
        authoritySnapshot: (payloadRecord.authoritySnapshot ??
          null) as Stage3AuthoritySnapshotV1 | null,
      }
    },
    async loadIsInternal(userId) {
      const data = await required(
        admin.from("profiles").select("is_admin").eq("id", userId).maybeSingle(),
      )
      return data?.is_admin === true
    },
  }
}

export function loadPersonalPlanJourneyAccessForUser(
  userId: string,
): Promise<PersonalPlanJourneyAccess> {
  return loadPersonalPlanJourneyAccessWithDeps(
    createSupabasePersonalPlanJourneyAccessLoader(
      createAdminClient() as unknown as PersonalPlanJourneyAccessSupabaseClient,
    ),
    userId,
  )
}
