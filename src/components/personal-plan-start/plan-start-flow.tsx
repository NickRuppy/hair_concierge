"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Info, Loader2, RotateCcw } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import {
  RefinementFlow,
  type Stage2HandoffPayload,
} from "@/components/personal-plan-refinement/refinement-flow"
import type { Stage2ModuleEntryRequest } from "@/lib/personal-plan/refinement/module-scope"
import {
  PLAN_FORK_STALE_NOTICE,
  PersonalPlanStageEntrance,
  PersonalPlanViewTransition,
  PlanForkScreen,
  acceptStatusAfterStale,
  derivePlanForkPreviewState,
  interpretAcceptIdealPlanResponse,
  type PersonalPlanTransitionDirection,
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
} from "@/lib/personal-plan/refinement/gateway"
import type { Stage2RefinementSession } from "@/lib/personal-plan/refinement/session"
import type { Stage2TriggerContext } from "@/lib/personal-plan/refinement/types"
import { directAcceptanceAssumptions } from "@/lib/personal-plan/direct-acceptance/defaults"
import {
  isStage1ProductExamplePreviewResponse,
  stage1ProductExamplePreviewRequestUrl,
  type Stage1ProductExamplePreviewResponse,
} from "@/lib/personal-plan/product-preview-contract"
import { markPersonalPlanStageNavigation } from "@/lib/personal-plan/stage-navigation-intent"

import { isNeedCardGroup } from "./need-card"
import {
  NeedPlanScreen,
  PlanStartHeader,
  Progress,
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
  /** Drives the fork screen's assumption list without touching the Stage-2 gateway. */
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
    }
  | { stage: "stage3"; refinedVersionId: string; repairRoutineVersionId?: string }

/**
 * Whether Stage 2's bridge may hand off into Stage 3 on its own. An explicit
 * refine request (`/plan-start?refine=1`, the Routine refinement nudge) must
 * not: after a direct accept the draft is already complete, so an auto-handoff
 * would bounce the user straight back to Stage 3 without ever showing the
 * Feinschliff.
 */
