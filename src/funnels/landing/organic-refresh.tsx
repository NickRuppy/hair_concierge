import Image from "next/image"
import Link from "next/link"

const trustItems = ["10 Fragen", "kostenlos", "Ergebnis sofort"] as const

const profileCards = [
  ["Dein Profil", "Wellig · fein"],
  ["Dein Fokus", "Feuchtigkeit"],
  ["Dein Hebel", "Leicht pflegen"],
] as const

const whyItems = [
  {
    icon: "✦",
    title: "Statt Haartyp-Schublade",
    body: "Wir fragen Oberfläche, Elastizität, Kopfhaut, Behandlungen und Ziele ab.",
  },
  {
    icon: "✓",
    title: "Kostenlose Einordnung",
    body: "Du siehst direkt, wo dein Haar heute steht und welche Pflegehebel relevant sind.",
  },
  {
    icon: "→",
    title: "Optionaler Plan danach",
    body: "Wenn du möchtest, kannst du anschließend eine konkrete Routine freischalten.",
  },
] as const

const steps = [
  ["1", "Haarprofil beantworten", "Zehn kurze Fragen zu Textur, Kopfhaut, Oberfläche und Zielen."],
  ["2", "Analyse ansehen", "Deine wichtigsten Pflege-Prioritäten werden klar zusammengefasst."],
  [
    "3",
    "Optional vertiefen",
    "Der bezahlte Plan bleibt optional und baut auf derselben Analyse auf.",
  ],
] as const

