"use client"

import Image from "next/image"
import Link from "next/link"
import { ChevronDown } from "lucide-react"

import { OrganicPlanOffer } from "@/components/organic-plan-offer/organic-plan-offer"
import { OfferTrackingProvider } from "@/components/quiz/offer-tracking-provider"
import { ScanHeroDemo } from "@/components/scan-regal-offer/scan-hero-demo"
import type { FunnelOfferVariantProps } from "@/funnels/types"
import { getScanCriteria } from "@/lib/quiz/scan-insert-examples"

const SCAN_REGAL_OFFER_REVISION = "scan_regal_v1"

/** Criteria the scanner always carries, regardless of the answers. */
const STATIC_CRITERIA = ["Hitzeschutz", "Repair-Pflege"] as const

const transformationContrasts = [
  [
    "„Ich weiß nie, welche Produkte wirklich zu mir passen.“",
    "Zu jedem Produkt ein klares Ergebnis für dein Haar",
  ],
  [
    "„Meine Haare sind trocken, strohig oder glanzlos.“",
    "Weich, geschmeidig, mit Glanz, den man sieht",
  ],
  ["Haare im Dutt oder Zopf verstecken", "Haare offen tragen, mit gutem Gefühl"],
] as const

const productTour = [
  {
    body: "Barcode scannen, Ergebnis und passende Alternativen sehen – im Regal und zu Hause.",
    src: "/images/funnels/scan/tour-scanner.png",
    tag: "Scanner",
    title: "Produkt-Scanner",
  },
  {
    body: "Wenige Produkte, feste Reihenfolge – gebaut aus deinem Profil.",
    src: "/images/funnels/scan/tour-plan.png",
    tag: "Plan",
    title: "Dein Plan",
  },
  {
    body: "Waschtag für Waschtag: Menge, Reihenfolge, Einwirkzeit.",
    src: "/images/funnels/scan/tour-anwendung.png",
    tag: "Anwendung",
    title: "Anwendung",
  },
  {
    body: "Antworten zu deinem Haar – Chaarlie kennt dein Profil.",
    src: "/images/funnels/scan/tour-chat.png",
    tag: "Chat",
    title: "Frag Chaarlie",
  },
] as const

const highlights = [
  {
    emphasis: "Vorm Regal",
    rest: " weißt du in Sekunden, ob ein Produkt zu dir passt – statt zu raten.",
  },
  { emphasis: "Zu Hause", rest: " sortierst du aus, was dein Haar beschwert oder austrocknet." },
  { emphasis: "Dein Plan", rest: " füllt die Lücken: wenige Produkte, klare Reihenfolge." },
  {
    emphasis: "Fahr dir durch die Haare",
    rest: " und sie fühlen sich weich an – nicht trocken und strohig.",
  },
] as const

const diagnosticMethods = [
  ["Zugtest", "Struktur & Elastizität"],
  ["Oberflächentest", "Haaroberfläche & Glanz"],
  ["Kopfhaut-Check", "Typ & Zustand"],
  ["Über 1.000 Produkte", "analysiert & geprüft"],
] as const

const surveyStats = [
  ["82%", "wollen verstehen, was ihr Haar wirklich braucht", "#563882"],
  ["73%", "wünschen sich eine klare Routine ohne Produktchaos", "#7657a2"],
  ["63%", "suchen Klarheit, welche Produkte wirklich passen", "#9a7cbd"],
] as const

const testimonials = [
  {
    name: "Sarah · Nie wieder googeln vorm Regal",
    quote:
      "Bei den Produkten stehen Preis, Anwendung und der Grund dabei, warum sie empfohlen werden.",
  },
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
] as const

