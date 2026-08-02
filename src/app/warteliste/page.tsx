import type { Metadata } from "next"

import { WaitlistForm } from "@/components/waitlist/waitlist-form"
import { WaitlistShell } from "@/components/waitlist/waitlist-shell"
import { FOUNDING_COHORT_SIZE, LAUNCH_DATE_LABEL } from "@/lib/waitlist/config"

export const metadata: Metadata = {
  title: "Warteliste | chaarlie",
  description: `Am ${LAUNCH_DATE_LABEL} öffnet chaarlie für die erste Gründungs-Runde. Trag dich ein und sei zuerst dabei.`,
  robots: { index: false, follow: false },
}

const STEPS = [
  {
    title: "Du trägst dich ein",
    body: "Vorname und E-Mail. Mehr brauchen wir jetzt noch nicht.",
  },
  {
    title: "Du erzählst uns von deinen Haaren",
    body: "Zwei Minuten Fragen. Wir bauen den Start um die Antworten der Warteliste herum.",
  },
  {
    title: `Am ${LAUNCH_DATE_LABEL} geht es los`,
    body: `Die Warteliste bekommt den Zugang zuerst, zum Gründungspreis. Nur die ersten ${FOUNDING_COHORT_SIZE} Plätze.`,
  },
]

const PROOF = [
  { value: "4.000+", label: "befragte Frauen zu ihrer Haarpflege" },
  { value: "82 %", label: "wollen endlich verstehen, was ihr Haar braucht" },
  { value: "63 %", label: "wissen nie, welche Produkte wirklich passen" },
]

export default function WaitlistPage() {
  return (
    <WaitlistShell>
      <section>
        <p className="mb-4 font-mono text-xs font-medium uppercase tracking-wider text-[var(--brand-plum)]">
          Warteliste · Start am {LAUNCH_DATE_LABEL}
        </p>

        <h1 className="font-display text-[2rem] font-semibold leading-[1.15] text-foreground sm:text-[2.75rem]">
          Du kaufst nicht die falschen Produkte. Dir hat nur nie jemand gesagt, was dein Haar
          braucht.
        </h1>

        <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
          chaarlie liest deine Haarstruktur, deine Kopfhaut und deinen Alltag aus und macht daraus
          eine Routine aus wenigen Produkten, die zueinander passen. Am {LAUNCH_DATE_LABEL} öffnen
          wir für die erste Gründungs-Runde.
        </p>

        <div className="mt-8 rounded-[14px] border border-border bg-card p-5 shadow-sm sm:p-6">
          <p className="mb-4 text-sm font-semibold text-foreground">
            Sichere dir deinen Platz auf der Warteliste
          </p>
          <WaitlistForm />
        </div>
      </section>

      <section className="mt-14 border-t border-border pt-10">
        <h2 className="font-display text-2xl font-semibold text-foreground">
          Warum wir das überhaupt bauen
        </h2>
        <p className="mt-4 max-w-xl leading-relaxed text-muted-foreground">
          Wir haben über 4.000 Frauen gefragt, was in ihrer Haarpflege schiefgeht. Die Antworten
          waren erstaunlich einheitlich: Es ist nicht die Disziplin und es ist nicht das Budget. Es
          ist, dass niemand sagt, welche drei Produkte zu genau diesem Haar passen und in welcher
          Reihenfolge sie benutzt werden.
        </p>
        <dl className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-3">
          {PROOF.map((item) => (
            <div key={item.label} className="rounded-[12px] border border-border bg-card p-4">
              <dt className="font-display text-2xl font-semibold text-[var(--brand-plum)]">
                {item.value}
              </dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.label}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-14 border-t border-border pt-10">
        <h2 className="font-display text-2xl font-semibold text-foreground">So läuft es ab</h2>
        <ol className="mt-6 flex flex-col gap-5">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand-plum)] font-mono text-sm font-medium text-white">
                {index + 1}
              </span>
              <div>
                <p className="font-semibold text-foreground">{step.title}</p>
                <p className="mt-1 leading-relaxed text-muted-foreground">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-14 border-t border-border pt-10">
        <h2 className="font-display text-2xl font-semibold text-foreground">
          Woher die Methode kommt
        </h2>
        <p className="mt-4 max-w-xl leading-relaxed text-muted-foreground">
          Die Logik dahinter ist kein Bauchgefühl. Zugtest, Oberflächentest und eine saubere
          Einordnung der Kopfhaut sind altes Friseurhandwerk. Neu ist nur, dass wir es konsequent
          in ein System übersetzt haben: über 4.000 Antworten aus der Umfrage, über 1.000 geprüfte
          Produkte, und zu jeder Empfehlung die Begründung, warum sie zu dir passt.
        </p>
      </section>

      <section className="mt-14 rounded-[14px] border border-border bg-card p-6 text-center sm:p-8">
        <h2 className="font-display text-2xl font-semibold text-foreground">
          Am {LAUNCH_DATE_LABEL} öffnen wir
        </h2>
        <p className="mx-auto mt-3 max-w-md leading-relaxed text-muted-foreground">
          Die Warteliste geht zuerst rein, zum Gründungspreis, und behält ihn dauerhaft. Danach gilt
          der reguläre Preis.
        </p>
        <div className="mx-auto mt-6 max-w-sm">
          <WaitlistForm />
        </div>
      </section>
    </WaitlistShell>
  )
}
