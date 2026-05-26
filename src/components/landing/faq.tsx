import Link from "next/link"

import { SectionHeading } from "@/components/landing/section-heading"

type FaqItem = {
  question: string
  answer: React.ReactNode
}

const items: FaqItem[] = [
  {
    question: "Wie unterscheidet sich Chaarlie von anderen Beauty-Quizzes?",
    answer:
      "Klassische Beauty-Quizzes fragen nach deinem Haartyp und schlagen dir eine Produkt-Range vor. Chaarlie kombiniert zwei Dinge: dein vollständiges Haarprofil (Struktur, Protein-Feuchtigkeit-Balance, Kopfhaut etc.) und deine tatsächliche Routine (Wäsche, Hitze-Styling, Nachtpflege etc.). Daraus bekommst du konkrete Empfehlungen mit echten Produktnamen — inklusive Drogerie-Alternativen. Kein Verkauf eigener Produkte.",
  },
  {
    question: "Brauche ich Vorwissen zur Haarpflege?",
    answer:
      "Nein. Das Quiz erklärt dir alles, was du wissen musst, während du es ausfüllst. Wenn du dich noch nie mit Haarpflege beschäftigt hast, ist Chaarlie genau für dich gebaut.",
  },
  {
    question: "Wie lange dauert es, bis ich Ergebnisse sehe?",
    answer:
      "Dein Haarprofil und die Routine bekommst du sofort nach dem Quiz. Sichtbare Veränderungen im Haar selbst hängen vom Ausgangszustand ab — in der Regel zeigen sich Effekte nach 2 bis 4 Wochen konsequenter Anwendung der empfohlenen Routine.",
  },
  {
    question: "Kann ich jederzeit kündigen?",
    answer:
      "Ja. Alle Pläne sind monatlich, quartalsweise oder jährlich kündbar — zum Ende der jeweiligen Abrechnungsperiode.",
  },
  {
    question: "Sind die empfohlenen Produkte teuer?",
    answer:
      "Wir empfehlen Produkte für jeden Preisbereich. Für jedes Salon-Produkt gibt es auch eine Drogerie-Alternative, die ähnlich gut funktioniert. Du entscheidest, was zu deinem Budget passt.",
  },
  {
    question: "Wer steht hinter Chaarlie?",
    answer:
      "Chaarlie ist ein Produkt der Haarmony LLC (Delaware, USA). Friseurmeister Tom Hannemann begleitet das Team beratend. Wir verkaufen keine eigenen Produkte und sind keinem Hersteller verpflichtet.",
  },
  {
    question: "Was passiert mit meinen Daten?",
    answer: (
      <>
        Deine Antworten werden ausschließlich verwendet, um deine persönliche Diagnose und Routine
        zu erstellen. Wir verkaufen keine Daten an Dritte. Details findest du in unserer{" "}
        <Link href="/datenschutz" className="underline hover:text-[var(--brand-plum-darkest)]">
          Datenschutzerklärung
        </Link>
        .
      </>
    ),
  },
]

export function Faq() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-[720px] px-6">
        <SectionHeading
          eyebrow="FAQ"
          title="Die häufigsten Fragen."
          lede="Antworten auf das, was du wissen solltest, bevor du loslegst."
        />

        <div className="mt-12 flex flex-col gap-3">
          {items.map((item) => (
            <details
              key={item.question}
              className="group overflow-hidden rounded-[14px] border border-border bg-card transition-colors open:border-[var(--brand-plum-light)]"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 text-base font-semibold text-[var(--brand-plum-darkest)] [&::-webkit-details-marker]:hidden">
                <span>{item.question}</span>
                <span
                  aria-hidden="true"
                  className="text-[22px] font-normal text-[var(--brand-plum)] transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <div className="px-6 pb-5 text-[15px] leading-relaxed text-muted-foreground">
                {item.answer}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
