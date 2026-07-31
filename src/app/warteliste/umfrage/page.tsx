import type { Metadata } from "next"
import Link from "next/link"

import { WaitlistProgress } from "@/components/waitlist/waitlist-progress"
import { WaitlistShell } from "@/components/waitlist/waitlist-shell"
import { WaitlistSurvey } from "@/components/waitlist/waitlist-survey"
import { WAITLIST_SURVEY_ID } from "@/lib/waitlist/config"

export const metadata: Metadata = {
  title: "Ein letzter Schritt ...",
  robots: { index: false, follow: false },
}

const BADGES = ["100 % kostenlos", "60 Sekunden", "Start am 9. August"]

export default function WaitlistSurveyPage() {
  return (
    <WaitlistShell>
      <WaitlistProgress percent={8} label="Fast geschafft" />

      <section className="mt-8 text-center">
        <p className="font-mono text-xs font-medium uppercase tracking-wider text-[var(--brand-plum)]">
          Fast geschafft
        </p>
        <h1 className="mt-4 font-display text-[1.75rem] font-semibold leading-tight text-foreground sm:text-[2.25rem]">
          Dein Platz steht.
          <br />
          Jetzt machen wir ihn passend.
        </h1>
        <p className="mx-auto mt-4 max-w-lg leading-relaxed text-muted-foreground">
          Beantworte die kurzen Fragen, damit wir den Start am 9. August auf Haare wie deine
          ausrichten. Wir lesen jede einzelne Antwort.
        </p>
        <p className="mt-4 text-sm font-semibold text-foreground">Dauert weniger als 60 Sekunden</p>

        <ul className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {BADGES.map((badge) => (
            <li
              key={badge}
              className="rounded-full border border-border bg-card px-3.5 py-1.5 font-mono text-[11px] font-medium uppercase tracking-wider text-[var(--brand-plum)]"
            >
              {badge}
            </li>
          ))}
        </ul>
      </section>

      {WAITLIST_SURVEY_ID ? (
        <div className="mt-9">
          <WaitlistSurvey surveyId={WAITLIST_SURVEY_ID} />
        </div>
      ) : (
        <div className="mt-9 rounded-[14px] border border-border bg-card p-6 text-center">
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
          Dein Platz auf der Warteliste ist bereits gesichert. Die Fragen sind freiwillig.
        </p>
      </div>
    </WaitlistShell>
  )
}
