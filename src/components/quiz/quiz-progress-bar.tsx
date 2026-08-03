"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

interface QuizProgressTransition {
  fromCurrent: number
  id: number
}

const QuizProgressTransitionContext = createContext<QuizProgressTransition | null>(null)

export function QuizProgressTransitionProvider({
  children,
  transition,
}: {
  children: ReactNode
  transition: QuizProgressTransition | null
}) {
  return (
    <QuizProgressTransitionContext.Provider value={transition}>
      {children}
    </QuizProgressTransitionContext.Provider>
  )
}

interface QuizProgressBarProps {
  current: number
  total: number
}

export function QuizProgressBar({ current, total }: QuizProgressBarProps) {
  const transition = useContext(QuizProgressTransitionContext)
  const targetFraction = current / total
  const transitionId = transition?.id
  const fromCurrent = transition?.fromCurrent
  const [displayFraction, setDisplayFraction] = useState(() =>
    fromCurrent === undefined ? targetFraction : fromCurrent / total,
  )

  useEffect(() => {
    const fromFraction = fromCurrent === undefined ? targetFraction : fromCurrent / total
    if (fromFraction === targetFraction) return

    const frame = window.requestAnimationFrame(() => setDisplayFraction(targetFraction))
    return () => window.cancelAnimationFrame(frame)
  }, [fromCurrent, targetFraction, total, transitionId])

  return (
    <div className="h-[4px] w-full rounded-full bg-border">
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none"
        data-legacy-quiz-progress-fill
        style={{
          width: `${displayFraction * 100}%`,
          background: "linear-gradient(90deg, var(--brand-plum), var(--brand-plum-dark))",
        }}
      />
    </div>
  )
}
