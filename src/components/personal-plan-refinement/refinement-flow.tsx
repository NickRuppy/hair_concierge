"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import {
  PersonalPlanJourneyHeader,
  PersonalPlanViewTransition,
  type PersonalPlanTransitionDirection,
} from "@/components/personal-plan-journey"
import { Button } from "@/components/ui/button"
import {
  Stage2RefinementError,
  type Stage2RefinementErrorCode,
  type Stage2RefinementGateway,
  type Stage2CompleteResult,
} from "@/lib/personal-plan/refinement/gateway"
import {
  saveStage2SessionAnswer,
  type Stage2RefinementSession,
} from "@/lib/personal-plan/refinement/session"
import type { Stage2QuestionId, Stage2StaticQuestionId } from "@/lib/personal-plan/refinement/types"

import { RefinementBridge } from "./refinement-bridge"
import {
  RefinementQuestion,
  getAnswerForQuestion,
  getQuestionFamily,
  getQuestionSection,
  journeySaveStatus,
  type RefinementQuestionStatus,
} from "./refinement-question"
import { REFINEMENT_TELEMETRY_EVENTS } from "./refinement-options"

export { REFINEMENT_TELEMETRY_EVENTS }

export type Stage2RefinementTelemetryEventName = (typeof REFINEMENT_TELEMETRY_EVENTS)[number]
export type Stage2RefinementTelemetryFamily =
  | "product_categories"
  | "wash_rhythm"
  | "conditional_context"
  | "oil_role"
  | "towel_handling"
  | "heat_behavior"
  | "detangling_behavior"
  | "night_behavior"
export type Stage2RefinementTelemetrySection = "current_products" | "hair_handling"

export type Stage2RefinementTelemetryEvent =
  | { name: "personal_plan_stage2_started" }
  | {
      name: "personal_plan_stage2_question_viewed"
      section: Stage2RefinementTelemetrySection
      family: Stage2RefinementTelemetryFamily
    }
  | {
      name: "personal_plan_stage2_answer_saved"
      family: Stage2RefinementTelemetryFamily
    }
  | {
      name: "personal_plan_stage2_save_failed"
      errorCode: Stage2RefinementErrorCode
    }
  | { name: "personal_plan_stage2_resumed" }
  | { name: "personal_plan_stage2_completed" }
  | { name: "personal_plan_stage2_bridge_viewed" }
  | { name: "personal_plan_stage2_handoff_failed" }

export type Stage2HandoffPayload = {
  handoff: Stage2CompleteResult
  session: Stage2RefinementSession
}

type RefinementMode = "loading" | "invitation" | "resume" | "question" | "bridge"

export function deriveRefinementEntryMode(
  session: Stage2RefinementSession,
  directEntry: boolean,
): Extract<RefinementMode, "invitation" | "resume" | "question" | "bridge"> {
  if (session.status === "complete") return "bridge"
  if (session.completedQuestionIds.length > 0) return "resume"
  return directEntry ? "question" : "invitation"
}

export function shouldReturnToStage1FromQuestion(input: {
  session: Stage2RefinementSession
  activeQuestionId: Stage2QuestionId
  directEntry: boolean
}): boolean {
  return (
    input.directEntry &&
    input.session.completedQuestionIds.length === 0 &&
    input.session.path.orderedQuestionIds.indexOf(input.activeQuestionId) === 0
  )
}

