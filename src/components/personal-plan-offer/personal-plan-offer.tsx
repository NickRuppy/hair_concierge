"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowDown, ArrowRight } from "lucide-react"

import { QUIZ_RESULT_REFERENCE_PRICES } from "@/components/checkout/plan-reference-prices"
import { OfferTrackingProvider } from "@/components/quiz/offer-tracking-provider"
import { ResultOfferPricing } from "@/components/quiz/result-offer-pricing"
import type { FunnelAnalyticsEnvelope, OfferEntryContext } from "@/lib/analytics/events"
import type { PersonalPlanDiagnosticDimension, PersonalPlanOfferModel } from "./types"

const testimonials = [
  {
    name: "Kim · Endlich verstehe ich meine Haare",
    quote:
      "Der Fragebogen ist echt gut und leicht verständlich. Auch die Produktempfehlung fand ich gut.",
  },
  {
    name: "Kerstin · Echte Antworten bekommen",
    quote:
      "Ich finde die Interaktion sehr gut: meine Fragen stellen zu können und dann die benötigten Antworten zu bekommen.",
  },
  {
    name: "Sarah · Nie wieder googeln vorm Regal",
    quote:
      "Bei den Produkten stehen Preis, Anwendung und der Grund dabei, warum sie empfohlen werden.",
  },
]

const PERSONAL_PLAN_OFFER_REVISION = "personal_plan_v2"

const planHighlights = [
  {
    emphasis: "Versteh endlich",
    prefix: "",
    remainder: ", was deine Haare wirklich brauchen",
    suffix: " – statt weiter zu raten.",
  },
  {
    emphasis: "Eine klare Routine",
    prefix: "",
    remainder: " ohne Produktchaos:",
    suffix: " wenige Produkte, feste Reihenfolge.",
  },
  {
    emphasis: "weich",
    prefix: "Fahr dir durch die Haare und sie fühlen sich ",
    remainder: "",
    suffix: " an – nicht trocken und strohig.",
  },
  {
    emphasis: "offen",
    prefix: "Trag deine Haare wieder ",
    remainder: "",
    suffix: " – mit einem richtig guten Gefühl.",
  },
]

const diagnosticMethods = [
  ["Zugtest", "Struktur & Elastizität"],
  ["Oberflächentest", "Haaroberfläche & Glanz"],
  ["Kopfhaut-Check", "Typ & Zustand"],
  ["Über 1.000 Produkte", "analysiert & geprüft"],
] as const

const beforeAfterContrasts = [
  [
    "„Ich weiß nie, welche Produkte wirklich zu mir passen.“",
    "Empfehlungen mit Grund, abgestimmt auf deine Auswertung",
  ],
  [
    "„Meine Haare sind trocken, strohig oder glanzlos.“",
    "Weich, geschmeidig, mit Glanz, den man sieht",
  ],
  ["Haare im Dutt oder Zopf verstecken", "Haare offen tragen, mit gutem Gefühl"],
] as const

const surveyStats = [
  ["82%", "wollen verstehen, was ihr Haar wirklich braucht", "#563882"],
  ["73%", "wünschen sich eine klare Routine ohne Produktchaos", "#7657a2"],
  ["63%", "wissen nicht, welche Produkte wirklich passen", "#9a7cbd"],
] as const

const SPECTRUM_LABELS: Record<1 | 2 | 3, string> = {
  1: "Viel Potenzial",
  2: "Gute Basis",
  3: "Optimal",
}

function Segments({ count, tone }: { count: 1 | 2 | 3; tone: "today" | "goal" }) {
  return (
    <div className="flex gap-1.5" aria-label={`${count} von 3`}>
      {[1, 2, 3].map((segment) => (
        <span
          key={segment}
          className={
            segment <= count
              ? tone === "goal"
                ? "h-2.5 flex-1 rounded-full bg-[#3b8d60]"
                : "h-2.5 flex-1 rounded-full bg-[var(--brand-plum)]"
              : "h-2.5 flex-1 rounded-full bg-[rgba(var(--brand-plum-rgb),0.12)]"
          }
        />
      ))}
    </div>
  )
}

function displayDiagnosticSummary(summary: string): string {
  if (summary === "Dein Plan hilft dir, diese Stärke zuverlässig zu erhalten.") {
    return "Dein Plan hilft dir, diese gute Ausgangslage zuverlässig zu erhalten."
  }
  return summary
}

