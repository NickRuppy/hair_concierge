"use client"

import { useEffect, useState, useRef } from "react"
import { useQuizStore } from "@/lib/quiz/store"
import { Loader2, Check } from "lucide-react"

const steps = [
  "Haarstruktur wird analysiert ...",
  "Protein-Feuchtigkeits-Balance wird berechnet ...",
  "Dein persoenliches Profil wird erstellt ...",
]

const STEP_DELAY = 1200

export function QuizAnalysis() {
  const { lead, answers, leadId, setAiInsight, goNext } = useQuizStore()
  const [completedSteps, setCompletedSteps] = useState(0)
  const [apiDone, setApiDone] = useState(false)
  const fetched = useRef(false)

  // Animate checklist items
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    for (let i = 0; i < steps.length; i++) {
      timers.push(
        setTimeout(() => setCompletedSteps(i + 1), STEP_DELAY * (i + 1))
      )
    }
    return () => timers.forEach(clearTimeout)
  }, [])

  // Call analyze API in parallel
  useEffect(() => {
    if (fetched.current || !leadId) return
    fetched.current = true

    fetch("/api/quiz/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId, name: lead.name, quizAnswers: answers }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.insight) setAiInsight(data.insight)
        setApiDone(true)
      })
      .catch(() => setApiDone(true))
  }, [leadId, lead.name, answers, setAiInsight])

  // Auto-transition when both animation and API are done
  useEffect(() => {
    if (completedSteps >= steps.length && apiDone) {
      const t = setTimeout(goNext, 400)
      return () => clearTimeout(t)
    }
  }, [completedSteps, apiDone, goNext])

  return (
    <div className="flex flex-col items-center justify-center py-16 animate-fade-in-up">
      <h2 className="font-header text-3xl text-white text-center mb-2">
        {lead.name.toUpperCase()}, DEIN PROFIL WIRD ERSTELLT
      </h2>
      <p className="text-base text-white/60 mb-10">Einen Moment noch...</p>

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
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F5C518]">
                    <Check className="h-4 w-4 text-[#1A1618]" />
                  </div>
                ) : active ? (
                  <Loader2 className="h-6 w-6 animate-spin text-[#F5C518]" />
                ) : (
                  <div className="h-2.5 w-2.5 rounded-full bg-white/20" />
                )}
              </div>
              <span className={`text-base ${done ? "text-white" : "text-white/60"}`}>{text}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
