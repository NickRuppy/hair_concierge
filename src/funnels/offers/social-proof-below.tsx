"use client"

import { ArrowDown, Check, LockKeyhole, MessageCircle, ShieldCheck, Star } from "lucide-react"

import { OfferFaq } from "@/components/quiz/offer-faq"
import { buildQuizOfferPreview } from "@/lib/quiz/offer-preview"
import type { QuizOfferPreview } from "@/lib/quiz/offer-preview-types"
import type { FunnelOfferVariantProps } from "@/funnels/types"

/**
 * Test variant "social_proof_below" (/lp/routine-b).
 *
 * Top of the page (hero, routine preview, lock card) intentionally mirrors the
 * production experience so the test isolates ONE variable: everything below the
 * lock card is replaced with real app screenshots, beta testimonials with star
 * ratings, trust stats, and an explicit "what you unlock" list at the pricing
 * block. Shared pricing/checkout arrives via pricingSlot and stays untouched.
 */

const IMAGE_BASE = "/images/funnels/social-proof-below"

const LOCKED_CATEGORY_TITLES: Record<string, string> = {
  shampoo: "Shampoo",
  conditioner: "Conditioner",
  protein_mask: "Protein-Maske",
  moisture_mask: "Feuchtigkeitsmaske",
  leave_in: "Leave-in",
  oil: "Haaröl",
  bondbuilder: "Bondbuilder",
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? ""
}

/**
 * Variant-local take on OfferPreviewRoutine: identical signals and foundation
 * cards, but the locked follow-up products render as one compact row instead
 * of three full-height cards.
 */
function PreviewWithCompactLocks({ preview }: { preview: QuizOfferPreview }) {
  const foundationProducts = preview.products.filter((product) => !product.suggested)
  const lockedProduct = preview.products.find((product) => product.suggested)

  return (
    <section className="border-t border-border py-9">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-[var(--brand-plum)]">
        Das wissen wir schon aus deinem Quiz
      </p>
      <h2 className="mt-2 font-header text-[30px] font-medium leading-[1.15] text-[var(--brand-plum-darkest)]">
        Deine Pflegebasis wird konkret.
      </h2>
      <p className="mt-3 text-[14px] leading-[1.65] text-muted-foreground">{preview.summary}</p>

      <div className="mt-6 overflow-hidden rounded-[18px] border border-[var(--brand-plum-light)] bg-[var(--brand-plum-ice)]/55">
        {preview.signals.map((signal) => (
          <div
            key={signal.label}
            className="flex gap-3 border-b border-[var(--brand-plum-light)] px-4 py-3.5 last:border-b-0"
          >
            <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-white text-[var(--brand-plum)]">
              <Check className="size-3.5" aria-hidden="true" />
            </span>
            <span>
              <strong className="block text-[13px] text-[var(--brand-plum-darkest)]">
                {signal.label}
              </strong>
              <span className="mt-0.5 block text-[12px] leading-relaxed text-muted-foreground">
                {signal.conclusion}
              </span>
            </span>
          </div>
        ))}
        <div className="flex items-center justify-center gap-2 border-t border-[var(--brand-plum-light)] bg-white/70 px-4 py-3 font-mono text-[9px] font-semibold uppercase tracking-[0.09em] text-[var(--brand-plum)]">
          <ArrowDown className="size-3.5" aria-hidden="true" />
          Daraus ergibt sich deine Pflegebasis
        </div>
      </div>

      <p className="mt-5 text-[12px] leading-relaxed text-muted-foreground">
        Mit konkreten Beispielen aus unserer Produktdatenbank. Das sind noch nicht deine finalen
        Produktempfehlungen.
      </p>

      <div className="mt-4 space-y-3">
        {foundationProducts.map((product) => (
          <article
            key={product.key}
            className="relative flex min-h-[132px] gap-4 overflow-hidden rounded-[18px] border border-border bg-white p-4 shadow-[0_8px_30px_-26px_rgba(var(--brand-plum-rgb),0.5)]"
          >
            <div className="grid h-[100px] w-[82px] shrink-0 place-items-center overflow-hidden rounded-[12px] bg-[var(--brand-plum-ice)] p-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- catalog images are hosted in the project's Supabase bucket. */}
              <img
                alt={product.name}
                className="h-full w-full object-contain"
                loading="lazy"
                src={product.imageUrl}
              />
            </div>
            <div className="min-w-0 flex-1 py-0.5">
              <p className="font-mono text-[8px] font-semibold uppercase tracking-[0.09em] text-[var(--brand-plum)]">
                {product.categoryLabel}
              </p>
              <h3 className="mt-1.5 text-[15px] font-bold leading-snug text-[var(--brand-plum-darkest)]">
                {product.name}
              </h3>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
                {product.note}
              </p>
              <p className="mt-2 text-[11px] font-semibold text-[var(--brand-plum)]">
                {product.cadence.label}
                {product.cadence.qualifier ? ` · ${product.cadence.qualifier}` : ""}
              </p>
            </div>
          </article>
        ))}
      </div>

      {lockedProduct ? (
        <div className="mt-4">
          <div className="grid grid-cols-3 gap-2.5">
            <article className="rounded-[14px] border border-[rgba(var(--brand-coral-rgb),0.38)] bg-white p-3 text-center">
              <span className="mx-auto grid size-7 place-items-center rounded-full bg-[var(--brand-coral-light)] text-[var(--brand-coral-dark)]">
                <LockKeyhole className="size-3.5" aria-hidden="true" />
              </span>
              <p className="mt-2 text-[11.5px] font-bold leading-tight text-[var(--brand-plum-darkest)]">
                {LOCKED_CATEGORY_TITLES[lockedProduct.category] ?? "Nächster Schritt"}
              </p>
              <div className="mx-auto mt-2 h-2 w-4/5 rounded-full bg-[var(--brand-plum-ice)] blur-[2px]" />
            </article>
            {[0, 1].map((index) => (
              <article
                key={index}
                aria-hidden="true"
                className="rounded-[14px] border border-border bg-white p-3 text-center opacity-[0.82]"
              >
                <span className="mx-auto grid size-7 place-items-center rounded-full border border-[var(--brand-plum-light)] bg-white text-[var(--brand-plum)]">
                  <LockKeyhole className="size-3.5" />
                </span>
                <div className="mx-auto mt-2.5 h-2.5 w-4/5 rounded-full bg-[var(--brand-plum-light)] blur-[3px]" />
                <div className="mx-auto mt-2 h-2 w-3/5 rounded-full bg-[var(--brand-plum-ice)] blur-[2px]" />
              </article>
            ))}
          </div>
          <p className="mt-2.5 text-center text-[11px] text-muted-foreground">
            Diese Bausteine gehören zu deiner vollständigen Routine.
          </p>
        </div>
      ) : null}
    </section>
  )
}

