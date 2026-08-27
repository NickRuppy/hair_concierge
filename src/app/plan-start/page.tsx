import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { PlanStartFlow, RouteAwarePlanStartProductionGate } from "@/components/personal-plan-start"
import type {
  PlanStartInitialJourney,
  PlanStartReadyViewModel,
} from "@/components/personal-plan-start/plan-start-flow"
import { adaptInitialNeedSnapshotToPlanStartViewModel } from "@/components/personal-plan-start/snapshot-adapter"
import { isPersonalPlanToolsEnabledForUser } from "@/lib/personal-plan/rollout-access"
import {
  canAccessPersonalPlanJourneyStage,
  type PersonalPlanJourneyAccess,
} from "@/lib/personal-plan/journey-access"
import { loadPersonalPlanJourneyAccessForUser } from "@/lib/personal-plan/journey-access-loader"
import { loadExistingStage2RefinementSession } from "@/lib/personal-plan/persistence/stage2-refinement-service"
import { createSupabaseStage2RefinementPersistence } from "@/lib/personal-plan/persistence/stage2-refinement-supabase"
import { createStage1PersistenceService } from "@/lib/personal-plan/persistence/stage1-service"
import { createStage1SupabaseDependencies } from "@/lib/personal-plan/persistence/stage1-supabase"
import type { Stage2RefinementSession } from "@/lib/personal-plan/refinement/session"
import {
  isPersonalPlanAppV1Enabled,
  isPersonalPlanStage2Enabled,
  isPersonalPlanStage3Enabled,
  isPersonalPlanStage4Enabled,
} from "@/lib/personal-plan/release"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "Dein Personal Plan",
  robots: { index: false, follow: false },
}

export type PlanStartPageDeps = {
  enabled: () => boolean
  stage2Enabled: () => boolean
  /**
   * Direct acceptance drives Stage 2 → 3 → 4 headlessly, so the fork may only
   * offer it when the accept route's own flag set is satisfied. Fail closed:
   * an unwired caller gets the refine-only fork.
   */
  stage3Enabled?: () => boolean
  stage4Enabled?: () => boolean
  getUserId: () => Promise<string | null>
  loadJourneyAccess: (userId: string) => Promise<PersonalPlanJourneyAccess>
  loadExistingRefinementSession: (userId: string) => Promise<Stage2RefinementSession | null>
  loadStage1Plan?: (userId: string) => Promise<PlanStartReadyViewModel | null>
}

export type PlanStartSearchParams = {
  repairRoutineVersionId?: string | string[]
  /** `1` = explicit re-entry into Stage 2 (the Routine refinement nudge). */
  refine?: string | string[]
}

/**
 * The Routine refinement nudge links to `/plan-start?refine=1`. Without it, a
 * directly accepted plan has a COMPLETE refinement draft, so the resolver would
 * seed the completed session and Stage 2 would auto-hand off straight into
 * Stage 3 — the user would never see the Feinschliff again.
 */
export function parseRefineParam(value: string | string[] | undefined): boolean {
  return (Array.isArray(value) ? value[0] : value) === "1"
}

export type PlanStartPageState =
  | { state: "unavailable" }
  | { state: "paid_pending" }
  | {
      state: "production"
      initialJourney: PlanStartInitialJourney
      initialPlan?: PlanStartReadyViewModel
      personalPlanId?: string
      initialRefinementSession?: Stage2RefinementSession
    }

export async function resolvePlanStartPageState(
  deps: PlanStartPageDeps,
  options: { repairRoutineVersionId?: string; refine?: boolean } = {},
): Promise<PlanStartPageState> {
  if (!deps.enabled()) return { state: "unavailable" }
  const userId = await deps.getUserId()
  if (!userId) return { state: "unavailable" }
  try {
    const access = await deps.loadJourneyAccess(userId)
    if (access.kind === "paid_pending" && access.recoveryHref === "/plan-bereit") {
      return { state: "paid_pending" }
    }
    if (!canAccessPersonalPlanJourneyStage(access, "stage1")) {
      return { state: "unavailable" }
    }
    let initialPlan: PlanStartReadyViewModel | null | undefined
    try {
      initialPlan = await deps.loadStage1Plan?.(userId)
    } catch {
      // Preserve the existing client retry path when only the optional server
      // preload fails; access/auth failures still resolve through the outer gate.
      initialPlan = undefined
    }
    const production = (
      initialJourney: PlanStartInitialJourney,
      bootstrap?: Pick<
        Extract<PlanStartPageState, { state: "production" }>,
        "personalPlanId" | "initialRefinementSession"
      >,
    ): PlanStartPageState => ({
      state: "production",
      initialJourney,
      ...(initialPlan ? { initialPlan } : {}),
      ...bootstrap,
    })
    const stage2Enabled = deps.stage2Enabled()
    // Mirrors the accept route's flag set: Stage 2 plus the Stage 3 and 4 flags
    // it drives headlessly. Deliberately NOT keyed on `access.allowed.stage2`:
    // access is read before `loadStage1Plan` creates the Stage-1 snapshot, so a
    // first-visit buyer is still pre-Stage-2 here and would lose the accept
    // button on their own fork screen. This flag only gates the fork's UI —
    // `POST /api/personal-plan/accept-ideal-plan` re-validates real access,
    // Stage 2 progress and seen state server-side before accepting anything.
    const directAcceptance =
      stage2Enabled && deps.stage3Enabled?.() && deps.stage4Enabled?.()
        ? ({ directAcceptanceAvailable: true } as const)
        : {}

    if (!stage2Enabled || access.kind !== "personal_plan" || !access.allowed.stage2) {
      return production(
        stage2Enabled
          ? { stage: "stage1", ...directAcceptance }
          : { stage: "stage1", refinementAvailable: false },
      )
    }

    const refinement = await deps.loadExistingRefinementSession(userId)
    if (!refinement) {
      return production({ stage: "stage1", ...directAcceptance })
    }
    const initialRefinementSession = isUsableInitialRefinementSession(refinement)
      ? refinement
      : undefined
    // An explicit refine request outranks every later-stage resume: it exists
    // precisely to stop the completed draft from being handed off again.
    if (options.refine) {
      return production(
        { stage: "stage2", returningToRefinement: true, ...directAcceptance },
        initialRefinementSession
          ? { personalPlanId: access.personalPlanId, initialRefinementSession }
          : undefined,
      )
    }
    if (
      options.repairRoutineVersionId &&
      refinement.status === "complete" &&
      access.allowed.stage3 &&
      refinement.completedHandoff
    ) {
      return production(
        {
          stage: "stage3",
          refinedVersionId: refinement.completedHandoff.refinedVersionId,
          repairRoutineVersionId: options.repairRoutineVersionId,
        },
        initialRefinementSession
          ? { personalPlanId: access.personalPlanId, initialRefinementSession }
          : undefined,
      )
    }
    if (
      refinement.status === "complete" &&
      access.frontier === "stage3" &&
      access.allowed.stage3 &&
      refinement.completedHandoff
    ) {
      return production(
        {
          stage: "stage3",
          refinedVersionId: refinement.completedHandoff.refinedVersionId,
        },
        initialRefinementSession
          ? { personalPlanId: access.personalPlanId, initialRefinementSession }
          : undefined,
      )
    }
    return production(
      { stage: "stage2", ...directAcceptance },
      initialRefinementSession
        ? { personalPlanId: access.personalPlanId, initialRefinementSession }
        : undefined,
    )
  } catch {
    return { state: "unavailable" }
  }
}

