import { ApplicationPage } from "@/components/application/application-page"
import type { ApplicationPageView } from "@/components/application/application-types"
import { toApplicationPageView } from "@/components/application/application-view-adapter"
import {
  resolvePersonalPlanStage5ContractVersion,
  resolvePersonalPlanStage5Rollout,
  type PersonalPlanStage5ContractVersion,
} from "@/lib/personal-plan/stage5-rollout"
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
import {
  adaptAcceptedActiveRoutineForApplication,
  loadImmutableRoutineProfile,
  type ApplicationRoutineReadClient,
} from "@/lib/personal-plan/routine/application-adapter"
import { loadPersonalPlanRoutineView } from "@/lib/personal-plan/routine/load-view"
import type { PersonalPlanRoutineReadClient } from "@/lib/personal-plan/routine/repository"
import { compileApplicationView } from "@/lib/routines/personal-plan/application/compiler"
import { compileApplicationViewV2 } from "@/lib/routines/personal-plan/application/compiler-v2"
import { projectApplicationCadenceByDay } from "@/lib/routines/personal-plan/application/cadence-projector"
import { createServerApplicationGuidanceRepository } from "@/lib/routines/personal-plan/application/repository"
import type {
  ApplicationDayTypeKey,
  ApplicationGuidanceProtocolV1,
} from "@/lib/routines/personal-plan/application/contracts"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  capturePersonalPlanApplicationFailure,
  type PersonalPlanApplicationFailureDetails,
} from "@/lib/observability/personal-plan-application"
import { reportPersonalPlanTransitionTiming } from "@/lib/personal-plan/transition-performance"

export const dynamic = "force-dynamic"

type AdminReadClient = PersonalPlanRoutineReadClient & ApplicationRoutineReadClient

export type AnwendungResolverDeps = {
  getUserId: () => Promise<string | null>
  loadJourneyAccess: (userId: string) => Promise<PersonalPlanJourneyAccess>
  loadRoutine: (userId: string) => ReturnType<typeof loadPersonalPlanRoutineView>
  adaptRoutine: typeof adaptAcceptedActiveRoutineForApplication
  loadProfile: typeof loadImmutableRoutineProfile
  loadContent: (
    contractVersion: PersonalPlanStage5ContractVersion,
  ) => ReturnType<typeof createServerApplicationGuidanceRepository>
  createReadClient: () => AdminReadClient
  appEnabled: () => boolean
  stage4Enabled: () => boolean
  rollout: () => ReturnType<typeof resolvePersonalPlanStage5Rollout>
  contractVersion?: () => PersonalPlanStage5ContractVersion
  reportFailure: (details: PersonalPlanApplicationFailureDetails) => void
}

function failureReason(error: unknown): PersonalPlanApplicationFailureDetails["reason"] {
  const message = error instanceof Error ? error.message : ""
  if (error instanceof Error && error.name === "ZodError") return "schema_contract"
  if (/database|postgres|supabase|relation|query/i.test(message)) return "database"
  if (/zod|schema|invalid|expected|missing active day definition/i.test(message))
    return "schema_contract"
  if (/guidance|protocol/i.test(message)) return "missing_protocol"
  return "unknown"
}

