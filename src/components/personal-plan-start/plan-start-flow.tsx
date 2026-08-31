"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Info, Loader2, RotateCcw } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import {
  RefinementFlow,
  type Stage2HandoffPayload,
  type Stage2ModuleCompletionPayload,
  type Stage2ModuleProgress,
} from "@/components/personal-plan-refinement/refinement-flow"
import {
  stage2SecondaryExitDestination,
  type Stage2ModuleEntryRequest,
} from "@/lib/personal-plan/refinement/module-scope"
import {
  PLAN_ACCEPT_REFINE_HREF,
  PLAN_ACCEPT_UNAVAILABLE_NOTICE,
  PersonalPlanStageEntrance,
  PersonalPlanViewTransition,
  acceptIdealPlanReadiness,
  deriveAcceptIdealPlanSeenRoles,
  interpretAcceptIdealPlanResponse,
  resolveStage1PreviewLoadState,
  runAcceptIdealPlanFlow,
  type AcceptIdealPlanSeenRole,
  type PersonalPlanTransitionDirection,
  type Stage1PreviewLoadState,
} from "@/components/personal-plan-journey"
import { Stage3ProductsFlow } from "@/components/personal-plan-products/stage3-products-flow"
import type { Stage3RoutineHandoff } from "@/components/personal-plan-products/stage3-products-flow"
import {
  createHttpStage3IntakeClient,
  createHttpStage3ProductsGateway,
} from "@/lib/personal-plan/products/http-gateway"
import { stage3BaselineAnalytics } from "@/lib/personal-plan/products/stage3-analytics"
import type { Stage3AuthorityEvaluation } from "@/lib/personal-plan/products/authority/contracts"
import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"
import {
  Stage3ProductsGatewayError,
  type Stage3ProductsGateway,
} from "@/lib/personal-plan/products/gateway"
import {
  buildStage3Bootstrap,
  type Stage3Bootstrap,
} from "@/lib/personal-plan/products/stage2-entry-adapter"
import { createHttpStage2RefinementGateway } from "@/lib/personal-plan/refinement/http-gateway"
import {
  Stage2RefinementError,
  type Stage2RefinementGateway,
  type Stage2CompleteResult,
  type Stage2ModuleRecomputeOutcome,
} from "@/lib/personal-plan/refinement/gateway"
import type { Stage2RefinementSession } from "@/lib/personal-plan/refinement/session"
import type { Stage2TriggerContext } from "@/lib/personal-plan/refinement/types"
import {
  isStage1ProductExamplePreviewResponse,
  stage1ProductExamplePreviewRequestUrl,
  type Stage1ProductExamplePreviewResponse,
} from "@/lib/personal-plan/product-preview-contract"
import { markPersonalPlanStageNavigation } from "@/lib/personal-plan/stage-navigation-intent"
import { withRoutinePlanUpdatedSignal } from "@/lib/personal-plan/routine/plan-updated-signal"

import { isNeedCardGroup } from "./need-card"
import {
  NeedPlanScreen,
  PlanStartHeader,
  Progress,
  type NeedPlanScreenNextIntent,
  type NeedPlanScreenNextStatus,
  type NeedPlanScreenViewModel,
} from "./need-plan-screen"
import {
  adaptInitialNeedSnapshotToPlanStartViewModel,
  applyStage1ProductExamplePreviews,
} from "./snapshot-adapter"

export type PlanStartReadyViewModel = {
  basis: NeedPlanScreenViewModel
  optional: NeedPlanScreenViewModel | null
  personalPlanId?: string
  sourceInputHash?: string
  /** The Stage-1 assumptions behind the plan, without touching the Stage-2 gateway. */
  stage2TriggerContext?: Stage2TriggerContext
}

export type PlanStartInitialJourney =
  | { stage: "stage1"; refinementAvailable?: boolean; directAcceptanceAvailable?: boolean }
  | {
      stage: "stage2"
      refinementAvailable?: boolean
      directAcceptanceAvailable?: boolean
      /**
       * Explicit Stage-2 re-entry (`/plan-start?refine=1`, the Routine
       * refinement nudge). Suppresses the bridge auto-handoff exactly like the
       * in-session "Zurück zum Feinschliff" return from Stage 3 does, so a
       * completed draft does not bounce the user straight back to Stage 3.
       */
      returningToRefinement?: boolean
      /**
       * Module deep link (`?refine=products|habits`, or `first_open` for the
       * plain `?refine=1` re-entry). The flow then walks only that module.
       */
      refineModule?: Stage2ModuleEntryRequest
      /**
       * The coarse "X von 4" the Routine banner just showed, read server-side
       * from the same `refinement-status` contract so the module questions
       * cannot contradict the banner the user tapped (26.08.2026). Optional:
       * an unavailable read simply means no meter.
       */
      moduleProgress?: Stage2ModuleProgress
      /** See the shared note on ORIGIN vs SCOPE below. */
      planAccepted?: boolean
    }
  | {
      stage: "stage3"
      refinedVersionId: string
      repairRoutineVersionId?: string
      /**
       * Set when this Stage-3 entry belongs to an explicit module run — today
       * only the Modul-1 (`products`) handoff resume. It carries the SAME fact
       * the Stage-2 field carries: the user came from the Routine banner or a
       * Profil row, so the retired chapter ceremony must stay suppressed for
       * the rest of the journey (founder ruling 27.08.2026). Without it, an
       * undirected reload of `/plan-start` after the handoff resurrects the
       * chapter-4 screen the module entry had already retired.
       */
      refineModule?: Stage2ModuleEntryRequest
      /** See the shared note on ORIGIN vs SCOPE below. */
      planAccepted?: boolean
    }

/**
 * Whether Stage 2's bridge may hand off into Stage 3 on its own. Off for any
 * `?refine=…` re-entry — though for a module entry this only matters for a
 * bridge armed at ENTRY: a bridge armed by a module the user just finished in
 * this session always auto-continues (`stage2BridgeAutoContinues`), because a
 * finished module is a surface hop, not a chapter to confirm.
 */
export function refinementAutoHandoffEnabled(initialJourney: PlanStartInitialJourney): boolean {
  return !(initialJourney.stage === "stage2" && initialJourney.returningToRefinement === true)
}

