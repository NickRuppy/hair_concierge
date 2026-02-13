"use client"

import { QuizCard } from "./quiz-card"
import { Button } from "@/components/ui/button"

interface QuizConsentSheetProps {
  open: boolean
  onConsent: (accepted: boolean) => void
}

export function QuizConsentSheet({ open, onConsent }: QuizConsentSheetProps) {
  if (!open) return null

  return (
    <div className="animate-fade-in-up">
      <QuizCard className="px-6 py-6">
        {/* Envelope icon */}
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#F5C518]/20">
          <span className="text-2xl">&#9993;&#65039;</span>
        </div>

        <h3 className="font-header text-center text-xl text-white mb-2">
          DUERFEN WIR DIR HAARPFLEGE-TIPPS SCHICKEN?
        </h3>

        {/* Yellow divider */}
        <div className="mx-auto mb-3 h-0.5 w-10 rounded-full bg-[#F5C518]" />

        <p className="text-center text-sm font-semibold text-white/80 mb-1">
          Experten-Tipps, Produkt-News und exklusive Angebote.
        </p>
        <p className="text-center text-xs text-white/38 mb-6 leading-relaxed">
          Du kannst dich jederzeit abmelden ueber den Link in unseren E-Mails. Unsere Datenschutzerklaerung findest du hier.
        </p>

        <Button
          onClick={() => onConsent(true)}
          variant="unstyled"
          className="quiz-btn-primary w-full h-14 text-base font-bold tracking-wide rounded-xl mb-3"
        >
          JA, WEITER ZU MEINEM PLAN
        </Button>
        <button
          onClick={() => onConsent(false)}
          className="w-full text-center text-sm text-white/60 underline underline-offset-2 hover:text-white/80 transition-colors"
        >
          Nein, nur meinen Plan schicken
        </button>
      </QuizCard>
    </div>
  )
}