export function RefinementFlow({
  gateway,
  initialSession,
  onTelemetry,
  onSecondaryExit,
  onHandoff,
  autoHandoff = true,
  directEntry = false,
  stageEntrance = false,
}: {
  gateway: Stage2RefinementGateway
  initialSession?: Stage2RefinementSession
  onTelemetry?: (event: Stage2RefinementTelemetryEvent) => void
  onSecondaryExit?: () => void
  onHandoff?: (payload: Stage2HandoffPayload) => void | Promise<void>
  autoHandoff?: boolean
  directEntry?: boolean
  stageEntrance?: boolean
}) {
  const initialView = useMemo(
    () => initialRefinementView(initialSession, directEntry),
    [directEntry, initialSession],
  )
  const [session, setSession] = useState<Stage2RefinementSession | null>(
    initialView?.session ?? null,
  )
  const [activeQuestionId, setActiveQuestionId] = useState<Stage2QuestionId | null>(
    initialView?.activeQuestionId ?? null,
  )
  const activeQuestionIdRef = useRef<Stage2QuestionId | null>(initialView?.activeQuestionId ?? null)
  const [questionDirection, setQuestionDirection] =
    useState<PersonalPlanTransitionDirection>("forward")
  const [localAnswer, setLocalAnswer] = useState<unknown>(initialView?.localAnswer)
  const [status, setStatus] = useState<RefinementQuestionStatus>(initialView?.status ?? "idle")
  const [mode, setMode] = useState<RefinementMode>(initialView?.mode ?? "loading")
  const [liveMessage, setLiveMessage] = useState(initialView?.liveMessage ?? "")
  const [bridge, setBridge] = useState<Stage2CompleteResult | null>(initialView?.bridge ?? null)
  const [handoffStatus, setHandoffStatus] = useState<"idle" | "loading" | "error" | "complete">(
    "idle",
  )
  const generationRef = useRef(0)
  const saveGenerationRef = useRef(0)
  const telemetryRef = useRef(onTelemetry)

  useEffect(() => {
    telemetryRef.current = onTelemetry
  }, [onTelemetry])

  const emit = useCallback((event: Stage2RefinementTelemetryEvent) => {
    telemetryRef.current?.(event)
  }, [])

  const setActiveFromSession = useCallback(
    (
      nextSession: Stage2RefinementSession,
      nextQuestionId: Stage2QuestionId | null,
      options?: { liveMessage?: string; status?: RefinementQuestionStatus },
    ) => {
      const previousQuestionId = activeQuestionIdRef.current
      if (previousQuestionId && nextQuestionId && previousQuestionId !== nextQuestionId) {
        const previousIndex = nextSession.path.orderedQuestionIds.indexOf(previousQuestionId)
        const nextIndex = nextSession.path.orderedQuestionIds.indexOf(nextQuestionId)
        setQuestionDirection(
          previousIndex >= 0 && nextIndex >= 0 && nextIndex < previousIndex ? "reverse" : "forward",
        )
      }
      activeQuestionIdRef.current = nextQuestionId
      setSession(nextSession)
      setActiveQuestionId(nextQuestionId)
      setLocalAnswer(
        nextQuestionId ? getAnswerForQuestion(nextSession.answers, nextQuestionId) : undefined,
      )
      setStatus(options?.status ?? "idle")
      setLiveMessage(options?.liveMessage ?? "")
      if (nextQuestionId) {
        emit({
          name: "personal_plan_stage2_question_viewed",
          section: getQuestionSection(nextQuestionId),
          family: getQuestionFamily(nextQuestionId),
        })
      }
    },
    [emit],
  )

  useEffect(() => {
    if (initialSession) {
      if (initialSession.status === "complete") {
        emit({ name: "personal_plan_stage2_bridge_viewed" })
      }
      return
    }
    let cancelled = false
    const generation = generationRef.current + 1
    generationRef.current = generation

    gateway
      .load()
      .then(async (loadedSession) => {
        if (cancelled || generationRef.current !== generation) return
        if (loadedSession.status === "complete") {
          const handoff = getCompletedHandoffForLoadedSession(loadedSession)
          if (cancelled || generationRef.current !== generation) return
          setSession(loadedSession)
          setBridge(handoff)
          setMode("bridge")
          setStatus("idle")
          setLiveMessage("")
          emit({ name: "personal_plan_stage2_bridge_viewed" })
          return
        }

        const firstUnresolved = loadedSession.path.firstUnresolvedQuestionId
        if (!firstUnresolved) {
          const finalQuestionId = getBridgeBackQuestionId(loadedSession)
          setActiveFromSession(loadedSession, finalQuestionId, {
            liveMessage: "Deine Antworten sind gespeichert. Die Übergabe ist noch offen.",
            status: "completion_failed",
          })
          setMode("question")
          return
        }

        setActiveFromSession(loadedSession, firstUnresolved)

        const entryMode = deriveRefinementEntryMode(loadedSession, directEntry)
        if (loadedSession.completedQuestionIds.length === 0) {
          setMode(entryMode)
          emit({ name: "personal_plan_stage2_started" })
        } else {
          setMode(entryMode)
          emit({ name: "personal_plan_stage2_resumed" })
        }
      })
      .catch(() => {
        if (cancelled || generationRef.current !== generation) return
        setLiveMessage("Feinschliff konnte nicht geladen werden.")
        setMode("loading")
        setStatus("save_failed")
      })

    return () => {
      cancelled = true
    }
  }, [directEntry, emit, gateway, initialSession, setActiveFromSession])

  const begin = useCallback(() => {
    if (!session?.path.firstUnresolvedQuestionId) return
    const nextQuestionId = session.path.firstUnresolvedQuestionId
    setActiveFromSession(session, nextQuestionId)
    setMode("question")
  }, [session, setActiveFromSession])

  const handleBack = useCallback(() => {
    if (status === "saving") return
    if (!session || !activeQuestionId) return
    const currentIndex = session.path.orderedQuestionIds.indexOf(activeQuestionId)
    const previousQuestionId =
      currentIndex > 0 ? session.path.orderedQuestionIds[currentIndex - 1] : null
    if (!previousQuestionId) {
      if (shouldReturnToStage1FromQuestion({ session, activeQuestionId, directEntry })) {
        onSecondaryExit?.()
        return
      }
      setMode(session.completedQuestionIds.length > 0 ? "resume" : "invitation")
      return
    }
    setActiveFromSession(session, previousQuestionId)
    setMode("question")
  }, [activeQuestionId, directEntry, onSecondaryExit, session, setActiveFromSession, status])

  const handleBridgeBack = useCallback(() => {
    if (!session) return
    const finalQuestionId = getBridgeBackQuestionId(session)
    if (!finalQuestionId) return
    setActiveFromSession(session, finalQuestionId)
    setHandoffStatus("idle")
    setMode("question")
  }, [session, setActiveFromSession])

  const handleBridgeContinue = useCallback(async () => {
    if (!onHandoff || !session || !bridge || handoffStatus === "loading") return
    setHandoffStatus("loading")
    try {
      await onHandoff({ handoff: bridge, session })
      setHandoffStatus("complete")
    } catch {
      emit({ name: "personal_plan_stage2_handoff_failed" })
      setHandoffStatus("error")
    }
  }, [bridge, emit, handoffStatus, onHandoff, session])

  useEffect(() => {
    if (!autoHandoff || mode !== "bridge" || !bridge || !onHandoff || handoffStatus !== "idle")
      return
    const timer = window.setTimeout(() => void handleBridgeContinue(), 0)
    return () => window.clearTimeout(timer)
  }, [autoHandoff, bridge, handleBridgeContinue, handoffStatus, mode, onHandoff])

  const showCompletedStage2Session = useCallback(
    (nextSession: Stage2RefinementSession, handoff: Stage2CompleteResult) => {
      const completedSession: Stage2RefinementSession = {
        ...nextSession,
        status: "complete",
        completedHandoff: handoff,
      }
      setSession(completedSession)
      setBridge(handoff)
      setMode("bridge")
      setStatus("saved")
      setLiveMessage("Feinschliff gespeichert.")
      emit({ name: "personal_plan_stage2_completed" })
      emit({ name: "personal_plan_stage2_bridge_viewed" })
    },
    [emit],
  )

  const completeStage2Session = useCallback(
    async (nextSession: Stage2RefinementSession) => {
      setSession(nextSession)
      try {
        const handoff = await gateway.complete({ expectedRevision: nextSession.revision })
        showCompletedStage2Session(nextSession, handoff)
      } catch (error) {
        const code = error instanceof Stage2RefinementError ? error.code : "completion_failed"
        emit({ name: "personal_plan_stage2_save_failed", errorCode: code })
        setBridge(null)
        setActiveFromSession(nextSession, getBridgeBackQuestionId(nextSession), {
          liveMessage:
            "Antwort gespeichert. Die Übergabe ist fehlgeschlagen und kann direkt wiederholt werden.",
          status: "completion_failed",
        })
        setMode("question")
      }
    },
    [emit, gateway, setActiveFromSession, showCompletedStage2Session],
  )

  const handleSubmit = useCallback(async () => {
    if (!session || !activeQuestionId) return
    if (status === "saving") return
    if (status === "completion_failed" && session.path.firstUnresolvedQuestionId === null) {
      setStatus("saving")
      setLiveMessage("Übergabe wird erneut versucht.")
      await completeStage2Session(session)
      return
    }
    const editedCompletedQuestion = session.completedQuestionIds.includes(activeQuestionId)
    const submittedSession = session
    const submittedQuestionId = activeQuestionId
    const submittedAnswer = localAnswer
    const saveGeneration = saveGenerationRef.current + 1
    saveGenerationRef.current = saveGeneration
    setStatus("saving")
    setLiveMessage("Antwort wird gespeichert.")
    try {
      const locallyAdvanced = saveStage2SessionAnswer(submittedSession, {
        questionId: submittedQuestionId,
        answer: submittedAnswer,
      })
      const willCompletePage =
        chooseNextQuestion(locallyAdvanced, submittedQuestionId, editedCompletedQuestion) === null
      const optimisticNextQuestionId = chooseNextQuestion(
        locallyAdvanced,
        submittedQuestionId,
        editedCompletedQuestion,
      )
      if (!willCompletePage && optimisticNextQuestionId) {
        setActiveFromSession(locallyAdvanced, optimisticNextQuestionId, {
          liveMessage: "Antwort wird gespeichert. Nächste Frage geladen.",
          status: "saving",
        })
        setMode("question")
      }
      const saveAnswerAndComplete = gateway.saveAnswerAndComplete?.bind(gateway)
      if (willCompletePage && saveAnswerAndComplete) {
        const result = await saveAnswerAndComplete({
          questionId: submittedQuestionId,
          answer: submittedAnswer,
          expectedRevision: submittedSession.revision,
        })
        if (saveGenerationRef.current !== saveGeneration) return
        emit({
          name: "personal_plan_stage2_answer_saved",
          family: getQuestionFamily(submittedQuestionId),
        })
        showCompletedStage2Session(result.session, result.handoff)
        return
      }
      const nextSession = await gateway.saveAnswer({
        questionId: submittedQuestionId,
        answer: submittedAnswer,
        expectedRevision: submittedSession.revision,
      })
      if (saveGenerationRef.current !== saveGeneration) return
      emit({
        name: "personal_plan_stage2_answer_saved",
        family: getQuestionFamily(submittedQuestionId),
      })

      const nextQuestionId = chooseNextQuestion(
        nextSession,
        submittedQuestionId,
        editedCompletedQuestion,
      )
      if (!nextQuestionId) {
        setSession(nextSession)
        await completeStage2Session(nextSession)
        return
      }
      setSession(nextSession)
      if (nextQuestionId !== optimisticNextQuestionId) {
        setActiveFromSession(nextSession, nextQuestionId, {
          liveMessage: "Antwort gespeichert. Nächste Frage geladen.",
          status: "saved",
        })
      } else {
        setStatus("saved")
        setLiveMessage("Antwort gespeichert.")
      }
      setMode("question")
    } catch (error) {
      if (saveGenerationRef.current !== saveGeneration) return
      if (error instanceof Stage2RefinementError && error.savedSession) {
        emit({
          name: "personal_plan_stage2_answer_saved",
          family: getQuestionFamily(submittedQuestionId),
        })
        emit({ name: "personal_plan_stage2_save_failed", errorCode: error.code })
        setBridge(null)
        setActiveFromSession(error.savedSession, getBridgeBackQuestionId(error.savedSession), {
          liveMessage:
            "Antwort gespeichert. Die Übergabe ist fehlgeschlagen und kann direkt wiederholt werden.",
          status: "completion_failed",
        })
        setMode("question")
        return
      }
      if (error instanceof Stage2RefinementError && error.code === "revision_conflict") {
        emit({ name: "personal_plan_stage2_save_failed", errorCode: "revision_conflict" })
        try {
          const loaded = await gateway.load()
          if (loaded.status === "complete") {
            const handoff = getCompletedHandoffForLoadedSession(loaded)
            setSession(loaded)
            setBridge(handoff)
            setMode("bridge")
            setStatus("idle")
            setLiveMessage("")
            emit({ name: "personal_plan_stage2_bridge_viewed" })
            return
          }
          const nextQuestionId = loaded.path.firstUnresolvedQuestionId
          if (!nextQuestionId) {
            setActiveFromSession(loaded, getBridgeBackQuestionId(loaded), {
              liveMessage: "Deine Antworten sind gespeichert. Die Übergabe ist noch offen.",
              status: "completion_failed",
            })
            setMode("question")
            return
          }
          setActiveFromSession(loaded, nextQuestionId, {
            liveMessage: "Neuer Fortschritt wurde geladen.",
            status: "revision_conflict",
          })
          setMode("question")
          return
        } catch {
          setStatus("save_failed")
          setLiveMessage("Speichern fehlgeschlagen. Der neuere Stand konnte nicht geladen werden.")
          setMode("question")
          return
        }
      }
      const code = error instanceof Stage2RefinementError ? error.code : "save_failed"
      emit({ name: "personal_plan_stage2_save_failed", errorCode: code })
      setSession(submittedSession)
      activeQuestionIdRef.current = submittedQuestionId
      setQuestionDirection("reverse")
      setActiveQuestionId(submittedQuestionId)
      setLocalAnswer(submittedAnswer)
      setStatus("save_failed")
      setLiveMessage("Speichern fehlgeschlagen.")
      setMode("question")
    }
  }, [
    activeQuestionId,
    completeStage2Session,
    emit,
    gateway,
    localAnswer,
    session,
    setActiveFromSession,
    showCompletedStage2Session,
    status,
  ])

  const handleLocalAnswer = useCallback(
    (answer: unknown, announcement?: string) => {
      setLocalAnswer(answer)
      if (announcement) setLiveMessage(announcement)
      if (
        status === "save_failed" ||
        status === "completion_failed" ||
        status === "revision_conflict"
      ) {
        setStatus("idle")
      }
    },
    [status],
  )

  const content = useMemo(() => {
    if (mode === "loading") return <LoadingShell status={status} liveMessage={liveMessage} />
    if (mode === "bridge" && bridge) {
      return (
        <RefinementBridge
          refinedVersionId={bridge.refinedVersionId}
          nextHref={bridge.nextHref}
          onBack={getBridgeBackQuestionId(session) ? handleBridgeBack : undefined}
          onContinue={onHandoff ? handleBridgeContinue : undefined}
          isContinuing={handoffStatus === "loading"}
          continueError={
            handoffStatus === "error"
              ? "Deine Produkte konnten nicht vorbereitet werden. Versuche es noch einmal."
              : undefined
          }
        />
      )
    }
    if (!session || !activeQuestionId)
      return <LoadingShell status={status} liveMessage={liveMessage} />
    if (mode === "invitation") {
      return <InvitationShell onBegin={begin} onSecondaryExit={onSecondaryExit} />
    }
    if (mode === "resume") {
      return (
        <ResumeShell
          firstUnresolvedQuestionLabel={labelForQuestion(activeQuestionId)}
          onBegin={begin}
        />
      )
    }
    const canGoBack = session.path.orderedQuestionIds.indexOf(activeQuestionId) > 0
    return (
      <div className="min-h-dvh bg-[var(--background)] text-[var(--text-body)]">
        <PersonalPlanJourneyHeader
          currentStage={2}
          saveStatus={journeySaveStatus(status)}
          onBack={canGoBack ? handleBack : onSecondaryExit}
        />
        <div className={stageEntrance ? "personal-plan-stage-target-enter" : undefined}>
          <PersonalPlanViewTransition
            viewKey={activeQuestionId}
            direction={questionDirection}
            variant="depth"
            focusOnInitialMount
          >
            <RefinementQuestion
              session={session}
              questionId={activeQuestionId}
              localAnswer={localAnswer}
              onLocalAnswerChange={handleLocalAnswer}
              status={status}
              liveMessage={liveMessage}
              canGoBack={canGoBack}
              onBack={handleBack}
              onSubmit={handleSubmit}
              onSecondaryExit={onSecondaryExit ?? (() => {})}
              showJourneyHeader={false}
              focusOnQuestionChange={false}
            />
          </PersonalPlanViewTransition>
        </div>
      </div>
    )
  }, [
    activeQuestionId,
    begin,
    bridge,
    handleBack,
    handleBridgeBack,
    handleBridgeContinue,
    handleLocalAnswer,
    handleSubmit,
    liveMessage,
    localAnswer,
    mode,
    handoffStatus,
    onHandoff,
    onSecondaryExit,
    questionDirection,
    session,
    stageEntrance,
    status,
  ])

  return content
}