/**
 * ORIGIN vs SCOPE — the distinction the rest of this block turns on.
 *
 * `?refine=products` is reached from two very different places:
 *
 *  - the Routine banner / a Profil row — the plan is ACCEPTED, the user has the
 *    full app nav, and this is a surface hop that edits an existing plan;
 *  - the failed-accept escape hatch (`PLAN_ACCEPT_REFINE_HREF`) — the plan was
 *    never activated, there is no Routine to return to, and completing the
 *    module produces the user's FIRST routine.
 *
 * Both are explicit module runs, so both get module SCOPE (scoped questions, no
 * chapter ceremony). Only the first has the post-accept ORIGIN that justifies
 * exiting to `/routine` and claiming „Plan aktualisiert“. Conflating the two
 * sends the unaccepted cohort at a `/routine` the frontier redirect bounces
 * back to a bare `/plan-start` — dropping their module scope onto the resume
 * shell — and tells a first-time buyer their plan was „aktualisiert“.
 *
 * `planAccepted` is derived server-side from `activeRoutineVersionId`, i.e. an
 * ACTIVATED routine — never from `allowed.stage4`, which a pending proposal
 * alone also satisfies.
 *
 * KNOWN LIMITATION (not solved here). The `/routine` exit is keyed on
 * acceptance, not on the frontier's current shape. A rare cohort — an active
 * routine whose `currentRefinedNeedVersionId` has since been nulled — is
 * genuinely accepted, so it takes the `/routine` exit, but its frontier may have
 * fallen back below Stage 4 and the redirect can still bounce it. That is a
 * narrower bounce than the one this split removes (it needs an activated
 * routine AND a nulled refined-need version), and fixing it properly means
 * routing on the live frontier rather than on a boolean. Tracked as follow-up.
 */

/**
 * SCOPE. The module this journey walks, wherever it started. Read for any
 * non-Stage-1 journey on purpose: `initialJourney` is frozen for the life of
 * the journey while the LOCAL stage moves, so a Stage-3 entry that switches
 * back to Stage 2 (the Modul-1 reload pressing Back) must still be recognised
 * as the module run it is.
 */
export function planStartModuleEntry(
  initialJourney: PlanStartInitialJourney,
): Stage2ModuleEntryRequest | undefined {
  return initialJourney.stage === "stage1" ? undefined : initialJourney.refineModule
}

/**
 * SCOPE. Whether this Feinschliff run was launched by a module entry request
 * (the Routine banner, a Profil row, the failed-accept escape hatch, or the
 * `?refine=1` nudge, which resolves to the first open module).
 */
export function isExplicitModuleRefinementEntry(initialJourney: PlanStartInitialJourney): boolean {
  return stage2SecondaryExitDestination(planStartModuleEntry(initialJourney)) === "routine"
}

/** ORIGIN. Whether this journey's plan has already been activated. */
function isAcceptedPlanJourney(initialJourney: PlanStartInitialJourney): boolean {
  return initialJourney.stage !== "stage1" && initialJourney.planAccepted === true
}

/**
 * An explicit module run on an ALREADY ACCEPTED plan — scope AND origin.
 *
 * Exported as the single source of truth for "post-accept module entry":
 * `RefinementFlow` needs it too (Task 2.1), to route a CLOSING module's
 * completion by origin rather than by draft status alone — see
 * `applyStage2ModuleCompletion` in refinement-flow.tsx.
 */
export function isPostAcceptModuleEntry(initialJourney: PlanStartInitialJourney): boolean {
  return isExplicitModuleRefinementEntry(initialJourney) && isAcceptedPlanJourney(initialJourney)
}

export type Stage2ModuleCompletionRoutingProps = {
  moduleEntry: Stage2ModuleEntryRequest | undefined
  postAcceptModuleEntry: boolean
}

/**
 * The exact `RefinementFlow` props that decide module-COMPLETION routing
 * (Task 2.1) — WHICH module this run scopes to, and whether it is a
 * post-accept module entry. Bundled into one call and spread at the JSX call
 * site below (`{...stage2ModuleCompletionRoutingProps(initialJourney)}`)
 * rather than listed as two separate prop lines, so the post-accept origin
 * signal cannot be silently dropped by deleting one line without also
 * breaking this function's own tests
 * (`tests/personal-plan-stage2-module-entry.test.tsx`).
 */
export function stage2ModuleCompletionRoutingProps(
  initialJourney: PlanStartInitialJourney,
): Stage2ModuleCompletionRoutingProps {
  return {
    moduleEntry: planStartModuleEntry(initialJourney),
    postAcceptModuleEntry: isPostAcceptModuleEntry(initialJourney),
  }
}

/**
 * Where leaving the Feinschliff goes. `/routine` only for the post-accept
 * cohort, which really came from there. The escape-hatch cohort has no routine
 * yet, so it stays inside the flow and returns to the plan it was trying to
 * accept — the surface it actually came from.
 */
export function planStartRefinementExitDestination(
  initialJourney: PlanStartInitialJourney,
): "routine" | "stage1" {
  return isPostAcceptModuleEntry(initialJourney) ? "routine" : "stage1"
}

/**
 * Whether the post-accept loop's chapter screens must stay suppressed for this
 * journey (field test 26.08.2026). Keyed on SCOPE alone: an explicit module
 * deep link is a directed request in both cohorts, and the escape-hatch arrival
 * must not regain the retired ceremony just because its plan is not live yet.
 */
export function planStartSuppressesChapterCeremony(
  initialJourney: PlanStartInitialJourney,
): boolean {
  return isExplicitModuleRefinementEntry(initialJourney)
}

export type PlanStartStage3BootstrapSource = "initial" | "stage2_handoff" | "correction"
export type PlanStartStage3BootstrapMode = "baseline" | "optional_inventory"

export function planStartUsesOptionalStage2Entry(initialJourney: PlanStartInitialJourney): boolean {
  return initialJourney.stage === "stage2" && Boolean(initialJourney.refineModule)
}

export function planStartStage3BootstrapMode(
  initialJourney: PlanStartInitialJourney,
  source: PlanStartStage3BootstrapSource,
): PlanStartStage3BootstrapMode {
  if (source === "correction") return "baseline"
  if (source === "initial") {
    return initialJourney.stage === "stage3" &&
      initialJourney.refineModule === "products" &&
      !initialJourney.repairRoutineVersionId
      ? "optional_inventory"
      : "baseline"
  }
  const moduleEntry = planStartModuleEntry(initialJourney)
  return moduleEntry === "products" || moduleEntry === "first_open"
    ? "optional_inventory"
    : "baseline"
}

/**
 * The Routine href for a habits-first module completion (Task 2.4: "habits
 * zuerst"). The toast (Task 2.6) is claimed ONLY when BOTH hold (Task 2.2,
 * the honesty fix):
 *
 *  - a post-accept module entry — an escape-hatch completion is an initial
 *    activation: nothing was updated, so the arrival speaks for itself; and
 *  - the server actually reports `recomputeOutcome === "applied"`
 *    (`moduleCompletion.recompute?.outcome`, T1.4). `"unchanged"`,
 *    `"unavailable"`, or an absent field (no active routine yet, or an older
 *    server) all mean the routine was NOT touched — the signal must not ride
 *    along on a post-accept origin alone.
 */
export function moduleCompletionRoutineHref(
  initialJourney: PlanStartInitialJourney,
  recomputeOutcome?: Stage2ModuleRecomputeOutcome,
): string {
  return isPostAcceptModuleEntry(initialJourney) && recomputeOutcome === "applied"
    ? withRoutinePlanUpdatedSignal("/routine")
    : "/routine"
}

