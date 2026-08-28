"use client"

import { Fragment } from "react"
import Link from "next/link"
import { ArrowDown, ChevronDown } from "lucide-react"

import { OfferTrackingProvider } from "@/components/quiz/offer-tracking-provider"
import { WistiaVideo } from "@/components/organic-plan-offer/wistia-video"
import { RegularQuizFieldTestActivationCard } from "@/components/regular-quiz-field-test/activation-card"
import { RegularQuizFieldTestBanner } from "@/components/regular-quiz-field-test/banner"
import type { FunnelOfferVariantProps } from "@/funnels/types"
import { buildPersonalPlanAssessmentRows } from "@/lib/personal-plan-quiz/assessment-copy"
import { assessPersonalPlanHair } from "@/lib/personal-plan-quiz/hair-assessment"
import { adaptLegacyQuizAnswersForAssessment } from "@/lib/personal-plan-quiz/offer-adapter"
import type { PersonalPlanDiagnosticDimension } from "@/components/personal-plan-offer/types"

const ORGANIC_PLAN_OFFER_REVISION = "organic_plan_v3"

const planHighlights: ReadonlyArray<{ emphasis: string; prefix?: string; rest: string }> = [
  {
    emphasis: "Versteh endlich",
    rest: ", was deine Haare wirklich brauchen – statt weiter zu raten.",
  },
  {
    emphasis: "Eine klare Routine ohne Produktchaos:",
    rest: " wenige Produkte, feste Reihenfolge.",
  },
  {
    emphasis: "weich",
    prefix: "Fahr dir durch die Haare und sie fühlen sich ",
    rest: " an – nicht trocken und strohig.",
  },
  {
    emphasis: "offen",
    prefix: "Trag deine Haare wieder ",
    rest: " – mit einem richtig guten Gefühl.",
  },
] as const

const diagnosticMethods = [
  ["Zugtest", "Struktur & Elastizität"],
  ["Oberflächentest", "Haaroberfläche & Glanz"],
  ["Kopfhaut-Check", "Typ & Zustand"],
  ["Über 1.000 Produkte", "analysiert & geprüft"],
] as const

const transformationContrasts = [
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
  ["63%", "suchen Klarheit, welche Produkte wirklich passen", "#9a7cbd"],
] as const

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
] as const

const faqItems = [
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
    "Ja. Du kannst deine vorhandenen Produkte jederzeit im Feinschliff ergänzen.",
  ],
  [
    "Was passiert direkt nach dem Kauf?",
    "Dein Plan wird direkt geöffnet. Wenn du magst, kannst du ihn danach mit deinen eigenen Produkten und Gewohnheiten genauer machen.",
  ],
] as const

const structureLabels: Record<string, string> = {
  straight: "glattes",
  wavy: "welliges",
  curly: "lockiges",
  coily: "krauses",
}

const thicknessLabels: Record<string, string> = {
  fine: "feines",
  normal: "mittelstarkes",
  coarse: "kräftiges",
}

const densityLabels: Record<string, string> = {
  low: "geringer Dichte",
  medium: "mittlerer Dichte",
  high: "hoher Dichte",
}