function displayProfileLine(profileLine?: string): string {
  const value = profileLine?.trim().replace(/\.$/, "")
  if (!value || value === "Basierend auf deiner Haaranalyse") {
    return "Für dein persönliches Haarprofil."
  }
  if (value === "Basierend auf deiner persönlichen Haaranalyse") {
    return "Für dein persönliches Haarprofil."
  }
  const personalized = value.match(/^Basierend auf deiner Analyse für (.+)$/)
  return `${personalized ? `Für ${personalized[1]}` : value}.`
}

function BeforeAfterFigure() {
  return (
    <figure className="mt-4 overflow-hidden rounded-[1.5rem] border border-[rgba(var(--brand-plum-rgb),0.10)] bg-white shadow-[0_24px_54px_-42px_rgba(var(--brand-plum-rgb),0.7)] sm:mt-5 sm:rounded-[1.75rem] [@media(min-width:640px)_and_(max-height:700px)]:col-start-2 [@media(min-width:640px)_and_(max-height:700px)]:row-span-2 [@media(min-width:640px)_and_(max-height:700px)]:row-start-1 [@media(min-width:640px)_and_(max-height:700px)]:mt-0">
      <div className="relative grid grid-cols-2 gap-2 bg-white p-2 sm:gap-4 sm:p-4">
        {[
          ["Heute", "left center", "bg-white/92 text-[var(--brand-plum-darkest)]"],
          ["Dein Ziel", "right center", "bg-white/92 text-[#255f40]"],
        ].map(([label, position, labelClass]) => (
          <div
            className="relative aspect-[3/4] overflow-hidden rounded-[1rem] sm:aspect-[2/3] sm:rounded-[1.15rem] [@media(min-width:640px)_and_(max-height:700px)]:aspect-[16/9]"
            key={label}
          >
            <div
              aria-label={
                label === "Heute" ? "Symbolische heutige Haarsituation" : "Symbolisches Haarziel"
              }
              className="absolute inset-0 bg-no-repeat"
              role="img"
              style={{
                backgroundImage:
                  "url('/images/funnels/personal-plan-offer/before-after-generic.webp')",
                backgroundPosition: position,
                backgroundSize: "200% auto",
              }}
            />
            <span
              className={`absolute left-2 top-2 rounded-full px-2.5 py-1 text-[11px] font-bold shadow-sm sm:left-3 sm:top-3 sm:px-3 sm:py-1.5 sm:text-xs ${labelClass}`}
            >
              {label}
            </span>
          </div>
        ))}
        <span
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-white bg-[var(--brand-plum)] text-white shadow-lg sm:h-12 sm:w-12 sm:border-[6px]"
        >
          <ArrowRight className="h-5 w-5" strokeWidth={2.25} />
        </span>
      </div>
      <figcaption className="border-t border-[rgba(var(--brand-plum-rgb),0.08)] px-4 py-2.5 text-center text-xs text-[rgba(var(--brand-plum-rgb),0.58)]">
        Symbolbild · Ergebnisse sind individuell
      </figcaption>
    </figure>
  )
}

function DiagnosticRow({ row }: { row: PersonalPlanDiagnosticDimension }) {
  return (
    <article className="rounded-[1.25rem] border border-[rgba(var(--brand-plum-rgb),0.10)] bg-white p-4 shadow-[0_16px_44px_-36px_rgba(var(--brand-plum-rgb),0.55)] sm:rounded-[1.5rem] sm:p-5">
      <h3 className="font-serif text-[1.2rem] leading-tight text-[var(--brand-plum-darkest)] sm:text-[1.45rem]">
        {row.title}
      </h3>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:gap-3">
        <div className="rounded-xl bg-[rgba(var(--brand-plum-rgb),0.055)] p-3 sm:rounded-2xl sm:p-4">
          <p className="mb-2 text-xs font-semibold leading-tight text-[rgba(var(--brand-plum-rgb),0.70)] sm:text-sm">
            {SPECTRUM_LABELS[row.todaySegments]}
          </p>
          <Segments count={row.todaySegments} tone="today" />
        </div>
        <div className="rounded-xl bg-[var(--brand-plum-ice)] p-3 sm:rounded-2xl sm:p-4">
          <p className="mb-2 text-xs font-semibold leading-tight text-[var(--brand-plum)] sm:text-sm">
            {SPECTRUM_LABELS[row.potentialSegments]}
          </p>
          <Segments count={row.potentialSegments} tone="goal" />
        </div>
      </div>
      <p className="mt-3 text-[0.9rem] leading-6 text-[rgba(var(--brand-plum-rgb),0.75)] sm:mt-4 sm:text-[0.95rem] sm:leading-7">
        {displayDiagnosticSummary(row.summary)}
      </p>
    </article>
  )
}

