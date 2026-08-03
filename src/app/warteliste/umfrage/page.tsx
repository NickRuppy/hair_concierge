import type { Metadata } from "next"

import { WaitlistShell } from "@/components/waitlist/waitlist-shell"
import { WaitlistSurvey } from "@/components/waitlist/waitlist-survey"
import { LAUNCH_DATE_LABEL, WAITLIST_SURVEY_ID } from "@/lib/waitlist/config"

export const metadata: Metadata = {
  title: "Dein Platz ist gesichert | chaarlie",
  robots: { index: false, follow: false },
}

export default function WaitlistSurveyPage() {
  return (
    <WaitlistShell>
      <section className="text-center">
        <p className="font-mono text-xs font-medium uppercase tracking-wider text-[var(--brand-plum)]">
          Dein Platz ist gesichert
        </p>
        <h1 className="mt-4 font-display text-[2rem] font-semibold leading-tight sm:text-[2.5rem]">
          Wenn du magst, hilf uns noch kurz beim Start.
        </h1>
        <p className="mx-auto mt-4 max-w-lg leading-relaxed text-muted-foreground">
          Die Umfrage dauert weniger als 60 Sekunden und ist freiwillig. Dein Platz auf der
          Warteliste bleibt davon ganz unberührt.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2 text-xs font-semibold text-[var(--brand-plum)]">
          {["Freiwillig", "Unter 60 Sekunden", `Start am ${LAUNCH_DATE_LABEL}`].map((label) => (
            <span key={label} className="rounded-full bg-[var(--brand-lavender)] px-3 py-1.5">
              {label}
            </span>
          ))}
        </div>
      </section>
      {WAITLIST_SURVEY_ID ? (
        <WaitlistSurvey surveyId={WAITLIST_SURVEY_ID} />
      ) : (
        <section className="mt-9 rounded-[14px] border border-border bg-card p-6 text-center">
          <p className="text-muted-foreground">
            Die Umfrage ist gerade nicht verfügbar. Dein Platz ist trotzdem gesichert.
          </p>
          <a
            href="/warteliste/danke"
            className="mt-4 inline-block text-sm font-semibold text-[var(--brand-plum)] underline underline-offset-4"
          >
            Zum letzten Schritt
          </a>
        </section>
      )}
    </WaitlistShell>
  )
}
