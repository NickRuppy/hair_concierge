import type { Metadata } from "next"
import Link from "next/link"

import { WaitlistShell } from "@/components/waitlist/waitlist-shell"
import { WaitlistSurvey } from "@/components/waitlist/waitlist-survey"
import { WAITLIST_SURVEY_ID } from "@/lib/waitlist/config"

export const metadata: Metadata = {
  title: "Fast geschafft | chaarlie",
  robots: { index: false, follow: false },
}

export default function WaitlistSurveyPage() {
  return (
    <WaitlistShell>
      <section className="text-center">
        <p className="font-mono text-xs font-medium uppercase tracking-wider text-[var(--brand-plum)]">
          Schritt 2 von 3
        </p>
        <h1 className="mt-4 font-display text-[1.75rem] font-semibold leading-tight text-foreground sm:text-[2.25rem]">
          Du bist drin. Jetzt kommt der Teil, der uns wirklich hilft.
        </h1>
        <p className="mx-auto mt-4 max-w-lg leading-relaxed text-muted-foreground">
          Zwei Minuten über deine Haare. Wir lesen jede einzelne Antwort und bauen den Start genau
          um das herum, was hier zusammenkommt.
        </p>
      </section>

      {WAITLIST_SURVEY_ID ? (
        <div className="mt-8">
          <WaitlistSurvey surveyId={WAITLIST_SURVEY_ID} />
        </div>
      ) : (
        <div className="mt-8 rounded-[14px] border border-border bg-card p-6 text-center">
          <p className="leading-relaxed text-muted-foreground">
            Die Fragen sind gleich für dich bereit. Wir schicken sie dir per E-Mail, sobald sie
            online sind.
          </p>
        </div>
      )}

      <div className="mt-8 text-center">
        <Link
          href="/warteliste/danke"
          className="inline-block rounded-[10px] bg-[var(--brand-coral)] px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-[var(--brand-coral-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral)] focus-visible:ring-offset-2"
        >
          Weiter zum letzten Schritt
        </Link>
        <p className="mt-3 text-xs text-muted-foreground">
          Dein Platz auf der Warteliste ist schon gesichert. Die Fragen sind freiwillig.
        </p>
      </div>
    </WaitlistShell>
  )
}
