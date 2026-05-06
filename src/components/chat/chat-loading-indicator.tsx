"use client"

import { CombIcon } from "@/components/ui/comb-icon"
import { useEffect, useState } from "react"

const LOADING_PHASES = [
  "Durchkämmen",
  "Anmischen",
  "Formulieren",
  "Sortieren",
  "Abgleichen",
  "Verfeinern",
  "Einordnen",
  "Nachschauen",
  "Auswählen",
  "Glätten",
  "Entwirren",
  "Vorbereiten",
  "Zusammenstellen",
  "Feinjustieren",
  "Abwägen",
  "Aufbereiten",
  "Prüfen",
  "Sichten",
  "Abrunden",
  "Aufschreiben",
]

const SLOW_RESPONSE_PHASE = "Das dauert heute etwas länger - ich bin gleich da"
const STATUS_ROTATION_MS = 1600
const SLOW_RESPONSE_DELAY_MS = 10000

function shuffleLoadingPhases() {
  const phases = [...LOADING_PHASES]

  for (let index = phases.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const currentPhase = phases[index]

    phases[index] = phases[swapIndex]
    phases[swapIndex] = currentPhase
  }

  return phases
}

export function ChatLoadingIndicator() {
  const [phases] = useState(() => shuffleLoadingPhases())
  const [phaseIndex, setPhaseIndex] = useState(0)

  useEffect(() => {
    const interval = window.setInterval(() => {
      setPhaseIndex((currentIndex) => currentIndex + 1)
    }, STATUS_ROTATION_MS)

    return () => window.clearInterval(interval)
  }, [])

  const elapsedMs = phaseIndex * STATUS_ROTATION_MS
  const shouldShowSlowResponse = elapsedMs >= SLOW_RESPONSE_DELAY_MS && phaseIndex % 4 === 0
  const message = shouldShowSlowResponse ? SLOW_RESPONSE_PHASE : phases[phaseIndex % phases.length]

  return (
    <div className="flex animate-fade-in-up-fast gap-3" data-testid="chat-loading-indicator">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_2px_8px_rgba(var(--brand-plum-rgb),0.25)]">
        <CombIcon className="h-4 w-4 text-primary-foreground" />
      </div>
      <div
        className="flex min-w-0 max-w-[calc(100vw-5.5rem)] items-center gap-2 rounded-2xl bg-muted px-4 py-2.5"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <span className="sr-only">Antwort wird vorbereitet.</span>
        <CombIcon className="animate-comb-sway text-muted-foreground" aria-hidden="true" />
        <span
          key={`${phaseIndex}-${message}`}
          className="animate-status-fade type-body-sm inline-flex min-w-0 max-w-full items-baseline whitespace-nowrap text-muted-foreground"
          aria-hidden="true"
          data-testid="chat-loading-status"
        >
          <span className="animate-status-shimmer min-w-0 truncate font-medium">{message}</span>
          <span className="animate-loading-ellipsis ml-0.5 inline-flex w-[1.1em] justify-start">
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </span>
        </span>
      </div>
    </div>
  )
}
