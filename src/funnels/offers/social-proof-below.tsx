"use client"

import { Check, LockKeyhole, MessageCircle, ShieldCheck, Star } from "lucide-react"

import { OfferFaq } from "@/components/quiz/offer-faq"
import { OfferPreviewRoutine } from "@/components/quiz/offer-preview-routine"
import { buildQuizOfferPreview } from "@/lib/quiz/offer-preview"
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

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? ""
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
    source: "Feedback aus der Beta",
  },
  {
    quote:
      "Ich finde die Interaktion sehr gut: meine Fragen stellen zu können und dann die benötigten Antworten zu bekommen.",
    source: "Feedback aus der Beta",
  },
  {
    quote:
      "Dass bei den Produkten der Preis und die Anwendung dabeistehen, ein Foto und warum er es empfiehlt. So muss ich nicht erst googeln.",
    source: "Feedback aus der Beta",
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

const TRUST_STATS = [
  { value: "4.000+", label: "Haar-Checks gemacht" },
  { value: "Sat.1", label: "bekannt aus dem TV" },
  { value: "19 J.", label: "Friseur-Erfahrung im Beirat" },
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
            Chaarlie starten
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
            Deine Analyse ist der Anfang. Chaarlie macht sie anwendbar.
          </h1>
          <p className="mt-5 text-[16px] leading-[1.65] text-muted-foreground">
            {narrative.intro} Jetzt wird daraus eine persönliche Routine mit konkreten Produkten –
            plus ein Begleiter für alle Fragen danach.
          </p>
        </section>

        {/* ===== Unverändert zur Produktion: Auswertung + Produkte ===== */}
        <OfferPreviewRoutine preview={preview} />

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
                Nach dem Start
              </p>
              <h2 className="mt-2 font-header text-[27px] font-medium leading-[1.15] text-[var(--brand-plum-darkest)]">
                {focusRoutine
                  ? "Weiter mit deiner vollständigen Routine."
                  : "Chaarlie finalisiert deinen persönlichen Plan."}
              </h2>
              <p className="mt-3 max-w-[380px] text-[13px] leading-relaxed text-muted-foreground">
                Du ergänzt deine aktuellen Produkte. Chaarlie prüft, was bleiben kann, schließt
                Lücken und erklärt Reihenfolge, Menge und Anwendung.
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
            Wer deine Routine gebaut hat
          </p>
          <h2 className="mt-2 text-center font-header text-[32px] font-medium leading-[1.12] text-[var(--brand-plum-darkest)]">
            Triff Chaarlie. Dein Haar-Experte für jeden Tag.
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
            Aus unserer Beta
          </p>
          <h2 className="mt-2 font-header text-[30px] font-medium leading-[1.15] text-[var(--brand-plum-darkest)]">
            Nicht nur unsere Meinung.
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

          <div className="mt-4 grid grid-cols-3 gap-2.5">
            {TRUST_STATS.map((stat) => (
              <div
                key={stat.value}
                className="rounded-[12px] border border-border bg-white px-2 py-3.5 text-center"
              >
                <p className="font-header text-[20px] font-medium leading-none text-[var(--brand-plum-darkest)]">
                  {stat.value}
                </p>
                <p className="mt-1.5 text-[10.5px] leading-[1.3] text-muted-foreground">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ===== Pricing: NEU mit "Was du freischaltest"-Liste über dem Slot ===== */}
        <section id="pricing" className="scroll-mt-[76px] border-t border-border py-9">
          {focusRoutine ? (
            <p className="mb-4 rounded-[12px] bg-[var(--brand-plum-ice)] px-3 py-2 text-center text-[12px] font-bold text-[var(--brand-plum)]">
              Weiter mit deiner Routine
            </p>
          ) : null}
          <p className="text-center font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-[var(--brand-plum)]">
            Dein persönlicher Haarpflege-Begleiter
          </p>
          <h2 className="mt-2 text-center font-header text-[36px] font-medium leading-[1.12] text-[var(--brand-plum-darkest)]">
            Starte mit Chaarlie.
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

          <div className="mt-6">{pricingSlot}</div>

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
            Chaarlie starten
          </a>
        </section>
      </main>
    </div>
  )
}