function isUsableInitialRefinementSession(
  session: Stage2RefinementSession,
): session is Stage2RefinementSession {
  return (
    session.schemaVersion === 1 &&
    typeof session.pathVersion === "string" &&
    typeof session.revision === "number" &&
    Array.isArray(session.completedQuestionIds) &&
    Array.isArray(session.path?.orderedQuestionIds)
  )
}

export default async function PlanStartPage({
  searchParams,
}: {
  searchParams?: Promise<PlanStartSearchParams>
}) {
  const params = (await searchParams) ?? {}
  const state = await resolvePlanStartPageState(
    {
      enabled: isPersonalPlanAppV1Enabled,
      stage2Enabled: isPersonalPlanStage2Enabled,
      stage3Enabled: isPersonalPlanStage3Enabled,
      stage4Enabled: isPersonalPlanStage4Enabled,
      getUserId: async () => (await (await createClient()).auth.getUser()).data.user?.id ?? null,
      loadJourneyAccess: loadPersonalPlanJourneyAccessForUser,
      loadExistingRefinementSession: async (userId) =>
        loadExistingStage2RefinementSession({
          userId,
          persistence: createSupabaseStage2RefinementPersistence(createAdminClient(), {
            toolsEnabled: (userId) =>
              isPersonalPlanToolsEnabledForUser(
                userId,
                createAdminClient() as unknown as Parameters<
                  typeof isPersonalPlanToolsEnabledForUser
                >[1],
              ),
          }),
        }),
      loadStage1Plan: async (userId) => {
        const result = await createStage1PersistenceService(
          createStage1SupabaseDependencies(createAdminClient() as never),
        ).loadOrCreate({ userId })
        if (result.status !== "completed") return null
        const plan = adaptInitialNeedSnapshotToPlanStartViewModel(result.outputSnapshot, {
          toolsEnabled: await isPersonalPlanToolsEnabledForUser(
            userId,
            createAdminClient() as unknown as Parameters<
              typeof isPersonalPlanToolsEnabledForUser
            >[1],
          ),
        })
        return plan ? { ...plan, personalPlanId: result.personalPlanId } : null
      },
    },
    {
      repairRoutineVersionId: parseUuidParam(params.repairRoutineVersionId),
      refine: parseRefineParam(params.refine),
    },
  )
  if (state.state === "paid_pending") redirect("/plan-bereit")
  if (state.state === "unavailable") return <PlanStartFlow state="unavailable" />

  return (
    <>
      <Stage1ProductExamplePreviewWarmup
        initialJourney={state.initialJourney}
        initialPlan={state.initialPlan}
      />
      <RouteAwarePlanStartProductionGate
        initialJourney={state.initialJourney}
        initialPlan={state.initialPlan}
        personalPlanId={state.personalPlanId}
        initialRefinementSession={state.initialRefinementSession}
      />
    </>
  )
}

export function Stage1ProductExamplePreviewWarmup({
  initialJourney,
  initialPlan,
}: {
  initialJourney: PlanStartInitialJourney
  initialPlan?: PlanStartReadyViewModel
}) {
  if (
    initialJourney.stage !== "stage1" ||
    !initialPlan?.personalPlanId ||
    !initialPlan.sourceInputHash
  ) {
    return null
  }
  // The preview JSON response is Cache-Control: no-store (it now carries
  // prices), so a preload hint for it can never be reused by the client's
  // real fetch — it would just be a second, wasted request. Product images
  // are still cacheable, so keep the storage-origin preconnect for them.
  return <link rel="preconnect" href="https://pqdkhefxsxkyeqelqegq.supabase.co" />
}

function parseUuidParam(value: string | string[] | undefined): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value
  return candidate &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidate)
    ? candidate
    : undefined
}
