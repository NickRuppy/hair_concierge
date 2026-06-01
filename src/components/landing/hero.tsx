import Image from "next/image"
import Link from "next/link"
import { TOM } from "@/data/team"

const outcomeChecks = [
  "Dein Haarprofil",
  "Dein Pflegehebel",
  "Routine & Produkte",
  "Drogerie-Alternativen",
] as const

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="#2D9F5E"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 shrink-0"
      aria-hidden="true"
    >
      <polyline points="16 6 8 14 4 10" />
    </svg>
  )
}

export function Hero() {
  return (
    <section
      id="top"
      className="bg-[linear-gradient(180deg,var(--background)_0%,var(--brand-plum-ice)_100%)] py-20 lg:py-24"
    >
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
        <div>
          <h1 className="mb-5 font-header text-[clamp(36px,5vw,64px)] font-medium leading-[1.1] text-[var(--brand-plum-darkest)]">
            Weißt du, was deine Haare{" "}
            <em className="font-medium italic text-[var(--brand-plum)]">wirklich</em> brauchen?
          </h1>
          <p className="mb-8 max-w-[520px] text-lg text-muted-foreground">
            Chaarlie analysiert dein Haar und zeigt dir, was deine Haare tatsächlich brauchen.
            Individuell, nicht pauschal. In 2 Minuten, kostenlos.
          </p>

          <ul className="grid max-w-[480px] grid-cols-2 gap-2.5">
            {outcomeChecks.map((label) => (
              <li
                key={label}
                className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-3.5 text-sm font-semibold text-[var(--brand-plum-darkest)]"
              >
                <CheckIcon />
                <span>{label}</span>
              </li>
            ))}
          </ul>

          <p className="mt-6 flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--brand-coral)] before:inline-block before:h-1.5 before:w-1.5 before:rounded-full before:bg-[var(--brand-coral)] before:content-['']">
            Starte heute damit
          </p>
        </div>

        <div className="rounded-[20px] border border-border bg-card p-8 shadow-[0_20px_60px_-20px_rgba(42,24,69,0.15)]">
          {/* Custom Link styling instead of <Button variant="landingCta"> because we
              need an anchor element with a multi-line label (CTA + subtitle). */}
          <Link
            href="/quiz"
            className="block rounded-[14px] bg-[linear-gradient(180deg,var(--brand-coral),var(--brand-coral-dark))] px-8 py-[18px] text-center text-white shadow-[0_10px_32px_rgba(var(--brand-coral-rgb),0.31),inset_0_1px_0_rgba(255,255,255,0.22)] transition-all hover:bg-[linear-gradient(180deg,var(--brand-coral),var(--brand-coral-deep))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral-dark)] focus-visible:ring-offset-2 motion-safe:hover:-translate-y-0.5"
          >
            <span className="block text-lg font-bold text-white">Quiz starten</span>
            <span className="mt-1 block text-[13px] font-normal text-white/85">
              In ca. 2 Minuten · Kostenlos
            </span>
          </Link>

          <figure className="mt-6 flex items-start gap-3.5 rounded-[14px] bg-[var(--brand-plum-ice)] p-4">
            <Image
              src={TOM.imageUrl}
              alt={TOM.name}
              width={96}
              height={96}
              className="h-12 w-12 shrink-0 rounded-full border-2 border-[var(--brand-plum-light)] bg-[var(--brand-plum-ice)] object-cover object-[52%_18%]"
            />
            <div>
              <blockquote className="mb-2 font-header text-[15px] italic leading-[1.4] text-[var(--brand-plum-darkest)]">
                „Ich sage es immer: Ohne Analyse ist jede Produktempfehlung Glücksspiel. Deswegen
                empfehle ich genau das hier.“
              </blockquote>
              <figcaption className="font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--brand-plum)]">
                {`${TOM.name} · ${TOM.role} · ${TOM.experienceYears} Jahre Erfahrung`}
              </figcaption>
            </div>
          </figure>

          <div className="mt-4 flex items-center justify-center gap-2">
            <span aria-hidden="true" className="text-lg tracking-[2px] text-[var(--brand-plum)]">
              ★★★★★
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
              4,9 / 5 aus ersten Nutzerinnen-Feedbacks
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