export async function resolveAnwendungPage(
  deps: AnwendungResolverDeps,
  selectedDayType?: ApplicationDayTypeKey,
): Promise<ApplicationPageView> {
  // Keep `off` non-exposing: no profile, Routine, product, or content read.
  if (!deps.appEnabled() || !deps.stage4Enabled() || deps.rollout() === "off") {
    return { state: "feature_disabled" }
  }
  const userId = await deps.getUserId()
  if (!userId) return { state: "feature_disabled" }

  const startedAt = Date.now()
  let failureContext: Omit<PersonalPlanApplicationFailureDetails, "reason" | "durationMs"> = {}

  try {
    const journey = await deps.loadJourneyAccess(userId)
    if (!canAccessPersonalPlanJourneyStage(journey, "stage5")) {
      return { state: "feature_disabled" }
    }
    const routine = await deps.loadRoutine(userId)
    if (routine.status === "no_personal_plan" || !routine.activeVersion) {
      return { state: "no_active_routine" }
    }
    failureContext = {
      planId: routine.personalPlanId,
      routineVersionId: routine.activeVersion.id,
      refinedVersionId: routine.activeVersion.payload.source.refinedVersionId,
    }
    const client = deps.createReadClient()
    const contractVersion = deps.contractVersion?.() ?? 1
    const [accepted, profile, content] = await Promise.all([
      deps.adaptRoutine({ client, activeVersion: routine.activeVersion, contractVersion }),
      deps.loadProfile({
        client,
        userId,
        planId: routine.personalPlanId,
        refinedVersionId: routine.activeVersion.payload.source.refinedVersionId,
      }),
      deps.loadContent(contractVersion),
    ])
    const [dayDefinitions, protocols] = await Promise.all([
      content.loadActiveDayTypeDefinitions(),
      content.loadActiveGuidanceProtocols(),
    ])
    const familyPayloads = protocols.map((protocol) => protocol.payload)
    const applicationInput = {
      routineItems: accepted.routineItems,
      unresolvedRoutineItems: accepted.unresolvedRoutineItems,
      profile,
      dayTypes: dayDefinitions.map((day) => ({ key: day.key, sortOrder: day.sortOrder })),
    }
    const compiled =
      contractVersion === 2
        ? compileApplicationViewV2({
            input: applicationInput,
            familyTemplates: familyPayloads.filter((payload) => payload.schemaVersion === 2),
            productPointers: accepted.applicationPointersV2 ?? [],
          })
        : compileApplicationView({
            input: applicationInput,
            protocols: [
              ...(familyPayloads as ApplicationGuidanceProtocolV1[]),
              ...accepted.exactGuidanceProtocols,
            ],
          })
    const pointerIssues =
      contractVersion === 2
        ? (compiled as ReturnType<typeof compileApplicationViewV2>).pointerIssues
        : []
    if (pointerIssues.length > 0) {
      for (const issue of pointerIssues) {
        deps.reportFailure({
          ...failureContext,
          durationMs: Date.now() - startedAt,
          reason: "product_guidance_unresolved",
          productId: issue.productId,
          issueCode: issue.reason,
        })
      }
    }
    const selectedFailure = selectedDayType
      ? compiled.failures.find((failure) => failure.dayType === selectedDayType)
      : undefined
    if (selectedFailure) {
      deps.reportFailure({
        ...failureContext,
        durationMs: Date.now() - startedAt,
        reason:
          selectedFailure.reason === "incomplete_guidance"
            ? "incomplete_guidance"
            : "missing_protocol",
      })
    }
    const view = toApplicationPageView({
      compiled,
      dayDefinitions,
      cadenceByDay: projectApplicationCadenceByDay({
        routineItems: accepted.routineItems,
        compiledDayKeys: compiled.days.map((day) => day.key),
      }),
    })
    if (selectedDayType) {
      if (view.state === "ready" && view.days.some((day) => day.dayType === selectedDayType)) {
        return { ...view, selectedDayType }
      }
      if (view.state === "no_complete_day" && view.restDay.dayType === selectedDayType) {
        return { state: "ready", days: [view.restDay], selectedDayType }
      }
      return { state: "day_unavailable", overviewHref: "/anwendung" }
    }
    return view
  } catch (error) {
    deps.reportFailure({
      ...failureContext,
      durationMs: Date.now() - startedAt,
      reason: failureReason(error),
    })
    return { state: "unavailable" }
  }
}

function createAdminReadClient() {
  return createAdminClient() as unknown as AdminReadClient
}
const defaultDeps: AnwendungResolverDeps = {
  getUserId: loadCachedAuthenticatedAppUserId,
  loadJourneyAccess: loadCachedPersonalPlanJourneyAccessForUser,
  loadRoutine: (userId) =>
    loadPersonalPlanRoutineView({
      client: createAdminReadClient(),
      userId,
      enabled: true,
      includePendingProposal: false,
    }),
  adaptRoutine: adaptAcceptedActiveRoutineForApplication,
  loadProfile: loadImmutableRoutineProfile,
  loadContent: (contractVersion) => createServerApplicationGuidanceRepository(contractVersion),
  createReadClient: createAdminReadClient,
  appEnabled: isPersonalPlanAppV1Enabled,
  stage4Enabled: isPersonalPlanStage4Enabled,
  rollout: resolvePersonalPlanStage5Rollout,
  contractVersion: resolvePersonalPlanStage5ContractVersion,
  reportFailure: capturePersonalPlanApplicationFailure,
}

async function resolveDefaultAnwendungPage(selectedDayType?: ApplicationDayTypeKey) {
  const startedAt = performance.now()
  const view = await resolveAnwendungPage(defaultDeps, selectedDayType)
  const durationMs = performance.now() - startedAt
  reportPersonalPlanTransitionTiming({
    layer: "server",
    operation: selectedDayType ? "application_day_resolve" : "application_page_resolve",
    outcome: view.state,
    durationMs,
  })
  return { view, durationMs }
}

export default async function AnwendungPage({
  selectedDayType,
}: { selectedDayType?: ApplicationDayTypeKey } = {}) {
  const { view, durationMs } = await resolveDefaultAnwendungPage(selectedDayType)
  const internalComputeMs =
    process.env.PERSONAL_PLAN_APPLICATION_PERFORMANCE_MARKER_ENABLED === "true"
      ? Math.round(durationMs * 100) / 100
      : undefined
  return <ApplicationPage view={view} internalComputeMs={internalComputeMs} />
}