export function refinementAutoHandoffEnabled(initialJourney: PlanStartInitialJourney): boolean {
  return !(initialJourney.stage === "stage2" && initialJourney.returningToRefinement === true)
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
  gateway: Pick<Stage3ProductsGateway, "loadOrCreate">
  personalPlanId: string
  refinedVersionId: string
  repairRoutineVersionId?: string
  /**
   * Module-driven Stage-3 (re-)entry: a later module completion stales the
   * draft this version produced, so the load must rebuild on the plan's
   * CURRENT refined version instead of dead-ending. A repair load keeps
   * failing closed — it must plan against exactly the version it names.
   */
  rebuildOnStaleRefinedVersion?: boolean
}): Promise<Stage3Bootstrap> {
  const loaded = await input.gateway.loadOrCreate({
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
  const [stage, setStage] = useState<"stage1" | "fork" | "stage2" | "stage3">(
    () => initialJourney.stage,
  )
  const [acceptStatus, setAcceptStatus] = useState<"idle" | "pending" | "error" | "unavailable">(
    "idle",
  )
  const [forkNotice, setForkNotice] = useState<string | null>(null)
  /** Consecutive `seen_state_stale` responses; resets on any other outcome. */
  const staleAcceptCountRef = useRef(0)
  const [plan, setPlan] = useState<PlanStartReadyViewModel | null>(initialPlan ?? null)
  const [productExamplePreviews, setProductExamplePreviews] =
    useState<Stage1ProductExamplePreviewResponse | null>(null)
  const [stage1LoadState, setStage1LoadState] = useState<"idle" | "loading" | "error">("idle")
  const [stage2LoadState, setStage2LoadState] = useState<"idle" | "loading" | "error">("idle")
  const [stage2EnteredLocally, setStage2EnteredLocally] = useState(false)
  const [stage3EnteredLocally, setStage3EnteredLocally] = useState(false)
  const stage2SeedRef = useRef(initialRefinementSession)
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
    if (stage !== "stage1" || !plan?.personalPlanId || !plan.sourceInputHash) return
    let cancelled = false
    void requestStage1ProductExamplePreviews({
      personalPlanId: plan.personalPlanId,
      sourceInputHash: plan.sourceInputHash,
    }).then(
      (response) => {
        if (
          !cancelled &&
          response.personalPlanId === plan.personalPlanId &&
          response.sourceInputHash === plan.sourceInputHash
        ) {
          setProductExamplePreviews(response)
        }
      },
      () => {
        // Product previews are presentation-only. The signed plan and journey stay available.
      },
    )
    return () => {
      cancelled = true
    }
  }, [plan?.personalPlanId, plan?.sourceInputHash, stage])
  const loadStage3Bootstrap = useCallback(
    async (
      refinedVersionId: string,
      options: { rebuildOnStaleRefinedVersion?: boolean } = {},
    ): Promise<Stage3Bootstrap> => {
      return loadPlanStartStage3Bootstrap({
        gateway: stage3Gateway,
        personalPlanId,
        refinedVersionId,
        repairRoutineVersionId:
          initialJourney.stage === "stage3" ? initialJourney.repairRoutineVersionId : undefined,
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
      // Stage-2 -> Stage-3 always arrives from a completion, so this is the
      // module-driven re-entry path the stale rebuild exists for.
      const bootstrap = await loadPlanStartStage2HandoffBootstrap({
        handoff,
        loadStage3Bootstrap: (refinedVersionId) =>
          loadStage3Bootstrap(refinedVersionId, { rebuildOnStaleRefinedVersion: true }),
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
          loadStage3Bootstrap,
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

  const forkPreviewState = useMemo(
    () => derivePlanForkPreviewState(productExamplePreviews),
    [productExamplePreviews],
  )

  const openRoutineHref = useCallback(
    (href: string) => {
      markPersonalPlanStageNavigation("/routine")
      replaceRoute(href)
    },
    [replaceRoute],
  )

  const acceptIdealPlanDirectly = useCallback(async () => {
    if (
      !forkPreviewState ||
      forkPreviewState.fallbackNotice ||
      forkPreviewState.refinementRequiredNotice ||
      acceptStatus === "pending"
    ) {
      return
    }
    setAcceptStatus("pending")
    setForkNotice(null)
    const outcome = await requestAcceptIdealPlan(forkPreviewState.seenRoles)
    if (outcome.kind === "accepted" || outcome.kind === "plan_already_accepted") {
      openRoutineHref(outcome.href)
      return
    }
    if (outcome.kind === "refinement_in_progress") {
      setAcceptStatus("idle")
      void enterStage2()
      return
    }
    if (outcome.kind === "seen_state_stale") {
      // The server would plan other products than the user just saw. Re-render
      // the fork from fresh previews instead of accepting something unseen.
      //
      // A second consecutive stale response means re-fetching did not converge:
      // the mismatch is structural (the server plans a role the preview payload
      // does not contain at all), so retrying can only loop while telling the
      // user their recommendations were "updated". Stop, and send them down the
      // path that does work.
      staleAcceptCountRef.current += 1
      const nextStatus = acceptStatusAfterStale(staleAcceptCountRef.current)
      setAcceptStatus(nextStatus)
      if (nextStatus === "unavailable") {
        setForkNotice(null)
        return
      }
      setForkNotice(PLAN_FORK_STALE_NOTICE)
      if (!plan?.personalPlanId || !plan.sourceInputHash) {
        setProductExamplePreviews(null)
        return
      }
      try {
        const refreshed = await requestStage1ProductExamplePreviews({
          personalPlanId: plan.personalPlanId,
          sourceInputHash: plan.sourceInputHash,
        })
        setProductExamplePreviews(refreshed)
      } catch {
        setProductExamplePreviews(null)
      }
      return
    }
    staleAcceptCountRef.current = 0
    setAcceptStatus("error")
  }, [
    acceptStatus,
    enterStage2,
    forkPreviewState,
    openRoutineHref,
    plan?.personalPlanId,
    plan?.sourceInputHash,
  ])

  const openRoutine = useCallback(
    (handoff: Stage3RoutineHandoff) => {
      performPersonalPlanRoutineHandoff(handoff, {
        markNavigation: markPersonalPlanStageNavigation,
        replaceRoute,
      })
    },
    [replaceRoute],
  )

  if (stage === "fork") {
    return (
      <PlanForkScreen
        assumptions={directAcceptanceAssumptions(
          plan?.stage2TriggerContext ?? {
            relevantCategories: [],
            hasReportedIrritatedScalp: false,
            dryShampooBridgeEligibility: "unknown",
          },
        )}
        previewState={forkPreviewState}
        directAcceptanceAvailable={
          initialJourney.stage !== "stage3" &&
          initialJourney.directAcceptanceAvailable === true &&
          Boolean(plan?.stage2TriggerContext)
        }
        refineStatus={stage2LoadState}
        acceptStatus={acceptStatus}
        noticeMessage={forkNotice}
        onRefine={() => void enterStage2()}
        onAccept={() => void acceptIdealPlanDirectly()}
        onBack={() => {
          // Leaving to Stage 1 and returning is a real remount of the fork, so
          // the retired accept path gets a clean slate.
          staleAcceptCountRef.current = 0
          setAcceptStatus("idle")
          setForkNotice(null)
          setStage("stage1")
        }}
      />
    )
  }
  if (stage === "stage2") {
    // The ref deliberately retains the latest persisted seed across stage switches.
    const initialStage2Session = stage2SeedRef.current
    return (
      <RefinementFlow
        gateway={stage2Gateway}
        initialSession={initialStage2Session}
        moduleEntry={initialJourney.stage === "stage2" ? initialJourney.refineModule : undefined}
        onSecondaryExit={() => {
          stage2SeedRef.current = undefined
          void enterStage1()
        }}
        onHandoff={handleHandoff}
        onModuleComplete={() => {
          // Modul 2 without a Stage-3 handoff (habits first): the user belongs
          // back on their Routine. The toast is Task 2.6.
          openRoutineHref("/routine")
        }}
        autoHandoff={!returningToRefinement}
        directEntry
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
      initialStep={stage1ReturnStepRef.current}
      onContinueToRefinement={(sourceStep) => {
        // The fork is the Stage-2 entry point and must render before any
        // Stage-2 gateway load, so its own error state can never block it.
        stage1ReturnStepRef.current = sourceStep
        setStage("fork")
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
    onContinueToRefinement?: (sourceStep: FlowStep) => void
    refinementAvailable?: boolean
  },
) {
  const [step, setStep] = useState<FlowStep>(() =>
    props.initialStep === "optional" && props.state === "ready" && props.plan.optional
      ? "optional"
      : "basis",
  )
  const [direction, setDirection] = useState<PersonalPlanTransitionDirection>("forward")
  const hasOptionalPage = props.state === "ready" && Boolean(props.plan.optional)
  const canRefine = props.refinementAvailable !== false
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
    if (step === "optional" && props.plan.optional) {
      return (
        <NeedPlanScreen
          screen={props.plan.optional}
          hasOptionalPage
          showJourneyHeader={false}
          onNext={
            canRefine && props.onContinueToRefinement
              ? () => props.onContinueToRefinement?.("optional")
              : undefined
          }
        />
      )
    }
    return (
      <NeedPlanScreen
        screen={props.plan.basis}
        hasOptionalPage={hasOptionalPage}
        showJourneyHeader={false}
        onNext={
          hasOptionalPage
            ? () => {
                setDirection("forward")
                setStep("optional")
              }
            : canRefine && props.onContinueToRefinement
              ? () => props.onContinueToRefinement?.("basis")
              : undefined
        }
      />
    )
  }, [canRefine, hasOptionalPage, props, step])

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
          stageLabel="Idealplan"
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
          <PersonalPlanViewTransition viewKey={step} direction={direction} variant="depth">
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
      stageLabel="Dein Plan"
      overline="Dein persönlicher Plan"
      title="Dein Idealplan entsteht"
      lead="Wir bereiten die Empfehlungen aus deiner Haaranalyse vor."
      icon={<Loader2 className="h-7 w-7 animate-spin" aria-hidden="true" />}
      dataState="loading"
    >
      <div className="mx-auto mt-4 w-full max-w-[270px]">
        <Progress value={50} label="Idealplan wird vorbereitet" />
      </div>
    </StateShell>
  )
}

export function PlanStartRetryableError({ onRetry }: { onRetry?: () => void }) {
  return (
    <StateShell
      stageLabel="Dein Plan"
      overline="Dein persönlicher Plan"
      title="Dein Plan lädt gerade nicht"
      lead="Deine Antworten sind gespeichert. Du musst nichts noch einmal ausfüllen."
      icon={<RotateCcw className="h-7 w-7" aria-hidden="true" />}
      dataState="retryable_error"
    >
      <p className="mx-auto mt-4 max-w-[270px] text-center text-sm leading-relaxed text-[#625d58]">
        Wir konnten deinen Idealplan nicht abrufen. Versuche es gleich noch einmal.
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
      stageLabel="Dein Plan"
      overline="Dein persönlicher Plan"
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

function StateShell({
  stageLabel,
  overline,
  title,
  lead,
  icon,
  dataState,
  children,
}: {
  stageLabel: string
  overline: string
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
