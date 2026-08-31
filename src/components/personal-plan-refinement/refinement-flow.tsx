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
  type Stage2ModuleCompletionResult,
} from "@/lib/personal-plan/refinement/gateway"
import {
  deriveStage2EntryMode,
  hostSessionFor,
  resolveStage2EntryModule,
  resolveStage2FlowEntryView,
  resolveStage2ModuleScope,
  scopeStage2SessionToModule,
  type Stage2ModuleEntryRequest,
  type Stage2ModuleScope,
} from "@/lib/personal-plan/refinement/module-scope"
import {
  saveStage2SessionAnswer,
  type Stage2RefinementSession,
} from "@/lib/personal-plan/refinement/session"
import type { Stage2Module, Stage2QuestionId } from "@/lib/personal-plan/refinement/types"

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
  | { name: "personal_plan_stage2_module_completed"; module: Stage2Module }

export type Stage2HandoffPayload = {
  handoff: Stage2CompleteResult
  session: Stage2RefinementSession
}

/**
 * A module finished WITHOUT handing the user into Stage 3 — today only
 * "habits before products". The flow emits; the host routes (back to
 * `/routine`). No toast UI here (Task 2.6 owns it).
 */
export type Stage2ModuleCompletionPayload = {
  moduleCompletion: Stage2ModuleCompletionResult
  session: Stage2RefinementSession
}

type RefinementMode = "loading" | "entry_error" | "question" | "bridge"

/**
 * The coarse "X von 4" the Routine banner shows, carried into the module flow
 * so the two surfaces cannot disagree (field test 26.08.2026). It is a SERVER
 * value (`refinement-status`, provenance-based) handed down by the host, never
 * re-derived here: the client session carries no answer provenance, so a
 * client-side count would read the direct-accept cohort's assumed answers as
 * finished modules. Static for the life of the module — the meter only moves
 * when a module is finished, and that navigates away.
 */
export type Stage2ModuleProgress = {
  completedSteps: number
  totalSteps: number
}

/**
 * Whether the Stage-3 bridge hands off on its own instead of waiting for a tap.
 *
 * `autoHandoff` is the creation funnel's rule (the host turns it off for an
 * explicit `?refine=…` re-entry so a completed draft cannot bounce the user
 * straight back into Stage 3). An EXPLICIT module entry overrides it: there the
 * bridge can only ever be armed by a module the user just finished in this
 * session, and finishing a module in the post-accept loop is a surface hop, not
 * a chapter to confirm (field test 26.08.2026).
 */
export function stage2BridgeAutoContinues(input: {
  autoHandoff: boolean
  explicitModuleEntry: boolean
}): boolean {
  return input.autoHandoff || input.explicitModuleEntry
}

function stage2BridgeMarkerProps(handoff: Stage2CompleteResult) {
  return {
    "data-refined-version-id": handoff.refinedVersionId,
    "data-stage2-next-href": handoff.nextHref,
  }
}

export function deriveRefinementEntryMode(
  session: Stage2RefinementSession,
): Extract<RefinementMode, "question" | "bridge"> {
  return deriveStage2EntryMode(session)
}

/**
 * Back off the first question with nothing answered leaves the flow — there is
 * no invitation chapter to fall back to any more (relic removal 28.08.2026).
 */
export function shouldReturnToStage1FromQuestion(input: {
  session: Stage2RefinementSession
  activeQuestionId: Stage2QuestionId
}): boolean {
  return (
    input.session.path.completedQuestionIds.length === 0 &&
    input.session.path.orderedQuestionIds.indexOf(input.activeQuestionId) === 0
  )
}

