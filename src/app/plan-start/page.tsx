import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { PlanStartFlow, PlanStartProductionGate } from "@/components/personal-plan-start"
import type { PlanStartInitialJourney } from "@/components/personal-plan-start/plan-start-flow"
import {
  canAccessPersonalPlanJourneyStage,
  type PersonalPlanJourneyAccess,
} from "@/lib/personal-plan/journey-access"
import { loadPersonalPlanJourneyAccessForUser } from "@/lib/personal-plan/journey-access-loader"
import { loadExistingStage2RefinementSession } from "@/lib/personal-plan/persistence/stage2-refinement-service"
import { createSupabaseStage2RefinementPersistence } from "@/lib/personal-plan/persistence/stage2-refinement-supabase"
import type { Stage2RefinementSession } from "@/lib/personal-plan/refinement/session"
import {
  isPersonalPlanAppV1Enabled,
  isPersonalPlanStage2Enabled,
} from "@/lib/personal-plan/release"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "Dein Personal Plan | Chaarlie",
  robots: { index: false, follow: false },
}

export type PlanStartPageDeps = {
  enabled: () => boolean
  stage2Enabled: () => boolean
  getUserId: () => Promise<string | null>
  loadJourneyAccess: (userId: string) => Promise<PersonalPlanJourneyAccess>
  loadExistingRefinementSession: (userId: string) => Promise<Stage2RefinementSession | null>
}

export type PlanStartPageState =
  | { state: "unavailable" }
  | { state: "paid_pending" }
  | { state: "production"; initialJourney: PlanStartInitialJourney }

export async function resolvePlanStartPageState(
  deps: PlanStartPageDeps,
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
    const stage2Enabled = deps.stage2Enabled()
    if (!stage2Enabled || access.kind !== "personal_plan" || !access.allowed.stage2) {
      return {
        state: "production",
        initialJourney: stage2Enabled
          ? { stage: "stage1" }
          : { stage: "stage1", refinementAvailable: false },
      }
    }

    const refinement = await deps.loadExistingRefinementSession(userId)
    if (!refinement) {
      return { state: "production", initialJourney: { stage: "stage1" } }
    }
    if (
      refinement.status === "complete" &&
      access.frontier === "stage3" &&
      access.allowed.stage3 &&
      refinement.completedHandoff
    ) {
      return {
        state: "production",
        initialJourney: {
          stage: "stage3",
          refinedVersionId: refinement.completedHandoff.refinedVersionId,
        },
      }
    }
    return { state: "production", initialJourney: { stage: "stage2" } }
  } catch {
    return { state: "unavailable" }
  }
}

export default async function PlanStartPage() {
  const state = await resolvePlanStartPageState({
    enabled: isPersonalPlanAppV1Enabled,
    stage2Enabled: isPersonalPlanStage2Enabled,
    getUserId: async () => (await (await createClient()).auth.getUser()).data.user?.id ?? null,
    loadJourneyAccess: loadPersonalPlanJourneyAccessForUser,
    loadExistingRefinementSession: async (userId) =>
      loadExistingStage2RefinementSession({
        userId,
        persistence: createSupabaseStage2RefinementPersistence(createAdminClient()),
      }),
  })
  if (state.state === "paid_pending") redirect("/plan-bereit")
  if (state.state === "unavailable") return <PlanStartFlow state="unavailable" />

  return <PlanStartProductionGate initialJourney={state.initialJourney} />
}