function Stars() {
  return (
    <div aria-label="5 von 5 Sternen" className="mb-2.5 flex gap-0.5">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          aria-hidden="true"
          className="size-[15px] fill-[#E8A33D] text-[#E8A33D]"
        />
      ))}
    </div>
  )
}

const TESTIMONIALS = [
  {
    quote:
      "Der Fragebogen ist echt gut und leicht verständlich. Im Chat hat das Antworten super geklappt. Auch die Produktempfehlung fand ich gut.",
    source: "Eine unserer ersten Kundinnen",
  },
  {
    quote:
      "Ich finde die Interaktion sehr gut: meine Fragen stellen zu können und dann die benötigten Antworten zu bekommen.",
    source: "Eine unserer ersten Kundinnen",
  },
  {
    quote:
      "Dass bei den Produkten der Preis und die Anwendung dabeistehen, ein Foto und warum er es empfiehlt. So muss ich nicht erst googeln.",
    source: "Eine unserer ersten Kundinnen",
  },
]

const APP_FEATURES = [
  {
    eyebrow: "Deine Routine",
    title: "Deine Routine. Jeden Tag. In der App.",
    copy: "Was, wann, wie oft: deine Routine wohnt in Chaarlie und passt sich an, wenn dein Haar sich verändert.",
    image: `${IMAGE_BASE}/app-routine.png`,
    alt: "Chaarlie App: die persönliche Routine",
  },
  {
    eyebrow: "Deine Produkte",
    title: "Jedes Produkt mit Preis, Anwendung und Grund.",
    copy: "Aus über 500 geprüften Produkten. Wenn etwas nicht passt oder zu teuer ist, schlägt Chaarlie dir eine Alternative vor.",
    image: `${IMAGE_BASE}/app-products.png`,
    alt: "Chaarlie App: Produktempfehlungen mit Preis und Begründung",
  },
  {
    eyebrow: "Dein Haar-Berater",
    title: "Fragen beim Umsetzen? Sofort beantwortet.",
    copy: "Chaarlie kennt dein Profil und deine Routine und erklärt dir, was gerade sinnvoll ist.",
    image: `${IMAGE_BASE}/app-home.png`,
    alt: "Chaarlie App: der Chat mit dem Haar-Berater",
  },
]