/**
 * The Routine href for a Stage-3 completion (Task 2.4: Modul 1 "products" →
 * Stage 3 → Routine). Stage 3 is also reached from a direct Idealplan accept,
 * from an ordinary resumed Stage-3 session, and from the failed-accept escape
 * hatch — none of those is a refinement-driven recompute, so the toast
 * (Task 2.6) only rides along for a post-accept module entry.
 */
export function stage3CompletionRoutineHref(
  initialJourney: PlanStartInitialJourney,
  href: string,
): string {
  return isPostAcceptModuleEntry(initialJourney) ? withRoutinePlanUpdatedSignal(href) : href
}

export type Stage3LoadRecoveryMode = "retry_stage3" | "reload_server_frontier"

export function stage3LoadRecoveryMode(error: unknown): Stage3LoadRecoveryMode {
  return error instanceof Stage3ProductsGatewayError && error.code === "stale_refined_source"
    ? "reload_server_frontier"
    : "retry_stage3"
}

export function recoverPlanStartStage3Load(
  mode: Stage3LoadRecoveryMode,
  actions: { retryStage3: () => void; reloadServerFrontier: () => void },
): void {
  if (mode === "reload_server_frontier") {
    actions.reloadServerFrontier()
    return
  }
  actions.retryStage3()
}

export class Stage3ProductKindCorrectionError extends Error {
  constructor(
    public readonly code:
      | "save_failed"
      | "completion_failed_after_save"
      | "bootstrap_failed_after_completion"
      | "revision_conflict"
      | "stage2_session_unavailable",
    message = code,
    public readonly savedSession?: Stage2RefinementSession,
  ) {
    super(message)
    this.name = "Stage3ProductKindCorrectionError"
  }
}

export type Stage3ProductKindCorrectionResult = {
  session: Stage2RefinementSession
  handoff: Stage2CompleteResult
  bootstrap: Stage3Bootstrap
  pendingCompletionSession: null
  pendingBootstrapSession: null
}

export async function completeStage2ProductKindCorrection(input: {
  categories: PersonalPlanCategory[]
  session: Stage2RefinementSession
  pendingCompletionSession?: Stage2RefinementSession | null
  pendingBootstrapSession?: Stage2RefinementSession | null
  stage2Gateway: Pick<Stage2RefinementGateway, "saveAnswerAndComplete" | "complete">
  loadStage3Bootstrap: (refinedVersionId: string) => Promise<Stage3Bootstrap>
}): Promise<Stage3ProductKindCorrectionResult> {
  try {
    let handoff: Stage2CompleteResult
    let nextSession =
      input.pendingBootstrapSession ?? input.pendingCompletionSession ?? input.session
    if (input.pendingBootstrapSession) {
      if (!input.pendingBootstrapSession.completedHandoff) {
        throw new Stage3ProductKindCorrectionError("stage2_session_unavailable")
      }
      handoff = input.pendingBootstrapSession.completedHandoff
    } else if (input.pendingCompletionSession) {
      handoff = await input.stage2Gateway.complete({
        expectedRevision: input.pendingCompletionSession.revision,
      })
    } else {
      const saveAnswerAndComplete = input.stage2Gateway.saveAnswerAndComplete?.bind(
        input.stage2Gateway,
      )
      if (!saveAnswerAndComplete) throw new Stage3ProductKindCorrectionError("save_failed")
      const result = await saveAnswerAndComplete({
        questionId: "current_product_categories",
        answer: input.categories,
        expectedRevision: input.session.revision,
      })
      nextSession = result.session
      handoff = result.handoff
    }
    const completedSession: Stage2RefinementSession = {
      ...nextSession,
      status: "complete",
      completedHandoff: handoff,
    }
    let bootstrap: Stage3Bootstrap
    try {
      bootstrap = await input.loadStage3Bootstrap(handoff.refinedVersionId)
    } catch {
      throw new Stage3ProductKindCorrectionError(
        "bootstrap_failed_after_completion",
        "bootstrap_failed_after_completion",
        completedSession,
      )
    }
    return {
      session: completedSession,
      handoff,
      bootstrap,
      pendingCompletionSession: null,
      pendingBootstrapSession: null,
    }
  } catch (error) {
    if (
      error instanceof Stage2RefinementError &&
      error.code === "completion_failed" &&
      error.savedSession
    ) {
      throw new Stage3ProductKindCorrectionError(
        "completion_failed_after_save",
        "completion_failed_after_save",
        error.savedSession,
      )
    }
    if (error instanceof Stage2RefinementError && error.code === "revision_conflict") {
      throw new Stage3ProductKindCorrectionError("revision_conflict")
    }
    if (error instanceof Stage3ProductKindCorrectionError) throw error
    throw new Stage3ProductKindCorrectionError("save_failed")
  }
}

export type PlanStartFlowProps =
  | { state: "ready"; plan: PlanStartReadyViewModel }
  | { state: "loading" }
  | { state: "retryable_error"; onRetry?: () => void }
  | { state: "unavailable"; profileHref?: string; supportHref?: string }

type PlanStartApiState = PlanStartFlowProps

export function interpretPlanStartApiResponse(status: number, body: unknown): PlanStartApiState {
  if (
    status === 404 &&
    body &&
    typeof body === "object" &&
    "error" in body &&
    body.error === "personal_plan_not_available"
  ) {
    return { state: "unavailable" }
  }
  if (
    status === 200 &&
    body &&
    typeof body === "object" &&
    "status" in body &&
    body.status === "completed" &&
    "outputSnapshot" in body
  ) {
    const plan = adaptInitialNeedSnapshotToPlanStartViewModel(body.outputSnapshot)
    const personalPlanId =
      "personalPlanId" in body && typeof body.personalPlanId === "string"
        ? body.personalPlanId
        : undefined
    if (plan) return { state: "ready", plan: { ...plan, personalPlanId } }
  }
  return { state: "retryable_error" }
}

export type PlanStartProductionGateProps = {
  initialJourney?: PlanStartInitialJourney
  initialPlan?: PlanStartReadyViewModel
  personalPlanId?: string
  initialRefinementSession?: Stage2RefinementSession
  reloadServerFrontier?: () => void
  replaceRoute?: (href: string) => void
}

