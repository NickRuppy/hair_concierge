"use client"

import { useQuizStore } from "@/lib/quiz/store"
import { Button } from "@/components/ui/button"

const bullets = [
  "Individuelle Analyse statt pauschaler Tipps",
  "Versteht Ursachen wie Proteinmangel, Trockenheit oder Kopfhautstress",
  "Bereitet deinen persoenlichen Pflegeplan vor",
]

export function QuizLanding() {
  const goNext = useQuizStore((s) => s.goNext)

  return (
    <div className="flex min-h-[80dvh] flex-col justify-between animate-fade-in-up">
      <div className="flex-1 flex flex-col justify-center">
        <h1 className="font-header text-3xl leading-tight text-white mb-4">
          FINDE IN 2 MINUTEN HERAUS, WAS DEINE HAARE WIRKLICH BRAUCHEN
        </h1>
        <p className="text-sm text-white/60 mb-6 leading-relaxed">
          TomBot analysiert dein Haar nach der Methode von Haar-Experte Tom Hannemann und sagt dir, was DEINE Haare tatsaechlich brauchen.
        </p>
        <ul className="space-y-3 mb-8">
          {bullets.map((text) => (
            <li key={text} className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#F5C518]/20">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 6L5 8.5L9.5 4" stroke="#F5C518" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="text-sm text-white/80">{text}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-2">
        <Button
          onClick={goNext}
          className="w-full h-12 text-base font-bold tracking-wide rounded-xl"
          style={{ background: "linear-gradient(135deg, #F5C518, #D4A800)" }}
        >
          QUIZ STARTEN
        </Button>
        <p className="text-center text-xs text-white/38">
          Dauert ca. 2 Minuten. Du kannst nichts falsch machen.
        </p>
      </div>
    </div>
  )
}
