"use client"

import { useRouter } from "next/navigation"
import { useQuizStore } from "@/lib/quiz/store"
import { QuizCard } from "./quiz-card"
import { Button } from "@/components/ui/button"

const nextSteps = [
  { emoji: "\uD83D\uDEBF", text: "3-Minuten-Anleitung fuer deine naechste Haarwaesche" },
  { emoji: "\uD83D\uDCAC", text: "Danach kannst du TomBot jederzeit Fragen stellen" },
  { emoji: "\uD83D\uDCC5", text: "In den naechsten Tagen bauen wir deinen Plan Schritt fuer Schritt auf" },
]

export function QuizWelcome() {
  const router = useRouter()
  const lead = useQuizStore((s) => s.lead)
  const leadId = useQuizStore((s) => s.leadId)

  return (
    <div className="flex flex-col animate-fade-in-up">
      <div className="flex-1 flex flex-col justify-center">
        <h2 className="font-header text-4xl text-white mb-3">
          WILLKOMMEN, {lead.name.toUpperCase()}
        </h2>
        <p className="text-base text-white/60 mb-8 leading-relaxed">
          Dein Haarprofil ist gespeichert. Heute machen wir nur einen Schritt: Tom zeigt dir, wie du beim naechsten Waschen vorgehst.
        </p>

        <div className="space-y-3">
          {nextSteps.map((item, i) => (
            <div
              key={item.text}
              className="animate-fade-in-up"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <QuizCard>
                <div className="flex items-start gap-3">
                  <span className="text-2xl leading-none mt-0.5">{item.emoji}</span>
                  <p className="text-base text-white/80 leading-relaxed">{item.text}</p>
                </div>
              </QuizCard>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <Button
          onClick={() => router.push(`/auth?from=quiz${leadId ? `&lead=${leadId}` : ""}`)}
          variant="unstyled"
          className="quiz-btn-primary w-full h-14 text-base font-bold tracking-wide rounded-xl"
        >
          ERSTEN SCHRITT ANSEHEN
        </Button>
      </div>
    </div>
  )
}