export function PlanStartProductionGate({
  initialJourney = { stage: "stage1" },
  initialPlan,
  personalPlanId,
  initialRefinementSession,
  reloadServerFrontier,
  replaceRoute,
}: PlanStartProductionGateProps) {
  const canBootstrapLaterStage = isValidLaterStageBootstrap(
    initialJourney,
    personalPlanId,
    initialRefinementSession,
  )
  const [state, setState] = useState<PlanStartApiState>(() =>
    initialPlan ? { state: "ready", plan: initialPlan } : { state: "loading" },
  )

  const load = useCallback(async (showLoading = false) => {
    if (showLoading) setState({ state: "loading" })
    try {
      setState(await requestPlanStart())
    } catch {
      setState({ state: "retryable_error" })
    }
  }, [])

  useEffect(() => {
    if (canBootstrapLaterStage || !shouldRequestPlanStartOnMount(initialPlan)) return
    let cancelled = false
    void requestPlanStart().then(
      (nextState) => {
        if (!cancelled) setState(nextState)
      },
      () => {
        if (!cancelled) setState({ state: "retryable_error" })
      },
    )
    return () => {
      cancelled = true
    }
  }, [canBootstrapLaterStage, initialPlan])

  if (canBootstrapLaterStage && personalPlanId) {
    return (
      <PlanStartCustomerJourney
        initialPlan={initialPlan}
        initialJourney={initialJourney}
        personalPlanId={personalPlanId}
        initialRefinementSession={initialRefinementSession}
        reloadServerFrontier={reloadServerFrontier}
        replaceRoute={replaceRoute}
      />
    )
  }

  if (state.state === "retryable_error")
    return <PlanStartRetryableError onRetry={() => void load(true)} />
  if (state.state !== "ready" || !state.plan.personalPlanId) return <PlanStartFlow {...state} />
  return (
    <PlanStartCustomerJourney
      initialPlan={state.plan}
      initialJourney={initialJourney}
      personalPlanId={state.plan.personalPlanId}
      reloadServerFrontier={reloadServerFrontier}
      replaceRoute={replaceRoute}
    />
  )
}

export function RouteAwarePlanStartProductionGate(
  props: Omit<PlanStartProductionGateProps, "replaceRoute">,
) {
  const router = useRouter()
  const replaceRoute = useCallback((href: string) => router.replace(href), [router])
  return <PlanStartProductionGate {...props} replaceRoute={replaceRoute} />
}

export function shouldRequestPlanStartOnMount(initialPlan?: PlanStartReadyViewModel): boolean {
  return !initialPlan
}
async function requestPlanStart(): Promise<PlanStartApiState> {
  const response = await fetch("/api/personal-plan/stage-1", {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  })
  const body = await response.json().catch(() => null)
  return interpretPlanStartApiResponse(response.status, body)
}

async function requestStage1ProductExamplePreviews(input: {
  personalPlanId: string
  sourceInputHash: string
}): Promise<Stage1ProductExamplePreviewResponse> {
  const response = await fetch(stage1ProductExamplePreviewRequestUrl(input), {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "default",
  })
  const body = await response.json().catch(() => null)
  if (!response.ok || !isStage1ProductExamplePreviewResponse(body)) {
    throw new Error("stage1_product_previews_unavailable")
  }
  return body
}

export async function loadPlanStartStage3Bootstrap(input: {
  gateway: Pick<Stage3ProductsGateway, "loadOrCreate" | "openOptionalInventory">
  personalPlanId: string
  refinedVersionId: string
  repairRoutineVersionId?: string
  optionalInventory?: boolean
  /**
   * Module-driven Stage-3 (re-)entry: a later module completion stales the
   * draft this version produced, so the load must rebuild on the plan's
   * CURRENT refined version instead of dead-ending. A repair load keeps
   * failing closed — it must plan against exactly the version it names.
   */
  rebuildOnStaleRefinedVersion?: boolean
}): Promise<Stage3Bootstrap> {
  const loaded = input.optionalInventory
    ? await openOptionalStage3Inventory(input.gateway, {
        personalPlanId: input.personalPlanId,
        refinedVersionId: input.refinedVersionId,
      })
    : await input.gateway.loadOrCreate({
        draftId: "client-derived",
        userId: "client-derived",
        personalPlanId: input.personalPlanId,
        refinedVersionId: input.refinedVersionId,
        ...(input.repairRoutineVersionId
          ? { repairRoutineVersionId: input.repairRoutineVersionId }
          : {}),
        ...(input.rebuildOnStaleRefinedVersion && !input.repairRoutineVersionId
          ? { rebuildOnStaleRefinedVersion: true }
          : {}),
        requirements: [],
      })
  return buildStage3Bootstrap(
    loaded as typeof loaded & { authorityEvaluations?: Stage3AuthorityEvaluation[] },
    input,
  )
}

function openOptionalStage3Inventory(
  gateway: Pick<Stage3ProductsGateway, "openOptionalInventory">,
  input: { personalPlanId: string; refinedVersionId: string },
) {
  const openOptionalInventory = gateway.openOptionalInventory?.bind(gateway)
  if (!openOptionalInventory) throw new Stage3ProductsGatewayError("temporarily_unavailable")
  return openOptionalInventory(input)
}

export async function loadPlanStartStage2HandoffBootstrap(input: {
  handoff: Stage2CompleteResult
  loadStage3Bootstrap: (refinedVersionId: string) => Promise<Stage3Bootstrap>
  reloadServerFrontier: () => void
}): Promise<Stage3Bootstrap | null> {
  try {
    return await input.loadStage3Bootstrap(input.handoff.refinedVersionId)
  } catch (error) {
    if (stage3LoadRecoveryMode(error) === "reload_server_frontier") {
      input.reloadServerFrontier()
      return null
    }
    throw error
  }
}

export async function requestAcceptIdealPlan(
  seenRoles: readonly { decisionKey: string; productId: string; factFingerprint: string }[],
): Promise<ReturnType<typeof interpretAcceptIdealPlanResponse>> {
  try {
    const response = await fetch("/api/personal-plan/accept-ideal-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      cache: "no-store",
      body: JSON.stringify({ seenRoles }),
    })
    return interpretAcceptIdealPlanResponse(
      response.status,
      await response.json().catch(() => null),
    )
  } catch {
    return { kind: "error" }
  }
}

export type PlanStartAcceptStatus = "idle" | "pending" | "error" | "unavailable"

/**
 * What the Idealplan CTA says and whether it is blocked. The CTA speaks for
 * whatever it is actually doing: once acceptance has handed off to the
 * Feinschliff — because it is not offered, because the server sent us there, or
 * because a Stage-2 load is running or has failed — it names the Feinschliff
 * instead of claiming a routine is being set up. `preparing` blocks it while
 * the previews that make up the accept payload are still in flight.
 */
export function planStartCtaState(input: {
  acceptAvailable: boolean
  acceptStatus: PlanStartAcceptStatus
  stage2LoadState: "idle" | "loading" | "error"
  previewLoadState: Stage1PreviewLoadState
}): { intent: NeedPlanScreenNextIntent; status: NeedPlanScreenNextStatus } {
  // A Stage-2 handoff (the `refinement_in_progress` outcome) owns the CTA while
  // it runs, so its loading and failure states stay visible.
  if (!input.acceptAvailable || input.stage2LoadState !== "idle") {
    return { intent: "refine", status: input.stage2LoadState }
  }
  if (input.acceptStatus === "unavailable") return { intent: "refine", status: "loading" }
  if (input.acceptStatus === "pending") return { intent: "accept", status: "loading" }
  if (input.acceptStatus === "error") return { intent: "accept", status: "error" }
  return {
    intent: "accept",
    status: acceptIdealPlanReadiness(input.previewLoadState) === "wait" ? "preparing" : "idle",
  }
}

