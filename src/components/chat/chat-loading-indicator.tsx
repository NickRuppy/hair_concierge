"use client"

import { useMemo } from "react"

const LOADING_MESSAGES = [
  "Durchkämmen...",
  "Föhnen...",
  "Zurechtschneiden...",
  "Entwirren...",
  "Anmischen...",
  "Ausspülen...",
  "Aufwickeln...",
  "Analysieren...",
  "Nachschlagen...",
  "Formulieren...",
]

function CombIcon() {
  return (
    <svg
      className="h-4 w-4 animate-comb-sway text-muted-foreground"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Handle */}
      <rect x="3" y="4" width="4" height="16" rx="1" />
      {/* Teeth */}
      <line x1="7" y1="6" x2="21" y2="6" />
      <line x1="7" y1="9" x2="21" y2="9" />
      <line x1="7" y1="12" x2="21" y2="12" />
      <line x1="7" y1="15" x2="21" y2="15" />
      <line x1="7" y1="18" x2="21" y2="18" />
    </svg>
  )
}

export function ChatLoadingIndicator() {
  const message = useMemo(
    () => LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)],
    []
  )

  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
        HC
      </div>
      <div className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-2.5">
        <CombIcon />
        <span className="text-sm text-muted-foreground">{message}</span>
      </div>
    </div>
  )
}
