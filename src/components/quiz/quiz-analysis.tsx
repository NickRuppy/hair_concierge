"use client"

import { Check, Loader2 } from "lucide-react"
import { useEffect, useRef, useState, type ReactNode } from "react"

export const QUIZ_ANALYSIS_STEPS = [
  "Deine wichtigsten Haar-Themen werden priorisiert",
  "Passende Produkte und Routine-Schritte werden zusammengestellt",
  "Deine persönliche Begleitung mit Chaarlie wird vorbereitet",
] as const

const STEP_DELAY = 800
export const QUIZ_ANALYSIS_MINIMUM_DURATION_MS = STEP_DELAY * QUIZ_ANALYSIS_STEPS.length

export function getQuizAnalysisTimeline(stepCount = QUIZ_ANALYSIS_STEPS.length) {
  return {
    stepDelays: Array.from({ length: stepCount }, (_, index) => STEP_DELAY * (index + 1)),
    minimumDuration: STEP_DELAY * stepCount,
  }
}

export function scheduleQuizAnalysis({
  onMinimumComplete,
  onStepComplete,
  reducedMotion,
}: {
  onMinimumComplete: () => void
  onStepComplete: (completedSteps: number) => void
  reducedMotion: boolean
}) {
  const timeline = getQuizAnalysisTimeline()
  const timers: ReturnType<typeof setTimeout>[] = []

  if (reducedMotion) {
    onStepComplete(QUIZ_ANALYSIS_STEPS.length)
    onMinimumComplete()
    return () => {}
  }

  for (const [index, delay] of timeline.stepDelays.entries()) {
    timers.push(setTimeout(() => onStepComplete(index + 1), delay))
  }

  timers.push(setTimeout(onMinimumComplete, timeline.minimumDuration))

  return () => timers.forEach(clearTimeout)
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
    // a rapid second click cannot start a competing transition.
  }

  return true
}

function getPreparationHeading(name: string, isReady: boolean) {
  const normalizedName = name.trim()

  if (isReady) {
    return normalizedName
      ? `${normalizedName}, deine Haaranalyse ist bereit.`
      : "Deine Haaranalyse ist bereit."
  }

  return normalizedName
    ? `${normalizedName}, wir stellen deine Haaranalyse zusammen.`
    : "Wir stellen deine Haaranalyse zusammen."
}

