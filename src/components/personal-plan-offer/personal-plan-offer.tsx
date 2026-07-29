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

const PERSONAL_PLAN_OFFER_REVISION = "personal_plan_v1"

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
    <figure className="mt-5 overflow-hidden rounded-[1.75rem] border border-[rgba(var(--brand-plum-rgb),0.10)] bg-white shadow-[0_24px_54px_-42px_rgba(var(--brand-plum-rgb),0.7)]">
      <div className="relative grid grid-cols-2 gap-3 bg-white p-3 sm:gap-4 sm:p-4">
        {[
          ["Heute", "left center", "bg-white/92 text-[var(--brand-plum-darkest)]"],
          ["Dein Ziel", "right center", "bg-white/92 text-[#255f40]"],
        ].map(([label, position, labelClass]) => (
          <div className="relative aspect-[2/3] overflow-hidden rounded-[1.15rem]" key={label}>
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
                backgroundSize: "200% 100%",
              }}
            />
            <span
              className={`absolute left-3 top-3 rounded-full px-3 py-1.5 text-xs font-bold shadow-sm ${labelClass}`}
            >
              {label}
            </span>
          </div>
        ))}
        <span
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[6px] border-white bg-[var(--brand-plum)] text-white shadow-lg"
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
    <article className="rounded-[1.5rem] border border-[rgba(var(--brand-plum-rgb),0.10)] bg-white p-5 shadow-[0_16px_44px_-36px_rgba(var(--brand-plum-rgb),0.55)]">
      <h3 className="font-serif text-[1.45rem] leading-tight text-[var(--brand-plum-darkest)]">
        {row.title}
      </h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-[rgba(var(--brand-plum-rgb),0.055)] p-4">
          <p className="mb-2 text-sm font-semibold text-[rgba(var(--brand-plum-rgb),0.70)]">
            {SPECTRUM_LABELS[row.todaySegments]}
          </p>
          <Segments count={row.todaySegments} tone="today" />
        </div>
        <div className="rounded-2xl bg-[var(--brand-plum-ice)] p-4">
          <p className="mb-2 text-sm font-semibold text-[var(--brand-plum)]">
            {SPECTRUM_LABELS[row.potentialSegments]}
          </p>
          <Segments count={row.potentialSegments} tone="goal" />
        </div>
      </div>
      <p className="mt-4 text-[0.95rem] leading-7 text-[rgba(var(--brand-plum-rgb),0.75)]">
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
              data-offer-destination="checkout"
              data-offer-source-section="hero"
              onClick={openCheckout}
              type="button"
            >
              Plan sichern
            </button>
          </div>
        </div>

        <section
          className="mx-auto max-w-4xl px-4 pb-6 pt-7 text-center sm:pb-8 sm:pt-10"
          data-offer-section="hero"
        >
          <h1 className="mx-auto max-w-[15ch] font-serif text-[2.7rem] leading-[0.98] tracking-[-0.04em] sm:text-6xl">
            Dein Haarplan ist bereit.
          </h1>
          <p className="mx-auto mt-3 max-w-[34rem] text-base leading-6 text-[rgba(var(--brand-plum-rgb),0.72)] sm:text-lg">
            {displayProfileLine(model.profileLine)}
          </p>
          <BeforeAfterFigure />
        </section>

        <section
          className="border-y border-[rgba(var(--brand-plum-rgb),0.08)] bg-white/55 px-4 py-7 sm:py-10"
          data-offer-section="personal_plan_diagnosis"
        >
          <div className="mx-auto max-w-4xl">
            <p className="text-center text-xs font-extrabold uppercase tracking-[0.16em] text-[rgba(var(--brand-plum-rgb),0.60)]">
              Deine Ausgangslage
            </p>
            <h2 className="mt-1.5 w-full text-center font-serif text-3xl leading-tight tracking-[-0.035em] sm:text-4xl">
              Dein Haar hat viel Potenzial.
            </h2>
            <div className="mt-5 space-y-4">
              {model.diagnosticRows.map((row) => (
                <DiagnosticRow key={row.id} row={row} />
              ))}
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-[rgba(var(--brand-plum-rgb),0.10)] bg-[rgba(var(--brand-plum-rgb),0.08)] p-5">
              <p className="text-lg font-semibold leading-8 text-[var(--brand-plum-darkest)]">
                {model.planFitStatement}
              </p>
            </div>
          </div>
        </section>

        <section
          className="mx-auto max-w-4xl px-4 py-10 sm:py-14"
          data-offer-section="personal_plan_complete_plan"
        >
          <div className="text-center">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[rgba(var(--brand-plum-rgb),0.60)]">
              Was du freischaltest
            </p>
            <h2 className="mx-auto mt-3 max-w-[24ch] font-serif text-4xl leading-tight tracking-[-0.035em]">
              Dein kompletter Haarpflegeplan – nicht nur ein Quiz-Ergebnis.
            </h2>
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            {[
              "Welche Produkte zu Kopfhaut, Textur, Dicke und Zustand passen.",
              "In welcher Reihenfolge du Reinigung, Pflege und Styling nutzt.",
              "Wie oft du die einzelnen Schritte wirklich brauchst.",
              "Wie du Chat und Haartagebuch ergänzend nutzt, wenn neue Fragen entstehen.",
            ].map((item) => (
              <div
                className="rounded-2xl border border-[rgba(var(--brand-plum-rgb),0.10)] bg-white p-5"
                key={item}
              >
                <span className="mb-3 grid h-9 w-9 place-items-center rounded-full bg-[#e9f5ed] text-[#2d8f5b]">
                  ✓
                </span>
                <p className="text-base font-semibold leading-7">{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section
          className="border-y border-[rgba(var(--brand-plum-rgb),0.08)] bg-white/55 px-4 py-10 sm:py-14"
          data-offer-section="personal_plan_method"
        >
          <div className="mx-auto max-w-4xl">
            <div className="text-center">
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[rgba(var(--brand-plum-rgb),0.60)]">
                So entsteht dein Plan
              </p>
              <h2 className="mx-auto mt-3 max-w-[24ch] font-serif text-4xl leading-tight tracking-[-0.035em]">
                Vier Signale. Eine klare Empfehlung.
              </h2>
              <p className="mx-auto mt-4 max-w-[38rem] text-base leading-7 text-[rgba(var(--brand-plum-rgb),0.72)]">
                Wir verbinden, was dein Haar zeigt, mit der Pflege, die im Alltag funktioniert.
              </p>
            </div>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {[
                ["01", "Zugtest", "Struktur & Elastizität"],
                ["02", "Oberflächentest", "Haaroberfläche & Glanz"],
                ["03", "Kopfhaut-Check", "Typ & Zustand"],
                ["04", "Produktabgleich", "Passende Pflege aus unserer Datenbank"],
              ].map(([number, title, description]) => (
                <div
                  className="flex items-start gap-4 rounded-2xl border border-[rgba(var(--brand-plum-rgb),0.10)] bg-white p-5 shadow-[0_16px_42px_-34px_rgba(var(--brand-plum-rgb),0.6)]"
                  key={title}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[rgba(var(--brand-plum-rgb),0.09)] text-xs font-bold text-[var(--brand-plum-darkest)]">
                    {number}
                  </span>
                  <span>
                    <strong className="block text-base">{title}</strong>
                    <span className="mt-1 block text-sm leading-6 text-[rgba(var(--brand-plum-rgb),0.68)]">
                      {description}
                    </span>
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl bg-[var(--brand-plum)] px-5 py-6 text-center text-white">
              <span
                aria-hidden="true"
                className="grid h-9 w-9 place-items-center rounded-full bg-white/15"
              >
                <ArrowDown className="h-5 w-5" strokeWidth={2.25} />
              </span>
              <p className="max-w-[34rem] font-semibold leading-7">
                Daraus entstehen deine Produktauswahl, Reihenfolge und Anwendung.
              </p>
            </div>
          </div>
        </section>

        <section
          className="mx-auto max-w-4xl px-4 py-10 sm:py-14"
          data-offer-section="pricing"
          id="pricing"
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
            <div className="mt-7 grid items-stretch gap-3 sm:grid-cols-3">
              {[
                ["82%", "wollen verstehen, was ihr Haar wirklich braucht"],
                ["73%", "wünschen sich eine klare Routine ohne Produktchaos"],
                ["63%", "wissen nicht, welche Produkte wirklich passen"],
              ].map(([value, label]) => (
                <div
                  className="flex h-full flex-col justify-center rounded-[1.5rem] border border-[rgba(var(--brand-plum-rgb),0.06)] bg-white p-6 text-center shadow-[0_16px_42px_-34px_rgba(var(--brand-plum-rgb),0.55)]"
                  key={value}
                >
                  <strong className="block font-serif text-5xl leading-none text-[var(--brand-plum-darkest)]">
                    {value}
                  </strong>
                  <span className="mt-3 block text-sm font-semibold leading-6 text-[rgba(var(--brand-plum-rgb),0.72)]">
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

        <section className="px-4 py-10 sm:py-14" data-offer-section="testimonials">
          <div className="mx-auto max-w-4xl text-center">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[rgba(var(--brand-plum-rgb),0.60)]">
              Stimmen aus der Beta
            </p>
            <h2 className="mt-3 font-serif text-4xl leading-tight tracking-[-0.035em]">
              Kundinnen lieben ihren Plan.
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

        <section className="mx-auto max-w-4xl px-4 py-10 sm:py-14" data-offer-section="guarantee">
          <div className="rounded-[1.75rem] border border-[rgba(var(--brand-plum-rgb),0.10)] bg-white p-6 text-center">
            <p className="text-sm font-extrabold uppercase tracking-[0.15em] text-[rgba(var(--brand-plum-rgb),0.60)]">
              Ohne Risiko
            </p>
            <h2 className="mt-2 font-serif text-4xl leading-tight">14 Tage Geld-zurück-Garantie</h2>
            <p className="mx-auto mt-4 max-w-[34rem] text-base leading-7 text-[rgba(var(--brand-plum-rgb),0.72)]">
              Wenn Chaarlie für dich nicht hilfreich ist, bekommst du dein Geld zurück.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-4 pb-24 pt-4" data-offer-section="faq">
          <h2 className="text-center font-serif text-4xl leading-tight tracking-[-0.035em]">
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