export function performPersonalPlanRoutineHandoff(
  handoff: Stage3RoutineHandoff,
  dependencies: {
    markNavigation: (destination: "/routine") => unknown
    replaceRoute: (href: string) => void
  },
) {
  dependencies.markNavigation("/routine")
  dependencies.replaceRoute(handoff.next.href)
}

export function PlanStartCustomerJourney({
  initialPlan,
  initialJourney,
  personalPlanId,
  initialRefinementSession,
  reloadServerFrontier = () => window.location.reload(),
  replaceRoute = (href) => window.location.replace(href),
}: {
  initialPlan?: PlanStartReadyViewModel
  initialJourney: PlanStartInitialJourney
  personalPlanId: string
  initialRefinementSession?: Stage2RefinementSession
  reloadServerFrontier?: () => void
  replaceRoute?: (href: string) => void
}) {
  const [stage, setStage] = useState<"stage1" | "stage2" | "stage3">(() => initialJourney.stage)
  const [acceptStatus, setAcceptStatus] = useState<PlanStartAcceptStatus>("idle")
  const [plan, setPlan] = useState<PlanStartReadyViewModel | null>(initialPlan ?? null)
  const [productExamplePreviews, setProductExamplePreviews] =
    useState<Stage1ProductExamplePreviewResponse | null>(null)
  /**
   * The Stage-1 preview request this render would make, or `null` when previews
   * are not requestable at all. One fact with three consumers — the effect that
   * fetches them, the initial load state, and the accept guard — so the CTA can
   * never be live on a render whose previews are still on their way.
   */
  const previewRequest = useMemo(
    () =>
      stage === "stage1" && plan?.personalPlanId && plan.sourceInputHash
        ? { personalPlanId: plan.personalPlanId, sourceInputHash: plan.sourceInputHash }
        : null,
    [plan?.personalPlanId, plan?.sourceInputHash, stage],
  )
  const [previewLoadState, setPreviewLoadState] = useState<Stage1PreviewLoadState>(() =>
    resolveStage1PreviewLoadState("not_requested", previewRequest !== null),
  )
  // Defense in depth for the same window on every later render: a plan that
  // arrives from `enterStage1()` makes previews requestable one render before
  // the effect can mark them loading.
  const resolvedPreviewLoadState = resolveStage1PreviewLoadState(
    previewLoadState,
    previewRequest !== null,
  )
  const [stage1LoadState, setStage1LoadState] = useState<"idle" | "loading" | "error">("idle")
  const [stage2LoadState, setStage2LoadState] = useState<"idle" | "loading" | "error">("idle")
  const [stage2EnteredLocally, setStage2EnteredLocally] = useState(false)
  const [stage3EnteredLocally, setStage3EnteredLocally] = useState(false)
  const stage2SeedRef = useRef(
    planStartUsesOptionalStage2Entry(initialJourney) ? undefined : initialRefinementSession,
  )
  const pendingStage2CompletionRef = useRef<Stage2RefinementSession | null>(null)
  const pendingStage3BootstrapRef = useRef<Stage2RefinementSession | null>(null)
  const stage3JourneyStartedRef = useRef(false)
  const [stage3Bootstrap, setStage3Bootstrap] = useState<Stage3Bootstrap | null>(null)
  const [returningToRefinement, setReturningToRefinement] = useState(
    () => !refinementAutoHandoffEnabled(initialJourney),
  )
  const stage1ReturnStepRef = useRef<FlowStep>("basis")
  const [stage3LoadState, setStage3LoadState] = useState<
    "idle" | "loading" | Stage3LoadRecoveryMode
  >(initialJourney.stage === "stage3" ? "loading" : "idle")
  const stage3Gateway = useMemo(() => createHttpStage3ProductsGateway(), [])
  const intakeClient = useMemo(() => createHttpStage3IntakeClient(), [])
  const stage2Gateway = useMemo(() => createHttpStage2RefinementGateway(), [])
  const displayedPlan = useMemo(
    () =>
      plan && productExamplePreviews
        ? applyStage1ProductExamplePreviews(plan, productExamplePreviews)
        : plan,
    [plan, productExamplePreviews],
  )

  useEffect(() => {
    if (!previewRequest) return
    const { personalPlanId, sourceInputHash } = previewRequest
    let cancelled = false
    setPreviewLoadState("loading")
    // The previews are no longer presentation-only: they ARE the seen state the
    // accept contract pins. A payload we asked for and did not get must not
    // read as "the user saw nothing", so failure is retried once and then
    // recorded — the CTA routes into the refinement rather than accepting blind.
    void (async () => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const response = await requestStage1ProductExamplePreviews({
            personalPlanId,
            sourceInputHash,
          })
          if (cancelled) return
          if (
            response.personalPlanId === personalPlanId &&
            response.sourceInputHash === sourceInputHash
          ) {
            setProductExamplePreviews(response)
            setPreviewLoadState("ready")
            return
          }
        } catch {
          if (cancelled) return
        }
      }
      if (!cancelled) setPreviewLoadState("unavailable")
    })()
    return () => {
      cancelled = true
    }
  }, [previewRequest])
  const loadStage3Bootstrap = useCallback(
    async (
      refinedVersionId: string,
      options: {
        rebuildOnStaleRefinedVersion?: boolean
        source?: PlanStartStage3BootstrapSource
      } = {},
    ): Promise<Stage3Bootstrap> => {
      const source = options.source ?? "initial"
      return loadPlanStartStage3Bootstrap({
        gateway: stage3Gateway,
        personalPlanId,
        refinedVersionId,
        repairRoutineVersionId:
          initialJourney.stage === "stage3" ? initialJourney.repairRoutineVersionId : undefined,
        optionalInventory:
          planStartStage3BootstrapMode(initialJourney, source) === "optional_inventory",
        rebuildOnStaleRefinedVersion: options.rebuildOnStaleRefinedVersion,
      })
    },
    [initialJourney, personalPlanId, stage3Gateway],
  )
  const installNewStage3Bootstrap = useCallback((bootstrap: Stage3Bootstrap) => {
    setStage3Bootstrap(bootstrap)
    if (stage3JourneyStartedRef.current) return
    stage3JourneyStartedRef.current = true
    stage3BaselineAnalytics.track("personal_plan_stage3_journey_started", {})
  }, [])
  const handleHandoff = useCallback(
    async ({ handoff, session }: Stage2HandoffPayload) => {
      // Every Stage-2 -> Stage-3 handoff takes this path, module-driven or not.
      // Asking for the stale rebuild here is harmless for a linear completion
      // (its version is current, so there is nothing stale to rebuild) and is
      // load-bearing after a later module completion staled this draft.
      const bootstrap = await loadPlanStartStage2HandoffBootstrap({
        handoff,
        loadStage3Bootstrap: (refinedVersionId) =>
          loadStage3Bootstrap(refinedVersionId, {
            rebuildOnStaleRefinedVersion: true,
            source: "stage2_handoff",
          }),
        reloadServerFrontier,
      })
      if (!bootstrap) return
      installNewStage3Bootstrap(bootstrap)
      stage2SeedRef.current = session
      setStage3LoadState("idle")
      setReturningToRefinement(false)
      setStage3EnteredLocally(true)
      setStage("stage3")
    },
    [installNewStage3Bootstrap, loadStage3Bootstrap, reloadServerFrontier],
  )

  const handleProductKindsCorrection = useCallback(
    async (categories: PersonalPlanCategory[]) => {
      const session =
        pendingStage3BootstrapRef.current ??
        pendingStage2CompletionRef.current ??
        stage2SeedRef.current
      if (!session) throw new Stage3ProductKindCorrectionError("stage2_session_unavailable")
      try {
        const result = await completeStage2ProductKindCorrection({
          categories,
          session,
          pendingCompletionSession: pendingStage2CompletionRef.current,
          pendingBootstrapSession: pendingStage3BootstrapRef.current,
          stage2Gateway,
          loadStage3Bootstrap: (refinedVersionId) =>
            loadStage3Bootstrap(refinedVersionId, { source: "correction" }),
        })
        pendingStage2CompletionRef.current = result.pendingCompletionSession
        pendingStage3BootstrapRef.current = result.pendingBootstrapSession
        stage2SeedRef.current = result.session
        installNewStage3Bootstrap(result.bootstrap)
        setStage3LoadState("idle")
      } catch (error) {
        if (error instanceof Stage3ProductKindCorrectionError) {
          if (error.code === "revision_conflict") window.location.reload()
          if (error.code === "completion_failed_after_save") {
            if (error.savedSession) {
              pendingStage2CompletionRef.current = error.savedSession
              stage2SeedRef.current = error.savedSession
            }
          }
          if (error.code === "bootstrap_failed_after_completion" && error.savedSession) {
            pendingStage3BootstrapRef.current = error.savedSession
            stage2SeedRef.current = error.savedSession
          }
          throw error
        }
        if (
          error instanceof Stage2RefinementError &&
          error.code === "completion_failed" &&
          error.savedSession
        ) {
          pendingStage2CompletionRef.current = error.savedSession
          stage2SeedRef.current = error.savedSession
          throw new Stage3ProductKindCorrectionError("completion_failed_after_save")
        }
        throw new Stage3ProductKindCorrectionError("save_failed")
      }
    },
    [installNewStage3Bootstrap, loadStage3Bootstrap, stage2Gateway],
  )

  const resumeStage3 = useCallback(async () => {
    if (initialJourney.stage !== "stage3") return
    setStage3LoadState("loading")
    try {
      installNewStage3Bootstrap(await loadStage3Bootstrap(initialJourney.refinedVersionId))
      setStage3LoadState("idle")
    } catch (error) {
      setStage3LoadState(stage3LoadRecoveryMode(error))
    }
  }, [initialJourney, installNewStage3Bootstrap, loadStage3Bootstrap])

  useEffect(() => {
    if (initialJourney.stage !== "stage3") return
    let cancelled = false
    void loadStage3Bootstrap(initialJourney.refinedVersionId).then(
      (loaded) => {
        if (cancelled) return
        installNewStage3Bootstrap(loaded)
        setStage3LoadState("idle")
      },
      (error) => {
        if (!cancelled) setStage3LoadState(stage3LoadRecoveryMode(error))
      },
    )
    return () => {
      cancelled = true
    }
  }, [initialJourney, installNewStage3Bootstrap, loadStage3Bootstrap])

  const enterStage1 = useCallback(async () => {
    setStage("stage1")
    if (plan || stage1LoadState === "loading") return
    setStage1LoadState("loading")
    try {
      const loaded = await requestPlanStart()
      if (
        loaded.state !== "ready" ||
        !loaded.plan.personalPlanId ||
        loaded.plan.personalPlanId !== personalPlanId
      ) {
        throw new Error("stage1_plan_unavailable")
      }
      setPlan(loaded.plan)
      setStage1LoadState("idle")
    } catch {
      setStage1LoadState("error")
    }
  }, [personalPlanId, plan, stage1LoadState])

  const enterStage2 = useCallback(async () => {
    if (stage2LoadState === "loading") return
    if (stage2SeedRef.current) {
      setStage2EnteredLocally(true)
      setStage("stage2")
      return
    }
    setStage2LoadState("loading")
    try {
      stage2SeedRef.current = await stage2Gateway.load()
      setStage2LoadState("idle")
      setStage2EnteredLocally(true)
      setStage("stage2")
    } catch {
      setStage2LoadState("error")
    }
  }, [stage2Gateway, stage2LoadState])

  const seenRoles = useMemo(
    () => deriveAcceptIdealPlanSeenRoles(productExamplePreviews),
    [productExamplePreviews],
  )
  /**
   * A Stage-3 resume already has a refined plan, and a build without the accept
   * route's flag set cannot accept at all. Both keep the old refinement entry.
   */
  const acceptAvailable =
    initialJourney.stage !== "stage3" && initialJourney.directAcceptanceAvailable === true

  const openRoutineHref = useCallback(
    (href: string) => {
      markPersonalPlanStageNavigation("/routine")
      replaceRoute(href)
    },
    [replaceRoute],
  )

  /**
   * The universal escape hatch. Completing the refinement also produces an
   * accepted plan, so anything acceptance cannot resolve goes here rather than
   * onto a retry that can only fail the same way.
   */
  const openRefinementRoute = useCallback(() => {
    setAcceptStatus("unavailable")
    replaceRoute(PLAN_ACCEPT_REFINE_HREF)
  }, [replaceRoute])

  /**
   * The Idealplan CTA. There is no fork screen to fall back to any more, so
   * every outcome has to land somewhere the user can act: the routine, the
   * running refinement, the refinement re-entry, or a retryable inline error.
   */
  const acceptIdealPlanDirectly = useCallback(async () => {
    if (acceptStatus === "pending") return
    const readiness = acceptIdealPlanReadiness(resolvedPreviewLoadState)
    // The CTA is disabled while previews load, so this only guards a race.
    if (readiness === "wait") return
    if (readiness === "refine") {
      openRefinementRoute()
      return
    }
    setAcceptStatus("pending")
    const effect = await runAcceptIdealPlanFlow({
      seenRoles,
      accept: requestAcceptIdealPlan,
      refreshSeenRoles: async (): Promise<AcceptIdealPlanSeenRole[] | null> => {
        if (!plan?.personalPlanId || !plan.sourceInputHash) return null
        try {
          const refreshed = await requestStage1ProductExamplePreviews({
            personalPlanId: plan.personalPlanId,
            sourceInputHash: plan.sourceInputHash,
          })
          setProductExamplePreviews(refreshed)
          return deriveAcceptIdealPlanSeenRoles(refreshed)
        } catch {
          return null
        }
      },
    })
    if (effect.kind === "open_routine") {
      openRoutineHref(effect.href)
      return
    }
    if (effect.kind === "continue_refinement") {
      setAcceptStatus("idle")
      void enterStage2()
      return
    }
    if (effect.kind === "open_refinement_route") {
      // The refinement produces an accepted plan too, so this is a detour, not
      // a failure. The CTA relabels to the Feinschliff while the route resolves.
      openRefinementRoute()
      return
    }
    setAcceptStatus("error")
  }, [
    acceptStatus,
    enterStage2,
    openRefinementRoute,
    openRoutineHref,
    plan?.personalPlanId,
    plan?.sourceInputHash,
    resolvedPreviewLoadState,
    seenRoles,
  ])

  const { intent: ctaIntent, status: ctaStatus } = planStartCtaState({
    acceptAvailable,
    acceptStatus,
    stage2LoadState,
    previewLoadState: resolvedPreviewLoadState,
  })

  const openRoutine = useCallback(
    (handoff: Stage3RoutineHandoff) => {
      performPersonalPlanRoutineHandoff(
        {
          ...handoff,
          next: {
            ...handoff.next,
            href: stage3CompletionRoutineHref(initialJourney, handoff.next.href),
          },
        },
        {
          markNavigation: markPersonalPlanStageNavigation,
          replaceRoute,
        },
      )
    },
    [initialJourney, replaceRoute],
  )

  if (stage === "stage2") {
    // The ref deliberately retains the latest persisted seed across stage switches.
    const initialStage2Session = stage2SeedRef.current
    return (
      <RefinementFlow
        gateway={stage2Gateway}
        initialSession={initialStage2Session}
        // Read from the journey regardless of the stage it STARTED at: a
        // reloaded Modul-1 Stage-3 journey switches the local stage back to
        // Stage 2 when Back is pressed, and it must keep walking its module
        // instead of falling into the full linear Feinschliff (resume shell).
        // `moduleEntry` and the post-accept origin signal (Task 2.1) travel
        // together — see `stage2ModuleCompletionRoutingProps`.
        {...stage2ModuleCompletionRoutingProps(initialJourney)}
        onSecondaryExit={() => {
          if (planStartRefinementExitDestination(initialJourney) === "routine") {
            openRoutineHref("/routine")
            return
          }
          stage2SeedRef.current = undefined
          void enterStage1()
        }}
        moduleProgress={
          initialJourney.stage === "stage2" ? (initialJourney.moduleProgress ?? null) : null
        }
        onHandoff={handleHandoff}
        onModuleComplete={(payload: Stage2ModuleCompletionPayload) => {
          // Modul 2 without a Stage-3 handoff (habits first), OR the closing
          // module on a post-accept run (Task 2.1): the user belongs back on
          // their Routine. The "Plan aktualisiert" toast (Task 2.6) rides
          // along only when the server actually recomputed it (Task 2.2) —
          // see `moduleCompletionRoutineHref`.
          openRoutineHref(
            moduleCompletionRoutineHref(
              initialJourney,
              payload.moduleCompletion.recompute?.outcome,
            ),
          )
        }}
        autoHandoff={!returningToRefinement}
        stageEntrance={stage2EnteredLocally}
      />
    )
  }
  if (stage === "stage3" && !stage3Bootstrap) {
    if (stage3LoadState === "retry_stage3" || stage3LoadState === "reload_server_frontier") {
      return (
        <PlanStartRetryableError
          onRetry={() =>
            recoverPlanStartStage3Load(stage3LoadState, {
              retryStage3: () => void resumeStage3(),
              reloadServerFrontier,
            })
          }
        />
      )
    }
    return <PlanStartLoading />
  }
  if (stage === "stage3" && stage3Bootstrap)
    return (
      <Stage3ProductsFlow
        key={stage3Bootstrap.entryContext.refinedVersionId}
        entryContext={stage3Bootstrap.entryContext}
        bootstrap={stage3Bootstrap}
        draftId="client-derived"
        userId="client-derived"
        gateway={stage3Gateway}
        intakeClient={intakeClient}
        analytics={stage3BaselineAnalytics}
        stageEntrance={stage3EnteredLocally}
        onOpenRoutine={openRoutine}
        onProductKindsCorrection={handleProductKindsCorrection}
        onBackToRefinement={() => {
          setReturningToRefinement(true)
          setStage("stage2")
        }}
      />
    )
  if (!displayedPlan) {
    if (stage1LoadState === "error") {
      return <PlanStartRetryableError onRetry={() => void enterStage1()} />
    }
    return <PlanStartLoading />
  }

  return (
    <PlanStartFlow
      state="ready"
      plan={displayedPlan}
      refinementAvailable={
        initialJourney.stage === "stage3" || initialJourney.refinementAvailable !== false
      }
      nextIntent={ctaIntent}
      nextStatus={ctaStatus}
      nextNotice={acceptStatus === "unavailable" ? PLAN_ACCEPT_UNAVAILABLE_NOTICE : null}
      initialStep={stage1ReturnStepRef.current}
      onContinue={(sourceStep) => {
        stage1ReturnStepRef.current = sourceStep
        // The Idealplan is accepted from here; the refinement entry only
        // survives for journeys that cannot accept (a Stage-3 resume that
        // walked back to Stage 1, or a build without the accept flag set).
        if (acceptAvailable) {
          void acceptIdealPlanDirectly()
          return
        }
        void enterStage2()
      }}
    />
  )
}

