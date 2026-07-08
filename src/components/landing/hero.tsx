import Link from "next/link"

import { ResultPreviewPhone } from "@/components/landing/result-preview-phone"

const trustMarkers = ["Kostenlos", "Ohne Anmeldung", "DSGVO-konform"] as const

export function Hero() {
  return (
    <section
      id="top"
      className="overflow-hidden bg-[linear-gradient(180deg,var(--background)_0%,var(--brand-plum-ice)_100%)] pt-10 lg:pt-14"
    >
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-9 px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
        <div>
          <p className="mb-3.5 flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.11em] text-[var(--brand-coral)] before:inline-block before:h-1.5 before:w-1.5 before:rounded-full before:bg-[var(--brand-coral)] before:content-['']">
            Kostenlose 2-Minuten-Haaranalyse
          </p>
          <h1 className="mb-4 font-header text-[clamp(31px,8vw,54px)] font-medium leading-[1.1] text-[var(--brand-plum-darkest)]">
            In 2 Minuten weißt du, was deine Haare{" "}
            <em className="font-medium italic text-[var(--brand-plum)]">wirklich</em> brauchen.
          </h1>
          <p className="mb-6 max-w-[480px] text-[17px] text-muted-foreground">
            Ehrliche Analyse statt Marketing — dein{" "}
            <b className="font-semibold text-[var(--brand-plum-darkest)]">Haarprofil</b>, deine{" "}
            <b className="font-semibold text-[var(--brand-plum-darkest)]">Routine</b>, deine{" "}
            <b className="font-semibold text-[var(--brand-plum-darkest)]">Produkte</b>.
          </p>

          <Link
            href="/quiz"
            prefetch={false}
            className="block max-w-[440px] rounded-[14px] bg-[linear-gradient(180deg,var(--brand-coral),var(--brand-coral-dark))] px-8 py-4 text-center text-white shadow-[0_10px_32px_rgba(var(--brand-coral-rgb),0.31),inset_0_1px_0_rgba(255,255,255,0.22)] transition-all hover:bg-[linear-gradient(180deg,var(--brand-coral),var(--brand-coral-deep))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral-dark)] focus-visible:ring-offset-2 motion-safe:hover:-translate-y-0.5"
          >
            <span className="block text-lg font-bold text-white">
              Kostenlose Haaranalyse starten
            </span>
            <span className="mt-0.5 block text-[13px] font-normal text-white/85">
              2 Minuten · ohne Anmeldung · Ergebnis sofort
            </span>
          </Link>

          <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 font-mono text-[10.5px] uppercase tracking-[0.07em] text-muted-foreground">
            {trustMarkers.map((label) => (
              <span key={label} className="flex items-center gap-1">
                <span aria-hidden="true" className="text-[#2D9F5E]">
                  ✓
                </span>
                {label}
              </span>
            ))}
          </p>
        </div>

        <div className="-mb-[70px] lg:-mb-[90px]">
          <ResultPreviewPhone />
        </div>
      </div>
    </section>
  )
}