export function QuizAnalysisView({
  completedSteps,
  isReady,
  name,
  onReveal,
  portrait,
  revealPending,
}: {
  completedSteps: number
  isReady: boolean
  name: string
  onReveal: () => void
  portrait?: ReactNode
  revealPending: boolean
}) {
  const heading = getPreparationHeading(name, isReady)
  const subcopy = isReady
    ? "Deine wichtigsten Prioritäten und Routine-Bausteine warten auf dich."
    : "Wir verbinden deine Angaben zu Haar, Zielen und Problemen."
  const portraitProgress = isReady ? 100 : Math.min(88, 14 + completedSteps * 24)

  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-col items-center px-1 py-6 text-center sm:py-10">
      <div aria-atomic="true" aria-live="polite" className="w-full" role="status">
        <p className="flex items-center justify-center gap-2 text-[13px] font-semibold text-[var(--brand-plum)]">
          <Check aria-hidden="true" className="h-4 w-4" />
          Deine Angaben sind gespeichert
        </p>
        <h2 className="mx-auto mt-4 min-h-[3.25em] max-w-[19ch] font-header text-[30px] leading-[1.08] text-[var(--brand-plum-darkest)] sm:min-h-[2.5em] sm:text-[34px]">
          {heading}
        </h2>
        <p className="mx-auto mt-3 min-h-[3em] max-w-[38ch] text-[15px] leading-relaxed text-muted-foreground">
          {subcopy}
        </p>
      </div>

      <div
        className="relative my-5 grid h-[190px] w-[190px] shrink-0 place-items-center overflow-hidden rounded-full border border-[#d8ccec]"
        data-preparation-portrait-stage={isReady ? "ready" : "loading"}
        style={{
          background: `radial-gradient(circle at center, rgba(255, 255, 255, 0.96) 0 57%, transparent 58%), conic-gradient(var(--brand-plum) ${portraitProgress}%, #e9e1f4 0)`,
        }}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-2 rounded-full border border-[#ece5f3]"
        />
        <div
          className={`relative z-10 h-[170px] w-[170px] overflow-hidden rounded-full transition-[filter,opacity] duration-200 motion-reduce:transition-none${
            isReady ? "" : " blur-[1.5px] opacity-60"
          }`}
        >
          {portrait}
        </div>
      </div>

      {!isReady ? (
        <div
          aria-label="Vorbereitung der Haaranalyse"
          aria-valuemax={QUIZ_ANALYSIS_STEPS.length}
          aria-valuemin={0}
          aria-valuenow={completedSteps}
          className="sr-only"
          role="progressbar"
        />
      ) : null}

      <ol aria-label="So wird deine Haaranalyse vorbereitet" className="w-full space-y-3 text-left">
        {QUIZ_ANALYSIS_STEPS.map((text, index) => {
          const finalStepWaitingForReadiness =
            !isReady && index === QUIZ_ANALYSIS_STEPS.length - 1 && completedSteps >= index
          const done = isReady || (completedSteps > index && !finalStepWaitingForReadiness)
          const active = !isReady && (completedSteps === index || finalStepWaitingForReadiness)
          const visible = isReady || completedSteps >= index

          return (
            <li
              key={text}
              className="flex min-h-11 items-center gap-3 rounded-[14px] bg-[var(--brand-cream)] px-3.5 py-2.5 transition-opacity duration-300 motion-reduce:transition-none"
              style={{ opacity: visible ? 1 : 0.32 }}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center">
                {done ? (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--brand-plum)]">
                    <Check aria-hidden="true" className="h-3.5 w-3.5 text-primary-foreground" />
                  </span>
                ) : active ? (
                  <Loader2
                    aria-hidden="true"
                    className="h-5 w-5 animate-spin text-[var(--brand-plum)] motion-reduce:animate-none"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 rounded-full bg-muted-foreground/20"
                  />
                )}
              </span>
              <span className="text-[14px] font-medium leading-snug text-[var(--brand-plum-darkest)]">
                {text}
              </span>
            </li>
          )
        })}
      </ol>

      <div className="mt-7 flex min-h-14 w-full items-center justify-center">
        {isReady ? (
          <button
            aria-busy={revealPending}
            className="quiz-btn-primary min-h-14 w-full max-w-md rounded-xl px-5 py-3 text-base font-bold tracking-wide disabled:cursor-wait disabled:opacity-80"
            disabled={revealPending}
            onClick={onReveal}
            type="button"
          >
            Meine Haaranalyse ansehen
          </button>
        ) : null}
      </div>
    </div>
  )
}

export interface QuizAnalysisProps {
  name: string
  onReveal: () => void | Promise<void>
  portrait?: ReactNode
  ready: boolean
}

export function QuizAnalysis({ name, onReveal, portrait, ready }: QuizAnalysisProps) {
  const [completedSteps, setCompletedSteps] = useState(0)
  const [minimumComplete, setMinimumComplete] = useState(false)
  const [revealPending, setRevealPending] = useState(false)
  const revealStartedRef = useRef(false)

  useEffect(() => {
    const reducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches

    return scheduleQuizAnalysis({
      onMinimumComplete: () => setMinimumComplete(true),
      onStepComplete: setCompletedSteps,
      reducedMotion,
    })
  }, [])

  const isReady = ready && minimumComplete

  const handleReveal = () => {
    if (!startQuizAnalysisReveal(revealStartedRef, onReveal)) return
    setRevealPending(true)
  }

  return (
    <QuizAnalysisView
      completedSteps={completedSteps}
      isReady={isReady}
      name={name}
      onReveal={handleReveal}
      portrait={portrait}
      revealPending={revealPending}
    />
  )
}
