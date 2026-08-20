"use client"

import { useEffect, useRef, useState, type Ref } from "react"

export type QuizTransitionPhase = "commit" | "loading" | "ready"
export type QuizCommitChoice = "ja" | "neugierig"

export const QUIZ_TRANSITION_LOADING_MS = 2600
export const QUIZ_TRANSITION_READY_BEAT_MS = 900

export function getCommitHeading(name: string) {
  const normalized = name.trim()
  return normalized
    ? `${normalized}, bereit für den nächsten Schritt mit deinem Haar?`
    : "Bereit für den nächsten Schritt mit deinem Haar?"
}

export function getLoadingHeading(name: string) {
  const normalized = name.trim()
  return normalized ? `Einen Moment, ${normalized}.` : "Einen Moment."
}

export function getQuizTransitionPhase({
  committed,
  loadingElapsed,
  ready,
}: {
  committed: boolean
  loadingElapsed: boolean
  ready: boolean
}): QuizTransitionPhase {
  if (!committed) return "commit"
  if (!loadingElapsed || !ready) return "loading"
  return "ready"
}

export function scheduleQuizTransitionLoading({
  onElapsed,
  reducedMotion,
}: {
  onElapsed: () => void
  reducedMotion: boolean
}) {
  if (reducedMotion) {
    onElapsed()
    return () => {}
  }
  const timer = setTimeout(onElapsed, QUIZ_TRANSITION_LOADING_MS)
  return () => clearTimeout(timer)
}

export function scheduleQuizTransitionReveal({
  onReveal,
  reducedMotion,
}: {
  onReveal: () => void
  reducedMotion: boolean
}) {
  if (reducedMotion) {
    onReveal()
    return () => {}
  }
  const timer = setTimeout(onReveal, QUIZ_TRANSITION_READY_BEAT_MS)
  return () => clearTimeout(timer)
}

export function startQuizAnalysisReveal(
  lock: { current: boolean },
  onReveal: () => void | Promise<void>,
): boolean {
  if (lock.current) return false

  lock.current = true

  try {
    void Promise.resolve(onReveal()).catch(() => {})
  } catch {
    // Navigation owns its error handling. Keep this terminal action one-shot so
    // a competing transition can never start.
  }

  return true
}

export function QuizAnalysisView({
  commitPending,
  name,
  onCommit,
  phase,
  statusRef,
}: {
  commitPending: boolean
  name: string
  onCommit: (choice: QuizCommitChoice) => void
  phase: QuizTransitionPhase
  statusRef?: Ref<HTMLDivElement>
}) {
  return (
    <>
      {phase === "commit" ? (
        <div className="mx-auto flex w-full max-w-[26rem] flex-col items-center py-10 text-center sm:py-16">
          <h2 className="text-balance font-header text-[2rem] font-medium leading-tight text-[var(--brand-plum-darkest)] sm:text-[2.4rem]">
            {getCommitHeading(name)}
          </h2>
          <button
            className="quiz-btn-primary mt-9 min-h-12 w-full rounded-[14px] px-5 py-3 text-base font-bold disabled:cursor-wait disabled:opacity-80"
            disabled={commitPending}
            onClick={() => onCommit("ja")}
            type="button"
          >
            Ja, zeig mir meine Analyse
          </button>
          <button
            className="mt-3 min-h-11 w-full rounded-[14px] px-5 py-2.5 text-sm font-semibold text-[var(--text-sub)] transition-colors hover:bg-[var(--brand-plum-ice)] hover:text-[var(--brand-plum)] disabled:cursor-wait disabled:opacity-80"
            disabled={commitPending}
            onClick={() => onCommit("neugierig")}
            type="button"
          >
            Ich bin neugierig
          </button>
        </div>
      ) : null}
      <div
        aria-atomic="true"
        aria-live="polite"
        className={
          phase === "commit"
            ? "sr-only"
            : "mx-auto flex w-full max-w-[26rem] flex-col items-center py-10 text-center outline-none focus:outline-none sm:py-16"
        }
        ref={statusRef}
        role="status"
        tabIndex={-1}
      >
        {phase === "loading" ? (
          <>
            <h2 className="text-balance font-header text-[2rem] font-medium leading-tight text-[var(--brand-plum-darkest)] sm:text-[2.4rem]">
              {getLoadingHeading(name)}
            </h2>
            <p className="mt-3 text-[15px] leading-6 text-[var(--text-sub)]">
              Deine Haaranalyse wird erstellt.
            </p>
            <div aria-hidden="true" className="quiz-shimmer-bar mt-8" />
          </>
        ) : null}
        {phase === "ready" ? (
          <h2 className="font-header text-[2rem] font-medium leading-tight text-[var(--brand-plum-darkest)] sm:text-[2.4rem]">
            Bereit.
          </h2>
        ) : null}
      </div>
    </>
  )
}

export interface QuizAnalysisProps {
  name: string
  onCommit?: (choice: QuizCommitChoice) => void
  onReveal: () => void | Promise<void>
  ready: boolean
}

export function QuizAnalysis({ name, onCommit, onReveal, ready }: QuizAnalysisProps) {
  const [choice, setChoice] = useState<QuizCommitChoice | null>(null)
  const [loadingElapsed, setLoadingElapsed] = useState(false)
  const revealStartedRef = useRef(false)
  const reducedMotionRef = useRef(false)
  const committedRef = useRef(false)
  const statusRef = useRef<HTMLDivElement | null>(null)
  const statusFocusedRef = useRef(false)

  useEffect(() => {
    reducedMotionRef.current =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  }, [])

  useEffect(() => {
    if (!choice) return
    return scheduleQuizTransitionLoading({
      onElapsed: () => setLoadingElapsed(true),
      reducedMotion: reducedMotionRef.current,
    })
  }, [choice])

  const phase = getQuizTransitionPhase({
    committed: choice !== null,
    loadingElapsed,
    ready,
  })

  useEffect(() => {
    if (phase !== "ready") return
    return scheduleQuizTransitionReveal({
      onReveal: () => startQuizAnalysisReveal(revealStartedRef, onReveal),
      reducedMotion: reducedMotionRef.current,
    })
    // onReveal is stable for the lifetime of the preparation screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  useEffect(() => {
    if (phase === "commit" || statusFocusedRef.current) return
    statusFocusedRef.current = true
    statusRef.current?.focus()
  }, [phase])

  const handleCommit = (selected: QuizCommitChoice) => {
    if (committedRef.current || choice) return
    committedRef.current = true
    setChoice(selected)
    onCommit?.(selected)
  }

  return (
    <QuizAnalysisView
      commitPending={choice !== null}
      name={name}
      onCommit={handleCommit}
      phase={phase}
      statusRef={statusRef}
    />
  )
}
