type Step = {
  number: string
  title: string
  body: string
}

const steps: Step[] = [
  {
    number: "1",
    title: "Quiz machen",
    body: "2 Minuten, sechs Fragen. Zugtest, Oberfläche, Kopfhaut, deine Ziele.",
  },
  {
    number: "2",
    title: "Diagnose erhalten",
    body: "Dein Haarprofil sofort sichtbar. Dein größter Pflegehebel klar benannt.",
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
        <div>
          <span className="mb-3 block font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--brand-plum)]">
            So funktioniert&apos;s
          </span>
          <h2
            className="mb-4 font-header font-medium leading-[1.2] text-[var(--brand-plum-darkest)]"
            style={{ fontSize: "clamp(28px, 4vw, 44px)" }}
          >
            In drei Schritten zu deiner Routine.
          </h2>
          <p className="max-w-[640px] text-lg text-muted-foreground">
            Ohne Anmeldung starten. Ergebnis sehen. Dann entscheiden.
          </p>
        </div>

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
      </div>
    </section>
  )
}
