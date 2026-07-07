import type { ReactNode } from "react"
import { Check, LockKeyhole, MessageCircle, ShieldCheck } from "lucide-react"

import { ResultOfferCountdown } from "@/components/quiz/result-offer-countdown"
import { ResultOfferPricing } from "@/components/quiz/result-offer-pricing"
import { QuizResultTransformationCard } from "@/components/quiz/quiz-result-transformation-card"
import { QuizResultLeverRows } from "@/components/quiz/quiz-result-lever-rows"
import type { QuizResultNarrative } from "@/lib/quiz/result-narrative"
import { STRIPE_PRICING_PLANS } from "@/lib/stripe/pricing-plans"

const FEATURE_IMAGES = {
  advisor: "/images/offer/advisor.jpg",
  products: "/images/offer/products.jpg",
  routine: "/images/offer/routine.jpg",
} as const

const FEATURES = [
  {
    kicker: "Dein KI Haar-Berater",
    title: "Frag alles. Bekomm sofort Antworten.",
    body: "Dein persönlicher Berater kennt dein Haar und erklärt dir, welche Pflege gerade sinnvoll ist.",
    benefit: "Kompetente Antworten, wann immer du sie brauchst.",
    imageUrl: FEATURE_IMAGES.advisor,
    imageAlt: "KI Haar-Berater",
  },
  {
    kicker: "500+ geprüfte Produkte",
    title: "Das richtige Shampoo. Der richtige Conditioner. Sofort.",
    body: "Chaarlie sagt dir genau, welche Produkte zu deiner Situation passen und warum.",
    benefit: "Nie wieder Fehlkäufe. Jedes Produkt hat einen Grund.",
    imageUrl: FEATURE_IMAGES.products,
    imageAlt: "Produktempfehlungen",
  },
  {
    kicker: "Deine Routine",
    title: "Ein klarer Plan. Was. Wann. Wie oft.",
    body: "Chaarlie baut dir eine Routine, die so einfach wie möglich ist und zu deinem Alltag passt.",
    benefit: "Du weißt jeden Tag genau, was zu tun ist.",
    imageUrl: FEATURE_IMAGES.routine,
    imageAlt: "Haarpflege Planer",
  },
] as const

const COMPARISON_ROWS = [
  ["Protein/Feuchtigkeit-Analyse", "—", "Ja"],
  ["Passende Produkte", "Rätselraten", "500+ mit Namen"],
  ["Persönliche Routine", "Trial & Error", "Sofort"],
  ["Beratung bei Fragen", "Teurer Salon", "Jederzeit"],
  ["Sichtbares Ergebnis", "Monate?", "4 Wochen"],
  ["Geld für falsche Produkte", "Hunderte €", "0 €"],
] as const

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? ""
}

function GuaranteeBadge() {
  return (
    <svg
      aria-label="14 Tage Geld-zurück-Garantie"
      className="mx-auto mb-4 size-[108px] text-[var(--brand-coral)]"
      viewBox="0 0 108 108"
      role="img"
    >
      <circle
        cx="54"
        cy="54"
        r="49"
        fill="none"
        stroke="currentColor"
        strokeDasharray="4 6"
        strokeWidth="1.5"
      />
      <circle cx="54" cy="54" r="42" fill="rgba(var(--brand-coral-rgb),0.08)" />
      <text
        x="54"
        y="31"
        textAnchor="middle"
        className="fill-[var(--brand-coral)] font-mono text-[8px] font-semibold uppercase tracking-[0.12em]"
      >
        Geld zurück
      </text>
      <text
        x="54"
        y="63"
        textAnchor="middle"
        className="fill-[var(--brand-plum-darkest)] font-header text-[32px] font-medium"
      >
        14
      </text>
      <text
        x="54"
        y="83"
        textAnchor="middle"
        className="fill-[var(--brand-plum)] font-mono text-[8px] font-semibold uppercase tracking-[0.12em]"
      >
        Tage Garantie
      </text>
    </svg>
  )
}