export function getBridgeBackQuestionId(
  session: Stage2RefinementSession | null,
): Stage2QuestionId | null {
  if (!session) return null
  return session.path.orderedQuestionIds.at(-1) ?? null
}

export function getCompletedHandoffForLoadedSession(
  session: Stage2RefinementSession,
): Stage2CompleteResult {
  if (session.status !== "complete" || !session.completedHandoff) {
    throw new Stage2RefinementError(
      "incomplete_refinement",
      "A loaded complete refinement session must carry its completed handoff",
    )
  }
  return session.completedHandoff
}

function chooseNextQuestion(
  session: Stage2RefinementSession,
  savedQuestionId: Stage2QuestionId,
  editedCompletedQuestion: boolean,
): Stage2QuestionId | null {
  if (editedCompletedQuestion) {
    const index = session.path.orderedQuestionIds.indexOf(savedQuestionId)
    if (index >= 0) return session.path.orderedQuestionIds[index + 1] ?? null
  }
  return session.path.firstUnresolvedQuestionId
}

function LoadingShell({
  status,
  liveMessage,
}: {
  status: RefinementQuestionStatus
  liveMessage: string
}) {
  return (
    <div className="min-h-dvh bg-[var(--background)]">
      <PersonalPlanJourneyHeader currentStage={2} saveStatus={journeySaveStatus(status)} />
      <main className="grid min-h-[calc(100dvh-92px)] place-items-center px-5 text-center">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--brand-plum)]">
            Feinschliff
          </p>
          <h1 className="mt-2 font-serif text-3xl font-medium text-[var(--brand-plum-darkest,#2a1845)]">
            Wir laden deinen Stand.
          </h1>
          {status === "save_failed" ? (
            <p role="alert" className="mt-3 text-sm text-[#a3434b]">
              Das hat gerade nicht geklappt. Bitte lade die Vorschau neu.
            </p>
          ) : null}
          <p aria-live="polite" className="sr-only">
            {liveMessage}
          </p>
        </div>
      </main>
    </div>
  )
}