export function RefinementFlow({
  gateway,
  initialSession,
  onTelemetry,
  onSecondaryExit,
  onHandoff,
  onModuleComplete,
  autoHandoff = true,
  stageEntrance = false,
  moduleEntry,
  moduleProgress,
}: {
  gateway: Stage2RefinementGateway
  initialSession?: Stage2RefinementSession
  onTelemetry?: (event: Stage2RefinementTelemetryEvent) => void
  onSecondaryExit?: () => void
  onHandoff?: (payload: Stage2HandoffPayload) => void | Promise<void>
  onModuleComplete?: (payload: Stage2ModuleCompletionPayload) => void | Promise<void>
  autoHandoff?: boolean
  stageEntrance?: boolean
  /**
   * Module-scoped entry. `products` / `habits` walk only that module;
   * `first_open` (the plain `?refine=1` re-entry) resolves against the loaded
   * session to its first open module (first module when nothing is open).
   */
  moduleEntry?: Stage2ModuleEntryRequest
  /** The banner's own "X von 4", shown as slim chrome above module questions. */
  moduleProgress?: Stage2ModuleProgress | null
}) {
  /**
   * Any module entry request (Routine banner, Profil row, escape hatch, or the
   * `?refine=1` nudge) is an explicit module run. Purely prop-derived, so it
   * is stable from the first render.
   */
  const explicitModuleEntry = moduleEntry != null
  const initialModule = useMemo(
    () => (initialSession ? resolveStage2EntryModule(initialSession, moduleEntry ?? null) : null),
    [initialSession, moduleEntry],
  )
  // The module is chosen once, at entry. Finishing it must not silently
  // re-scope the running flow onto the other module.
  const moduleRef = useRef<Stage2Module | null>(initialModule)
  const moduleScopeRef = useRef<Stage2ModuleScope>(
    resolveStage2ModuleScope(moduleEntry, initialModule),
  )
  /**
   * The latest UNSCOPED session. State holds the module-scoped view, but the
   * host must always receive the full path (see `hostSessionFor`).
   */
  const unscopedSessionRef = useRef<Stage2RefinementSession | null>(initialSession ?? null)
  const trackSession = useCallback((session: Stage2RefinementSession) => {
    unscopedSessionRef.current = session
    return scopeStage2SessionToModule(session, moduleRef.current)
  }, [])
  const shouldPrepareInitialModuleEntry =
    explicitModuleEntry && Boolean(gateway.openOptionalRefinement)
  const initialView = useMemo(
    () =>
      shouldPrepareInitialModuleEntry
        ? null
        : initialRefinementView(
            initialSession ? scopeStage2SessionToModule(initialSession, initialModule) : undefined,
            resolveStage2ModuleScope(moduleEntry, initialModule),
          ),
    [initialModule, initialSession, moduleEntry, shouldPrepareInitialModuleEntry],
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
  const [entryRetryNonce, setEntryRetryNonce] = useState(0)
  const handoffInFlightRef = useRef(false)
  const bridgeCancelledRef = useRef(false)
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
    let cancelled = false
    const generation = generationRef.current + 1
    generationRef.current = generation

    const openEntry = async () => {
      try {
        const rawSession = initialSession ?? (await gateway.load())
        if (cancelled || generationRef.current !== generation) return

        const resolvedModule = resolveStage2EntryModule(rawSession, moduleEntry ?? null)
        moduleRef.current = resolvedModule
        moduleScopeRef.current = resolveStage2ModuleScope(moduleEntry, resolvedModule)

        let rawEntrySession = rawSession
        const openOptionalRefinement = gateway.openOptionalRefinement?.bind(gateway)
        if (moduleScopeRef.current === "explicit" && resolvedModule && openOptionalRefinement) {
          setMode("loading")
          setStatus("idle")
          setLiveMessage("Gespeicherte Angaben werden vorbereitet.")
          rawEntrySession = await openOptionalRefinement(resolvedModule)
          if (cancelled || generationRef.current !== generation) return
        }

        const loadedSession = trackSession(rawEntrySession)
        const entry = resolveStage2FlowEntryView({
          session: loadedSession,
          moduleScope: moduleScopeRef.current,
        })
        if (entry.bridge) {
          const handoff = getCompletedHandoffForLoadedSession(loadedSession)
          if (cancelled || generationRef.current !== generation) return
          setSession(loadedSession)
          setBridge(handoff)
          setMode("bridge")
          setStatus("idle")
          setLiveMessage("")
          setHandoffStatus("idle")
          handoffInFlightRef.current = false
          bridgeCancelledRef.current = false
          emit({ name: "personal_plan_stage2_bridge_viewed" })
          return
        }

        setActiveFromSession(loadedSession, entry.activeQuestionId, {
          liveMessage: entry.liveMessage,
          status: entry.status,
        })
        setMode(entry.mode)
        if (entry.status === "completion_failed") return
        emit({
          name:
            loadedSession.path.completedQuestionIds.length === 0
              ? "personal_plan_stage2_started"
              : "personal_plan_stage2_resumed",
        })
      } catch {
        if (cancelled || generationRef.current !== generation) return
        setLiveMessage("Feinschliff konnte nicht vorbereitet werden.")
        setMode("entry_error")
        setStatus("save_failed")
      }
    }

    void openEntry()

    return () => {
      cancelled = true
    }
  }, [
    emit,
    entryRetryNonce,
    gateway,
    initialSession,
    moduleEntry,
    setActiveFromSession,
    trackSession,
  ])

  const handleBack = useCallback(() => {
    if (status === "saving") return
    if (!session || !activeQuestionId) return
    const currentIndex = session.path.orderedQuestionIds.indexOf(activeQuestionId)
    const previousQuestionId =
      currentIndex > 0 ? session.path.orderedQuestionIds[currentIndex - 1] : null
    if (!previousQuestionId) {
      // Back off the first question of a module entry leaves the module
      // (→ /routine). It must never reveal the funnel's resume chapter, which
      // the post-accept loop has no place for (26.08.2026).
      if (explicitModuleEntry || shouldReturnToStage1FromQuestion({ session, activeQuestionId })) {
        onSecondaryExit?.()
        return
      }
      onSecondaryExit?.()
      return
    }
    setActiveFromSession(session, previousQuestionId)
    setMode("question")
  }, [
    activeQuestionId,
    explicitModuleEntry,
    onSecondaryExit,
    session,
    setActiveFromSession,
    status,
  ])

  const handleBridgeBack = useCallback(() => {
    if (!session || handoffStatus === "loading") return
    const finalQuestionId = getBridgeBackQuestionId(session)
    if (!finalQuestionId) return
    bridgeCancelledRef.current = true
    handoffInFlightRef.current = false
    setActiveFromSession(session, finalQuestionId)
    setHandoffStatus("idle")
    setMode("question")
  }, [handoffStatus, session, setActiveFromSession])

  const handleBridgeContinue = useCallback(async () => {
    if (
      !onHandoff ||
      !session ||
      !bridge ||
      handoffStatus === "loading" ||
      handoffStatus === "complete" ||
      handoffInFlightRef.current ||
      bridgeCancelledRef.current
    ) {
      return
    }
    handoffInFlightRef.current = true
    setHandoffStatus("loading")
    try {
      await onHandoff({
        handoff: bridge,
        session: hostSessionFor(unscopedSessionRef.current, session),
      })
      if (bridgeCancelledRef.current) return
      setHandoffStatus("complete")
    } catch {
      handoffInFlightRef.current = false
      emit({ name: "personal_plan_stage2_handoff_failed" })
      setHandoffStatus("error")
    }
  }, [bridge, emit, handoffStatus, onHandoff, session])

  useEffect(() => {
    if (mode !== "bridge" || !bridge || !onHandoff || handoffStatus !== "idle") return
    if (!stage2BridgeAutoContinues({ autoHandoff, explicitModuleEntry })) return
    const timer = window.setTimeout(() => void handleBridgeContinue(), 0)
    return () => window.clearTimeout(timer)
  }, [
    autoHandoff,
    bridge,
    explicitModuleEntry,
    handleBridgeContinue,
    handoffStatus,
    mode,
    onHandoff,
  ])

  const showCompletedStage2Session = useCallback(
    (nextSession: Stage2RefinementSession, handoff: Stage2CompleteResult) => {
      const completedSession: Stage2RefinementSession = {
        ...nextSession,
        status: "complete",
        completedHandoff: handoff,
      }
      // Keep the host-facing session in lockstep, but on the FULL path.
      unscopedSessionRef.current = {
        ...(unscopedSessionRef.current ?? nextSession),
        status: "complete",
        completedHandoff: handoff,
      }
      setSession(completedSession)
      setBridge(handoff)
      setMode("bridge")
      setHandoffStatus("idle")
      handoffInFlightRef.current = false
      bridgeCancelledRef.current = false
      setStatus("saved")
      setLiveMessage("Feinschliff gespeichert.")
      emit({ name: "personal_plan_stage2_completed" })
      emit({ name: "personal_plan_stage2_bridge_viewed" })
    },
    [emit],
  )

  const showCompletionFailure = useCallback(
    (nextSession: Stage2RefinementSession, error: unknown) => {
      const code = error instanceof Stage2RefinementError ? error.code : "completion_failed"
      emit({ name: "personal_plan_stage2_save_failed", errorCode: code })
      setBridge(null)
      setActiveFromSession(nextSession, getBridgeBackQuestionId(nextSession), {
        liveMessage: completionFailureMessage(code),
        status: code === "incomplete_refinement" ? "stale_refinement" : "completion_failed",
      })
      setMode("question")
    },
    [emit, setActiveFromSession],
  )

  const completeStage2Session = useCallback(
    async (nextSession: Stage2RefinementSession) => {
      setSession(nextSession)
      try {
        const handoff = await gateway.complete({ expectedRevision: nextSession.revision })
        showCompletedStage2Session(nextSession, handoff)
      } catch (error) {
        showCompletionFailure(nextSession, error)
      }
    },
    [gateway, showCompletedStage2Session, showCompletionFailure],
  )

  const applyModuleCompletion = useCallback(
    async (nextSession: Stage2RefinementSession, moduleCompletion: Stage2ModuleCompletionResult) =>
      applyStage2ModuleCompletion(
        {
          session: nextSession,
          hostSession: hostSessionFor(unscopedSessionRef.current, nextSession),
          moduleCompletion,
        },
        {
          emit,
          showCompletedSession: showCompletedStage2Session,
          showStage3Bridge: (bridgeSession, handoff) => {
            setSession(bridgeSession)
            setBridge(handoff)
            setMode("bridge")
            setHandoffStatus("idle")
            handoffInFlightRef.current = false
            bridgeCancelledRef.current = false
            setStatus("saved")
            // A module is done, not the whole Feinschliff — don't overclaim (2.8).
            // „Fertig." keeps the milestone audibly distinct from the per-answer
            // „Antwort gespeichert." in the same live region.
            setLiveMessage("Fertig. Antworten gespeichert.")
          },
          handBackToHost: async (payload) => {
            setSession(nextSession)
            setStatus("saved")
            setLiveMessage("Fertig. Antworten gespeichert.")
            await onModuleComplete?.(payload)
          },
        },
      ),
    [emit, onModuleComplete, showCompletedStage2Session],
  )

  const completeStage2Module = useCallback(
    async (nextSession: Stage2RefinementSession, stage2Module: Stage2Module) => {
      setSession(nextSession)
      const completeModule = gateway.completeModule?.bind(gateway)
      if (!completeModule) {
        // A gateway that cannot project a module leaves the answer saved rather
        // than closing the whole draft behind the user's back.
        setStatus("saved")
        setLiveMessage("Antwort gespeichert.")
        setMode("question")
        return
      }
      try {
        await applyModuleCompletion(
          nextSession,
          await completeModule({ module: stage2Module, expectedRevision: nextSession.revision }),
        )
      } catch (error) {
        showCompletionFailure(nextSession, error)
      }
    },
    [applyModuleCompletion, gateway, showCompletionFailure],
  )

  const reloadFromGateway = useCallback(async () => {
    try {
      const loaded = trackSession(await gateway.load())
      const entry = resolveStage2FlowEntryView({
        session: loaded,
        moduleScope: moduleScopeRef.current,
      })
      if (entry.bridge) {
        setSession(loaded)
        setBridge(getCompletedHandoffForLoadedSession(loaded))
        setMode("bridge")
        setStatus("idle")
        setLiveMessage("")
        setHandoffStatus("idle")
        handoffInFlightRef.current = false
        bridgeCancelledRef.current = false
        emit({ name: "personal_plan_stage2_bridge_viewed" })
        return
      }
      setActiveFromSession(loaded, entry.activeQuestionId, {
        liveMessage:
          entry.status === "idle" ? "Neuer Fortschritt wurde geladen." : entry.liveMessage,
        status: entry.status === "idle" ? "revision_conflict" : entry.status,
      })
      setMode("question")
    } catch {
      setStatus("save_failed")
      setLiveMessage("Speichern hat nicht geklappt. Der neuere Stand konnte nicht geladen werden.")
      setMode("question")
    }
  }, [emit, gateway, setActiveFromSession, trackSession])

  const handleSubmit = useCallback(async () => {
    if (!session || !activeQuestionId) return
    if (status === "saving") return
    if (status === "stale_refinement") {
      setStatus("saving")
      setLiveMessage("Dein Feinschliff-Stand wird neu geladen.")
      await reloadFromGateway()
      return
    }
    if (status === "completion_failed" && session.path.firstUnresolvedQuestionId === null) {
      setStatus("saving")
      setLiveMessage("Wir versuchen das Abschließen erneut.")
      if (moduleRef.current) {
        await completeStage2Module(session, moduleRef.current)
        return
      }
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
      const locallyAdvanced = trackSession(
        saveStage2SessionAnswer(submittedSession, {
          questionId: submittedQuestionId,
          answer: submittedAnswer,
        }),
      )
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
      const stage2Module = moduleRef.current
      const saveAnswerAndCompleteModule = gateway.saveAnswerAndCompleteModule?.bind(gateway)
      if (willCompletePage && stage2Module && saveAnswerAndCompleteModule) {
        const result = await saveAnswerAndCompleteModule({
          module: stage2Module,
          questionId: submittedQuestionId,
          answer: submittedAnswer,
          expectedRevision: submittedSession.revision,
        })
        if (saveGenerationRef.current !== saveGeneration) return
        emit({
          name: "personal_plan_stage2_answer_saved",
          family: getQuestionFamily(submittedQuestionId),
        })
        await applyModuleCompletion(trackSession(result.session), result.moduleCompletion)
        return
      }
      const saveAnswerAndComplete = gateway.saveAnswerAndComplete?.bind(gateway)
      if (willCompletePage && !stage2Module && saveAnswerAndComplete) {
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
        showCompletedStage2Session(trackSession(result.session), result.handoff)
        return
      }
      const nextSession = trackSession(
        await gateway.saveAnswer({
          questionId: submittedQuestionId,
          answer: submittedAnswer,
          expectedRevision: submittedSession.revision,
        }),
      )
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
        if (stage2Module) {
          await completeStage2Module(nextSession, stage2Module)
          return
        }
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
        showCompletionFailure(trackSession(error.savedSession), error)
        return
      }
      if (error instanceof Stage2RefinementError && error.code === "revision_conflict") {
        emit({ name: "personal_plan_stage2_save_failed", errorCode: "revision_conflict" })
        await reloadFromGateway()
        return
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
    applyModuleCompletion,
    completeStage2Module,
    completeStage2Session,
    emit,
    gateway,
    localAnswer,
    reloadFromGateway,
    session,
    setActiveFromSession,
    showCompletedStage2Session,
    showCompletionFailure,
    status,
    trackSession,
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
      // `stale_refinement` deliberately survives an edit: the only useful next
      // action is reloading the Feinschliff-Stand, not saving on top of it.
    },
    [status],
  )

  const content = useMemo(() => {
    if (mode === "loading") return <LoadingShell status={status} liveMessage={liveMessage} />
    if (mode === "entry_error") {
      return (
        <EntryPreparationShell
          status={status}
          liveMessage={liveMessage}
          onBack={onSecondaryExit}
          onRetry={() => setEntryRetryNonce((current) => current + 1)}
        />
      )
    }
    if (mode === "bridge" && bridge) {
      return (
        <BridgeHandoffShell
          handoff={bridge}
          status={status}
          liveMessage={liveMessage}
          handoffStatus={handoffStatus}
          onBack={getBridgeBackQuestionId(session) ? handleBridgeBack : undefined}
          onRetry={onHandoff ? handleBridgeContinue : undefined}
          showManualContinue={
            Boolean(onHandoff) &&
            !stage2BridgeAutoContinues({ autoHandoff, explicitModuleEntry }) &&
            handoffStatus === "idle"
          }
        />
      )
    }
    if (!session || !activeQuestionId)
      return <LoadingShell status={status} liveMessage={liveMessage} />
    const canGoBack = session.path.orderedQuestionIds.indexOf(activeQuestionId) > 0
    return (
      <div className="min-h-dvh bg-[var(--background)] text-[var(--text-body)]">
        <PersonalPlanJourneyHeader
          currentStage={2}
          saveStatus={journeySaveStatus(status)}
          onBack={canGoBack ? handleBack : onSecondaryExit}
          // The banner's own coarse meter, in the slot the retired 5-stage bar
          // used to occupy — module questions otherwise give no sense of where
          // this sits in the plan (field test 26.08.2026).
          moduleProgress={moduleProgress ?? undefined}
        />
        <div className="overflow-x-clip">
          <div className={stageEntrance ? "personal-plan-stage-target-enter" : undefined}>
            <PersonalPlanViewTransition
              viewKey={activeQuestionId}
              direction={questionDirection}
              variant="quiz"
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
      </div>
    )
  }, [
    activeQuestionId,
    autoHandoff,
    bridge,
    explicitModuleEntry,
    handleBack,
    handleBridgeBack,
    handleBridgeContinue,
    handleLocalAnswer,
    handleSubmit,
    liveMessage,
    localAnswer,
    mode,
    moduleProgress,
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

export type Stage2ModuleCompletionEffects = {
  emit: (event: Stage2RefinementTelemetryEvent) => void
  /** The closing module: the draft is complete, exactly like the linear flow. */
  showCompletedSession: (session: Stage2RefinementSession, handoff: Stage2CompleteResult) => void
  /** Modul 1: the draft stays open, but the user is carried into Stage 3. */
  showStage3Bridge: (session: Stage2RefinementSession, handoff: Stage2CompleteResult) => void
  /** A module that hands off nowhere (habits before products) — the host routes. */
  handBackToHost: (payload: Stage2ModuleCompletionPayload) => void | Promise<void>
}

/**
 * The three outcomes of finishing ONE module, extracted from the component so
 * they are drivable against a fake gateway without a DOM.
 *
 * - `status: "complete"` — this was the CLOSING module, so the server ran the
 *   unchanged full completion. Byte-identical end state to today's linear flow.
 * - `stage3Handoff` — Modul 1 (`products`): bridge into Stage 3 while the draft
 *   stays `in_progress`.
 * - otherwise — `habits` before `products`: nothing to hand off, so the host
 *   decides where the user goes (today: back to the Routine).
 *
 * `hostSession` is deliberately separate from `session`: the flow's own view may
 * be module-scoped (a truncated path), and that must never leave the component.
 */
export async function applyStage2ModuleCompletion(
  input: {
    session: Stage2RefinementSession
    hostSession: Stage2RefinementSession
    moduleCompletion: Stage2ModuleCompletionResult
  },
  effects: Stage2ModuleCompletionEffects,
): Promise<void> {
  const { session, hostSession, moduleCompletion } = input
  const handoff: Stage2CompleteResult = {
    refinedVersionId: moduleCompletion.refinedVersionId,
    nextHref: moduleCompletion.nextHref,
  }
  effects.emit({ name: "personal_plan_stage2_module_completed", module: moduleCompletion.module })
  if (moduleCompletion.status === "complete") {
    effects.showCompletedSession(session, handoff)
    return
  }
  if (moduleCompletion.stage3Handoff) {
    effects.showStage3Bridge(session, handoff)
    effects.emit({ name: "personal_plan_stage2_bridge_viewed" })
    return
  }
  await effects.handBackToHost({ moduleCompletion, session: hostSession })
}

/**
 * M-7: the module gate (resolver path) and the delegated full close (stored
 * answers incl. assumed ones) can disagree, which surfaces as a 422
 * `incomplete_refinement`. Retrying the handoff cannot fix that — say so.
 */
export function completionFailureMessage(code: Stage2RefinementErrorCode): string {
  return code === "incomplete_refinement"
    ? "Dein Feinschliff-Stand hat sich geändert."
    : "Antwort gespeichert. Das Abschließen hat nicht geklappt."
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
  title = "Wir laden deinen Stand.",
}: {
  status: RefinementQuestionStatus
  liveMessage: string
  title?: string
}) {
  return (
    <div className="min-h-dvh bg-[var(--background)]">
      <PersonalPlanJourneyHeader currentStage={2} saveStatus={journeySaveStatus(status)} />
      <main className="grid min-h-[calc(100dvh-71px)] place-items-center px-5 text-center">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--brand-plum)]">
            Feinschliff
          </p>
          <h1 className="mt-2 font-serif text-3xl font-medium text-[var(--brand-plum-darkest,#2a1845)]">
            {title}
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

function EntryPreparationShell({
  status,
  liveMessage,
  onBack,
  onRetry,
}: {
  status: RefinementQuestionStatus
  liveMessage: string
  onBack?: () => void
  onRetry: () => void
}) {
  return (
    <div className="min-h-dvh bg-[var(--background)]">
      <PersonalPlanJourneyHeader
        currentStage={2}
        saveStatus={journeySaveStatus(status)}
        onBack={onBack}
      />
      <main className="mx-auto flex min-h-[calc(100dvh-71px)] w-full max-w-[600px] flex-col justify-center px-5 py-8 text-center">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--brand-plum)]">
          Feinschliff gespeichert
        </p>
        <h1 className="mt-2 font-serif text-[30px] font-medium leading-tight tracking-normal text-[var(--brand-plum-darkest,#2a1845)]">
          Wir konnten deine Angaben gerade nicht vorbereiten.
        </h1>
        <p role="alert" className="mt-3 text-sm leading-6 text-[#a3434b]">
          Deine bisherigen Antworten bleiben gespeichert. Versuche es bitte noch einmal.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {onBack ? (
            <Button type="button" onClick={onBack} variant="outline" className="rounded-full">
              Zurück
            </Button>
          ) : null}
          <Button type="button" onClick={onRetry} variant="funnelCta">
            Erneut versuchen
          </Button>
        </div>
        <p aria-live="polite" className="sr-only">
          {liveMessage}
        </p>
      </main>
    </div>
  )
}