function StaticPricingPreview() {
  const selectedPlan = STRIPE_PRICING_PLANS.find((plan) => plan.interval === "quarter")

  return (
    <div className="space-y-4">
      <div className="grid gap-2.5">
        {STRIPE_PRICING_PLANS.map((plan) => (
          <div
            key={plan.interval}
            className="relative flex min-h-[74px] items-center gap-3 rounded-[14px] border border-border bg-white px-4 py-3"
          >
            {plan.badge ? (
              <span className="absolute right-3 top-0 -translate-y-1/2 rounded-full bg-[var(--brand-plum)] px-2.5 py-1 font-mono text-[8px] font-semibold uppercase tracking-[0.08em] text-white">
                {plan.badge}
              </span>
            ) : null}
            <span className="size-[18px] rounded-full border-2 border-border" />
            <span className="flex-1">
              <span className="block text-[15px] font-bold text-[var(--brand-plum-darkest)]">
                {plan.name}
              </span>
              <span className="block text-[11px] text-muted-foreground">
                {plan.perMonth}
                {plan.savings ? ` · ${plan.savings}` : ""}
              </span>
            </span>
            <span className="flex flex-col items-end leading-none">
              <span className="text-[12px] text-muted-foreground line-through">{plan.price}</span>
              <span className="mt-0.5 text-[17px] font-bold text-[var(--brand-plum-darkest)]">
                {plan.discountedPrice}
              </span>
            </span>
          </div>
        ))}
      </div>
      {selectedPlan ? (
        <div className="flex min-h-[54px] w-full items-center justify-center rounded-[12px] bg-[var(--brand-coral)] px-5 py-3 text-[14px] font-bold text-white">
          {selectedPlan.ctaLabel}
        </div>
      ) : null}
    </div>
  )
}