function InvitationShell({
  onBegin,
  onSecondaryExit,
}: {
  onBegin: () => void
  onSecondaryExit?: () => void
}) {
  return (
    <div className="min-h-dvh bg-[var(--background)]">
      <PersonalPlanJourneyHeader currentStage={2} onBack={onSecondaryExit} />
      <main className="mx-auto flex min-h-[calc(100dvh-92px)] w-full max-w-[600px] flex-col justify-center px-5 py-8">
        <section className="rounded-[22px] border border-[rgba(var(--brand-plum-rgb),0.14)] bg-gradient-to-br from-[#f3edf8] to-[#fff8f3] px-5 py-7 text-center">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--brand-plum)]">
            Dein Idealplan steht
          </p>
          <h1 className="mt-2 font-serif text-[30px] font-medium leading-tight tracking-normal text-[var(--brand-plum-darkest,#2a1845)]">
            Jetzt machen wir ihn zu deinem.
          </h1>
          <p className="mx-auto mt-3 max-w-[360px] text-sm leading-6 text-[var(--text-sub,#6a6560)]">
            Ein kurzer Fragenfluss klärt, was du heute benutzt und wie du dein Haar behandelst.
            Danach geht es direkt zur Produkterfassung.
          </p>
        </section>
        <p className="mt-4 rounded-xl bg-[#f5f2ee] px-3 py-2.5 text-xs leading-5 text-[var(--text-sub,#6a6560)]">
          <span className="font-bold text-[#4f8058]">✓</span> Dein erster Idealplan bleibt
          gespeichert. Danach führen wir dich direkt zu deinen konkreten Produkten.
        </p>
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onSecondaryExit}
            className="min-h-[52px] rounded-xl px-3 text-sm font-bold text-[var(--brand-plum)] hover:bg-[var(--brand-plum-ice)]"
          >
            Zum Idealplan
          </button>
          <Button type="button" onClick={onBegin} variant="funnelCta" className="flex-1">
            Feinschliff starten&nbsp; →
          </Button>
        </div>
      </main>
    </div>
  )
}

