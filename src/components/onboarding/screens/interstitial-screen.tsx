"use client"

import { ArrowLeft } from "lucide-react"

interface InterstitialScreenProps {
  onContinue: () => void
  onBack: () => void
}

export function InterstitialScreen({ onContinue, onBack }: InterstitialScreenProps) {
  return (
    <div>
      <button
        onClick={onBack}
        aria-label="Zurück"
        className="flex min-h-[44px] min-w-[44px] items-center justify-center text-muted-foreground hover:text-foreground transition-colors mb-2"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      <h1 className="animate-fade-in-up font-header text-3xl leading-tight text-foreground mb-4">
        Fast geschafft!
      </h1>

      <p
        className="animate-fade-in-up text-base text-muted-foreground leading-relaxed mb-10"
        style={{ animationDelay: "100ms" }}
      >
        Jetzt noch ein paar Fragen zu deinem Alltag — wie du dein Haar trocknest, bürstest und
        schützt.
      </p>

      <div className="animate-fade-in-up" style={{ animationDelay: "200ms" }}>
        <button onClick={onContinue} className="quiz-btn-primary w-full">
          Weiter
        </button>
      </div>
    </div>
  )
}
