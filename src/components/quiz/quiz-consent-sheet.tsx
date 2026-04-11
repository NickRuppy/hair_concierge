"use client"

import { QuizCard } from "./quiz-card"
import { Button } from "@/components/ui/button"

interface QuizConsentSheetProps {
  open: boolean
  saving: boolean
  onConsent: (accepted: boolean) => void
}

export function QuizConsentSheet({ open, saving, onConsent }: QuizConsentSheetProps) {
  if (!open) return null

  return (
    <div className="animate-fade-in-up">
      <QuizCard className="px-6 py-6">
        {/* Envelope icon */}
        <div
          className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
          style={{ background: "rgba(var(--brand-plum-rgb), 0.15)" }}
        >
          <span className="text-2xl">&#9993;&#65039;</span>
        </div>

        <h3 className="font-header text-center text-xl text-foreground mb-2">
          Duerfen wir dir Haarpflege-Tipps schicken?
        </h3>

        {/* Plum divider */}
        <div className="mx-auto mb-3 h-0.5 w-10 rounded-full bg-[var(--brand-plum)]" />

        <p className="text-center text-sm font-semibold text-foreground mb-1">
          Experten-Tipps, Produkt-News und exklusive Angebote.
        </p>
        <p className="text-center text-xs text-[var(--text-caption)] mb-6 leading-relaxed">
          Du kannst dich jederzeit abmelden über den Link in unseren E-Mails. Unsere{" "}
          <a href="/datenschutz" target="_blank" className="underline hover:text-muted-foreground">
            Datenschutzerklärung
          </a>{" "}
          findest du hier.
        </p>

        <Button
          onClick={() => onConsent(true)}
          disabled={saving}
          variant="unstyled"
          className="quiz-btn-primary w-full h-14 text-base font-bold tracking-wide rounded-xl mb-3"
        >
          {saving ? "Wird gespeichert..." : "Ja, weiter zu meinem Plan"}
        </Button>
        <button
          onClick={() => onConsent(false)}
          disabled={saving}
          className="w-full text-center text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
        >
          Nein, nur meinen Plan schicken
        </button>
      </QuizCard>
    </div>
  )
}
