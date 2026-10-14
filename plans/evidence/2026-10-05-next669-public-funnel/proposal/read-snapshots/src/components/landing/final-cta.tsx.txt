import Link from "next/link"

export function FinalCta() {
  return (
    <section className="mx-6 my-12 max-w-[1100px] md:mx-auto">
      <div className="rounded-3xl bg-[var(--brand-plum-darkest)] px-6 py-10 text-center text-white sm:px-12 sm:py-16">
        <h2
          className="mx-auto mb-3.5 font-header font-medium leading-[1.2] text-white"
          style={{ fontSize: "clamp(28px, 4vw, 40px)" }}
        >
          Bereit für eine Pflege, die besser zu deinen{" "}
          <em className="font-medium italic text-[var(--brand-plum-light)]">Haaren passt?</em>
        </h2>
        <p
          className="mx-auto mb-8 max-w-[520px] text-[17px]"
          style={{ color: "rgba(255,255,255,0.75)" }}
        >
          Zwei Minuten. Kostenlos. Ohne Anmeldung. Dein Haarprofil sofort.
        </p>
        <Link
          href="/quiz"
          prefetch={false}
          className="inline-block rounded-[14px] bg-[var(--brand-coral)] px-9 py-[18px] text-[17px] font-bold text-white transition-all hover:bg-white hover:text-[var(--brand-plum-darkest)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2"
        >
          Kostenlose Haaranalyse starten
        </Link>
      </div>
    </section>
  )
}
