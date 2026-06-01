"use client"

import { useEffect, useState } from "react"
import { useQuizStore } from "@/lib/quiz/store"
import { Loader2, Check } from "lucide-react"

const steps = [
  "Haarstruktur wird analysiert ...",
  "Protein-Feuchtigkeits-Balance wird berechnet ...",
  "Dein persönliches Profil wird erstellt ...",
]

const STEP_DELAY = 1200

export function QuizAnalysis() {
  const { lead, goNext } = useQuizStore()
  const [completedSteps, setCompletedSteps] = useState(0)
  const canReveal = completedSteps >= steps.length

  // Animate checklist items
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    for (let i = 0; i < steps.length; i++) {
      timers.push(setTimeout(() => setCompletedSteps(i + 1), STEP_DELAY * (i + 1)))
    }
    return () => timers.forEach(clearTimeout)
  }, [])

  return (
    <div className="flex flex-col items-center justify-center py-16 animate-fade-in-up">
      <h2 className="font-header text-3xl text-foreground text-center mb-2">
        {lead.name.toUpperCase()}, DEIN PROFIL WIRD ERSTELLT
      </h2>
      <p className="text-base text-muted-foreground mb-10">Einen Moment noch...</p>

      <div className="w-full space-y-4">
        {steps.map((text, i) => {
          const done = completedSteps > i
          const active = completedSteps === i

          return (
            <div
              key={text}
              className="flex items-center gap-3 transition-opacity duration-300"
              style={{ opacity: completedSteps >= i ? 1 : 0.3 }}
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center">
                {done ? (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--brand-plum)]">
                    <Check className="h-4 w-4 text-primary-foreground" />
                  </div>
                ) : active ? (
                  <Loader2 className="h-6 w-6 animate-spin text-[var(--brand-plum)]" />
                ) : (
                  <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/20" />
                )}
              </div>
              <span className={`text-base ${done ? "text-foreground" : "text-muted-foreground"}`}>
                {text}
              </span>
            </div>
          )
        })}
      </div>

      {canReveal ? (
        <button
          type="button"
          onClick={goNext}
          className="quiz-btn-primary mt-10 min-h-14 w-full max-w-md rounded-xl px-5 py-3 text-base font-bold tracking-wide"
        >
          MEIN HAARPROFIL ANSEHEN
        </button>
      ) : null}
    </div>
  )
}