export default function OrganicRefreshLandingVariant() {
  return (
    <main className="min-h-screen bg-[#fcfaf7] text-[var(--brand-plum-darkest)]">
      <header className="sticky top-0 z-30 border-b border-[rgba(var(--brand-plum-rgb),0.08)] bg-[#fcfaf7]/94 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-1 px-2 py-3 sm:gap-3 sm:px-5">
          <Link href="/" className="shrink-0 font-serif text-2xl font-semibold tracking-tight">
            chaarlie
          </Link>
          <nav className="flex shrink-0 items-center gap-1 sm:gap-3" aria-label="Zugang">
            <Link
              href="/auth?next=/chat"
              prefetch={false}
              className="inline-flex min-h-11 items-center rounded-md px-0.5 text-sm font-semibold text-[rgba(var(--brand-plum-rgb),0.68)] underline-offset-4 transition-colors hover:text-[var(--brand-plum-darkest)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] focus-visible:ring-offset-2 sm:px-1"
            >
              Anmelden
            </Link>
            <Link
              href="/quiz"
              prefetch={false}
              className="inline-flex min-h-11 items-center rounded-full bg-[var(--brand-plum)] px-2.5 text-sm font-bold text-white shadow-[0_12px_30px_-22px_rgba(var(--brand-plum-rgb),0.85)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] focus-visible:ring-offset-2 sm:px-4"
            >
              Analyse starten
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-8 px-5 pb-10 pt-8 sm:pb-16 sm:pt-14 lg:grid-cols-[1fr_0.9fr] lg:gap-12">
        <div>
          <p className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-extrabold uppercase tracking-[0.16em] text-[rgba(var(--brand-plum-rgb),0.62)] shadow-sm">
            Kostenlose Haaranalyse
          </p>
          <h1 className="mt-4 max-w-[12ch] font-serif text-[3.3rem] leading-[0.94] tracking-[-0.055em] sm:text-[4.8rem]">
            Versteh dein Haar. Ohne Produktchaos.
          </h1>
          <p className="mt-5 max-w-[34rem] text-lg leading-8 text-[rgba(var(--brand-plum-rgb),0.72)]">
            Zehn ruhige Fragen zu deinem Haarprofil. Danach siehst du, welche Pflegehebel für dich
            relevant sind — klar, kostenlos und ohne künstlichen Druck.
          </p>
          <Link
            href="/quiz"
            prefetch={false}
            data-landing-hero-cta
            className="mt-7 inline-flex w-full max-w-[440px] flex-col items-center rounded-[1.1rem] bg-[var(--brand-plum)] px-8 py-4 text-center text-white shadow-[0_20px_44px_-30px_rgba(var(--brand-plum-rgb),0.9)] transition-transform motion-safe:hover:-translate-y-0.5 sm:w-auto"
          >
            <span className="text-lg font-extrabold">Kostenlose Analyse starten</span>
            <span className="mt-0.5 text-sm text-white/80">10 Fragen · Ergebnis direkt danach</span>
          </Link>
          <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-bold uppercase tracking-[0.08em] text-[rgba(var(--brand-plum-rgb),0.52)]">
            {trustItems.map((item) => (
              <span key={item} className="inline-flex items-center gap-1.5">
                <span className="text-[#2d9f5e]" aria-hidden="true">
                  ✓
                </span>
                {item}
              </span>
            ))}
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-[360px] rounded-[2rem] border border-[rgba(var(--brand-plum-rgb),0.10)] bg-white p-4 shadow-[0_28px_64px_-42px_rgba(var(--brand-plum-rgb),0.8)]">
          <div className="rounded-[1.5rem] bg-[#f4eff8] p-4">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[1.25rem] bg-[#e8dfea]">
              <Image
                alt="Beispielprofil mit welligem Haar"
                className="object-cover object-center"
                fetchPriority="high"
                fill
                preload
                sizes="(max-width: 1024px) 360px, 320px"
                src="/images/funnels/personal-plan-quiz/profile-summary/wavy-medium.webp"
              />
              <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--brand-plum-darkest)] shadow-sm backdrop-blur">
                Beispielprofil
              </span>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {profileCards.map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-2xl bg-[#fbf8fc] px-4 py-3"
              >
                <span className="text-xs font-extrabold uppercase tracking-[0.12em] text-[rgba(var(--brand-plum-rgb),0.48)]">
                  {label}
                </span>
                <strong className="text-sm">{value}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-[rgba(var(--brand-plum-rgb),0.08)] bg-white/58 px-5 py-12 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[rgba(var(--brand-plum-rgb),0.58)]">
              Was anders ist
            </p>
            <h2 className="mt-3 font-serif text-4xl leading-tight tracking-[-0.04em]">
              Eine Analyse, die bei deinem Alltag startet.
            </h2>
          </div>
          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {whyItems.map((item) => (
              <article
                key={item.title}
                className="rounded-[1.5rem] border border-[rgba(var(--brand-plum-rgb),0.08)] bg-white p-5 shadow-[0_18px_46px_-38px_rgba(var(--brand-plum-rgb),0.7)]"
              >
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[#eee8f6] text-xl font-black text-[#6b50a0]">
                  {item.icon}
                </span>
                <h3 className="mt-4 text-lg font-extrabold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[rgba(var(--brand-plum-rgb),0.68)]">
                  {item.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-12 sm:py-16">
        <div className="grid gap-3 md:grid-cols-3">
          {steps.map(([number, title, body]) => (
            <article
              key={number}
              className="rounded-[1.5rem] border border-[rgba(var(--brand-plum-rgb),0.08)] bg-white p-6"
            >
              <span className="font-serif text-5xl italic leading-none text-[var(--brand-plum)]">
                {number}
              </span>
              <h3 className="mt-4 text-lg font-extrabold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-[rgba(var(--brand-plum-rgb),0.68)]">
                {body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="px-5 pb-14">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-[var(--brand-plum)] px-6 py-9 text-center text-white shadow-[0_24px_54px_-38px_rgba(var(--brand-plum-rgb),0.85)]">
          <h2 className="font-serif text-4xl leading-tight tracking-[-0.04em]">
            Bereit, dein Haar besser zu verstehen?
          </h2>
          <p className="mx-auto mt-3 max-w-[34rem] text-base leading-7 text-white/78">
            Zehn Fragen. Kostenlos. Dein persönliches Ergebnis direkt danach.
          </p>
          <Link
            href="/quiz"
            prefetch={false}
            className="mt-6 inline-flex rounded-full bg-white px-7 py-3 font-extrabold text-[var(--brand-plum-darkest)]"
          >
            Analyse starten
          </Link>
        </div>
      </section>
    </main>
  )
}