function profileLine(quizAnswers: FunnelOfferVariantProps["quizAnswers"]) {
  const texture = quizAnswers.structure ? structureLabels[quizAnswers.structure] : null
  const thickness = quizAnswers.thickness ? thicknessLabels[quizAnswers.thickness] : null
  const density = quizAnswers.density ? densityLabels[quizAnswers.density] : null
  const hairDescription = [texture, thickness].filter(Boolean).join(", ")
  const sentenceHairDescription = hairDescription
    ? `${hairDescription.charAt(0).toUpperCase()}${hairDescription.slice(1)}`
    : null

  if (sentenceHairDescription && density) return `${sentenceHairDescription} Haar mit ${density}.`
  if (sentenceHairDescription) return `${sentenceHairDescription} Haar.`
  if (density) return `Haar mit ${density}.`
  return "Für dein persönliches Haarprofil."
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

function DiagnosticRow({ row }: { row: PersonalPlanDiagnosticDimension }) {
  return (
    <article
      className="rounded-[1.25rem] border border-[rgba(var(--brand-plum-rgb),0.10)] bg-white p-4 shadow-[0_16px_44px_-36px_rgba(var(--brand-plum-rgb),0.55)] sm:rounded-[1.5rem] sm:p-5"
      data-organic-diagnostic-row={row.id}
    >
      <h3 className="font-serif text-[1.25rem] leading-tight tracking-[-0.025em] text-[var(--brand-plum-darkest)] sm:text-[1.45rem]">
        {row.title}
      </h3>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:gap-3">
        <div className="rounded-xl bg-[rgba(var(--brand-plum-rgb),0.055)] p-3 sm:rounded-2xl sm:p-4">
          <p className="mb-2 text-xs font-semibold leading-tight text-[rgba(var(--brand-plum-rgb),0.70)] sm:text-sm">
            Heute
          </p>
          <Segments count={row.todaySegments} tone="today" />
        </div>
        <div className="rounded-xl bg-[var(--brand-plum-ice)] p-3 sm:rounded-2xl sm:p-4">
          <p className="mb-2 text-xs font-semibold leading-tight text-[var(--brand-plum)] sm:text-sm">
            Dein Ziel
          </p>
          <Segments count={row.potentialSegments} tone="goal" />
        </div>
      </div>
      <p className="mt-3 text-[0.9rem] leading-6 text-[rgba(var(--brand-plum-rgb),0.75)] sm:mt-4 sm:text-[0.95rem] sm:leading-7">
        {row.explanationParts?.length
          ? row.explanationParts.map((part, index) =>
              part.kind === "answer" ? (
                <strong key={`${part.kind}-${index}`} className="font-bold text-[#5a3c8d]">
                  {part.text}
                </strong>
              ) : (
                <Fragment key={`${part.kind}-${index}`}>{part.text}</Fragment>
              ),
            )
          : row.summary}
      </p>
    </article>
  )
}

function FaqItem({ answer, faqId, question }: { answer: string; faqId: string; question: string }) {
  return (
    <details
      className="rounded-2xl border border-[rgba(var(--brand-plum-rgb),0.10)] bg-white p-5"
      data-offer-faq={faqId}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold [&::-webkit-details-marker]:hidden">
        <span>{question}</span>
        <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={2.25} />
      </summary>
      <p className="mt-3 text-base leading-7 text-[rgba(var(--brand-plum-rgb),0.72)]">{answer}</p>
    </details>
  )
}

export function OrganicPlanOffer({
  entryContext,
  leadId,
  offerTracking,
  offerVariant,
  pricingSlot,
  quizAnswers,
  regularFieldTest = null,
}: FunnelOfferVariantProps) {
  const diagnosticInput = adaptLegacyQuizAnswersForAssessment(quizAnswers)
  const assessment = assessPersonalPlanHair(diagnosticInput)
  const diagnosticRows = buildPersonalPlanAssessmentRows(assessment, diagnosticInput)
  const isRegularFieldTest = Boolean(regularFieldTest)
  const isEmailBoundModerator = regularFieldTest?.identityMode === "email_bound"
  const visibleFaqItems = isRegularFieldTest
    ? faqItems.filter(([question]) => question !== "Was passiert direkt nach dem Kauf?")
    : faqItems
  const activationHref = "#regular_field_test_activation"

  return (
    <OfferTrackingProvider
      entryContext={entryContext}
      focusRoutine={false}
      leadId={leadId}
      offerRevision={ORGANIC_PLAN_OFFER_REVISION}
      offerTracking={offerTracking}
      offerVariant={offerVariant}
      testKind={isRegularFieldTest ? "field_test" : null}
      trackingIdentity={{
        conditionerModuleId: null,
        needLane: null,
        shampooModuleId: null,
        suggestedCategory: null,
      }}
    >
      <main className="min-h-screen bg-[#fcfaf7] text-[var(--brand-plum-darkest)]">
        <div className="sticky top-0 z-30 border-b border-[rgba(var(--brand-plum-rgb),0.10)] bg-[#fcfaf7]/95 backdrop-blur">
          {isRegularFieldTest && !isEmailBoundModerator ? (
            <RegularQuizFieldTestBanner surface="offer" />
          ) : null}
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
            <Link href="/" className="font-serif text-2xl font-semibold tracking-tight">
              chaarlie
            </Link>
            <a
              className="rounded-full bg-[var(--brand-plum)] px-4 py-2 text-sm font-bold text-white"
              data-offer-cta="sticky_header"
              data-offer-destination={
                isEmailBoundModerator
                  ? "moderator_organic_test_activation"
                  : isRegularFieldTest
                    ? "regular_field_test_activation"
                    : "pricing"
              }
              data-offer-source-section="hero"
              href={isRegularFieldTest ? activationHref : "#pricing"}
            >
              {isRegularFieldTest ? "Kostenlos fortfahren" : "Angebot ansehen"}
            </a>
          </div>
        </div>

        <section
          className="mx-auto max-w-4xl px-4 pb-6 pt-8 text-center sm:pb-10 sm:pt-12"
          data-offer-section="hero"
        >
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[rgba(var(--brand-plum-rgb),0.60)]">
            Deine Analyse ist bereit
          </p>
          <h1 className="mx-auto mt-3 max-w-[15ch] font-serif text-[2.45rem] leading-[0.98] tracking-[-0.045em] sm:text-6xl">
            Dein Haarplan ist bereit.
          </h1>
          <p className="mx-auto mt-3 max-w-[36rem] text-base leading-7 text-[rgba(var(--brand-plum-rgb),0.72)] sm:text-lg">
            {profileLine(quizAnswers)}
          </p>
          <p className="mx-auto mt-5 max-w-[36rem] text-base font-bold leading-6 text-[var(--brand-plum-darkest)] sm:text-lg">
            Schau dir zuerst das Video an:
          </p>
          <WistiaVideo />
        </section>

        <section
          className="border-y border-[rgba(var(--brand-plum-rgb),0.08)] bg-white/55 px-4 py-6 sm:py-10"
          data-offer-section="personal_plan_diagnosis"
        >
          <div className="mx-auto max-w-4xl">
            <p className="text-center text-xs font-extrabold uppercase tracking-[0.16em] text-[rgba(var(--brand-plum-rgb),0.60)]">
              Deine Ausgangslage
            </p>
            <h2 className="mt-1.5 text-center font-serif text-[1.875rem] leading-tight tracking-[-0.035em] sm:text-4xl">
              In deinem Haar steckt viel Potenzial.
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-center text-sm leading-6 text-[rgba(var(--brand-plum-rgb),0.68)] sm:text-base">
              Deine Antworten zeigen, wie wir deine Ausgangslage einordnen.
            </p>
            <div className="mt-4 space-y-3 sm:mt-5 sm:space-y-4">
              {diagnosticRows.map((row) => (
                <DiagnosticRow key={row.id} row={row} />
              ))}
            </div>
            <div className="mt-4 rounded-[1.25rem] border border-emerald-100 bg-emerald-50 p-4 sm:mt-5 sm:rounded-[1.5rem] sm:p-5">
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-emerald-700">
                Das Gute
              </p>
              <h3 className="mt-1 font-serif text-xl text-[var(--brand-plum-darkest)] sm:text-2xl">
                Hier können wir gezielt ansetzen.
              </h3>
              <p className="mt-1 text-sm leading-6 text-[rgba(var(--brand-plum-rgb),0.72)] sm:text-base">
                Dein Plan baut genau auf diesen Punkten auf.
              </p>
            </div>
          </div>
        </section>

        <section
          className="mx-auto max-w-4xl scroll-mt-16 px-4 py-10 sm:py-14"
          data-offer-section="personal_plan_complete_plan"
          id="personal_plan_complete_plan"
          tabIndex={-1}
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
                key={`${item.prefix ?? ""}${item.emphasis}`}
              >
                <span
                  aria-hidden="true"
                  className="grid h-[30px] w-[30px] place-items-center rounded-full bg-[#eee8f6] text-sm font-black text-[#6b50a0]"
                >
                  ✓
                </span>
                <p className="mt-px text-[13px] font-semibold leading-[1.42] sm:text-sm">
                  {item.prefix}
                  <strong className="font-extrabold text-[#5a3c8d]">{item.emphasis}</strong>
                  {item.rest}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section
          className="mx-auto max-w-4xl scroll-mt-16 px-4 py-10 sm:py-14"
          data-offer-section="pricing"
          id={isRegularFieldTest ? "regular_field_test_activation" : "pricing"}
          tabIndex={-1}
        >
          <div className="text-center">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[rgba(var(--brand-plum-rgb),0.60)]">
              {isRegularFieldTest ? "Kostenlos aktivieren" : "Plan freischalten"}
            </p>
            <h2 className="mx-auto mt-3 max-w-[24ch] font-serif text-4xl leading-tight tracking-[-0.035em]">
              {isEmailBoundModerator
                ? "Starte deinen 90-Tage-Testzugang ab Aktivierung."
                : isRegularFieldTest
                  ? "Starte deinen siebentägigen Chaarlie Testzugang."
                  : "Starte mit deinem persönlichen Plan."}
            </h2>
          </div>
          <div className="mt-7">
            {regularFieldTest ? (
              <RegularQuizFieldTestActivationCard
                accessDurationHours={regularFieldTest.accessDurationHours}
                activationApiPath={regularFieldTest.activationApiPath}
                identityMode={regularFieldTest.identityMode}
                leadId={leadId}
              />
            ) : (
              pricingSlot
            )}
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
          <div className="mt-5 grid gap-3 sm:mt-7 md:grid-cols-3">
            {transformationContrasts.map(([before, after]) => (
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

        {!isRegularFieldTest ? (
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
        ) : null}

        <section className="mx-auto max-w-4xl px-4 pb-24 pt-1" data-offer-section="faq">
          <h2 className="text-center font-serif text-[2rem] leading-tight tracking-[-0.035em] sm:text-4xl">
            Häufige Fragen
          </h2>
          <div className="mt-6 space-y-3">
            {visibleFaqItems.map(([question, answer], index) => (
              <FaqItem
                answer={answer}
                faqId={`organic-plan-${index + 1}`}
                key={question}
                question={question}
              />
            ))}
          </div>
          <div
            className="mt-8 rounded-[1.5rem] bg-[var(--brand-plum)] p-6 text-center text-white"
            data-offer-section="final_cta"
          >
            <h2 className="font-serif text-3xl leading-tight">
              {isRegularFieldTest
                ? "Dein Testzugang ist für diese Auswertung bereit."
                : "Dein Plan zu schöneren Haaren in 30 Tagen."}
            </h2>
            <a
              className="mt-5 inline-flex rounded-full bg-white px-7 py-3 font-bold text-[var(--brand-plum-darkest)]"
              data-offer-cta="final"
              data-offer-destination={
                isEmailBoundModerator
                  ? "moderator_organic_test_activation"
                  : isRegularFieldTest
                    ? "regular_field_test_activation"
                    : "pricing"
              }
              data-offer-source-section="final_cta"
              href={isRegularFieldTest ? activationHref : "#pricing"}
            >
              {isRegularFieldTest ? "Kostenlos mit Chaarlie fortfahren" : "Plan sichern"}
            </a>
          </div>
        </section>
      </main>
    </OfferTrackingProvider>
  )
}
