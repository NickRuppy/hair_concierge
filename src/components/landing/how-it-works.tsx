import Link from "next/link"

import { SectionHeading } from "@/components/landing/section-heading"

type Step = {
  number: string
  title: string
  body: string
}

const steps: Step[] = [
  {
    number: "1",
    title: "Haaranalyse machen",
    body: "2 Minuten, 10 Fragen. Zugtest, Oberfläche, Kopfhaut, deine Ziele.",
  },
  {
    number: "2",
    title: "Haarprofil erhalten",
    body: "Dein Profil sofort sichtbar. Dein größter Pflege-Hebel klar benannt.",
  },
  {
    number: "3",
    title: "Routine starten",
    body: "Deine Routine mit konkreten Produkten und Drogerie-Alternativen. Direkt anwendbar.",
  },
]

export function HowItWorks() {
  return (
    <section className="border-y border-border bg-card py-20">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading
          eyebrow="So funktioniert's"
          title="In drei Schritten zu deiner Routine."
          lede="Ohne Anmeldung starten. Ergebnis sofort sehen."
        />

        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {steps.map((step) => (
            <div
              key={step.number}
              className="rounded-[18px] border border-border bg-background p-8"
            >
              <div className="mb-4 font-header text-5xl font-medium italic leading-none text-[var(--brand-plum)]">
                {step.number}
              </div>
              <h3 className="mb-2.5 text-lg font-bold text-[var(--brand-plum-darkest)]">
                {step.title}
              </h3>
              <p className="text-[15px] leading-relaxed text-muted-foreground">{step.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-center">
          <Link
            href="/quiz"
            prefetch={false}
            className="block w-full max-w-[440px] rounded-[14px] bg-[linear-gradient(180deg,var(--brand-coral),var(--brand-coral-dark))] px-8 py-4 text-center text-white shadow-[0_10px_32px_rgba(var(--brand-coral-rgb),0.31),inset_0_1px_0_rgba(255,255,255,0.22)] transition-all hover:bg-[linear-gradient(180deg,var(--brand-coral),var(--brand-coral-deep))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral-dark)] focus-visible:ring-offset-2 motion-safe:hover:-translate-y-0.5"
          >
            <span className="block text-lg font-bold text-white">
              Kostenlose Haaranalyse starten
            </span>
            <span className="mt-0.5 block text-[13px] font-normal text-white/85">
              2 Minuten · ohne Anmeldung
            </span>
          </Link>
        </div>
      </div>
    </section>
  )
}