function BridgeHandoffShell({
  handoff,
  status,
  liveMessage,
  handoffStatus,
  onBack,
  onRetry,
  showManualContinue,
}: {
  handoff: Stage2CompleteResult
  status: RefinementQuestionStatus
  liveMessage: string
  handoffStatus: "idle" | "loading" | "error" | "complete"
  onBack?: () => void
  onRetry?: () => void
  showManualContinue: boolean
}) {
  const isBusy = handoffStatus === "loading"
  const hasError = handoffStatus === "error"
  return (
    <div
      {...stage2BridgeMarkerProps(handoff)}
      className="min-h-dvh bg-[var(--background)] text-[var(--text-body)]"
    >
      <PersonalPlanJourneyHeader
        currentStage={2}
        saveStatus={journeySaveStatus(hasError ? "save_failed" : status)}
        onBack={isBusy ? undefined : onBack}
      />
      <main className="mx-auto flex min-h-[calc(100dvh-71px)] w-full max-w-[600px] flex-col justify-center px-5 py-8 text-center">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--brand-plum)]">
          Feinschliff gespeichert
        </p>
        <h1 className="mt-2 font-serif text-[30px] font-medium leading-tight tracking-normal text-[var(--brand-plum-darkest,#2a1845)]">
          Deine Produkte werden vorbereitet.
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--text-sub,#6a6560)]">
          Deine Antworten sind gespeichert. Wir bringen dich direkt zur Produktauswahl.
        </p>
        {hasError ? (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-[#fff4f2] px-3 py-2.5 text-sm text-[#a3434b]"
          >
            Deine Produkte konnten nicht vorbereitet werden. Versuche es noch einmal.
          </p>
        ) : null}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {onBack ? (
            <Button type="button" onClick={onBack} variant="outline" className="rounded-full">
              Zur letzten Frage
            </Button>
          ) : null}
          {hasError && onRetry ? (
            <Button type="button" onClick={onRetry} variant="funnelCta">
              Erneut versuchen
            </Button>
          ) : null}
          {showManualContinue && onRetry ? (
            <Button type="button" onClick={onRetry} variant="funnelCta">
              Produktauswahl öffnen
            </Button>
          ) : null}
        </div>
        {isBusy ? (
          <p className="mt-4 text-xs font-semibold text-[var(--brand-plum)]" aria-busy="true">
            Produkte werden vorbereitet …
          </p>
        ) : null}
        <p aria-live="polite" className="sr-only">
          {liveMessage}
        </p>
      </main>
    </div>
  )
}

type InitialRefinementView = {
  session: Stage2RefinementSession
  activeQuestionId: Stage2QuestionId | null
  localAnswer: unknown
  status: RefinementQuestionStatus
  mode: "question" | "bridge"
  liveMessage: string
  bridge: Stage2CompleteResult | null
}

function initialRefinementView(
  session: Stage2RefinementSession | undefined,
  moduleScope: Stage2ModuleScope,
): InitialRefinementView | null {
  if (!session) return null
  const entry = resolveStage2FlowEntryView({ session, moduleScope })
  return {
    session,
    activeQuestionId: entry.activeQuestionId,
    localAnswer: entry.activeQuestionId
      ? getAnswerForQuestion(session.answers, entry.activeQuestionId)
      : undefined,
    status: entry.status,
    mode: entry.mode,
    liveMessage: entry.liveMessage,
    bridge: entry.bridge ? getCompletedHandoffForLoadedSession(session) : null,
  }
}
