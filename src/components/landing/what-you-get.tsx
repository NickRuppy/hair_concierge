import { SectionHeading } from "@/components/landing/section-heading"
import { QUIZ_TOTAL_QUESTIONS } from "@/lib/quiz/questions"

type Item = { title: string; body: React.ReactNode }

const items: Item[] = [
  {
    title: "Dein Haarprofil",
    body: "6 Dimensionen — Struktur, Oberfläche, Kopfhaut, Feuchtigkeit, Protein, Glanz — und dein größter Pflege-Hebel, klar benannt.",
  },
  {
    title: "Deine Routine",
    body: "Was du wann anwendest, wie oft und wie lange. Abgestimmt auf dein Haar, nicht auf einen Haartyp von der Stange.",
  },
  {
    title: "Konkrete Produkte",
    body: (
      <>
        Mit Marke und Größe — und{" "}
        <span className="font-semibold text-[#2D9F5E]">
          immer einer günstigen Drogerie-Alternative
        </span>
        . Wir verkaufen nichts und sind keinem Hersteller verpflichtet.
      </>
    ),
  },
]

const honesty = [
  "Keine eigenen Produkte",
  "Keinem Hersteller verpflichtet",
  "Daten nur für deine Analyse",
] as const

export function WhatYouGet() {
  return (
    <section className="py-14">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading
          eyebrow={`Das bekommst du — sofort nach den ${QUIZ_TOTAL_QUESTIONS} Fragen`}
          title="Keine Produkt-Werbung. Eine Diagnose."
        />

        <div className="mt-7 grid gap-3.5 md:grid-cols-3">
          {items.map((item, index) => (
            <div key={item.title} className="rounded-[18px] border border-border bg-card p-6">
              <p className="mb-2.5 font-header text-3xl font-medium italic leading-none text-[var(--brand-plum)]">
                {index + 1}
              </p>
              <h3 className="mb-1.5 text-[16.5px] font-bold text-[var(--brand-plum-darkest)]">
                {item.title}
              </h3>
              <p className="text-[14.5px] leading-relaxed text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </div>

        <p className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[13px] text-muted-foreground">
          {honesty.map((label) => (
            <span key={label} className="flex items-center gap-1.5">
              <span aria-hidden="true" className="font-bold text-[#2D9F5E]">
                ✓
              </span>
              {label}
            </span>
          ))}
        </p>
      </div>
    </section>
  )
}