export function QuizResultOfferPageShell({
  name,
  narrative,
  pricingSlot,
  focusRoutine = false,
}: {
  name: string
  narrative: QuizResultNarrative
  pricingSlot?: ReactNode
  focusRoutine?: boolean
}) {
  const displayName = firstName(name)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="fixed inset-x-0 top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[520px] items-center justify-between gap-3 px-5 py-2.5">
          <ResultOfferCountdown
            className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--text-caption)]"
            valueClassName="font-sans text-[14px] font-bold text-[var(--brand-coral-dark)]"
            label="Angebot:"
          />
          <a
            href="#pricing"
            className="rounded-[12px] bg-[var(--brand-coral)] px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_8px_24px_-16px_rgba(var(--brand-coral-rgb),0.65)]"
          >
            Jetzt sichern
          </a>
        </div>
      </div>

      <main className="mx-auto w-full max-w-[520px] px-5">
        <section className="pb-7 pt-[72px] text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#2D9F5E]/25 bg-[#2D9F5E]/10 px-3.5 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[#2D9F5E]">
            <Check className="size-3.5" />
            Analyse fertig
          </span>
          <p className="mb-2 mt-4 font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-[var(--brand-plum)]">
            {displayName
              ? `${displayName}, hier findest du dein Ergebnis`
              : "Hier findest du dein Ergebnis."}
          </p>
          <h1 className="font-header text-[clamp(24px,7vw,34px)] font-medium leading-[1.14] text-[var(--brand-plum-darkest)]">
            So können sich deine Haare in 4 Wochen anfühlen.
          </h1>
        </section>

        <section className="space-y-4 border-t border-border py-8">
          <QuizResultTransformationCard rows={narrative.rows} />

          <article className="rounded-[16px] border border-border bg-white p-6 shadow-[0_1px_2px_rgba(var(--brand-plum-rgb),0.03)]">
            <p className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--brand-plum)]">
              {narrative.needs.title}
            </p>
            <h2 className="font-header text-[25px] font-medium leading-[1.2] text-[var(--brand-plum-darkest)]">
              {narrative.needs.mainLeverTitle}
            </h2>
            <p className="mt-4 text-[14.5px] leading-[1.65] text-[var(--brand-plum-darkest)]">
              {narrative.needs.mainLeverWhy}
            </p>
            <div className="mt-5">
              <QuizResultLeverRows products={narrative.needs.products} />
            </div>
          </article>
        </section>

        <section id="unlock-plan" className="scroll-mt-[72px] border-t border-border py-8">
          <article className="relative min-h-[248px] overflow-hidden rounded-[16px] border border-border bg-white shadow-[0_1px_2px_rgba(var(--brand-plum-rgb),0.03)]">
            <div className="space-y-2 p-6 blur-[5px]">
              <div className="h-3 w-3/4 rounded-full bg-[var(--brand-plum-ice)]" />
              <div className="h-3 w-1/2 rounded-full bg-[var(--brand-plum-ice)]" />
              <div className="h-3 w-5/6 rounded-full bg-[var(--brand-plum-ice)]" />
              <div className="h-3 w-2/5 rounded-full bg-[var(--brand-plum-ice)]" />
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 p-6 text-center">
              <LockKeyhole className="mb-2 size-9 text-[var(--brand-plum)]" />
              <h2 className="font-header text-[22px] font-medium text-[var(--brand-plum-darkest)]">
                {focusRoutine
                  ? "Der nächste Schritt: deine aktuelle Routine"
                  : "Dein vollständiger 30-Tage-Plan ist fertig"}
              </h2>
              <p className="mt-2 max-w-[300px] text-[13px] leading-relaxed text-muted-foreground">
                {focusRoutine
                  ? "Damit Chaarlie später gezielt Produkte, Reihenfolge und Anwendung empfehlen kann."
                  : "Mit konkreten Produkten für deine Situation"}
              </p>
              <p className="mt-2 text-[12px] italic text-muted-foreground">
                Ausgearbeitet von Chaarlie.
              </p>
              <a
                href="#pricing"
                className="mt-4 rounded-[12px] bg-[var(--brand-coral)] px-8 py-3 text-[13px] font-bold text-white"
              >
                Plan freischalten
              </a>
            </div>
          </article>
        </section>

        <section className="border-t border-border py-8">
          <div className="rounded-[16px] border border-[var(--brand-plum-light)] bg-[var(--brand-plum-ice)] p-5">
            <p className="mb-2 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-plum)]">
              Warum diese Empfehlung?
            </p>
            <h2 className="font-header text-[23px] font-medium leading-[1.2] text-[var(--brand-plum-darkest)]">
              Chaarlie bewertet erst dein Haar, dann die Produkte.
            </h2>
            <p className="mt-3 text-[14px] leading-[1.6] text-muted-foreground">
              Jede Routine wird aus deinem Profil, deinen Zielen und deinen aktuellen Gewohnheiten
              abgeleitet. So bleibt klar, warum ein Produkt passt und wann eine einfachere
              Alternative reicht.
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {["Analyse zuerst", "Konkrete Gründe", "Keine eigenen Produkte"].map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-[var(--brand-plum-light)] bg-white px-2.5 py-1 font-mono text-[8px] font-semibold uppercase tracking-[0.06em] text-[var(--brand-plum)]"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-3 border-t border-border py-8">
          <p className="text-center font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-[var(--brand-plum)]">
            Was Chaarlie für dich tut
          </p>
          <h2 className="text-center font-header text-[28px] font-medium leading-[1.18] text-[var(--brand-plum-darkest)]">
            Dein persönlicher Haar-Experte. Immer dabei.
          </h2>
          {FEATURES.map((feature) => (
            <article
              key={feature.kicker}
              className="overflow-hidden rounded-[14px] border border-border bg-white"
            >
              <div className="h-[240px] overflow-hidden bg-[var(--brand-plum-ice)]">
                {/* eslint-disable-next-line @next/next/no-img-element -- renderToStaticMarkup tests do not load Next image remote config. */}
                <img
                  src={feature.imageUrl}
                  alt={feature.imageAlt}
                  className="h-full w-full object-cover object-top"
                />
              </div>
              <div className="p-5">
                <p className="mb-2 font-mono text-[9px] font-semibold uppercase tracking-[0.09em] text-[var(--brand-plum)]">
                  {feature.kicker}
                </p>
                <h3 className="text-[17px] font-bold leading-snug text-[var(--brand-plum-darkest)]">
                  {feature.title}
                </h3>
                <p className="mt-2 text-[14px] leading-[1.55] text-muted-foreground">
                  {feature.body}
                </p>
                <p className="mt-4 border-t border-border pt-3 font-header text-[13px] italic leading-snug text-[var(--brand-plum)]">
                  {feature.benefit}
                </p>
              </div>
            </article>
          ))}
        </section>

        <section className="border-t border-border py-8">
          <h2 className="mb-4 text-center font-header text-[28px] font-medium leading-[1.18] text-[var(--brand-plum-darkest)]">
            Ohne vs. mit Chaarlie
          </h2>
          <table className="w-full overflow-hidden rounded-[12px] border border-border bg-white text-[13px]">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-3 text-left font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Vergleich
                </th>
                <th className="px-3 py-3 text-center font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--text-caption)]">
                  Ohne
                </th>
                <th className="bg-[var(--brand-plum-ice)]/70 px-3 py-3 text-center font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--brand-plum)]">
                  Chaarlie
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map(([label, without, withChaarlie]) => (
                <tr key={label} className="border-t border-border first:border-t-0">
                  <td className="px-3 py-3 text-left text-muted-foreground">{label}</td>
                  <td className="px-3 py-3 text-center text-[var(--text-caption)]">{without}</td>
                  <td className="bg-[var(--brand-plum-ice)]/70 px-3 py-3 text-center font-bold text-[var(--brand-plum)]">
                    {withChaarlie}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section id="pricing" className="scroll-mt-[72px] border-t border-border py-8">
          {focusRoutine ? (
            <p className="mb-3 rounded-[12px] bg-[var(--brand-plum-ice)] px-3 py-2 text-center text-[12px] font-bold text-[var(--brand-plum)]">
              Weiter mit deiner Routine
            </p>
          ) : null}
          <p className="text-center font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-[var(--brand-plum)]">
            Dein Plan ist fertig
          </p>
          <h2 className="mt-2 text-center font-header text-[34px] font-medium leading-[1.14] text-[var(--brand-plum-darkest)]">
            Starte Chaarlie
          </h2>
          <p className="mx-auto mt-3 max-w-[36ch] text-center text-[16px] leading-[1.6] text-muted-foreground">
            Deine Auswertung zeigt, was möglich ist. Dein Plan zeigt dir wie.
          </p>
          {focusRoutine ? (
            <p className="mx-auto mt-3 max-w-[36ch] text-center text-[13px] leading-[1.55] text-muted-foreground">
              Wir schauen uns an, was du aktuell verwendest, damit Chaarlie gezielter empfehlen
              kann.
            </p>
          ) : null}
          <div className="my-5 rounded-[14px] border border-[rgba(var(--brand-coral-rgb),0.14)] bg-[var(--brand-coral-light)] p-5 text-center">
            <ResultOfferCountdown
              className="flex items-center justify-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--brand-coral)]"
              valueClassName="block font-sans text-[32px] font-bold leading-none text-[var(--brand-plum-darkest)]"
            />
            <p className="mt-2 text-[12px] text-muted-foreground">Danach gilt der normale Preis</p>
          </div>
          {pricingSlot ?? <StaticPricingPreview />}
          <article className="mt-7 rounded-[14px] border border-border bg-white p-6 text-center">
            <ShieldCheck aria-hidden="true" className="mx-auto size-9 text-[var(--brand-coral)]" />
            <GuaranteeBadge />
            <h3 className="font-header text-[22px] font-medium text-[var(--brand-plum-darkest)]">
              Geld-zurück-Garantie
            </h3>
            <p className="mt-2 text-[13px] leading-[1.6] text-muted-foreground">
              Sollte der Plan nicht zu dir passen, bekommst du innerhalb von 14 Tagen nach dem Kauf
              dein Geld zurück.
            </p>
          </article>
        </section>

        <section className="border-t border-border pb-20 pt-8 text-center">
          <MessageCircle className="mx-auto mb-3 size-8 text-[var(--brand-plum)]" />
          <h2 className="font-header text-[28px] font-medium leading-[1.18] text-[var(--brand-plum-darkest)]">
            {focusRoutine
              ? "Mach mit deiner Routine weiter."
              : "Dein Haar wartet nicht. Starte jetzt."}
          </h2>
          <p className="mx-auto mt-3 max-w-[36ch] text-[14px] leading-[1.6] text-muted-foreground">
            {focusRoutine
              ? "Deine Haaranalyse ist fertig. Jetzt verstehen wir deine aktuelle Pflege-Routine."
              : "Dein persönlicher Plan ist fertig. Hol dir jetzt das Sonderangebot."}
          </p>
          <a
            href="#pricing"
            className="mt-5 flex min-h-[54px] w-full items-center justify-center rounded-[12px] bg-[var(--brand-coral)] px-5 py-3 text-[14px] font-bold text-white shadow-[0_8px_24px_-16px_rgba(var(--brand-coral-rgb),0.65)]"
          >
            Mein Angebot sichern
          </a>
        </section>
      </main>
    </div>
  )
}

export function QuizResultOfferPage({
  name,
  narrative,
  leadId,
  onCheckoutOpen,
  focusRoutine = false,
}: {
  name: string
  narrative: QuizResultNarrative
  leadId: string | null
  onCheckoutOpen?: () => void
  focusRoutine?: boolean
}) {
  return (
    <QuizResultOfferPageShell
      name={name}
      narrative={narrative}
      pricingSlot={<ResultOfferPricing leadId={leadId} onCheckoutOpen={onCheckoutOpen} />}
      focusRoutine={focusRoutine}
    />
  )
}
