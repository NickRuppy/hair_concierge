const pains = [
  "Ein Badezimmer voller Produkte, die nicht halten, was sie versprechen.",
  "Frizz, Spliss oder platte Längen — trotz teurer Pflege.",
  "Jede Empfehlung im Internet sagt etwas anderes.",
] as const

export function PainStrip() {
  return (
    <section className="bg-[var(--brand-plum-darkest)] pb-9 pt-[88px] text-white lg:pt-[110px]">
      <div className="mx-auto grid max-w-7xl gap-2 px-6">
        <div className="max-w-[660px]">
          <h2 className="mb-2 font-header text-[21px] font-medium text-white">
            Kommt dir das bekannt vor?
          </h2>
          {pains.map((pain) => (
            <p key={pain} className="flex items-baseline gap-2.5 text-[15px] text-white/80">
              <span aria-hidden="true" className="shrink-0 text-[var(--brand-plum-light)]">
                —
              </span>
              {pain}
            </p>
          ))}
          <p className="mt-4 max-w-[520px] text-[15px] text-white">
            Alle drei haben dieselbe Ursache: Produkte, die nicht zu deinem Haar passen. Deshalb
            beginnt Chaarlie mit einer Analyse — nicht mit einer Empfehlung.
          </p>
        </div>
      </div>
    </section>
  )
}
