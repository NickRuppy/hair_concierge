"use client"

import Link from "next/link"
import { Info, Loader2, RotateCcw } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import {
  RefinementFlow,
  type Stage2HandoffPayload,
} from "@/components/personal-plan-refinement/refinement-flow"
import { Stage3ProductsFlow } from "@/components/personal-plan-products/stage3-products-flow"
import {
  createHttpStage3IntakeClient,
  createHttpStage3ProductsGateway,
} from "@/lib/personal-plan/products/http-gateway"
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

import {
  NeedPlanScreen,
  PlanStartHeader,
  Progress,
  type NeedPlanScreenViewModel,
} from "./need-plan-screen"
import { adaptInitialNeedSnapshotToPlanStartViewModel } from "./snapshot-adapter"

export type PlanStartReadyViewModel = {
  basis: NeedPlanScreenViewModel
  optional: NeedPlanScreenViewModel | null
  personalPlanId?: string
}

export type PlanStartInitialJourney =
  | { stage: "stage1"; refinementAvailable?: boolean }
  | { stage: "stage2"; refinementAvailable?: boolean }
  | { stage: "stage3"; refinedVersionId: string }

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
}

export async function completeStage2ProductKindCorrection(input: {
  categories: PersonalPlanCategory[]
  session: Stage2RefinementSession
  pendingCompletionSession?: Stage2RefinementSession | null
  stage2Gateway: Pick<Stage2RefinementGateway, "saveAnswerAndComplete" | "complete">
  loadStage3Bootstrap: (refinedVersionId: string) => Promise<Stage3Bootstrap>
}): Promise<Stage3ProductKindCorrectionResult> {
  try {
    let handoff: Stage2CompleteResult
    let nextSession = input.pendingCompletionSession ?? input.session
    if (input.pendingCompletionSession) {
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
    const bootstrap = await input.loadStage3Bootstrap(handoff.refinedVersionId)
    return {
      session: completedSession,
      handoff,
      bootstrap,
      pendingCompletionSession: null,
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

export function PlanStartProductionGate({
  initialJourney = { stage: "stage1" },
  initialPlan,
  personalPlanId,
  initialRefinementSession,
}: {
  initialJourney?: PlanStartInitialJourney
  initialPlan?: PlanStartReadyViewModel
  personalPlanId?: string
  initialRefinementSession?: Stage2RefinementSession
}) {
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
    />
  )
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

export async function loadPlanStartStage3Bootstrap(input: {
  gateway: Pick<Stage3ProductsGateway, "loadOrCreate">
  personalPlanId: string
  refinedVersionId: string
}): Promise<Stage3Bootstrap> {
  const loaded = await input.gateway.loadOrCreate({
    draftId: "client-derived",
    userId: "client-derived",
    personalPlanId: input.personalPlanId,
    refinedVersionId: input.refinedVersionId,
    requirements: [],
  })
  return buildStage3Bootstrap(
    loaded as typeof loaded & { authorityEvaluations?: Stage3AuthorityEvaluation[] },
    input,
  )
}

export function PlanStartCustomerJourney({
  initialPlan,
  initialJourney,
  personalPlanId,
  initialRefinementSession,
}: {
  initialPlan?: PlanStartReadyViewModel
  initialJourney: PlanStartInitialJourney
  personalPlanId: string
  initialRefinementSession?: Stage2RefinementSession
}) {
  const [stage, setStage] = useState<"stage1" | "stage2" | "stage3">(() => initialJourney.stage)
  const [plan, setPlan] = useState<PlanStartReadyViewModel | null>(initialPlan ?? null)
  const [stage1LoadState, setStage1LoadState] = useState<"idle" | "loading" | "error">("idle")
  const stage2SeedRef = useRef(initialRefinementSession)
  const pendingStage2CompletionRef = useRef<Stage2RefinementSession | null>(null)
  const [stage3Bootstrap, setStage3Bootstrap] = useState<Stage3Bootstrap | null>(null)
  const [returningToRefinement, setReturningToRefinement] = useState(false)
  const [stage3LoadState, setStage3LoadState] = useState<
    "idle" | "loading" | Stage3LoadRecoveryMode
  >(initialJourney.stage === "stage3" ? "loading" : "idle")
  const stage3Gateway = useMemo(() => createHttpStage3ProductsGateway(), [])
  const intakeClient = useMemo(() => createHttpStage3IntakeClient(), [])
  const stage2Gateway = useMemo(() => createHttpStage2RefinementGateway(), [])
  const loadStage3Bootstrap = useCallback(
    async (refinedVersionId: string): Promise<Stage3Bootstrap> => {
      return loadPlanStartStage3Bootstrap({
        gateway: stage3Gateway,
        personalPlanId,
        refinedVersionId,
      })
    },
    [personalPlanId, stage3Gateway],
  )
  const handleHandoff = useCallback(
    async ({ handoff, session }: Stage2HandoffPayload) => {
      setStage3Bootstrap(await loadStage3Bootstrap(handoff.refinedVersionId))
      stage2SeedRef.current = session
      setStage3LoadState("idle")
      setReturningToRefinement(false)
      setStage("stage3")
    },
    [loadStage3Bootstrap],
  )

  const handleProductKindsCorrection = useCallback(
    async (categories: PersonalPlanCategory[]) => {
      const session = pendingStage2CompletionRef.current ?? stage2SeedRef.current
      if (!session) throw new Stage3ProductKindCorrectionError("stage2_session_unavailable")
      try {
        const result = await completeStage2ProductKindCorrection({
          categories,
          session,
          pendingCompletionSession: pendingStage2CompletionRef.current,
          stage2Gateway,
          loadStage3Bootstrap,
        })
        pendingStage2CompletionRef.current = result.pendingCompletionSession
        stage2SeedRef.current = result.session
        setStage3Bootstrap(result.bootstrap)
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
    [loadStage3Bootstrap, stage2Gateway],
  )

  const resumeStage3 = useCallback(async () => {
    if (initialJourney.stage !== "stage3") return
    setStage3LoadState("loading")
    try {
      setStage3Bootstrap(await loadStage3Bootstrap(initialJourney.refinedVersionId))
      setStage3LoadState("idle")
    } catch (error) {
      setStage3LoadState(stage3LoadRecoveryMode(error))
    }
  }, [initialJourney, loadStage3Bootstrap])

  useEffect(() => {
    if (initialJourney.stage !== "stage3") return
    let cancelled = false
    void loadStage3Bootstrap(initialJourney.refinedVersionId).then(
      (loaded) => {
        if (cancelled) return
        setStage3Bootstrap(loaded)
        setStage3LoadState("idle")
      },
      (error) => {
        if (!cancelled) setStage3LoadState(stage3LoadRecoveryMode(error))
      },
    )
    return () => {
      cancelled = true
    }
  }, [initialJourney, loadStage3Bootstrap])

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

  if (stage === "stage2")
    return (
      <RefinementFlow
        gateway={stage2Gateway}
        initialSession={stage2SeedRef.current}
        onSecondaryExit={() => {
          stage2SeedRef.current = undefined
          void enterStage1()
        }}
        onHandoff={handleHandoff}
        autoHandoff={!returningToRefinement}
        directEntry
      />
    )
  if (stage === "stage3" && !stage3Bootstrap) {
    if (stage3LoadState === "retry_stage3" || stage3LoadState === "reload_server_frontier") {
      return (
        <PlanStartRetryableError
          onRetry={() =>
            recoverPlanStartStage3Load(stage3LoadState, {
              retryStage3: () => void resumeStage3(),
              reloadServerFrontier: () => window.location.reload(),
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
        onProductKindsCorrection={handleProductKindsCorrection}
        onBackToRefinement={() => {
          setReturningToRefinement(true)
          setStage("stage2")
        }}
      />
    )
  if (!plan) {
    if (stage1LoadState === "error") {
      return <PlanStartRetryableError onRetry={() => void enterStage1()} />
    }
    return <PlanStartLoading />
  }

  return (
    <PlanStartFlow
      state="ready"
      plan={plan}
      refinementAvailable={
        initialJourney.stage === "stage3" || initialJourney.refinementAvailable !== false
      }
      onContinueToRefinement={() => setStage("stage2")}
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
type FlowStep = "basis" | "optional"

export function PlanStartFlow(
  props: PlanStartFlowProps & {
    onContinueToRefinement?: () => void
    refinementAvailable?: boolean
  },
) {
  const [step, setStep] = useState<FlowStep>("basis")
  const hasOptionalPage = props.state === "ready" && Boolean(props.plan.optional)
  const canRefine = props.refinementAvailable !== false

  const content = useMemo(() => {
    if (props.state !== "ready") return null
    if (step === "optional" && props.plan.optional) {
      return (
        <NeedPlanScreen
          screen={props.plan.optional}
          hasOptionalPage
          onBack={() => setStep("basis")}
          onNext={canRefine ? props.onContinueToRefinement : undefined}
        />
      )
    }
    return (
      <NeedPlanScreen
        screen={props.plan.basis}
        hasOptionalPage={hasOptionalPage}
        onNext={
          hasOptionalPage
            ? () => setStep("optional")
            : canRefine
              ? props.onContinueToRefinement
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

  return content
}

export function PlanStartLoading() {
  return (
    <StateShell
      stageLabel="Dein Plan"
      overline="Dein persönlicher Plan"
      title="Dein Bedarfsplan entsteht"
      lead="Wir bereiten die Empfehlungen aus deinem Quiz vor."
      icon={<Loader2 className="h-7 w-7 animate-spin" aria-hidden="true" />}
      dataState="loading"
    >
      <div className="mx-auto mt-4 w-full max-w-[270px]">
        <Progress value={50} label="Bedarfsplan wird vorbereitet" />
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
        Wir konnten deinen Bedarfsplan nicht abrufen. Versuche es gleich noch einmal.
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