export function PersonalPlanOffer({
  entryContext,
  leadId,
  model,
  offerTracking,
}: {
  entryContext: OfferEntryContext
  leadId: string
  model: PersonalPlanOfferModel
  offerTracking?: FunnelAnalyticsEnvelope | null
}) {
  const [checkoutOpenRequest, setCheckoutOpenRequest] = useState(0)
  const openCheckout = () => setCheckoutOpenRequest((value) => value + 1)
  const scrollToPricing = () => {
    const pricing = document.getElementById("pricing")
    if (!pricing) return
    pricing.scrollIntoView({ behavior: "smooth", block: "start" })
    window.setTimeout(() => pricing.focus({ preventScroll: true }), 450)
  }

  return (
    <OfferTrackingProvider
      entryContext={entryContext}
      focusRoutine={false}
      leadId={leadId}
      offerRevision={PERSONAL_PLAN_OFFER_REVISION}
      offerTracking={offerTracking}
      offerVariant="personal-plan-v1"
      trackingIdentity={{
        conditionerModuleId: null,
        needLane: null,
        shampooModuleId: null,
        suggestedCategory: null,
      }}
    >
      <main className="min-h-screen bg-[#fcfaf7] text-[var(--brand-plum-darkest)]">
        <div className="sticky top-0 z-30 border-b border-[rgba(var(--brand-plum-rgb),0.10)] bg-[#fcfaf7]/95 backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
            <Link href="/lp/haarplan" className="font-serif text-2xl font-semibold tracking-tight">
              chaarlie
            </Link>
            <button
              className="rounded-full bg-[var(--brand-plum)] px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_28px_-18px_rgba(var(--brand-plum-rgb),0.85)]"
              data-offer-cta="sticky_header"
              data-offer-destination="pricing"
              data-offer-source-section="hero"
              onClick={scrollToPricing}
              type="button"
            >
              Pläne ansehen
            </button>
          </div>
        </div>

        <section
          className="mx-auto max-w-4xl px-4 pb-5 pt-5 text-center sm:pb-8 sm:pt-10 [@media(min-width:640px)_and_(max-height:700px)]:grid [@media(min-width:640px)_and_(max-height:700px)]:grid-cols-[0.8fr_1.2fr] [@media(min-width:640px)_and_(max-height:700px)]:items-center [@media(min-width:640px)_and_(max-height:700px)]:gap-x-6 [@media(min-width:640px)_and_(max-height:700px)]:pb-5 [@media(min-width:640px)_and_(max-height:700px)]:pt-5 [@media(min-width:640px)_and_(max-height:700px)]:text-left"
          data-offer-section="hero"
        >
          <h1 className="mx-auto max-w-[15ch] font-serif text-[2.25rem] leading-[0.98] tracking-[-0.04em] sm:text-6xl [@media(min-width:640px)_and_(max-height:700px)]:mx-0 [@media(min-width:640px)_and_(max-height:700px)]:self-end [@media(min-width:640px)_and_(max-height:700px)]:text-[2.25rem]">
            Dein Haarplan ist bereit.
          </h1>
          <p className="mx-auto mt-3 max-w-[34rem] text-base leading-6 text-[rgba(var(--brand-plum-rgb),0.72)] sm:text-lg [@media(min-width:640px)_and_(max-height:700px)]:mx-0 [@media(min-width:640px)_and_(max-height:700px)]:mt-2 [@media(min-width:640px)_and_(max-height:700px)]:self-start [@media(min-width:640px)_and_(max-height:700px)]:text-base">
            {displayProfileLine(model.profileLine)}
          </p>
          <BeforeAfterFigure />
        </section>

        <section
          className="border-y border-[rgba(var(--brand-plum-rgb),0.08)] bg-white/55 px-4 py-6 sm:py-10"
          data-offer-section="personal_plan_diagnosis"
        >
          <div className="mx-auto max-w-4xl">
            <p className="text-center text-xs font-extrabold uppercase tracking-[0.16em] text-[rgba(var(--brand-plum-rgb),0.60)]">
              Deine Ausgangslage
            </p>
            <h2 className="mt-1.5 w-full text-center font-serif text-[1.875rem] leading-tight tracking-[-0.035em] sm:text-4xl">
              Dein Haar hat viel Potenzial.
            </h2>
            <div className="mt-4 space-y-3 sm:mt-5 sm:space-y-4">
              {model.diagnosticRows.map((row) => (
                <DiagnosticRow key={row.id} row={row} />
              ))}
            </div>

            <div className="mt-4 rounded-[1.25rem] border border-[rgba(var(--brand-plum-rgb),0.10)] bg-[rgba(var(--brand-plum-rgb),0.08)] p-4 sm:mt-5 sm:rounded-[1.5rem] sm:p-5">
              <p className="text-base font-semibold leading-7 text-[var(--brand-plum-darkest)] sm:text-lg sm:leading-8">
                {model.planFitStatement}
              </p>
            </div>
          </div>
        </section>

        <section
          className="mx-auto max-w-4xl px-4 py-7 sm:py-14"
          data-offer-section="personal_plan_complete_plan"
        >
          <div className="text-center">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[rgba(var(--brand-plum-rgb),0.60)]">
              Was du freischaltest
            </p>
            <h2 className="mx-auto mt-2 max-w-[18ch] font-serif text-[2rem] leading-[1.05] tracking-[-0.035em] sm:mt-3 sm:max-w-[24ch] sm:text-4xl sm:leading-tight">
              Die Highlights deines Plans
            </h2>
          </div>
          <div className="mt-5 grid gap-2 sm:mt-7 sm:grid-cols-2 sm:gap-3">
            {planHighlights.map((item) => (
              <div
                className="grid grid-cols-[30px_1fr] items-start gap-3 rounded-2xl border border-[rgba(var(--brand-plum-rgb),0.10)] bg-white p-3 text-left shadow-[0_16px_42px_-34px_rgba(var(--brand-plum-rgb),0.55)] sm:p-4"
                key={item.emphasis}
              >
                <span
                  aria-hidden="true"
                  className="grid h-[30px] w-[30px] place-items-center rounded-full bg-[#eee8f6] text-sm font-black text-[#6b50a0]"
                >
                  ✓
                </span>
                <p className="mt-px text-[13px] font-semibold leading-[1.42] sm:text-sm">
                  <strong className="font-extrabold">
                    {item.prefix}
                    <span className="text-[#5a3c8d] shadow-[inset_0_-0.46em_rgba(107,80,160,0.13)]">
                      {item.emphasis}
                    </span>
                    {item.remainder}
                  </strong>
                  {item.suffix}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section
          className="border-y border-[rgba(var(--brand-plum-rgb),0.08)] bg-white/55 px-4 py-10 sm:py-14"
          data-offer-section="personal_plan_method"
        >
          <div className="mx-auto max-w-4xl">
            <div className="rounded-[1.25rem] border border-[rgba(var(--brand-plum-rgb),0.09)] bg-white p-[18px] text-center shadow-[0_16px_42px_-34px_rgba(var(--brand-plum-rgb),0.60)]">
              <h2 className="mx-auto max-w-[24ch] font-serif text-[1.375rem] leading-[1.13] tracking-[-0.025em] sm:text-4xl sm:leading-tight">
                Dein Plan basiert auf echter Haar-Diagnostik:
              </h2>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {diagnosticMethods.map(([title, description]) => (
                  <div
                    className="flex min-h-[75px] flex-col items-center justify-center rounded-xl bg-[#f1ecf6] p-3 text-center"
                    key={title}
                  >
                    <strong className="block text-xs sm:text-sm">{title}</strong>
                    <span className="mt-1 block text-[11px] leading-[1.35] text-[rgba(var(--brand-plum-rgb),0.68)] sm:text-xs">
                      {description}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-center text-[11px] text-[rgba(var(--brand-plum-rgb),0.58)] sm:text-xs">
                Entwickelt gemeinsam mit Friseurmeistern.
              </p>
            </div>
            <div className="mt-3 flex flex-col items-center gap-2 rounded-2xl bg-[var(--brand-plum)] px-4 py-3.5 text-center text-white">
              <span
                aria-hidden="true"
                className="grid h-[30px] w-[30px] place-items-center rounded-full bg-white/15"
              >
                <ArrowDown className="h-[17px] w-[17px]" strokeWidth={2.25} />
              </span>
              <p className="max-w-[34rem] text-xs font-bold leading-[1.42] sm:text-sm">
                Daraus entstehen deine Produktauswahl, Reihenfolge und Anwendung.
              </p>
            </div>
          </div>
        </section>

        <section
          className="mx-auto max-w-4xl px-4 py-7 sm:py-14"
          data-offer-section="personal_plan_before_after"
        >
          <div className="text-center">
            <h2 className="font-serif text-[2rem] leading-tight tracking-[-0.035em] sm:text-4xl">
              Vorher und <span className="text-[#6b50a0]">nachher</span> mit Chaarlie
            </h2>
            <p className="mt-3 text-base leading-7 text-[rgba(var(--brand-plum-rgb),0.72)]">
              So beschreiben es Frauen in unserer Umfrage:
            </p>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3 sm:mt-7">
            {beforeAfterContrasts.map(([before, after]) => (
              <article
                className="overflow-hidden rounded-[1.5rem] border border-[rgba(var(--brand-plum-rgb),0.10)] bg-white shadow-[0_16px_42px_-34px_rgba(var(--brand-plum-rgb),0.55)]"
                key={before}
              >
                <p className="flex items-start gap-3 bg-[#f7f4f9] px-4 py-4 text-left text-sm italic leading-6 text-[rgba(var(--brand-plum-rgb),0.63)]">
                  <span
                    aria-hidden="true"
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#ebe7ee] text-sm font-bold text-[#aaa2ad]"
                  >
                    ×
                  </span>
                  <span>{before}</span>
                </p>
                <p className="flex items-start gap-3 border-t border-[rgba(var(--brand-plum-rgb),0.07)] px-4 py-4 text-left text-sm font-bold leading-6 text-[#6b50a0]">
                  <span
                    aria-hidden="true"
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#6b50a0] text-sm text-white"
                  >
                    ✓
                  </span>
                  <span>{after}</span>
                </p>
              </article>
            ))}
          </div>
        </section>

        <section
          className="mx-auto max-w-4xl scroll-mt-16 px-4 py-10 sm:py-14"
          data-offer-section="pricing"
          id="pricing"
          tabIndex={-1}
        >
          <div className="text-center">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[rgba(var(--brand-plum-rgb),0.60)]">
              Plan freischalten
            </p>
            <h2 className="mx-auto mt-3 max-w-[24ch] font-serif text-4xl leading-tight tracking-[-0.035em]">
              Starte mit deinem persönlichen Plan.
            </h2>
          </div>
          <div className="mt-7">
            <ResultOfferPricing
              leadId={leadId}
              offerTracking={offerTracking}
              openCheckoutRequestId={checkoutOpenRequest}
              referencePrices={QUIZ_RESULT_REFERENCE_PRICES}
            />
          </div>
        </section>

        <section
          className="border-y border-[rgba(var(--brand-plum-rgb),0.08)] bg-white/55 px-4 py-10 sm:py-14"
          data-offer-section="personal_plan_survey"
        >
          <div className="mx-auto max-w-4xl text-center">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[rgba(var(--brand-plum-rgb),0.60)]">
              Was Frauen wirklich beschäftigt
            </p>
            <h2 className="mt-3 font-serif text-4xl leading-tight tracking-[-0.035em]">
              Über 4.000 Frauen haben uns geantwortet.
            </h2>
            <div className="mt-7 grid items-stretch gap-3 md:grid-cols-3">
              {surveyStats.map(([value, label, ringColor]) => (
                <div
                  className="flex min-h-[92px] items-center gap-3.5 rounded-[1.25rem] border border-[rgba(var(--brand-plum-rgb),0.06)] bg-white py-2.5 pl-3 pr-4 text-left shadow-[0_16px_42px_-34px_rgba(var(--brand-plum-rgb),0.55)]"
                  key={value}
                >
                  <span
                    className="grid h-[66px] w-[66px] shrink-0 place-items-center rounded-full p-[7px]"
                    style={{
                      background: `conic-gradient(${ringColor} ${value.slice(0, -1)}%, rgba(var(--brand-plum-rgb),0.10) 0)`,
                    }}
                  >
                    <strong className="grid h-full w-full place-items-center rounded-full bg-white font-serif text-[19px] font-medium leading-none text-[var(--brand-plum-darkest)]">
                      {value}
                    </strong>
                  </span>
                  <span className="block text-[12.5px] font-semibold leading-[1.45] text-[rgba(var(--brand-plum-rgb),0.72)]">
                    {label}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-center text-sm text-[rgba(var(--brand-plum-rgb),0.55)]">
              Quelle: eigene Umfrage · 4.024 Antworten · Mehrfachauswahl möglich
            </p>
          </div>
        </section>

        <section className="px-4 py-7 sm:py-14" data-offer-section="testimonials">
          <div className="mx-auto max-w-4xl text-center">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[rgba(var(--brand-plum-rgb),0.60)]">
              Stimmen aus der Beta
            </p>
            <h2 className="mt-3 font-serif text-4xl leading-tight tracking-[-0.035em]">
              Das sagen Kundinnen über Chaarlie.
            </h2>
            <div className="mt-7 grid items-stretch gap-3 md:grid-cols-3">
              {testimonials.map((testimonial) => (
                <blockquote
                  className="h-full rounded-[1.5rem] border border-[rgba(var(--brand-plum-rgb),0.06)] bg-white p-6 text-left shadow-[0_16px_42px_-34px_rgba(var(--brand-plum-rgb),0.55)]"
                  key={testimonial.name}
                >
                  <span aria-label="5 von 5 Sternen" className="text-[#d96869]">
                    ★★★★★
                  </span>
                  <strong className="mt-2 block">{testimonial.name}</strong>
                  <p className="mt-3 text-base leading-7">„{testimonial.quote}“</p>
                </blockquote>
              ))}
            </div>
          </div>
        </section>

        <section
          className="mx-auto max-w-4xl px-4 pb-6 pt-3 sm:py-14"
          data-offer-section="guarantee"
        >
          <div className="rounded-[1.5rem] border border-[rgba(var(--brand-plum-rgb),0.10)] bg-white p-5 text-center sm:rounded-[1.75rem] sm:p-6">
            <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-[rgba(var(--brand-plum-rgb),0.60)] sm:text-sm">
              Ohne Risiko
            </p>
            <h2 className="mx-auto mt-2 max-w-[18ch] font-serif text-[2rem] leading-[1.05] sm:max-w-none sm:text-4xl sm:leading-tight">
              14 Tage Geld-zurück-Garantie
            </h2>
            <p className="mx-auto mt-3 max-w-[34rem] text-sm leading-6 text-[rgba(var(--brand-plum-rgb),0.72)] sm:mt-4 sm:text-base sm:leading-7">
              Wenn Chaarlie für dich nicht hilfreich ist, bekommst du dein Geld zurück.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-4 pb-24 pt-1" data-offer-section="faq">
          <h2 className="text-center font-serif text-[2rem] leading-tight tracking-[-0.035em] sm:text-4xl">
            Häufige Fragen
          </h2>
          <div className="mt-6 space-y-3">
            {[
              [
                "Warum reicht nicht einfach ein neues Shampoo?",
                "Ein einzelnes Produkt kann nur einen Teil beeinflussen. Dein Plan verbindet Reinigung, Pflege, Styling und Anwendung, damit die Schritte zu deinem Haar und zueinander passen.",
              ],
              [
                "Ist der Plan wirklich auf mein Haar abgestimmt?",
                "Deine Haarstruktur, Dicke, Dichte, Länge, Oberfläche, Elastizität, Kopfhaut und Ziele bestimmen, wie dein Plan aufgebaut wird.",
              ],
              [
                "Was bekomme ich genau?",
                "Eine vollständige Routine mit passenden Produkten, der richtigen Reihenfolge sowie klarer Anwendung und Häufigkeit. Chat und Haartagebuch sind ergänzend enthalten.",
              ],
              [
                "Kann ich meine bisherigen Produkte weiterverwenden?",
                "Ja. Im anschließenden Onboarding gibst du an, was du bereits nutzt. Passende Produkte können in deinen Plan übernommen werden.",
              ],
              [
                "Was passiert direkt nach dem Kauf?",
                "Du ergänzt noch deine vorhandenen Produkte und Gewohnheiten. Danach wird dein vollständiger Plan im Routinebereich geöffnet.",
              ],
            ].map(([question, answer], index) => (
              <details
                className="rounded-2xl border border-[rgba(var(--brand-plum-rgb),0.10)] bg-white p-5"
                data-offer-faq={`personal-plan-${index + 1}`}
                key={question}
              >
                <summary className="cursor-pointer font-bold">{question}</summary>
                <p className="mt-3 text-base leading-7 text-[rgba(var(--brand-plum-rgb),0.72)]">
                  {answer}
                </p>
              </details>
            ))}
          </div>
          <div
            className="mt-8 rounded-[1.5rem] bg-[var(--brand-plum)] p-6 text-center text-white"
            data-offer-section="final_cta"
          >
            <h2 className="font-serif text-3xl leading-tight">
              Dein Plan zu schöneren Haaren in 30 Tagen.
            </h2>
            <button
              className="mt-5 rounded-full bg-white px-7 py-3 font-bold text-[var(--brand-plum-darkest)]"
              data-offer-cta="final"
              data-offer-destination="checkout"
              data-offer-source-section="final_cta"
              onClick={openCheckout}
              type="button"
            >
              Plan sichern
            </button>
          </div>
        </section>
      </main>
    </OfferTrackingProvider>
  )
}

export function PersonalPlanOfferRecovery({ leadId }: { leadId: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#fcfaf7] px-4 text-[var(--brand-plum-darkest)]">
      <section className="max-w-lg rounded-[2rem] border border-[rgba(var(--brand-plum-rgb),0.10)] bg-white p-7 text-center shadow-[0_22px_54px_-40px_rgba(var(--brand-plum-rgb),0.55)]">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[rgba(var(--brand-plum-rgb),0.60)]">
          Haarplan wird vorbereitet
        </p>
        <h1 className="mt-3 font-serif text-4xl leading-tight tracking-[-0.035em]">
          Dein Ergebnis ist noch nicht vollständig bereit.
        </h1>
        <p className="mt-4 text-base leading-7 text-[rgba(var(--brand-plum-rgb),0.72)]">
          Bitte versuche es noch einmal. Deine Quizdaten bleiben erhalten, aber wir zeigen keine
          erfundenen Produktempfehlungen an.
        </p>
        <Link
          className="mt-6 inline-flex rounded-full bg-[var(--brand-plum)] px-6 py-3 font-bold text-white"
          href={`/result/${leadId}?entry=quiz_completion`}
        >
          Ergebnis erneut laden
        </Link>
      </section>
    </main>
  )
}

export function PersonalPlanPaidContinuation({ leadId, name }: { leadId: string; name: string }) {
  const displayName = name.trim().split(/\s+/)[0]
  return (
    <main className="grid min-h-screen place-items-center bg-[#fcfaf7] px-4 text-[var(--brand-plum-darkest)]">
      <section className="max-w-xl rounded-[2rem] border border-[rgba(var(--brand-plum-rgb),0.10)] bg-white p-7 text-center shadow-[0_22px_54px_-40px_rgba(var(--brand-plum-rgb),0.55)]">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[rgba(var(--brand-plum-rgb),0.60)]">
          Dein Haarplan ist bereit
        </p>
        <h1 className="mt-3 font-serif text-4xl leading-tight tracking-[-0.035em]">
          {displayName ? `${displayName}, ` : ""}verfeinere deinen Plan mit deinen Produkten.
        </h1>
        <p className="mt-4 text-base leading-7 text-[rgba(var(--brand-plum-rgb),0.72)]">
          Dein persönlicher Haarpflegeplan ist vorbereitet. Im nächsten Schritt ergänzt du noch,
          welche Produkte du bereits nutzt. Danach öffnet sich dein Routinebereich.
        </p>
        <Link
          className="mt-6 inline-flex rounded-full bg-[var(--brand-plum)] px-6 py-3 font-bold text-white"
          href={`/onboarding?lead=${leadId}&returnTo=%2Froutine`}
        >
          Meinen Plan verfeinern
        </Link>
      </section>
    </main>
  )
}
