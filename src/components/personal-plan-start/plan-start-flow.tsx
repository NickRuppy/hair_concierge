"use client"

import Link from "next/link"
import { Check, ChevronLeft, ChevronRight, Info, Loader2, RotateCcw } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"

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
}: {
  initialJourney?: PlanStartInitialJourney
  initialPlan?: PlanStartReadyViewModel
}) {
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
    if (!shouldRequestPlanStartOnMount(initialPlan)) return
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
  }, [initialPlan])

  if (state.state === "retryable_error")
    return <PlanStartRetryableError onRetry={() => void load(true)} />
  if (state.state !== "ready" || !state.plan.personalPlanId) return <PlanStartFlow {...state} />
  return <PlanStartCustomerJourney plan={state.plan} initialJourney={initialJourney} />
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
  plan,
  initialJourney,
}: {
  plan: PlanStartReadyViewModel
  initialJourney: PlanStartInitialJourney
}) {
  const [stage, setStage] = useState<"stage1" | "stage2" | "stage3">(() => initialJourney.stage)
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
      if (!plan.personalPlanId) throw new Error("stage3_plan_unavailable")
      return loadPlanStartStage3Bootstrap({
        gateway: stage3Gateway,
        personalPlanId: plan.personalPlanId,
        refinedVersionId,
      })
    },
    [plan.personalPlanId, stage3Gateway],
  )
  const handleHandoff = useCallback(
    async ({ handoff }: Stage2HandoffPayload) => {
      setStage3Bootstrap(await loadStage3Bootstrap(handoff.refinedVersionId))
      setStage3LoadState("idle")
      setReturningToRefinement(false)
      setStage("stage3")
    },
    [loadStage3Bootstrap],
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

  if (stage === "stage2")
    return (
      <RefinementFlow
        gateway={stage2Gateway}
        onSecondaryExit={() => setStage("stage1")}
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
        entryContext={stage3Bootstrap.entryContext}
        bootstrap={stage3Bootstrap}
        draftId="client-derived"
        userId="client-derived"
        gateway={stage3Gateway}
        intakeClient={intakeClient}
        onBackToRefinement={() => {
          setReturningToRefinement(true)
          setStage("stage2")
        }}
      />
    )
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

export function PlanStartTransition({
  onBack,
  onContinue,
}: {
  onBack: () => void
  onContinue?: () => void
}) {
  return (
    <section className="flex min-h-dvh flex-col bg-[#fdfbf9]" data-plan-start-screen="transition">
      <PlanStartHeader stageLabel="Nächster Schritt" />
      <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-3 pb-24 pt-3 sm:max-w-[560px] sm:px-5">
        <Progress value={100} label="Bedarfsplan abgeschlossen" />
        <section className="mt-7 rounded-[22px] border border-[rgba(107,80,160,0.13)] bg-[#f4edf8] px-4 py-6 text-center">
          <div className="mx-auto mb-4 grid h-[54px] w-[54px] place-items-center rounded-[18px] bg-white text-[#6B50A0] shadow-[0_8px_20px_rgba(59,38,80,0.10)]">
            <Check className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#6e6863]">
            Deine Grundlage steht
          </div>
          <h1 className="font-header mt-2 text-[26px] leading-tight text-[#291a43]">
            Jetzt machen wir sie zu deiner.
          </h1>
          <p className="mx-auto mt-2 max-w-[270px] text-[11.5px] leading-relaxed text-[#625d58]">
            Als Nächstes verfeinern wir deinen Plan mit ein paar gezielten Fragen.
          </p>
        </section>
      </main>
      <nav
        aria-label="Nächster Schritt"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-[#ece6df] bg-[#fdfbf9]/95 px-3 py-2.5 backdrop-blur"
      >
        <div className="mx-auto flex max-w-[430px] items-center gap-2 sm:max-w-[560px]">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-11 items-center gap-1 rounded-[12px] px-3 text-[11px] font-extrabold text-[#6B50A0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Zum Plan
          </button>
          <button
            type="button"
            disabled={!onContinue}
            onClick={onContinue}
            className="personal-plan-primary-action ml-auto inline-flex min-h-11 items-center gap-1 px-4 text-[11px]"
          >
            Plan verfeinern
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </nav>
    </section>
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
