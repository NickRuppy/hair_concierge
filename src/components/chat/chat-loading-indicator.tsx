"use client"

import { CombIcon } from "@/components/ui/comb-icon"

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

function pickRandomMessage() {
  return LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)]
}

export function ChatLoadingIndicator() {
  const message = pickRandomMessage()

  return (
    <div className="flex gap-3 animate-fade-in-up-fast">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
        HC
      </div>
      <div className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-2.5">
        <CombIcon className="animate-comb-sway text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{message}</span>
      </div>
    </div>
  )
}