function ResumeShell({
  firstUnresolvedQuestionLabel,
  onBegin,
}: {
  firstUnresolvedQuestionLabel: string
  onBegin: () => void
}) {
  return (
    <div className="min-h-dvh bg-[var(--background)]">
      <PersonalPlanJourneyHeader currentStage={2} saveStatus="saved" />
      <main className="mx-auto flex min-h-[calc(100dvh-92px)] w-full max-w-[600px] flex-col justify-center px-5 py-8">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--brand-plum)]">
          Wir laden deinen Feinschliff.
        </p>
        <h1 className="mt-2 font-serif text-[30px] font-medium leading-tight tracking-normal text-[var(--brand-plum-darkest,#2a1845)]">
          Du machst bei der ersten offenen Frage weiter.
        </h1>
        <div className="mt-5 rounded-[18px] border border-[rgba(var(--brand-plum-rgb),0.13)] bg-white p-4 shadow-[0_14px_40px_-34px_rgba(42,24,69,0.65)]">
          <p className="text-xs font-bold text-[var(--brand-plum-darkest,#2a1845)]">Noch offen</p>
          <p className="mt-1 text-sm text-[var(--text-sub,#6a6560)]">
            {firstUnresolvedQuestionLabel}
          </p>
        </div>
        <p className="mt-4 rounded-xl bg-[#f5f2ee] px-3 py-2.5 text-xs leading-5 text-[var(--text-sub,#6a6560)]">
          <span className="font-bold text-[#4f8058]">✓</span> Bis zur vorherigen Frage ist alles
          gespeichert.
        </p>
        <Button type="button" onClick={onBegin} variant="funnelCta" className="mt-6">
          Bei der offenen Frage fortfahren&nbsp; →
        </Button>
      </main>
    </div>
  )
}

