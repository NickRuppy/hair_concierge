type ValueBlock = {
  paths: React.ReactNode
  title: string
  body: string
}

const valueBlocks: ValueBlock[] = [
  {
    paths: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </>
    ),
    title: "2 Minuten, klares Ergebnis",
    body: "Ein strukturierter Selbsttest, der die richtigen Fragen stellt. Kein endloses Formular, kein generisches Resultat.",
  },
  {
    paths: <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />,
    title: "Konkrete Produktempfehlungen",
    body: "Nicht „nimm halt einen Conditioner“. Sondern: dieser Conditioner, weil dein Zugtest Folgendes zeigt. Plus Drogerie-Alternative.",
  },
  {
    paths: (
      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
    ),
    title: "Begleitung statt Einmal-Test",
    body: "Deine Routine wächst mit dir. Fragen kommen auf? Anpassungen nötig? Du bekommst Unterstützung.",
  },
  {
    paths: <path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
    title: "Friseurmeisterlich beraten",
    body: "Friseurmeister Tom Hannemann begleitet das Team beratend. Keine Heilsversprechen, nur ehrliche Empfehlungen.",
  },
]

export function WhatIs() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-7xl px-6">
        <div>
          <span className="mb-3 block font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--brand-plum)]">
            Was ist Chaarlie
          </span>
          <h2
            className="mb-4 font-header font-medium leading-[1.2] text-[var(--brand-plum-darkest)]"
            style={{ fontSize: "clamp(28px, 4vw, 44px)" }}
          >
            Eine ehrliche Haaranalyse statt Marketing-Versprechen.
          </h2>
          <p className="max-w-[640px] text-lg text-muted-foreground">
            Chaarlie ist eine digitale Beratung f&uuml;r deine Haarpflege. Du machst einen
            Selbsttest in 2 Minuten, bekommst eine klare Einsch&auml;tzung deines Haarprofils und
            eine Routine, die zu deinen Haaren passt. Inklusive konkreter Produktvorschl&auml;ge mit
            g&uuml;nstigen Drogerie-Alternativen.
          </p>
        </div>

        <div className="mt-10 grid items-center gap-8 md:grid-cols-2 md:gap-16">
          <div className="flex flex-col gap-5">
            {valueBlocks.map((block) => (
              <div key={block.title} className="flex items-start gap-4">
                <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-[10px] bg-[var(--brand-plum-ice)] text-[var(--brand-plum)]">
                  <svg
                    aria-hidden="true"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {block.paths}
                  </svg>
                </span>
                <div>
                  <h3 className="mb-1 text-base font-bold text-[var(--brand-plum-darkest)] sm:text-[17px]">
                    {block.title}
                  </h3>
                  <p className="text-[15px] leading-relaxed text-muted-foreground">{block.body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="relative flex min-h-[380px] items-center justify-center overflow-hidden rounded-3xl bg-[var(--brand-plum-ice)] p-12">
            <div className="max-w-[280px] rounded-[18px] bg-white p-6 shadow-[0_20px_60px_-10px_rgba(42,24,69,0.2)]">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--brand-plum)]/60">
                Frage 4 / 6
              </p>
              <p className="mb-5 font-header text-xl text-[var(--brand-plum-darkest)]">
                Wie elastisch ist dein Haar?
              </p>
              <div className="flex flex-col gap-2">
                <div className="rounded-[10px] border-[1.5px] border-border px-3.5 py-2.5 text-[13px] text-foreground">
                  Dehnt sich, geht zur&uuml;ck
                </div>
                <div className="rounded-[10px] border-[1.5px] border-[var(--brand-plum)] bg-[var(--brand-plum-ice)] px-3.5 py-2.5 text-[13px] text-foreground">
                  Bleibt ausgeleiert
                </div>
                <div className="rounded-[10px] border-[1.5px] border-border px-3.5 py-2.5 text-[13px] text-foreground">
                  Rei&szlig;t sofort
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