const UNLOCK_ITEMS = [
  {
    title: "Deine vollständige Routine:",
    copy: "alle Bausteine freigeschaltet und erklärt, was, wann, wie oft.",
  },
  {
    title: "Dein Haar-Berater, jederzeit:",
    copy: "jede Frage während du umsetzt, sofort beantwortet.",
  },
  {
    title: "Produkt-Tausch inklusive:",
    copy: "wenn etwas nicht passt oder zu teuer ist, bekommst du eine Alternative.",
  },
  {
    title: "Nachmessung in Woche 4:",
    copy: "wir prüfen gemeinsam, ob es wirkt.",
  },
]

export default function FunnelSocialProofBelowOfferVariant({
  name,
  narrative,
  quizAnswers,
  pricingSlot,
  focusRoutine = false,
}: FunnelOfferVariantProps) {
  const displayName = firstName(name)
  const preview = buildQuizOfferPreview(quizAnswers)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="fixed inset-x-0 top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[560px] items-center justify-between gap-3 px-5 py-2.5">
          <div>
            <strong className="font-header text-[18px] font-medium text-[var(--brand-plum-darkest)]">
              chaarlie
            </strong>
            <span className="block font-mono text-[8px] font-semibold uppercase tracking-[0.09em] text-[var(--brand-plum)]">
              Dein Ergebnis ist da
            </span>
          </div>
          <a
            href="#pricing"
            className="rounded-[12px] bg-[var(--brand-coral)] px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_8px_24px_-16px_rgba(var(--brand-coral-rgb),0.65)]"
          >
            Routine freischalten
          </a>
        </div>
      </div>

      <main className="mx-auto w-full max-w-[560px] px-5">
        {/* ===== Unverändert zur Produktion: Hero ===== */}
        <section className="pb-9 pt-[84px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#2D9F5E]/25 bg-[#2D9F5E]/10 px-3.5 py-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.11em] text-[#2D9F5E]">
            <Check className="size-3.5" aria-hidden="true" />
            Quiz ausgewertet
          </span>
          <p className="mb-2 mt-5 font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-[var(--brand-plum)]">
            {displayName
              ? `${displayName}, wir kennen jetzt die Bedürfnisse deiner Haare`
              : "Wir kennen jetzt die Bedürfnisse deiner Haare"}
          </p>
          <h1 className="font-header text-[clamp(32px,9vw,46px)] font-medium leading-[1.08] text-[var(--brand-plum-darkest)]">
            Dein Haar kann sich in 4 Wochen anders anfühlen. Hier ist dein Weg dahin.
          </h1>
          <p className="mt-5 text-[16px] leading-[1.65] text-muted-foreground">
            {narrative.intro} Jetzt wird daraus eine persönliche Routine mit konkreten Produkten,
            plus ein Begleiter für alle Fragen danach.
          </p>
        </section>

        {/* ===== Auswertung + Produkte (Variante: kompakte gesperrte Karten) ===== */}
        <PreviewWithCompactLocks preview={preview} />

        {/* ===== Unverändert zur Produktion: Schloss-Karte ===== */}
        <section id="unlock-plan" className="scroll-mt-[76px] border-t border-border py-9">
          <article className="relative min-h-[300px] overflow-hidden rounded-[20px] border border-[var(--brand-plum-light)] bg-white shadow-[0_14px_45px_-36px_rgba(var(--brand-plum-rgb),0.7)]">
            <div aria-hidden="true" className="space-y-3 p-7 blur-[6px]">
              {["w-5/6", "w-2/3", "w-full", "w-3/4", "w-1/2"].map((width) => (
                <div
                  key={width}
                  className={`h-4 ${width} rounded-full bg-[var(--brand-plum-ice)]`}
                />
              ))}
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/72 p-7 text-center backdrop-blur-[1px]">
              <LockKeyhole className="mb-3 size-9 text-[var(--brand-plum)]" aria-hidden="true" />
              <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.11em] text-[var(--brand-plum)]">
                Nach dem Freischalten
              </p>
              <h2 className="mt-2 font-header text-[27px] font-medium leading-[1.15] text-[var(--brand-plum-darkest)]">
                {focusRoutine
                  ? "Weiter mit deiner vollständigen Routine."
                  : "Deine vollständige Routine wartet schon auf dich."}
              </h2>
              <p className="mt-3 max-w-[380px] text-[13px] leading-relaxed text-muted-foreground">
                Alle Bausteine aufeinander abgestimmt: was, wann, wie oft. Dazu dein Haar-Berater
                für jede Frage, die danach kommt.
              </p>
              <a
                href="#pricing"
                className="mt-5 rounded-[12px] bg-[var(--brand-coral)] px-8 py-3 text-[13px] font-bold text-white"
              >
                Vollständige Routine freischalten
              </a>
            </div>
          </article>
        </section>

        {/* ===== NEU: Triff Chaarlie mit echten App-Screenshots ===== */}
        <section className="border-t border-border py-9">
          <p className="text-center font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-[var(--brand-plum)]">
            Dein Zugang
          </p>
          <h2 className="mt-2 text-center font-header text-[32px] font-medium leading-[1.12] text-[var(--brand-plum-darkest)]">
            Das alles bekommst du in Chaarlie.
          </h2>
          <p className="mx-auto mt-3 max-w-[40ch] text-center text-[14px] leading-[1.6] text-muted-foreground">
            Keine Liste zum Abheften. Deine Routine lebt in der App, und du kannst jederzeit alles
            fragen.
          </p>

          <div className="mt-7 space-y-5">
            {APP_FEATURES.map((feature) => (
              <article
                key={feature.eyebrow}
                className="rounded-[20px] border border-border bg-white p-6 text-center shadow-[0_14px_45px_-36px_rgba(var(--brand-plum-rgb),0.5)]"
              >
                <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.11em] text-[var(--brand-plum)]">
                  {feature.eyebrow}
                </p>
                <h3 className="mt-2 font-header text-[22px] font-medium leading-[1.2] text-[var(--brand-plum-darkest)]">
                  {feature.title}
                </h3>
                <p className="mx-auto mt-2 max-w-[36ch] text-[13px] leading-[1.6] text-muted-foreground">
                  {feature.copy}
                </p>
                <img
                  src={feature.image}
                  alt={feature.alt}
                  loading="lazy"
                  className="mx-auto mt-5 w-[210px] rounded-[22px] border-[6px] border-[#1c1230] shadow-[0_22px_50px_-24px_rgba(var(--brand-plum-rgb),0.55)]"
                />
              </article>
            ))}
          </div>
        </section>

        {/* ===== NEU: Testimonials mit Sternen + Vertrauens-Zahlen ===== */}
        <section className="border-t border-border py-9">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-[var(--brand-plum)]">
            Bewertungen
          </p>
          <h2 className="mt-2 font-header text-[30px] font-medium leading-[1.15] text-[var(--brand-plum-darkest)]">
            Was unsere ersten Kundinnen sagen.
          </h2>

          <div className="mt-6 space-y-3.5">
            {TESTIMONIALS.map((testimonial) => (
              <blockquote
                key={testimonial.quote}
                className="rounded-[16px] border border-border border-l-[3px] border-l-[var(--brand-plum-light)] bg-white p-5"
              >
                <Stars />
                <p className="font-header text-[15px] italic leading-[1.55] text-[var(--brand-plum-darkest)]">
                  &bdquo;{testimonial.quote}&ldquo;
                </p>
                <footer className="mt-2.5 font-mono text-[9px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
                  {testimonial.source}
                </footer>
              </blockquote>
            ))}
          </div>

          <p className="mt-4 rounded-[12px] border border-border bg-white px-4 py-3.5 text-center text-[12.5px] leading-[1.5] text-muted-foreground">
            <strong className="mr-1.5 font-header text-[17px] font-medium text-[var(--brand-plum-darkest)]">
              4.000+
            </strong>
            Empfehlungen auf Basis von Daten aus über 4.000 Haar-Auswertungen.
          </p>
        </section>

        {/* ===== NEU: Gründer-Brief (Wieso jetzt?) ===== */}
        <section className="border-t border-border py-9">
          <article className="rounded-[20px] border border-[var(--brand-plum-light)] bg-[var(--brand-plum-ice)]/45 p-6">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-[var(--brand-plum)]">
              Ein Wort von den Gründern
            </p>
            <h2 className="mt-2 font-header text-[28px] font-medium leading-[1.15] text-[var(--brand-plum-darkest)]">
              Wieso jetzt mit Chaarlie starten?
            </h2>
            <div className="mt-4 space-y-3.5 text-[14px] leading-[1.7] text-muted-foreground">
              <p>
                Die meisten Menschen finden nie heraus, was ihr Haar wirklich braucht. Sie pflegen
                jahrelang daran vorbei, und Schäden, die sich über Jahre aufbauen, lassen sich
                irgendwann kaum noch reparieren. Dann hilft oft nur noch abschneiden und von vorn
                anfangen.
              </p>
              <p>
                Dazu kommt das Geld: In unseren Haar-Auswertungen sehen wir immer wieder, dass viele
                300 bis 470 Euro im Jahr für Produkte ausgeben, von denen die meisten nicht zu ihrem
                Haar passen. Genau dafür haben wir Chaarlie gebaut. Du weißt, was bei dir wirkt,
                bevor du kaufst, sparst dadurch schnell 30 Euro und mehr im Monat, und kannst die
                Empfehlungen genauso für deine Familie nutzen.
              </p>
              <p>
                Am Ende geht es um mehr als Produkte: eine gesunde Kopfhaut, Haare, die sich wieder
                gut anfühlen, und das gute Gefühl, es zu wissen statt zu raten.
              </p>
            </div>
            <p className="mt-5 font-header text-[18px] font-medium text-[var(--brand-plum-darkest)]">
              Nick &amp; Jonas
            </p>
            <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.09em] text-[var(--brand-plum)]">
              Gründer von Chaarlie
            </p>
          </article>
        </section>

        {/* ===== Pricing: NEU mit "Was du freischaltest"-Liste über dem Slot ===== */}
        <section id="pricing" className="scroll-mt-[76px] border-t border-border py-9">
          {focusRoutine ? (
            <p className="mb-4 rounded-[12px] bg-[var(--brand-plum-ice)] px-3 py-2 text-center text-[12px] font-bold text-[var(--brand-plum)]">
              Weiter mit deiner Routine
            </p>
          ) : null}
          <p className="text-center font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-[var(--brand-plum)]">
            Deine Pflegebasis steht
          </p>
          <h2 className="mt-2 text-center font-header text-[36px] font-medium leading-[1.12] text-[var(--brand-plum-darkest)]">
            Schalte deine vollständige Routine frei.
          </h2>
          <p className="mx-auto mt-3 max-w-[40ch] text-center text-[14px] leading-[1.6] text-muted-foreground">
            Die Basis kennst du schon. Das schaltest du frei:
          </p>

          <ul className="mx-auto mt-5 max-w-[420px] space-y-3">
            {UNLOCK_ITEMS.map((item) => (
              <li key={item.title} className="flex items-start gap-2.5 text-[14px] leading-[1.5]">
                <Check aria-hidden="true" className="mt-0.5 size-[17px] shrink-0 text-[#2D9F5E]" />
                <span className="text-muted-foreground">
                  <strong className="font-bold text-[var(--brand-plum-darkest)]">
                    {item.title}
                  </strong>{" "}
                  {item.copy}
                </span>
              </li>
            ))}
          </ul>

          <p className="mx-auto mt-6 max-w-[420px] rounded-[12px] bg-[var(--brand-plum-ice)] px-4 py-3 text-center text-[12.5px] leading-[1.55] text-[var(--brand-plum-darkest)]">
            Zum Vergleich: Ein einziger Fehlkauf im Drogerieregal kostet oft mehr als ein Monat
            Chaarlie.
          </p>

          <div className="mt-5">{pricingSlot}</div>

          <article className="mt-7 rounded-[16px] border border-border bg-white p-6 text-center">
            <ShieldCheck aria-hidden="true" className="mx-auto size-8 text-[var(--brand-coral)]" />
            <h3 className="mt-3 font-header text-[22px] font-medium text-[var(--brand-plum-darkest)]">
              14 Tage Geld-zurück-Garantie
            </h3>
            <p className="mt-2 text-[13px] leading-[1.6] text-muted-foreground">
              Sollte Chaarlie nicht zu dir passen, bekommst du innerhalb von 14 Tagen nach dem Kauf
              dein Geld zurück. Jederzeit kündbar.
            </p>
          </article>
        </section>

        <OfferFaq />

        {/* ===== Schluss-CTA mit direkterer Copy ===== */}
        <section className="border-t border-border pb-20 pt-9 text-center">
          <MessageCircle
            className="mx-auto mb-3 size-8 text-[var(--brand-plum)]"
            aria-hidden="true"
          />
          <h2 className="font-header text-[30px] font-medium leading-[1.15] text-[var(--brand-plum-darkest)]">
            Deine Routine ist fertig. Hol sie dir.
          </h2>
          <p className="mx-auto mt-3 max-w-[38ch] text-[14px] leading-[1.6] text-muted-foreground">
            Die Basis ist geschenkt, der Rest wartet. Schalte deine vollständige Routine frei und
            behalte Chaarlie für jede Frage danach.
          </p>
          <a
            href="#pricing"
            className="mt-5 flex min-h-[54px] w-full items-center justify-center rounded-[12px] bg-[var(--brand-coral)] px-5 py-3 text-[14px] font-bold text-white shadow-[0_8px_24px_-16px_rgba(var(--brand-coral-rgb),0.65)]"
          >
            Meine Routine freischalten
          </a>
        </section>
      </main>
    </div>
  )
}
