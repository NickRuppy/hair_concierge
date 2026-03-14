"use client"

import { useRouter } from "next/navigation"
import { useQuizStore } from "@/lib/quiz/store"
import { QuizCard } from "./quiz-card"
import { Button } from "@/components/ui/button"

const nextSteps = [
  { emoji: "\uD83E\uDDF4", text: "Sag uns noch kurz, wie dicht dein Haar ist" },
  { emoji: "\uD83C\uDFAF", text: "Danach waehle deine Ziele und dein gewuenschtes Volumen" },
  { emoji: "\uD83D\uDCAC", text: "Anschliessend kannst du TomBot direkt Fragen zu deinem Haar stellen" },
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
          Deine Haar-Diagnose ist gespeichert. Jetzt fehlt noch ein kurzer Schritt, damit TomBot deine Empfehlungen an deine Ziele und deine Wunsch-Routine anpassen kann.
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
          onClick={() => {
            const params = new URLSearchParams()
            params.set("from", "quiz")
            params.set("next", "/onboarding/density")
            if (leadId) params.set("lead", leadId)
            if (lead.email) params.set("email", lead.email)
            router.push(`/auth?${params.toString()}`)
          }}
          variant="unstyled"
          className="quiz-btn-primary w-full h-14 text-base font-bold tracking-wide rounded-xl"
        >
          ZIELE UND ROUTINE STARTEN
        </Button>
      </div>
    </div>
  )
}
