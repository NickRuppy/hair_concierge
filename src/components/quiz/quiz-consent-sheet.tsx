"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

interface QuizConsentSheetProps {
  open: boolean
  saving: boolean
  onConsent: (accepted: boolean) => void
}

export function QuizConsentSheet({ open, saving, onConsent }: QuizConsentSheetProps) {
  const [pendingChoice, setPendingChoice] = useState<boolean | null>(null)

  if (!open) return null

  const handleChoice = (accepted: boolean) => {
    setPendingChoice(accepted)
    onConsent(accepted)
  }

  return (
    <section className="mx-auto w-full max-w-[40rem] animate-fade-in-up">
      <h1 className="mt-6 text-balance text-center font-header text-[2rem] font-medium leading-tight text-[var(--brand-plum-darkest)] outline-none focus:outline-none sm:text-[2.4rem]">
        Dürfen wir dir Haarpflege-Tipps schicken?
      </h1>
      <p className="mt-3 text-center leading-7 text-[var(--text-sub)]">
        Deine Auswertung bekommst du in jedem Fall. Mit Ja erlaubst du zusätzliche Tipps,
        Produkt-News und Angebote per E-Mail.
      </p>
      <div className="mt-7 grid gap-3">
        <Button
          onClick={() => handleChoice(true)}
          disabled={saving}
          className="h-12 text-base"
          variant="cta"
        >
          {saving && pendingChoice === true ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Wird gespeichert…
            </>
          ) : (
            "Ja, weiter zu meiner Auswertung"
          )}
        </Button>
        <Button
          onClick={() => handleChoice(false)}
          disabled={saving}
          className="h-12 rounded-[14px] border-[var(--brand-plum-light)] bg-white text-base text-[var(--brand-plum-darkest)] hover:bg-[var(--brand-plum-ice)]"
          variant="outline"
        >
          {saving && pendingChoice === false ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Wird gespeichert…
            </>
          ) : (
            "Nein, nur meine Auswertung schicken"
          )}
        </Button>
      </div>
      <p className="mt-5 text-center text-xs leading-5 text-[var(--text-sub)]">
        Du kannst dich jederzeit über den Link in unseren E-Mails abmelden. Mehr dazu in unserer{" "}
        <a className="underline hover:text-foreground" href="/datenschutz" target="_blank">
          Datenschutzerklärung
        </a>
        .
      </p>
    </section>
  )
}