function isValidLaterStageBootstrap(
  initialJourney: PlanStartInitialJourney,
  personalPlanId: string | undefined,
  initialRefinementSession: Stage2RefinementSession | undefined,
) {
  if (initialJourney.stage === "stage1" || !personalPlanId || !initialRefinementSession) {
    return false
  }
  if (initialJourney.stage === "stage2") return true
  return (
    initialRefinementSession.status === "complete" &&
    initialRefinementSession.completedHandoff?.refinedVersionId === initialJourney.refinedVersionId
  )
}
export type FlowStep = "basis" | "optional"

export function PlanStartFlow(
  props: PlanStartFlowProps & {
    initialStep?: FlowStep
    /** Leaves the Idealplan from its last page — accept, or open the Feinschliff. */
    onContinue?: (sourceStep: FlowStep) => void
    refinementAvailable?: boolean
    /** What the last page's CTA does, and therefore what it is called. */
    nextIntent?: NeedPlanScreenNextIntent
    nextStatus?: NeedPlanScreenNextStatus
    nextNotice?: string | null
  },
) {
  const [step, setStep] = useState<FlowStep>(() =>
    props.initialStep === "optional" && props.state === "ready" && props.plan.optional
      ? "optional"
      : "basis",
  )
  const [direction, setDirection] = useState<PersonalPlanTransitionDirection>("forward")
  const hasOptionalPage = props.state === "ready" && Boolean(props.plan.optional)
  // A Stage-1-only build has nowhere to go from the Idealplan — no accept route
  // and no Feinschliff — so it renders no continuation CTA at all.
  const canContinue = props.refinementAvailable !== false
  const optionalImageUrls =
    props.state === "ready" && step === "basis" && props.plan.optional
      ? [
          ...new Set(
            props.plan.optional.cards
              .flatMap((card) => (isNeedCardGroup(card) ? card.members : [card]))
              .flatMap((card) => (card.imageUrl ? [card.imageUrl] : [])),
          ),
        ]
      : []

  const content = useMemo(() => {
    if (props.state !== "ready") return null
    const nextIntent = props.nextIntent ?? "refine"
    if (step === "optional" && props.plan.optional) {
      return (
        <NeedPlanScreen
          screen={props.plan.optional}
          hasOptionalPage
          showJourneyHeader={false}
          nextIntent={nextIntent}
          nextStatus={props.nextStatus}
          nextNotice={props.nextNotice}
          onNext={
            canContinue && props.onContinue ? () => props.onContinue?.("optional") : undefined
          }
        />
      )
    }
    return (
      <NeedPlanScreen
        screen={props.plan.basis}
        hasOptionalPage={hasOptionalPage}
        showJourneyHeader={false}
        nextIntent={nextIntent}
        {...(hasOptionalPage ? {} : { nextStatus: props.nextStatus, nextNotice: props.nextNotice })}
        onNext={
          hasOptionalPage
            ? () => {
                setDirection("forward")
                setStep("optional")
              }
            : canContinue && props.onContinue
              ? () => props.onContinue?.("basis")
              : undefined
        }
      />
    )
  }, [canContinue, hasOptionalPage, props, step])

  if (props.state === "unavailable") {
    return <PlanStartUnavailable profileHref={props.profileHref} supportHref={props.supportHref} />
  }

  if (props.state === "loading") {
    return <PlanStartLoading />
  }

  if (props.state === "retryable_error") {
    return <PlanStartRetryableError onRetry={props.onRetry} />
  }

  return (
    <>
      {optionalImageUrls.length > 0 ? (
        <link rel="preconnect" href="https://pqdkhefxsxkyeqelqegq.supabase.co" />
      ) : null}
      {optionalImageUrls.map((imageUrl) => (
        <link key={imageUrl} rel="preload" as="image" href={imageUrl} />
      ))}
      <div className="min-h-dvh bg-[var(--background)]">
        <PlanStartHeader
          stageLabel="Plan"
          onBack={
            step === "optional"
              ? () => {
                  setDirection("reverse")
                  setStep("basis")
                }
              : undefined
          }
          backLabel={step === "optional" ? "Zur Basis" : undefined}
        />
        <PersonalPlanStageEntrance destination="/plan-start">
          <PersonalPlanViewTransition viewKey={step} direction={direction} variant="quiz">
            {content}
          </PersonalPlanViewTransition>
        </PersonalPlanStageEntrance>
      </div>
    </>
  )
}

