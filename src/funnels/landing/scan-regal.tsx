import Image from "next/image"
import Link from "next/link"

import { SiteFooter } from "@/components/landing/site-footer"
import { Wordmark } from "@/components/landing/wordmark"
import { ScanExampleCard } from "@/components/quiz/scan-inserts/scan-example-card"
import { getScanInsertExample } from "@/lib/quiz/scan-insert-examples"

const CTA_LABEL = "Haarprofil erstellen"
const CTA_FINE_PRINT = "10 Fragen · 2 Minuten · danach ist dein Scanner startklar"

/**
 * The same example card the first scanner insert shows, built from the empty
 * answer set: the landing has no quiz answers yet, so the card demonstrates the
 * scanner on a default profile instead of pretending to know the visitor.
 */
const heroExample = getScanInsertExample(16, {})

const steps = [
  ["1", "Haarprofil", "10 Fragen zu Struktur, Kopfhaut und Zielen."],
  ["2", "Scannen", "Barcode in den Rahmen halten – im Regal oder zu Hause."],
  [
    "3",
    "Ergebnis",
    "Passt, passt mit Einschränkung oder passt nicht – plus Alternativen, die passen.",
  ],
] as const

const appStack = [
  "Produkt-Scanner",
  "Persönlicher Plan",
  "Anwendung Schritt für Schritt",
  "Chat mit Chaarlie",
] as const

function SectionEyebrow({ children }: { children: string }) {
  return (
    <p className="text-center text-[10.5px] font-extrabold uppercase tracking-[0.16em] text-[var(--brand-plum)]">
      {children}
    </p>
  )
}

export default function FunnelScanRegalLandingVariant() {
  return (
    <>
      <main className="min-h-screen bg-background text-[var(--brand-plum-darkest)]">
        <header className="sticky top-0 z-50 border-b border-[rgba(var(--brand-plum-rgb),0.12)] bg-[rgba(253,251,249,0.95)] backdrop-blur-[12px]">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
            <Link href="/" aria-label="chaarlie Startseite" className="shrink-0">
              <Wordmark />
            </Link>
            <nav className="flex shrink-0 items-center gap-1 sm:gap-4" aria-label="Zugang">
              <Link
                href="/auth?next=/chat"
                prefetch={false}
                className="hidden min-h-11 items-center rounded-md px-1 text-[13px] font-semibold text-[var(--brand-plum)] underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] focus-visible:ring-offset-2 sm:inline-flex"
              >
                Anmelden
              </Link>
              <Link
                href="/quiz"
                prefetch={false}
                className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full bg-[var(--brand-plum)] px-3.5 text-[13px] font-bold text-white transition-colors hover:bg-[var(--brand-plum-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] focus-visible:ring-offset-2"
              >
                {CTA_LABEL}
              </Link>
            </nav>
          </div>
        </header>

        {/*
          Hero. One column on mobile — claim, photo, quote — and on large screens
          the photo moves beside the text by spanning both rows of the grid, so
          the markup renders the image exactly once.
        */}
        <section className="mx-auto grid max-w-6xl gap-5 px-5 pb-10 pt-6 sm:pb-14 sm:pt-12 lg:grid-cols-[1fr_0.8fr] lg:items-center lg:gap-12">
          <div className="flex flex-col gap-4 lg:col-start-1 lg:row-start-1">
            <p className="self-start rounded-full bg-[var(--brand-plum-ice)] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--brand-plum-dark)]">
              Drogerie-Regal
            </p>
            <h1 className="text-balance font-header text-[2.25rem] leading-[1.02] tracking-[-0.03em] text-[var(--brand-plum-darkest)] sm:text-[3.4rem]">
              200 Shampoos im Regal. Eins passt zu dir.
            </h1>
            <p className="max-w-[34rem] text-[16px] leading-[1.55] text-[var(--text-sub)]">
              Chaarlie zeigt dir per Scan, welches. Dafür braucht es dein Haarprofil – 10 Fragen, 2
              Minuten.
            </p>
          </div>

          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[24px] bg-[var(--brand-plum-ice)] shadow-[0_30px_70px_-40px_rgba(42,24,69,0.6)] sm:aspect-[4/5] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:aspect-[3/4]">
            <Image
              alt="Frau vor dem Drogerieregal mit einer Shampoo-Flasche in der Hand"
              className="object-cover"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 30rem"
              src="/images/funnels/scan/frau-regal-aha.webp"
            />
            <ScanExampleCard card={heroExample} />
          </div>

          <figure className="rounded-[22px] border border-[var(--brand-plum-light)] bg-white px-[18px] py-4 text-center shadow-[0_24px_60px_-40px_rgba(70,41,59,0.55)] lg:col-start-1 lg:row-start-2">
            <blockquote className="text-[15.5px] italic leading-[1.55] text-[var(--brand-plum-darkest)]">
              „Ich weiß nie, welche Produkte wirklich zu mir passen.“
            </blockquote>
            <figcaption className="mt-2.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--brand-plum)]">
              Häufigste Antwort · eigene Umfrage, 4.024 Frauen
            </figcaption>
          </figure>
        </section>

        {/* The three steps are a real sequence, so they carry numbers. */}
        <section className="mx-auto max-w-6xl px-5 pb-10 sm:pb-14">
          <SectionEyebrow>So funktioniert’s</SectionEyebrow>
          <ol className="mt-4 flex flex-col gap-2.5 sm:grid sm:grid-cols-3 sm:gap-3">
            {steps.map(([number, title, body]) => (
              <li
                key={number}
                className="flex items-start gap-3 rounded-[16px] border border-[var(--brand-plum-light)] bg-white px-3.5 py-3"
              >
                <span
                  aria-hidden="true"
                  className="grid h-7 w-7 flex-none place-items-center rounded-full bg-[var(--brand-plum)] text-[13px] font-bold text-white"
                >
                  {number}
                </span>
                <span>
                  <strong className="block text-[14.5px] font-bold text-[var(--brand-plum-darkest)]">
                    {title}
                  </strong>
                  <span className="mt-0.5 block text-[13px] leading-[1.4] text-[var(--text-sub)]">
                    {body}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        {/* What the profile unlocks — four tiles in a 2x2. */}
        <section className="mx-auto max-w-6xl px-5 pb-12 sm:pb-16">
          <SectionEyebrow>Im Chaarlie-Abo</SectionEyebrow>
          <ul className="mx-auto mt-4 grid max-w-2xl grid-cols-2 gap-2">
            {appStack.map((item) => (
              <li
                key={item}
                className="flex items-center gap-2 rounded-[14px] border border-[var(--brand-plum-light)] bg-white px-3 py-2.5 text-[12.5px] font-semibold text-[var(--brand-plum-darkest)]"
              >
                <span
                  aria-hidden="true"
                  className="h-2 w-2 flex-none rounded-full bg-[var(--brand-coral)]"
                />
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="px-5 pb-14">
          <div className="mx-auto flex w-full max-w-[440px] flex-col items-center">
            <Link
              href="/quiz"
              prefetch={false}
              className="flex min-h-[56px] w-full items-center justify-center rounded-full bg-[var(--brand-coral)] px-[22px] text-center text-base font-bold text-white transition-colors hover:bg-[var(--brand-coral-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral-dark)] focus-visible:ring-offset-2"
            >
              {CTA_LABEL}
            </Link>
            <p className="mt-2 text-center text-[11.5px] text-[var(--text-caption)]">
              {CTA_FINE_PRINT}
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
