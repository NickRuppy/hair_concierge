"use client"

import { useQuizStore } from "@/lib/quiz/store"
import { Button } from "@/components/ui/button"

const bullets = [
  "Individuelle Analyse statt pauschaler Tipps",
  "Versteht Ursachen wie Proteinmangel, Trockenheit oder Kopfhautstress",
  "Bereitet deinen persönlichen Pflegeplan vor",
]

export function QuizLanding() {
  const goNext = useQuizStore((s) => s.goNext)

  return (
    <div className="flex flex-col animate-fade-in-up">
      <div className="flex-1 flex flex-col justify-center">
        <h1 className="font-header text-4xl leading-tight text-foreground mb-4">
          Finde in 2 Minuten heraus, was deine Haare wirklich brauchen
        </h1>
        <p className="text-base text-muted-foreground mb-6 leading-relaxed">
          Hair Concierge analysiert dein Haar und zeigt dir, was deine Haare tatsächlich brauchen.
        </p>
        <ul className="space-y-3 mb-8">
          {bullets.map((text) => (
            <li key={text} className="flex items-start gap-2.5">
              <span
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                style={{ background: "rgba(var(--brand-plum-rgb), 0.15)" }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M2.5 6L5 8.5L9.5 4"
                    stroke="var(--brand-plum)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className="text-base text-foreground">{text}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-2">
        <Button
          onClick={goNext}
          variant="unstyled"
          className="quiz-btn-primary w-full h-14 text-base font-bold tracking-wide rounded-xl"
        >
          Quiz starten
        </Button>
        <p className="text-center text-sm text-[var(--text-caption)]">
          Dauert ca. 2 Minuten. Du kannst nichts falsch machen.
        </p>
        <p className="text-center text-sm text-muted-foreground pt-2">
          <a href="/auth" className="underline hover:text-foreground transition-colors">
            Du hast bereits ein Konto? Hier anmelden
          </a>
        </p>
      </div>
    </div>
  )
}