export function PlanStartLoading() {
  return (
    <StateShell
      title="Dein Plan entsteht"
      lead="Wir bereiten die Empfehlungen aus deiner Haaranalyse vor."
      icon={<Loader2 className="h-7 w-7 animate-spin" aria-hidden="true" />}
      dataState="loading"
    >
      <div className="mx-auto mt-4 w-full max-w-[270px]">
        <Progress value={50} label="Plan wird vorbereitet" />
      </div>
    </StateShell>
  )
}

export function PlanStartRetryableError({ onRetry }: { onRetry?: () => void }) {
  return (
    <StateShell
      title="Dein Plan lädt gerade nicht"
      lead="Deine Antworten sind gespeichert. Du musst nichts noch einmal ausfüllen."
      icon={<RotateCcw className="h-7 w-7" aria-hidden="true" />}
      dataState="retryable_error"
    >
      <p className="mx-auto mt-4 max-w-[270px] text-center text-sm leading-relaxed text-[#625d58]">
        Wir konnten deinen Plan nicht abrufen. Versuche es gleich noch einmal.
      </p>
      <div className="mx-auto mt-5 flex w-full max-w-[280px] flex-col gap-1.5">
        <button
          type="button"
          onClick={onRetry}
          className="min-h-11 rounded-[12px] bg-[#6B50A0] px-3 text-[12px] font-extrabold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Erneut versuchen
        </button>
        <Link
          href="/profile"
          className="min-h-11 rounded-[12px] px-3 py-3 text-center text-[12px] font-extrabold text-[#6B50A0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Später fortfahren
        </Link>
      </div>
    </StateShell>
  )
}

