import type { Metadata } from "next"

import { WaitlistForm } from "@/components/waitlist/waitlist-form"
import { WaitlistShell } from "@/components/waitlist/waitlist-shell"
import { FOUNDING_COHORT_SIZE, LAUNCH_DATE_LABEL } from "@/lib/waitlist/config"

export const metadata: Metadata = {
  title: "Warteliste | chaarlie",
  description: `Am ${LAUNCH_DATE_LABEL} öffnet chaarlie für die erste Gründungs-Runde.`,
  robots: { index: false, follow: false },
}
const proof = [
  ["4.000+", "Frauen haben mit uns über ihre Haarpflege gesprochen."],
  ["82 %", "wollen endlich verstehen, was ihr Haar braucht."],
  ["63 %", "wissen nicht, welche Produkte wirklich passen."],
]

export default function WaitlistPage() {
  return (
    <WaitlistShell>
      <section>
        <p className="mb-4 font-mono text-xs font-medium uppercase tracking-wider text-[var(--brand-plum)]">
          Warteliste · Start am {LAUNCH_DATE_LABEL}
        </p>
        <h1 className="font-display text-[2rem] font-semibold leading-[1.12] sm:text-[2.75rem]">
          Versteh endlich, was dein Haar wirklich braucht.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
          chaarlie macht aus deiner Haarstruktur, Kopfhaut und deinem Alltag eine Routine aus
          wenigen Produkten, die zusammenpassen. Am {LAUNCH_DATE_LABEL} öffnen wir für die erste
          Gründungs-Runde.
        </p>
        <div className="mt-8 rounded-[14px] border border-border bg-card p-5 shadow-sm sm:p-6">
          <p className="mb-4 text-sm font-semibold">Sichere dir deinen Platz auf der Warteliste</p>
          <WaitlistForm />
        </div>
      </section>
      <section className="mt-14 border-t border-border pt-10">
        <h2 className="font-display text-2xl font-semibold">Warum wir das bauen</h2>
        <p className="mt-4 max-w-xl leading-relaxed text-muted-foreground">
          Wir haben über 4.000 Frauen gefragt, was in ihrer Haarpflege schiefgeht. Die Antworten
          zeigen ein klares Muster: Es fehlt nicht an Disziplin oder Budget, sondern an einer
          verlässlichen Einordnung, welche Produkte zu genau diesem Haar passen und in welcher
          Reihenfolge sie benutzt werden.
        </p>
        <dl className="mt-7 grid gap-4 sm:grid-cols-3">
          {proof.map(([value, label]) => (
            <div key={value} className="rounded-xl border border-border bg-card p-4">
              <dt className="font-display text-2xl font-semibold text-[var(--brand-plum)]">
                {value}
              </dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{label}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="mt-14 border-t border-border pt-10">
        <h2 className="font-display text-2xl font-semibold">So läuft es ab</h2>
        <ol className="mt-6 space-y-5">
          {[
            [
              "Du trägst dich ein",
              "Vorname und E-Mail reichen. Damit ist dein Platz auf der Warteliste gesichert.",
            ],
            ["Wenn du magst: kurze Umfrage", "Sie hilft uns beim Start, ist aber freiwillig."],
            [
              `Am ${LAUNCH_DATE_LABEL} geht es los`,
              `Die ersten ${FOUNDING_COHORT_SIZE} Plätze erhalten den Gründungspreis dauerhaft.`,
            ],
          ].map(([title, text], index) => (
            <li key={title} className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand-plum)] font-mono text-sm text-white">
                {index + 1}
              </span>
              <div>
                <p className="font-semibold">{title}</p>
                <p className="mt-1 text-muted-foreground">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <section className="mt-14 rounded-[14px] border border-border bg-card p-6 text-center sm:p-8">
        <h2 className="font-display text-2xl font-semibold">Am {LAUNCH_DATE_LABEL} öffnen wir</h2>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">
          Die Warteliste kommt zuerst rein. Die erste Runde ist auf {FOUNDING_COHORT_SIZE} Plätze
          begrenzt und der Gründungspreis bleibt dauerhaft erhalten.
        </p>
        <div className="mx-auto mt-6 max-w-sm">
          <WaitlistForm />
        </div>
      </section>
    </WaitlistShell>
  )
}
