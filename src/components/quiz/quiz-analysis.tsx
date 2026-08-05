"use client"

import { Check, Loader2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"

export const QUIZ_ANALYSIS_STEPS = [
  "Dein Haarprofil wird ausgewertet",
  "Deine wichtigsten Pflegehebel werden sortiert",
  "Dein persönlicher Plan wird zusammengestellt",
] as const

export const QUIZ_ANALYSIS_MILESTONES = [
  {
    id: "today",
    label: "Heute",
    title: "Du erkennst deine wichtigsten Pflegehebel.",
    body: "Dein Plan zeigt dir, welche Schritte für dein Haar zuerst relevant sind.",
  },
  {
    id: "week-one",
    label: "Nach 7 Tagen",
    title: "Deine Routine wird leichter umsetzbar.",
    body: "Du weißt, wann welcher Schritt dran ist und worauf du bei der Anwendung achten kannst.",
  },
  {
    id: "week-four",
    label: "Nach 4 Wochen",
    title: "Du kannst Veränderungen besser einordnen.",
    body: "Du erkennst klarer, was deinem Haar guttut und wo du deine Routine anpassen solltest.",
  },
] as const

const STEP_DELAY = 800
export const QUIZ_ANALYSIS_MINIMUM_DURATION_MS = STEP_DELAY * QUIZ_ANALYSIS_STEPS.length

export function getQuizAnalysisTimeline(stepCount = QUIZ_ANALYSIS_STEPS.length) {
  return {
    stepDelays: Array.from({ length: stepCount }, (_, index) => STEP_DELAY * (index + 1)),
    minimumDuration: STEP_DELAY * stepCount,
  }
}

export function getQuizAnalysisProgress(completedSteps: number, isReady: boolean) {
  if (isReady) return 100
  return [8, 36, 65, 94][Math.min(3, Math.max(0, completedSteps))]
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
  revealPending,
}: {
  completedSteps: number
  isReady: boolean
  name: string
  onReveal: () => void
  revealPending: boolean
}) {
  const heading = getPreparationHeading(name, isReady)
  const subcopy = isReady
    ? "Deine wichtigsten Prioritäten und Routine-Bausteine warten auf dich."
    : "Während wir rechnen, zeigen wir dir, wie dein Plan dich Schritt für Schritt unterstützen kann."
  const progress = getQuizAnalysisProgress(completedSteps, isReady)
  const milestoneIndex = isReady
    ? QUIZ_ANALYSIS_MILESTONES.length - 1
    : Math.min(completedSteps, QUIZ_ANALYSIS_MILESTONES.length - 1)
  const milestone = QUIZ_ANALYSIS_MILESTONES[milestoneIndex]
  const progressLabel = isReady
    ? "Deine Auswertung ist bereit"
    : completedSteps >= QUIZ_ANALYSIS_STEPS.length
      ? "Dein Plan wird finalisiert"
      : QUIZ_ANALYSIS_STEPS[completedSteps]

  return (
    <div className="mx-auto flex w-full max-w-[40rem] flex-col items-center py-6 text-center sm:py-10">
      <div aria-atomic="true" aria-live="polite" className="w-full" role="status">
        <p className="flex items-center justify-center gap-2 text-[13px] font-semibold text-[var(--brand-plum)]">
          <Check aria-hidden="true" className="h-4 w-4" />
          Deine Angaben sind gespeichert
        </p>
        <h2 className="mx-auto mt-4 max-w-[20ch] text-balance font-header text-[2rem] font-medium leading-tight text-[var(--brand-plum-darkest)] outline-none focus:outline-none sm:text-[2.4rem]">
          {heading}
        </h2>
        <p className="mx-auto mt-3 max-w-[42ch] text-[15px] leading-6 text-[var(--text-sub)]">
          {subcopy}
        </p>
      </div>

      <div className="mt-7 w-full rounded-[2rem] border border-[var(--brand-plum-light)] bg-white p-5 text-left shadow-[0_24px_70px_-45px_rgba(70,41,59,0.65)] sm:p-6">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold text-[var(--brand-plum)]">{progressLabel}</p>
          <span className="shrink-0 whitespace-nowrap font-mono text-xs font-bold tabular-nums text-[var(--brand-plum)]">
            {progress} %
          </span>
        </div>
        <div
          aria-label="Fortschritt der Haaranalyse"
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={progress}
          className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--brand-plum-light)]"
          role="progressbar"
        >
          <div
            className="h-full rounded-full bg-[var(--brand-plum)] transition-[width] duration-500 ease-out motion-reduce:transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>

        <ol aria-label="So entsteht dein Plan" className="mt-6 grid grid-cols-3 gap-2">
          {QUIZ_ANALYSIS_MILESTONES.map((item, index) => (
            <li className="text-center" key={item.id}>
              <span
                aria-hidden="true"
                className={`mx-auto mb-2 block h-2.5 w-2.5 rounded-full transition-colors duration-300 motion-reduce:transition-none ${
                  index <= milestoneIndex
                    ? "bg-[var(--brand-plum)]"
                    : "bg-[var(--brand-plum-light)]"
                }`}
              />
              <span className="text-[11px] font-semibold leading-tight text-[var(--text-sub)]">
                {item.label}
              </span>
            </li>
          ))}
        </ol>

        <div
          className="mt-5 min-h-[132px] rounded-2xl bg-[var(--brand-plum-ice)] px-5 py-4 text-center"
          data-analysis-milestone={milestone.id}
        >
          <div className="animate-fade-in-up motion-reduce:animate-none" key={milestone.id}>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-plum)]">
              {milestone.label}
            </p>
            <h3 className="mt-2 text-lg font-semibold leading-snug text-[var(--brand-plum-darkest)]">
              {milestone.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--text-sub)]">{milestone.body}</p>
          </div>
        </div>

        {isReady ? (
          <button
            aria-busy={revealPending}
            className="quiz-btn-primary mt-5 min-h-12 w-full rounded-[14px] px-5 py-3 text-base font-bold disabled:cursor-wait disabled:opacity-80"
            disabled={revealPending}
            onClick={onReveal}
            type="button"
          >
            Meine Haaranalyse ansehen
          </button>
        ) : (
          <p className="mt-5 flex items-center justify-center gap-2 text-sm font-semibold text-[var(--brand-plum)]">
            <Loader2
              aria-hidden="true"
              className="h-4 w-4 animate-spin motion-reduce:animate-none"
            />
            {progressLabel}
          </p>
        )}
      </div>
    </div>
  )
}

export interface QuizAnalysisProps {
  name: string
  onReveal: () => void | Promise<void>
  ready: boolean
}

export function QuizAnalysis({ name, onReveal, ready }: QuizAnalysisProps) {
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
      revealPending={revealPending}
    />
  )
}