const faqItems = [
  [
    "Welche Produkte kennt der Scanner?",
    "Die gängigen Haarpflege-Produkte von dm und Rossmann: Shampoos, Spülungen, Kuren, Leave-ins, Öle, Hitzeschutz. Unbekannte Produkte nimmst du mit einem Tipp auf – wir prüfen sie und melden uns im Chat.",
  ],
  [
    "Brauche ich den Plan, wenn ich den Scanner habe?",
    "Der Scanner sagt dir, ob ein einzelnes Produkt zu dir passt. Der Plan sagt dir, welche wenigen Produkte du in welcher Reihenfolge brauchst – und was du dir sparen kannst. Beides gehört zusammen und ist im Abo enthalten.",
  ],
  [
    "Ist das Ergebnis wirklich auf mein Haar abgestimmt?",
    "Ja. Jedes Ergebnis vergleicht die Produktfakten mit deinen Kriterien aus dem Haarprofil: Haardicke, Kopfhaut, Reinigung, Pflegegewicht und mehr. Jede Zeile lässt sich antippen und erklärt sich.",
  ],
  [
    "Kann ich meine bisherigen Produkte weiterverwenden?",
    "Ja – scann sie einfach. Was passt, bleibt in deinem Plan. Was nicht passt, siehst du sofort, bevor du etwas wegwirfst.",
  ],
  [
    "Was passiert direkt nach dem Kauf?",
    "Du landest im Scanner. Dein Profil ist schon da, dein Plan wartet daneben. Scann als Erstes, was in deinem Bad steht.",
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

/**
 * The profile sentence under the hero headline. Mirrors the organic offer's
 * derivation so the same answers read the same on both offers.
 */
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

function SectionEyebrow({ children }: { children: string }) {
  return (
    <p className="text-center text-xs font-extrabold uppercase tracking-[0.16em] text-[rgba(var(--brand-plum-rgb),0.60)]">
      {children}
    </p>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-2 text-balance text-center font-serif text-[1.75rem] leading-[1.08] tracking-[-0.03em] sm:text-4xl sm:leading-tight">
      {children}
    </h2>
  )
}

function SectionSub({ children }: { children: string }) {
  return (
    <p className="mx-auto mt-2 max-w-[36rem] text-center text-[15px] leading-[1.55] text-[rgba(var(--brand-plum-rgb),0.72)]">
      {children}
    </p>
  )
}

function SectionCaption({ children }: { children: string }) {
  return (
    <p className="mt-3 text-center text-xs text-[rgba(var(--brand-plum-rgb),0.58)]">{children}</p>
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

/**
 * The `scan-regal-v1` offer: the scanner is the product, the plan comes with it.
 *
 * Only the commercial offer is scanner-shaped. A field test or a partner
 * activation replaces the purchase with an activation card and carries its own
 * banners, so those contexts keep rendering the organic offer instead of
 * growing a second set of non-commercial branches here.
 */
export function ScanRegalOffer(props: FunnelOfferVariantProps) {
  const {
    entryContext,
    isInternalTest = false,
    leadId,
    offerTracking,
    offerVariant,
    partnerAccess = null,
    pricingSlot,
    quizAnswers,
    regularFieldTest = null,
  } = props

  const isRegularFieldTest = Boolean(regularFieldTest)
  const isPartnerAccess = Boolean(partnerAccess)
  const isNonCommercialOffer = isRegularFieldTest || isPartnerAccess
  // The organic offer's own section order (`ORGANIC_PLAN_SECTION_ORDER`) is keyed off
  // `offerVariant`, so the scanner's `scan-regal-v1` must not leak into it here — it
  // would otherwise resolve engagement tracking against the scanner's section order.
  if (isNonCommercialOffer) return <OrganicPlanOffer {...props} offerVariant="organic-plan-v1" />

  const criteria = getScanCriteria(quizAnswers)

  return (
    <OfferTrackingProvider
      entryContext={entryContext}
      focusRoutine={false}
      isInternalTest={isInternalTest}
      leadId={leadId}
      offerRevision={SCAN_REGAL_OFFER_REVISION}
      offerTracking={offerTracking}
      offerVariant={offerVariant}
      testKind={null}
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
            <Link href="/" className="font-serif text-2xl font-semibold tracking-tight">
              chaarlie
            </Link>
            {/*
              The only permanently visible CTA on a very long page, so it holds
              the 44 px touch target — through padding, not a bigger label.
            */}
            <a
              className="inline-flex min-h-11 items-center rounded-full bg-[var(--brand-plum)] px-5 text-sm font-bold text-white"
              data-offer-cta="sticky_header"
              data-offer-destination="pricing"
              data-offer-source-section="hero"
              href="#pricing"
            >
              Angebot ansehen
            </a>
          </div>
        </div>

        {/* Hero — the profile is done, the scanner shows what it can do with it. */}
        <section
          className="mx-auto max-w-4xl px-5 pb-8 pt-7 sm:pb-12 sm:pt-12"
          data-offer-section="hero"
        >
          <SectionEyebrow>Dein Haarprofil ist fertig</SectionEyebrow>
          <h1 className="mx-auto mt-3 max-w-[15ch] text-balance text-center font-serif text-[2.375rem] leading-[0.98] tracking-[-0.045em] sm:text-6xl">
            Nie wieder raten vorm Regal.
          </h1>
          <SectionSub>{profileLine(quizAnswers)}</SectionSub>
          <figure className="mx-auto mt-5 max-w-[420px]">
            <ScanHeroDemo quizAnswers={quizAnswers} />
            <figcaption className="mt-3 text-center text-xs leading-[1.5] text-[rgba(var(--brand-plum-rgb),0.58)]">
              So prüft der Scanner Produkte für dein Profil – bei den gängigen Produkten von dm und
              Rossmann.
            </figcaption>
          </figure>
        </section>

        <section
          className="border-y border-[rgba(var(--brand-plum-rgb),0.08)] bg-white/55 px-5 py-9 sm:py-14"
          data-offer-section="before_after"
        >
          <div className="mx-auto max-w-4xl">
            <h2 className="text-balance text-center font-serif text-[1.75rem] leading-[1.08] tracking-[-0.03em] sm:text-4xl sm:leading-tight">
              Vorher und <span className="text-[#6b50a0]">nachher</span> mit Chaarlie
            </h2>
            <SectionSub>So beschreiben es Frauen in unserer Umfrage:</SectionSub>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
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
          </div>
        </section>

        {/* The criteria are the answers, named back — the scanner's own yardstick. */}
        <section
          className="mx-auto max-w-4xl px-5 py-9 sm:py-14"
          data-offer-section="scan_criteria"
        >
          <SectionEyebrow>Deine Kriterien</SectionEyebrow>
          <SectionHeading>Darauf achtet der Scanner bei dir.</SectionHeading>
          <SectionSub>Abgeleitet aus deinen 10 Antworten.</SectionSub>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {criteria.map((criterion) => (
              <span
                className="rounded-full bg-[var(--brand-plum-ice)] px-[11px] py-1.5 text-[12.5px] font-semibold text-[var(--brand-plum-dark)]"
                key={criterion.label}
              >
                {criterion.label}: {criterion.value}
              </span>
            ))}
            {STATIC_CRITERIA.map((label) => (
              <span
                className="rounded-full bg-[var(--brand-plum-ice)] px-[11px] py-1.5 text-[12.5px] font-semibold text-[var(--brand-plum-dark)]"
                key={label}
              >
                {label}
              </span>
            ))}
          </div>
          {/* The chips here are plain text; only the scan result is tappable. */}
          <SectionCaption>
            Im Scanner lässt sich jede Zeile antippen und erklärt sich.
          </SectionCaption>
        </section>

        {/*
          Product tour. The cards scroll horizontally inside their own track —
          the negative margin only reaches the section padding, so the page
          itself never scrolls sideways.
        */}
        <section
          className="border-y border-[rgba(var(--brand-plum-rgb),0.08)] bg-white/55 px-5 py-9 sm:py-14"
          data-offer-section="product_tour"
        >
          <div className="mx-auto max-w-4xl">
            <SectionEyebrow>Was du bekommst</SectionEyebrow>
            <SectionHeading>Scanner, Plan und Chat – in einer App.</SectionHeading>
            <SectionSub>Alles im Chaarlie-Abo.</SectionSub>
            <ul className="-mx-5 mt-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2">
              {productTour.map((card) => (
                <li
                  className="w-[200px] flex-none snap-start overflow-hidden rounded-[18px] border border-[var(--brand-plum-light)] bg-white shadow-[0_18px_40px_-30px_rgba(42,24,69,0.5)]"
                  key={card.title}
                >
                  <div className="relative h-[250px] overflow-hidden bg-[var(--brand-plum-ice)]">
                    <Image
                      alt=""
                      className="block w-full"
                      height={812}
                      sizes="200px"
                      src={card.src}
                      width={375}
                    />
                    <span className="absolute left-2.5 top-2.5 rounded-full bg-[var(--brand-plum)] px-2 py-[3px] text-[9.5px] font-extrabold uppercase tracking-[0.12em] text-white">
                      {card.tag}
                    </span>
                  </div>
                  <p className="px-3 pt-2.5 text-[14.5px] font-bold text-[var(--brand-plum-darkest)]">
                    {card.title}
                  </p>
                  <p className="px-3 pb-3 pt-0.5 text-[12.5px] leading-[1.4] text-[var(--text-sub)]">
                    {card.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section
          className="mx-auto max-w-4xl scroll-mt-16 px-5 py-9 sm:py-14"
          data-offer-section="pricing"
          id="pricing"
          tabIndex={-1}
        >
          <SectionEyebrow>Freischalten</SectionEyebrow>
          <SectionHeading>Scanner und Plan freischalten.</SectionHeading>
          <div className="mt-6">{pricingSlot}</div>
        </section>

        <section
          className="border-y border-[rgba(var(--brand-plum-rgb),0.08)] bg-white/55 px-5 py-9 sm:py-14"
          data-offer-section="scan_coverage"
        >
          <div className="mx-auto max-w-4xl">
            <SectionEyebrow>Kennt der Scanner mein Produkt?</SectionEyebrow>
            <div className="mt-4 rounded-[18px] bg-[var(--brand-plum-ice)] px-4 py-3.5 text-[13.5px] leading-[1.5] text-[var(--brand-plum-darkest)]">
              <strong className="mb-[3px] block text-[14.5px]">
                Die gängigen Produkte von dm und Rossmann.
              </strong>
              Unbekanntes Produkt? Ein Tipp genügt – wir prüfen es und melden uns im Chat, sobald
              das Ergebnis da ist.
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-5 py-9 sm:py-14" data-offer-section="highlights">
          <SectionEyebrow>Die Highlights</SectionEyebrow>
          <SectionHeading>Was sich für dich ändert.</SectionHeading>
          <div className="mt-5 grid gap-2 sm:grid-cols-2 sm:gap-3">
            {highlights.map((item) => (
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
                <p className="mt-px text-[13.5px] font-semibold leading-[1.42]">
                  <strong className="font-extrabold text-[#5a3c8d]">{item.emphasis}</strong>
                  {item.rest}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section
          className="border-y border-[rgba(var(--brand-plum-rgb),0.08)] bg-white/55 px-5 py-9 sm:py-14"
          data-offer-section="method"
        >
          <div className="mx-auto max-w-4xl">
            <div className="rounded-[1.25rem] border border-[rgba(var(--brand-plum-rgb),0.09)] bg-white p-[18px] text-center shadow-[0_16px_42px_-34px_rgba(var(--brand-plum-rgb),0.60)]">
              <h2 className="mx-auto max-w-[24ch] font-serif text-[1.375rem] leading-[1.13] tracking-[-0.025em] sm:text-4xl sm:leading-tight">
                Dein Ergebnis basiert auf echter Haar-Diagnostik:
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
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-5 py-9 sm:py-14" data-offer-section="survey">
          <SectionEyebrow>Was Frauen wirklich beschäftigt</SectionEyebrow>
          <SectionHeading>Über 4.000 Frauen haben uns geantwortet.</SectionHeading>
          <div className="mt-6 grid items-stretch gap-3 md:grid-cols-3">
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
          <SectionCaption>
            Quelle: eigene Umfrage · 4.024 Antworten · Mehrfachauswahl möglich
          </SectionCaption>
        </section>

        <section
          className="border-y border-[rgba(var(--brand-plum-rgb),0.08)] bg-white/55 px-5 py-9 sm:py-14"
          data-offer-section="testimonials"
        >
          <div className="mx-auto max-w-4xl">
            <SectionEyebrow>Stimmen aus der Beta</SectionEyebrow>
            <SectionHeading>Das sagen Kundinnen über Chaarlie.</SectionHeading>
            <div className="mt-6 grid items-stretch gap-3 md:grid-cols-3">
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

        <section className="mx-auto max-w-4xl px-5 py-9 sm:py-14" data-offer-section="guarantee">
          <div className="rounded-[1.5rem] border border-[rgba(var(--brand-plum-rgb),0.10)] bg-white p-5 text-center sm:rounded-[1.75rem] sm:p-6">
            <SectionEyebrow>Ohne Risiko</SectionEyebrow>
            <h2 className="mx-auto mt-2 max-w-[18ch] font-serif text-[1.75rem] leading-[1.05] sm:max-w-none sm:text-4xl sm:leading-tight">
              14 Tage Geld-zurück-Garantie
            </h2>
            <p className="mx-auto mt-3 max-w-[34rem] text-sm leading-6 text-[rgba(var(--brand-plum-rgb),0.72)] sm:text-base sm:leading-7">
              Wenn Chaarlie für dich nicht hilfreich ist, bekommst du dein Geld zurück.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-5 pb-10 pt-1" data-offer-section="faq">
          <h2 className="text-center font-serif text-[1.75rem] leading-[1.08] tracking-[-0.03em] sm:text-4xl sm:leading-tight">
            Häufige Fragen
          </h2>
          <div className="mt-6 space-y-3">
            {faqItems.map(([question, answer], index) => (
              <FaqItem
                answer={answer}
                faqId={`scan-regal-${index + 1}`}
                key={question}
                question={question}
              />
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-5 pb-24" data-offer-section="final_cta">
          <div className="rounded-[1.5rem] bg-[var(--brand-plum)] p-6 text-center text-white">
            <h2 className="font-serif text-3xl leading-tight">Dein Scanner wartet.</h2>
            <p className="mx-auto mt-2 max-w-[32rem] text-[15px] leading-[1.55] text-white/85">
              Scann als Erstes, was bei dir im Bad steht.
            </p>
            <a
              className="mt-5 inline-flex rounded-full bg-white px-7 py-3 font-bold text-[var(--brand-plum-darkest)]"
              data-offer-cta="final"
              data-offer-destination="pricing"
              data-offer-source-section="final_cta"
              href="#pricing"
            >
              Jetzt freischalten
            </a>
          </div>
        </section>
      </main>
    </OfferTrackingProvider>
  )
}