type InitialRefinementView = {
  session: Stage2RefinementSession
  activeQuestionId: Stage2QuestionId | null
  localAnswer: unknown
  status: RefinementQuestionStatus
  mode: "invitation" | "resume" | "question" | "bridge"
  liveMessage: string
  bridge: Stage2CompleteResult | null
}

function initialRefinementView(
  session: Stage2RefinementSession | undefined,
  directEntry: boolean,
): InitialRefinementView | null {
  if (!session) return null
  if (session.status === "complete") {
    return {
      session,
      activeQuestionId: null,
      localAnswer: undefined,
      status: "idle",
      mode: "bridge",
      liveMessage: "",
      bridge: getCompletedHandoffForLoadedSession(session),
    }
  }
  const firstUnresolvedQuestionId = session.path.firstUnresolvedQuestionId
  if (!firstUnresolvedQuestionId) {
    const finalQuestionId = getBridgeBackQuestionId(session)
    return {
      session,
      activeQuestionId: finalQuestionId,
      localAnswer: finalQuestionId
        ? getAnswerForQuestion(session.answers, finalQuestionId)
        : undefined,
      status: "completion_failed",
      mode: "question",
      liveMessage: "Deine Antworten sind gespeichert. Die Übergabe ist noch offen.",
      bridge: null,
    }
  }
  return {
    session,
    activeQuestionId: firstUnresolvedQuestionId,
    localAnswer: getAnswerForQuestion(session.answers, firstUnresolvedQuestionId),
    status: "idle",
    mode: deriveRefinementEntryMode(session, directEntry),
    liveMessage: "",
    bridge: null,
  }
}

function labelForQuestion(questionId: Stage2QuestionId): string {
  if (questionId.startsWith("heat:")) return "Häufigkeit und Hitzeschutz"
  const labels = {
    current_product_categories: "Aktuelle Produktarten",
    wet_wash_frequency: "Nasswasch-Rhythmus",
    scalp_irritation_detail: "Kopfhaut-Klärung",
    dry_shampoo_bridge_preference: "Trockenshampoo zwischen den Wäschen",
    dry_shampoo_visible_hair_color: "Sichtbare Ansatzfarbe",
    oil_purposes: "Öl-Aufgaben",
    towel_handling: "Handtuch",
    drying_routes: "Trocknungswege",
    additional_heat_tools: "Zusätzliche Hitze-Tools",
    night_protection: "Nachtschutz",
  } as const satisfies Record<Exclude<Stage2QuestionId, `heat:${string}`>, string>
  return labels[questionId as Stage2StaticQuestionId]
}
