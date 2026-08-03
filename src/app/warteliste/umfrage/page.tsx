import type { Metadata } from "next"

import { WaitlistProgress } from "@/components/waitlist/waitlist-progress"
import { WaitlistShell } from "@/components/waitlist/waitlist-shell"
import { WaitlistSurvey } from "@/components/waitlist/waitlist-survey"
import { LAUNCH_DATE_LABEL, WAITLIST_SURVEY_ID } from "@/lib/waitlist/config"

export const metadata: Metadata = {
  title: "Ein letzter Schritt ...",
  robots: { index: false, follow: false },
}

export default function WaitlistSurveyPage() {
  return (
    <WaitlistShell>
      <WaitlistProgress percent={67} label="Fast geschafft" />

      <section className="mt-8 text-center">
        <p className="font-mono text-xs font-medium uppercase tracking-wider text-[var(--brand-plum)]">
          Fast geschafft
        </p>
        <h1 className="mt-4 font-display text-[1.75rem] font-semibold leading-tight sm:text-[2.25rem]">
          Dein Platz ist fast gesichert
        </h1>
        <p className="mx-auto mt-4 max-w-lg leading-relaxed text-muted-foreground">
          Ein letzter Schritt, damit wir chaarlie auf dich und deine Haare abstimmen können. Danach
          schalten wir dir die kostenlosen Ressourcen in unserer WhatsApp-Community frei.
        </p>
        <p className="mt-4 text-sm font-semibold">Dauert weniger als 60 Sekunden</p>
        <ul className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {["100 % kostenlos", "60 Sekunden", `Start am ${LAUNCH_DATE_LABEL}`].map((badge) => (
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
        <WaitlistSurvey surveyId={WAITLIST_SURVEY_ID} />
      ) : (
        <section className="mt-9 rounded-[14px] border border-border bg-card p-6 text-center">
          <p className="text-muted-foreground">
            Die Umfrage ist gerade nicht verfügbar. Deine Anmeldung ist gespeichert.
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
