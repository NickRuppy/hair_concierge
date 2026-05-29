import { SectionHeading } from "@/components/landing/section-heading"

type Feature = {
  paths: React.ReactNode
  title: string
  body: string
}

const features: Feature[] = [
  {
    paths: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </>
    ),
    title: "Vollständiges Haarprofil",
    body: "Sechs Dimensionen: Struktur, Oberfläche, Kopfhaut, Feuchtigkeit, Protein, Glanz. Alles auf einen Blick.",
  },
  {
    paths: (
      <>
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
      </>
    ),
    title: "500+ Produktempfehlungen",
    body: "Konkrete Produkte mit Marke und Größe. Inklusive Drogerie-Alternativen für jeden Preisbereich.",
  },
  {
    paths: (
      <>
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </>
    ),
    title: "Deine persönliche Routine",
    body: "Was du wann anwendest. Wie oft. Wie lange. Konkrete Anleitung, kein Ratespiel.",
  },
  {
    paths: <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />,
    title: "Persönlicher Haar-Coach",
    body: "Stelle Fragen, bekomme Antworten. Dein Profil ist gespeichert, du musst nichts wiederholen.",
  },
]

export function Features() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading eyebrow="Was du bekommst" title="Alles in einer App, nichts überflüssig." />

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {features.map((feature) => (
            <div key={feature.title} className="rounded-[18px] border border-border bg-card p-8">
              <span className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-[var(--brand-plum-ice)] text-[var(--brand-plum)]">
                <svg
                  aria-hidden="true"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {feature.paths}
                </svg>
              </span>
              <h3 className="mb-2 text-lg font-bold text-[var(--brand-plum-darkest)]">
                {feature.title}
              </h3>
              <p className="text-[15px] leading-relaxed text-muted-foreground">{feature.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
