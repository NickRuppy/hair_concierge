"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import {
  Stage2RefinementError,
  type Stage2RefinementErrorCode,
  type Stage2RefinementGateway,
  type Stage2CompleteResult,
} from "@/lib/personal-plan/refinement/gateway"
import type { Stage2RefinementSession } from "@/lib/personal-plan/refinement/session"
import type { Stage2QuestionId, Stage2StaticQuestionId } from "@/lib/personal-plan/refinement/types"

import { RefinementBridge } from "./refinement-bridge"
import {
  RefinementQuestion,
  getAnswerForQuestion,
  getQuestionFamily,
  getQuestionSection,
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

export function RefinementFlow({
  gateway,
  onTelemetry,
  onSecondaryExit,
}: {
  gateway: Stage2RefinementGateway
  onTelemetry?: (event: Stage2RefinementTelemetryEvent) => void
  onSecondaryExit?: () => void
}) {
  const [session, setSession] = useState<Stage2RefinementSession | null>(null)
  const [activeQuestionId, setActiveQuestionId] = useState<Stage2QuestionId | null>(null)
  const [localAnswer, setLocalAnswer] = useState<unknown>(undefined)
  const [status, setStatus] = useState<RefinementQuestionStatus>("idle")
  const [mode, setMode] = useState<"loading" | "invitation" | "resume" | "question" | "bridge">(
    "loading",
  )
  const [liveMessage, setLiveMessage] = useState("")
  const [bridge, setBridge] = useState<Stage2CompleteResult | null>(null)
  const generationRef = useRef(0)
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

        if (loadedSession.completedQuestionIds.length === 0) {
          setMode("invitation")
          emit({ name: "personal_plan_stage2_started" })
        } else {
          setMode("resume")
          emit({ name: "personal_plan_stage2_resumed" })
        }
      })
      .catch(() => {
        if (cancelled || generationRef.current !== generation) return
        setLiveMessage("Verfeinerung konnte nicht geladen werden.")
        setMode("loading")
        setStatus("save_failed")
      })

    return () => {
      cancelled = true
    }
  }, [emit, gateway, setActiveFromSession])

  const begin = useCallback(() => {
    if (!session?.path.firstUnresolvedQuestionId) return
    const nextQuestionId = session.path.firstUnresolvedQuestionId
    setActiveFromSession(session, nextQuestionId)
    setMode("question")
  }, [session, setActiveFromSession])

  const handleBack = useCallback(() => {
    if (!session || !activeQuestionId) return
    const currentIndex = session.path.orderedQuestionIds.indexOf(activeQuestionId)
    const previousQuestionId =
      currentIndex > 0 ? session.path.orderedQuestionIds[currentIndex - 1] : null
    if (!previousQuestionId) {
      setMode(session.completedQuestionIds.length > 0 ? "resume" : "invitation")
      return
    }
    setActiveFromSession(session, previousQuestionId)
    setMode("question")
  }, [activeQuestionId, session, setActiveFromSession])

  const handleBridgeBack = useCallback(() => {
    if (!session) return
    const finalQuestionId = getBridgeBackQuestionId(session)
    if (!finalQuestionId) return
    setActiveFromSession(session, finalQuestionId)
    setMode("question")
  }, [session, setActiveFromSession])

  const completeStage2Session = useCallback(
    async (nextSession: Stage2RefinementSession) => {
      setSession(nextSession)
      try {
        const handoff = await gateway.complete({ expectedRevision: nextSession.revision })
        const completedSession: Stage2RefinementSession = {
          ...nextSession,
          status: "complete",
          completedHandoff: handoff,
        }
        setSession(completedSession)
        setBridge(handoff)
        setMode("bridge")
        setStatus("saved")
        setLiveMessage("Verfeinerung gespeichert.")
        emit({ name: "personal_plan_stage2_completed" })
        emit({ name: "personal_plan_stage2_bridge_viewed" })
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
    [emit, gateway, setActiveFromSession],
  )

  const handleSubmit = useCallback(async () => {
    if (!session || !activeQuestionId) return
    if (status === "completion_failed" && session.path.firstUnresolvedQuestionId === null) {
      setStatus("saving")
      setLiveMessage("Übergabe wird erneut versucht.")
      await completeStage2Session(session)
      return
    }
    const editedCompletedQuestion = session.completedQuestionIds.includes(activeQuestionId)
    setStatus("saving")
    setLiveMessage("Antwort wird gespeichert.")
    try {
      const nextSession = await gateway.saveAnswer({
        questionId: activeQuestionId,
        answer: localAnswer,
        expectedRevision: session.revision,
      })
      emit({
        name: "personal_plan_stage2_answer_saved",
        family: getQuestionFamily(activeQuestionId),
      })

      const nextQuestionId = chooseNextQuestion(
        nextSession,
        activeQuestionId,
        editedCompletedQuestion,
      )
      if (!nextQuestionId) {
        setSession(nextSession)
        await completeStage2Session(nextSession)
        return
      }
      setActiveFromSession(nextSession, nextQuestionId, {
        liveMessage: "Antwort gespeichert. Nächste Frage geladen.",
      })
      setMode("question")
    } catch (error) {
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
          return
        }
      }
      const code = error instanceof Stage2RefinementError ? error.code : "save_failed"
      emit({ name: "personal_plan_stage2_save_failed", errorCode: code })
      setStatus("save_failed")
      setLiveMessage("Speichern fehlgeschlagen.")
    }
  }, [
    activeQuestionId,
    completeStage2Session,
    emit,
    gateway,
    localAnswer,
    session,
    setActiveFromSession,
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
    return (
      <RefinementQuestion
        session={session}
        questionId={activeQuestionId}
        localAnswer={localAnswer}
        onLocalAnswerChange={handleLocalAnswer}
        status={status}
        liveMessage={liveMessage}
        canGoBack={session.path.orderedQuestionIds.indexOf(activeQuestionId) > 0}
        onBack={handleBack}
        onSubmit={handleSubmit}
        onSecondaryExit={onSecondaryExit ?? (() => {})}
      />
    )
  }, [
    activeQuestionId,
    begin,
    bridge,
    handleBack,
    handleBridgeBack,
    handleLocalAnswer,
    handleSubmit,
    liveMessage,
    localAnswer,
    mode,
    onSecondaryExit,
    session,
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
    <main className="grid min-h-dvh place-items-center bg-[var(--background,#fdfbf9)] px-5 text-center">
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--brand-plum)]">
          Verfeinerung
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
    <main className="mx-auto flex min-h-dvh w-full max-w-[540px] flex-col justify-center bg-[var(--background,#fdfbf9)] px-5 py-8">
      <div className="mb-6 grid grid-cols-5 gap-1">
        {["Bedarf", "Verfeinerung", "Produkte", "Routine", "Anwendung"].map((label, index) => (
          <span
            key={label}
            className={`text-center text-[9px] font-bold ${index <= 1 ? "text-[var(--brand-plum)]" : "text-[var(--text-muted,#736f69)]"}`}
          >
            <span
              className={`mx-auto mb-1 block h-2.5 w-2.5 rounded-full ${index === 0 ? "bg-[var(--brand-plum)]" : index === 1 ? "border-2 border-[var(--brand-coral,#d4616a)]" : "border border-[var(--border,#e7e0d9)]"}`}
            />
            {label}
          </span>
        ))}
      </div>
      <section className="rounded-[22px] border border-[rgba(var(--brand-plum-rgb),0.14)] bg-gradient-to-br from-[#f3edf8] to-[#fff8f3] px-5 py-7 text-center">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--brand-plum)]">
          Dein Bedarfsplan steht
        </p>
        <h1 className="mt-2 font-serif text-[30px] font-medium leading-tight tracking-normal text-[var(--brand-plum-darkest,#2a1845)]">
          Jetzt machen wir ihn zu deinem.
        </h1>
        <p className="mx-auto mt-3 max-w-[360px] text-sm leading-6 text-[var(--text-sub,#6a6560)]">
          Ein kurzer Fragenfluss klärt, was du heute benutzt und wie du dein Haar behandelst. Danach
          geht es direkt zur Produkterfassung.
        </p>
      </section>
      <p className="mt-4 rounded-xl bg-[#f5f2ee] px-3 py-2.5 text-xs leading-5 text-[var(--text-sub,#6a6560)]">
        <span className="font-bold text-[#4f8058]">✓</span> Dein erster Bedarfsplan bleibt
        gespeichert. Danach führen wir dich direkt zu deinen konkreten Produkten.
      </p>
      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={onSecondaryExit}
          className="min-h-[52px] rounded-xl px-3 text-sm font-bold text-[var(--brand-plum)] hover:bg-[var(--brand-plum-ice)]"
        >
          Zum Bedarfsplan
        </button>
        <button
          type="button"
          onClick={onBegin}
          className="min-h-[52px] flex-1 rounded-xl bg-[var(--brand-coral,#d4616a)] px-4 text-sm font-bold text-white"
        >
          Verfeinerung starten&nbsp; →
        </button>
      </div>
    </main>
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
    <main className="mx-auto flex min-h-dvh w-full max-w-[540px] flex-col justify-center bg-[var(--background,#fdfbf9)] px-5 py-8">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--brand-plum)]">
        Weiter verfeinern
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
      <button
        type="button"
        onClick={onBegin}
        className="mt-6 min-h-[52px] rounded-xl bg-[var(--brand-coral,#d4616a)] px-4 text-sm font-bold text-white"
      >
        Bei der offenen Frage fortfahren&nbsp; →
      </button>
    </main>
  )
}

function labelForQuestion(questionId: Stage2QuestionId): string {
  if (questionId.startsWith("heat:")) return "Häufigkeit und Hitzeschutz"
  const labels = {
    current_product_categories: "Aktuelle Produktarten",
    wet_wash_frequency: "Nasswasch-Rhythmus",
    scalp_irritation_detail: "Kopfhaut-Klärung",
    dry_shampoo_bridge_preference: "Trockenshampoo-Brücke",
    dry_shampoo_visible_hair_color: "Sichtbare Ansatzfarbe",
    oil_purposes: "Öl-Aufgaben",
    towel_handling: "Handtuch",
    drying_routes: "Trocknungswege",
    additional_heat_tools: "Zusätzliche Hitze-Tools",
    night_protection: "Nachtschutz",
  } as const satisfies Record<Exclude<Stage2QuestionId, `heat:${string}`>, string>
  return labels[questionId as Stage2StaticQuestionId]
}
