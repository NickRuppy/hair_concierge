"use client"

import { useRouter } from "next/navigation"
import { useQuizStore } from "@/lib/quiz/store"
import { QuizGlassCard } from "./quiz-glass-card"
import { Button } from "@/components/ui/button"

const nextSteps = [
  { emoji: "\uD83D\uDEBF", text: "3-Minuten-Anleitung fuer deine naechste Haarwaesche" },
  { emoji: "\uD83D\uDCAC", text: "Danach kannst du TomBot jederzeit Fragen stellen" },
  { emoji: "\uD83D\uDCC5", text: "In den naechsten Tagen bauen wir deinen Plan Schritt fuer Schritt auf" },
]

export function QuizWelcome() {
  const router = useRouter()
  const lead = useQuizStore((s) => s.lead)

  return (
    <div className="flex min-h-[80dvh] flex-col justify-between animate-fade-in-up">
      <div className="flex-1 flex flex-col justify-center">
        <h2 className="font-header text-3xl text-white mb-3">
          WILLKOMMEN, {lead.name.toUpperCase()}
        </h2>
        <p className="text-sm text-white/60 mb-8 leading-relaxed">
          Dein Haarprofil ist gespeichert. Heute machen wir nur einen Schritt: Tom zeigt dir, wie du beim naechsten Waschen vorgehst.
        </p>

        <div className="space-y-2.5">
          {nextSteps.map((item, i) => (
            <div
              key={item.text}
              className="animate-fade-in-up"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <QuizGlassCard>
                <div className="flex items-start gap-3">
                  <span className="text-xl leading-none mt-0.5">{item.emoji}</span>
                  <p className="text-sm text-white/80 leading-relaxed">{item.text}</p>
                </div>
              </QuizGlassCard>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <Button
          onClick={() => router.push("/auth?from=quiz")}
          className="w-full h-12 text-base font-bold tracking-wide rounded-xl"
          style={{ background: "linear-gradient(135deg, #F5C518, #D4A800)" }}
        >
          ERSTEN SCHRITT ANSEHEN
        </Button>
      </div>
    </div>
  )
}
