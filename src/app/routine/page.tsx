import type { ReactNode } from "react"

import { PersonalPlanRoutineClient } from "@/components/routine/personal-plan"
import { RoutinePageClient } from "@/components/routine/routine-page-client"
import { RetryRefreshButton } from "@/components/ui/retry-refresh-button"
import { loadPersonalPlanRoutineView } from "@/lib/personal-plan/routine/load-view"
import { stripRoutineToolPayload } from "@/lib/personal-plan/routine/decode-stored"
import type { PersonalPlanRoutineView } from "@/lib/personal-plan/routine/contracts"
import { isPersonalPlanToolsEnabledForUser } from "@/lib/personal-plan/rollout-access"
import type { PersonalPlanRoutineReadClient } from "@/lib/personal-plan/routine/repository"
import {
  loadOwnerPortfolioPresentation,
  type PortfolioPresentation,
} from "@/lib/personal-plan/routine/portfolio-presentation"
import {
  isPersonalPlanAppV1Enabled,
  isPersonalPlanStage4Enabled,
} from "@/lib/personal-plan/release"
import {
  canAccessPersonalPlanJourneyStage,
  type PersonalPlanJourneyAccess,
} from "@/lib/personal-plan/journey-access"
import {
  loadCachedAuthenticatedAppUserId,
  loadCachedPersonalPlanJourneyAccessForUser,
} from "@/lib/personal-plan/navigation-access"
import { createAdminClient } from "@/lib/supabase/admin"
import { reportPersonalPlanTransitionTiming } from "@/lib/personal-plan/transition-performance"

export const dynamic = "force-dynamic"

export type RoutinePageResolverDeps = {
  getUserId: () => Promise<string | null>
  loadJourneyAccess: (userId: string) => Promise<PersonalPlanJourneyAccess>
  readView: (input: {
    userId: string
    enabled: boolean
  }) => ReturnType<typeof loadPersonalPlanRoutineView>
  stage4Enabled: () => boolean
  /**
   * Server-owned Hair Tools rollout for this owner. Omitted means off: the
   * browser may never decide this, and an unwired caller renders the released
   * product-only Routine.
   */
  toolsEnabled?: (userId: string) => Promise<boolean>
  readPortfolioPresentation?: (
    userId: string,
    planId: string,
    portfolioVersionId: string,
  ) => Promise<PortfolioPresentation | null>
}

/** Removes every Tool projection from a loaded Routine view. */
function withoutRoutineToolProjection<T extends { status: string }>(view: T): T {
  const loaded = view as unknown as PersonalPlanRoutineView
  return {
    ...view,
    ...(loaded.activeVersion?.payload
      ? {
          activeVersion: {
            ...loaded.activeVersion,
            payload: stripRoutineToolPayload(loaded.activeVersion.payload),
          },
        }
      : {}),
    ...(loaded.pendingProposal?.candidate
      ? {
          pendingProposal: {
            ...loaded.pendingProposal,
            candidate: stripRoutineToolPayload(loaded.pendingProposal.candidate),
          },
        }
      : {}),
  }
}

export async function resolveRoutinePage(deps: RoutinePageResolverDeps) {
  const userId = await deps.getUserId()
  if (!userId) return { kind: "legacy" as const }

  try {
    const journey = await deps.loadJourneyAccess(userId)
    if (journey.kind === "legacy") return { kind: "legacy" as const }
    if (!canAccessPersonalPlanJourneyStage(journey, "stage4")) {
      return { kind: "unavailable" as const }
    }

    const enabled = deps.stage4Enabled()
    const loadedView = await deps.readView({ userId, enabled })
    if (loadedView.status === "no_personal_plan") return { kind: "legacy" as const }
    // Fail-closed rollout boundary: a gated-off owner is served the released
    // product-only Routine. The stored Tool facts are untouched.
    const view =
      (await deps.toolsEnabled?.(userId)) === true
        ? loadedView
        : withoutRoutineToolProjection(loadedView)
    const routinePayload =
      view.status === "proposal" ? view.pendingProposal?.candidate : view.activeVersion?.payload
    const portfolioVersionId = routinePayload?.source.productPortfolioVersionId
    let portfolioPresentation: PortfolioPresentation | null = null
    if (portfolioVersionId && deps.readPortfolioPresentation) {
      try {
        portfolioPresentation = await deps.readPortfolioPresentation(
          userId,
          view.personalPlanId,
          portfolioVersionId,
        )
      } catch {
        // Presentation must not substitute or hide an otherwise valid Routine.
      }
    }
    return {
      kind: "personal_plan" as const,
      view,
      enabled,
      portfolioPresentation,
      stage5Reachable: canAccessPersonalPlanJourneyStage(journey, "stage5"),
    }
  } catch {
    // The legacy Routine is not a safe substitute once a Personal Plan exists.
    // Preserve the scoped recovery state instead of silently presenting it as confirmed.
    return { kind: "unavailable" as const }
  }
}

const defaultDeps: RoutinePageResolverDeps = {
  getUserId: loadCachedAuthenticatedAppUserId,
  loadJourneyAccess: loadCachedPersonalPlanJourneyAccessForUser,
  readView: ({ userId, enabled }) =>
    loadPersonalPlanRoutineView({
      client: createAdminClient() as unknown as PersonalPlanRoutineReadClient,
      userId,
      enabled,
    }),
  stage4Enabled: () => isPersonalPlanAppV1Enabled() && isPersonalPlanStage4Enabled(),
  toolsEnabled: (userId) =>
    isPersonalPlanToolsEnabledForUser(
      userId,
      createAdminClient() as unknown as Parameters<typeof isPersonalPlanToolsEnabledForUser>[1],
    ),
  readPortfolioPresentation: (userId, planId, portfolioVersionId) =>
    loadOwnerPortfolioPresentation(
      createAdminClient() as unknown as PersonalPlanRoutineReadClient,
      userId,
      planId,
      portfolioVersionId,
    ),
}

export function RoutineUnavailableState({
  retryAction = <RetryRefreshButton label="Erneut laden" />,
}: {
  retryAction?: ReactNode
} = {}) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-8">
      <section aria-live="polite" className="space-y-3 rounded-[8px] border border-border p-5">
        <h1 className="text-xl font-semibold">Deine Routine ist gerade nicht verfügbar</h1>
        <p className="text-sm text-muted-foreground">
          Bitte lade diese Seite erneut. Deine bestätigte Routine bleibt unverändert.
        </p>
        {retryAction}
      </section>
    </main>
  )
}

async function resolveDefaultRoutinePage() {
  const startedAt = performance.now()
  const resolved = await resolveRoutinePage(defaultDeps)
  reportPersonalPlanTransitionTiming({
    layer: "server",
    operation: "routine_page_resolve",
    outcome: resolved.kind,
    durationMs: performance.now() - startedAt,
  })
  return resolved
}

export default async function RoutinePage() {
  const resolved = await resolveDefaultRoutinePage()
  if (resolved.kind === "legacy") return <RoutinePageClient />

  if (resolved.kind === "unavailable") {
    return <RoutineUnavailableState />
  }

  return (
    <PersonalPlanRoutineClient
      initialView={resolved.view}
      enabled={resolved.enabled}
      stage5Reachable={resolved.stage5Reachable}
      portfolioPresentation={resolved.portfolioPresentation}
    />
  )
}