export function PlanStartUnavailable({
  profileHref = "/profile",
  supportHref = "/kontakt",
}: {
  profileHref?: string
  supportHref?: string
}) {
  return (
    <StateShell
      title="Dieser Planbereich ist gerade nicht verfügbar"
      lead="Deine bisherigen Angaben bleiben gespeichert."
      icon={<Info className="h-7 w-7" aria-hidden="true" />}
      dataState="unavailable"
    >
      <p className="mx-auto mt-4 max-w-[270px] text-center text-sm leading-relaxed text-[#625d58]">
        Du musst nichts erneut ausfüllen. Du kannst zu deinem Profil zurückkehren oder uns
        kontaktieren.
      </p>
      <div className="mx-auto mt-5 flex w-full max-w-[280px] flex-col gap-1.5">
        <Link
          href={profileHref}
          className="min-h-11 rounded-[12px] bg-[#6B50A0] px-3 py-3 text-center text-[12px] font-extrabold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Zum Profil
        </Link>
        <Link
          href={supportHref}
          className="min-h-11 rounded-[12px] px-3 py-3 text-center text-[12px] font-extrabold text-[#6B50A0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Support kontaktieren
        </Link>
      </div>
    </StateShell>
  )
}

/**
 * Every Stage-1 state screen shares one identity: the same header stage label
 * as the real plan pages (`PlanStartHeader stageLabel="Plan"`) and the same
 * overline. They are defaults rather than three repeated literals so the label
 * cannot drift out of sync with the pages it stands in for again.
 */
function StateShell({
  stageLabel = "Plan",
  overline = "Dein persönlicher Plan",
  title,
  lead,
  icon,
  dataState,
  children,
}: {
  stageLabel?: string
  overline?: string
  title: string
  lead: string
  icon: React.ReactNode
  dataState: string
  children: React.ReactNode
}) {
  return (
    <section className="min-h-dvh bg-[#fdfbf9]" data-plan-start-state={dataState}>
      <PlanStartHeader stageLabel={stageLabel} />
      <main className="mx-auto w-full max-w-[430px] px-3 py-12 sm:max-w-[560px] sm:px-5">
        <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#6e6863]">
          {overline}
        </div>
        <h1 className="font-header mt-1 text-[23px] leading-[1.14] text-[#291a43] sm:text-[28px]">
          {title}
        </h1>
        <p className="mt-1 text-[11.5px] leading-relaxed text-[#706a65] sm:text-sm">{lead}</p>
        <div className="mx-auto mt-12 grid h-[62px] w-[62px] place-items-center rounded-[20px] bg-[#f1ecf8] text-[#6B50A0]">
          {icon}
        </div>
        {children}
      </main>
    </section>
  )
}
