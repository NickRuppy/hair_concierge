"use client"

import { Fragment, useCallback, useEffect, useRef, useState, type MouseEvent } from "react"
import Link from "next/link"
import { ArrowDown, ArrowRight, ChevronDown } from "lucide-react"

import {
  getSubscriptionPlanReferencePrices,
  QUIZ_RESULT_REFERENCE_PRICES,
} from "@/components/checkout/plan-reference-prices"
import { OfferTrackingProvider } from "@/components/quiz/offer-tracking-provider"
import {
  getMembershipCheckoutSummary,
  getPersonalPlanOneTimeCheckoutSummary,
  ResultOfferPricing,
  type ResultOfferPricingCheckoutSummary,
} from "@/components/quiz/result-offer-pricing"
import {
  FooterCookieSettingsButton,
  FooterLink,
  offerFooterLinks,
} from "@/components/landing/footer-links"
import type { FunnelAnalyticsEnvelope, OfferEntryContext } from "@/lib/analytics/events"
import {
  clearPersonalPlanPreparedPlanClaim,
  clearPersonalPlanQuizDraft,
} from "@/lib/personal-plan-quiz"
import type { PersonalPlanOfferFocusTarget } from "@/lib/personal-plan-quiz/offer-focus"
import type { SubscriptionPricingCatalog } from "@/lib/stripe/pricing-plans"
import type { PersonalPlanDiagnosticDimension, PersonalPlanOfferModel } from "./types"

const testimonials = [
  {
    context: "34 · feines, welliges, blondiertes Haar",
    name: "Kim · Endlich verstehe ich meine Haare",
    quote:
      "Der Fragebogen ist echt gut und leicht verständlich. Im Chat hat das Antworten super geklappt. Auch die Produktempfehlung fand ich gut.",
  },
  {
    name: "Kerstin · Echte Antworten bekommen",
    quote:
      "Ich finde die Interaktion sehr gut: meine Fragen stellen zu können und dann die benötigten Antworten zu bekommen.",
  },
  {
    name: "Sarah · Nie wieder googeln vorm Regal",
    quote:
      "Bei den Produkten stehen Preis und Anwendung dabei – und warum sie empfohlen werden. So muss ich nicht erst googeln.",
  },
]

const PERSONAL_PLAN_OFFER_REVISION = "personal_plan_v4"

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

const personalPlanSharedFaqItems = [
  {
    id: "new-shampoo-not-enough",
    question: "Warum reicht nicht einfach ein neues Shampoo?",
    answer:
      "Ein einzelnes Produkt kann nur einen Teil beeinflussen. Dein Plan verbindet Reinigung, Pflege, Styling und Anwendung, damit die Schritte zu deinem Haar und zueinander passen.",
  },
  {
    id: "personalized-plan",
    question: "Ist der Plan wirklich auf mein Haar abgestimmt?",
    answer:
      "Deine Haarstruktur, Dicke, Dichte, Länge, Oberfläche, Elastizität, Kopfhaut und Ziele bestimmen, wie dein Plan aufgebaut wird.",
  },
  {
    id: "included-and-after-purchase",
    question: "Was bekomme ich – und was passiert nach dem Kauf?",
    answer:
      "Du erhältst eine vollständige Routine mit passenden Produkten, der richtigen Reihenfolge sowie klarer Anwendung und Häufigkeit. Chat und Haartagebuch sind ergänzend enthalten. Nach dem Kauf ergänzt du noch deine vorhandenen Produkte und Gewohnheiten; anschließend öffnet sich dein Routinebereich.",
  },
  {
    id: "new-or-expensive-products",
    question: "Muss ich neue oder teure Produkte kaufen?",
    answer:
      "Nein. Wir empfehlen in unterschiedlichen Preisklassen. Du entscheidest, was du kaufst, und passende Produkte, die du bereits hast, können in deinen Plan übernommen werden.",
  },
  {
    id: "not-helpful-refund",
    question: "Was, wenn Chaarlie für mich nicht hilfreich ist?",
    answer:
      "Wenn Chaarlie für dich nicht hilfreich ist, erhältst du innerhalb der ersten 14 Tage eine vollständige Rückerstattung.",
  },
  {
    id: "recommendation-credibility",
    question: "Woher weiß ich, dass das echt ist?",
    answer:
      "Bei Chaarlie siehst du, warum eine Empfehlung zu deinem Haar passt. Unsere Produktdaten basieren auf nachvollziehbaren Quellen, und dein Plan wurde gemeinsam mit Friseurmeistern entwickelt. Wenn Chaarlie für dich nicht hilfreich ist, erhältst du innerhalb von 14 Tagen eine Rückerstattung.",
  },
  {
    id: "time-to-notice",
    question: "Wie lange, bis ich etwas merke?",
    answer:
      "Ob die Routine zu dir passt, merkst du oft schon nach den ersten Anwendungen: Sie sollte verständlich sein und sich gut in deinen Alltag einfügen. Wann sich dein Haar sichtbar oder spürbar verändert, ist individuell. Manche Veränderungen zeigen sich schnell, andere brauchen mehrere Wochen konsequente Pflege. Wir versprechen deshalb keinen festen Zeitpunkt – geben dir aber einen klaren Plan und eine 14-Tage-Geld-zurück-Garantie.",
  },
] as const

const personalPlanMembershipFaqItems = [
  {
    id: "why-subscription",
    question: "Warum ist Chaarlie ein Abo?",
    answer:
      "Dein Haar und deine Bedürfnisse können sich verändern – etwa durch Jahreszeiten, äußere Einflüsse, Färben, neue Ziele oder wenn du neue Produkte ausprobierst. Deshalb bleibt Chaarlie an deiner Seite: Deine Routine kann angepasst werden und du erhältst Unterstützung, wenn sich etwas verändert. So bleibt dein Plan keine Momentaufnahme, sondern entwickelt sich mit dir weiter.",
  },
  {
    id: "cancellation-timing",
    question: "Wie und wann kann ich kündigen?",
    answer:
      "Du kannst deine Mitgliedschaft jederzeit beenden. Sie läuft bis zum Ende der bereits bezahlten Abrechnungsperiode weiter; danach entstehen keine weiteren Kosten.",
  },
] as const

export function scrollToPersonalPlanPricing(
  pricing: Pick<HTMLElement, "focus" | "scrollIntoView"> | null = document.getElementById(
    "pricing",
  ),
  schedule: (callback: () => void, delay: number) => unknown = (callback, delay) =>
    window.setTimeout(callback, delay),
) {
  if (!pricing) return false
  pricing.scrollIntoView({ behavior: "smooth", block: "start" })
  schedule(() => pricing.focus({ preventScroll: true }), 450)
  return true
}

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

function PersonalPlanQuizRestart({ className = "" }: { className?: string }) {
  const [status, setStatus] = useState<"idle" | "restarting" | "error">("idle")
  const inFlight = useRef(false)

  const restart = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    setStatus("restarting")

    try {
      const response = await fetch("/api/quiz/personal-plan-result-return/reset", {
        method: "POST",
        credentials: "same-origin",
      })
      if (response.status !== 204) throw new Error("result return reset failed")

      try {
        clearPersonalPlanQuizDraft(window.localStorage)
      } catch {
        // Restricted browser contexts can block access to the storage object itself.
      }
      try {
        clearPersonalPlanPreparedPlanClaim(window.sessionStorage)
      } catch {
        // The server-side reset succeeded, so local storage cannot block navigation.
      }

      window.location.replace("/lp/haarplan")
    } catch {
      inFlight.current = false
      setStatus("error")
    }
  }, [])

  return (
    <div className={className}>
      <button
        aria-busy={status === "restarting"}
        className="text-sm font-semibold underline underline-offset-4 disabled:cursor-wait disabled:opacity-70"
        disabled={status === "restarting"}
        onClick={() => void restart()}
        type="button"
      >
        {status === "restarting"
          ? "Haar-Check wird vorbereitet …"
          : "Du möchtest deine Angaben ändern? Haar-Check neu starten"}
      </button>
      {status === "error" ? (
        <p aria-live="polite" className="mt-3 text-sm" role="status">
          Das hat gerade nicht geklappt. Bitte versuche es noch einmal.
        </p>
      ) : null}
    </div>
  )
}

function readOneTimeReferencePriceLabel(
  summary: ResultOfferPricingCheckoutSummary,
): string | undefined {
  if (summary.commerceKind !== "one_time") return undefined
  return summary.referencePriceLabel
}

function HairdresserProof() {
  return (
    <p className="mt-4 inline-flex rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700 shadow-[0_12px_30px_-24px_rgba(20,83,45,0.55)] sm:text-sm [@media(min-width:640px)_and_(max-height:700px)]:justify-self-start">
      Entwickelt gemeinsam mit Friseurmeistern.
    </p>
  )
}

function TestimonialsSection() {
  return (
    <section className="px-4 py-7 sm:py-14" data-offer-section="testimonials">
      <div className="mx-auto max-w-4xl text-center">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[rgba(var(--brand-plum-rgb),0.60)]">
          Erfahrungen
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
              {"context" in testimonial ? (
                <span className="mt-1 block text-sm leading-5 text-[rgba(var(--brand-plum-rgb),0.58)]">
                  {testimonial.context}
                </span>
              ) : null}
              <p className="mt-3 text-base leading-7">„{testimonial.quote}“</p>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  )
}

function PersonalPlanOfferFooter() {
  return (
    <footer className="border-t border-[rgba(var(--brand-plum-rgb),0.10)] bg-white/70 px-4 py-8 text-[rgba(var(--brand-plum-rgb),0.68)]">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <p className="font-semibold text-[var(--brand-plum-darkest)]">
          Haarmony LLC ·{" "}
          <a className="underline underline-offset-4" href="mailto:info@chaarlie.de">
            info@chaarlie.de
          </a>
        </p>
        <nav aria-label="Rechtliches und Kontakt" className="flex flex-wrap gap-x-4 gap-y-2">
          {offerFooterLinks.map((item) => (
            <FooterLink key={item.href} {...item} />
          ))}
          <FooterCookieSettingsButton />
        </nav>
      </div>
    </footer>
  )
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
        {row.explanationParts?.length
          ? row.explanationParts.map((part, index) =>
              part.kind === "answer" ? (
                <strong
                  key={`${part.kind}-${index}`}
                  className="font-bold text-[rgba(var(--brand-plum-rgb),0.88)]"
                >
                  {part.text}
                </strong>
              ) : (
                <Fragment key={`${part.kind}-${index}`}>{part.text}</Fragment>
              ),
            )
          : displayDiagnosticSummary(row.summary)}
      </p>
    </article>
  )
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  )
}

function AnimatedPersonalPlanFaqItem({
  answer,
  faqId,
  question,
}: {
  answer: string
  faqId: string
  question: string
}) {
  const detailsRef = useRef<HTMLDetailsElement | null>(null)
  const closedHeightRef = useRef<number | null>(null)
  const closeTimerRef = useRef<number | null>(null)
  const frameRef = useRef<number | null>(null)
  const isOpenRef = useRef(false)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const restoredOpen = detailsRef.current?.open ?? false
    isOpenRef.current = restoredOpen
    if (restoredOpen) {
      frameRef.current = window.requestAnimationFrame(() => {
        setIsOpen(detailsRef.current?.open ?? false)
        frameRef.current = null
      })
    }
    return () => {
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current)
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current)
    }
  }, [])

  function cancelPendingMotion() {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
  }

  function setInstant(open: boolean) {
    const details = detailsRef.current
    if (!details) return
    cancelPendingMotion()
    details.style.height = ""
    details.style.overflow = ""
    details.style.transition = ""
    details.open = open
    isOpenRef.current = open
    setIsOpen(open)
  }

  function animateOpen(details: HTMLDetailsElement) {
    const startHeight = details.getBoundingClientRect().height
    if (!details.open) closedHeightRef.current = startHeight
    details.open = true
    isOpenRef.current = true
    setIsOpen(true)
    details.style.overflow = "hidden"
    details.style.height = `${startHeight}px`
    details.style.transition = "height 180ms ease"
    frameRef.current = window.requestAnimationFrame(() => {
      details.style.height = `${details.scrollHeight}px`
      closeTimerRef.current = window.setTimeout(() => {
        details.style.height = ""
        details.style.overflow = ""
        details.style.transition = ""
        closeTimerRef.current = null
      }, 190)
    })
  }

  function animateClose(details: HTMLDetailsElement) {
    const summary = details.querySelector("summary")
    const startHeight = details.getBoundingClientRect().height
    const styles = window.getComputedStyle(details)
    const measuredClosedHeight = summary
      ? summary.getBoundingClientRect().height +
        Number.parseFloat(styles.paddingTop) +
        Number.parseFloat(styles.paddingBottom) +
        Number.parseFloat(styles.borderTopWidth) +
        Number.parseFloat(styles.borderBottomWidth)
      : startHeight
    const endHeight = closedHeightRef.current ?? measuredClosedHeight
    isOpenRef.current = false
    setIsOpen(false)
    details.style.overflow = "hidden"
    details.style.height = `${startHeight}px`
    details.style.transition = "height 180ms ease"
    frameRef.current = window.requestAnimationFrame(() => {
      details.style.height = `${endHeight}px`
      closeTimerRef.current = window.setTimeout(() => {
        details.open = false
        details.style.height = ""
        details.style.overflow = ""
        details.style.transition = ""
        closeTimerRef.current = null
      }, 190)
    })
  }

  function toggleFaq() {
    const details = detailsRef.current
    if (!details) return
    if (prefersReducedMotion()) {
      setInstant(!isOpenRef.current)
      return
    }
    cancelPendingMotion()
    if (!isOpenRef.current) {
      animateOpen(details)
    } else {
      animateClose(details)
    }
  }

  function handleSummaryClick(event: MouseEvent<HTMLElement>) {
    event.preventDefault()
    toggleFaq()
  }

  return (
    <details
      className="personal-plan-faq-item rounded-2xl border border-[rgba(var(--brand-plum-rgb),0.10)] bg-white p-5"
      data-offer-faq={faqId}
      data-offer-faq-state={isOpen ? "open" : "closed"}
      ref={detailsRef}
      suppressHydrationWarning
    >
      <summary
        className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold [&::-webkit-details-marker]:hidden"
        onClick={handleSummaryClick}
      >
        <span>{question}</span>
        <ChevronDown
          aria-hidden="true"
          className={`personal-plan-faq-chevron h-4 w-4 shrink-0 transition-transform duration-150 motion-reduce:transition-none ${
            isOpen ? "rotate-180" : "rotate-0"
          }`}
          data-offer-faq-chevron=""
          strokeWidth={2.25}
        />
      </summary>
      <p className="mt-3 text-base leading-7 text-[rgba(var(--brand-plum-rgb),0.72)]">{answer}</p>
    </details>
  )
}

export function PersonalPlanOffer({
  showQuizRestart = false,
  checkoutPresentationFixture,
  entryContext,
  focusTarget = null,
  isInternalTest = false,
  leadId,
  model,
  offerTracking,
  offerVariant = "personal-plan-v1",
  pricingCatalog,
}: {
  showQuizRestart?: boolean
  checkoutPresentationFixture?: { expressElements: boolean; overlay: boolean }
  entryContext: OfferEntryContext
  focusTarget?: PersonalPlanOfferFocusTarget | null
  isInternalTest?: boolean
  leadId: string
  model: PersonalPlanOfferModel
  offerTracking?: FunnelAnalyticsEnvelope | null
  offerVariant?: string
  pricingCatalog?: SubscriptionPricingCatalog
}) {
  const [checkoutOpenRequest, setCheckoutOpenRequest] = useState(0)
  const [clientReady, setClientReady] = useState(false)
  const isOneTimeOffer = offerVariant === "personal-plan-one-time-v1"
  const resolvedPricingCatalog = pricingCatalog ?? "standard"
  const pricingCatalogWasProvided = pricingCatalog !== undefined
  const [pricingReached, setPricingReached] = useState(false)
  const [checkoutSummary, setCheckoutSummary] = useState<ResultOfferPricingCheckoutSummary>(() =>
    isOneTimeOffer
      ? getPersonalPlanOneTimeCheckoutSummary()
      : getMembershipCheckoutSummary("quarter", resolvedPricingCatalog),
  )
  const openCheckout = () => setCheckoutOpenRequest((value) => value + 1)
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setClientReady(true))
    return () => window.cancelAnimationFrame(frame)
  }, [])
  useEffect(() => {
    if (!focusTarget) return

    window.requestAnimationFrame(() => {
      const target = document.getElementById(focusTarget)
      target?.scrollIntoView({ block: "start" })
      target?.focus({ preventScroll: true })
    })
  }, [focusTarget])

  const scrollToPricing = () => scrollToPersonalPlanPricing()
  const stickySelectedInterval =
    pricingReached && checkoutSummary.commerceKind === "membership"
      ? checkoutSummary.interval
      : undefined
  const stickyDestination = pricingReached ? "checkout" : "pricing"
  const stickySourceSection = pricingReached ? "pricing" : "hero"
  const stickyAction = pricingReached ? openCheckout : scrollToPricing
  const stickyReferencePriceLabel = readOneTimeReferencePriceLabel(checkoutSummary)
  const handlePricingReached = useCallback(() => setPricingReached(true), [])

  return (
    <OfferTrackingProvider
      entryContext={entryContext}
      focusRoutine={false}
      isInternalTest={isInternalTest}
      leadId={leadId}
      offerRevision={PERSONAL_PLAN_OFFER_REVISION}
      offerTracking={offerTracking}
      offerVariant={offerVariant}
      pricingCatalog={isOneTimeOffer ? undefined : resolvedPricingCatalog}
      trackingIdentity={{
        conditionerModuleId: null,
        needLane: null,
        shampooModuleId: null,
        suggestedCategory: null,
      }}
    >
      <main
        className="min-h-screen bg-[#fcfaf7] text-[var(--brand-plum-darkest)]"
        data-personal-plan-offer-client-ready={clientReady ? "true" : "false"}
      >
        <div className="sticky top-0 z-30 border-b border-[rgba(var(--brand-plum-rgb),0.10)] bg-[#fcfaf7]/95 backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
            <Link href="/lp/haarplan" className="font-serif text-2xl font-semibold tracking-tight">
              chaarlie
            </Link>
            <button
              className="personal-plan-sticky-cta flex h-11 w-36 sm:w-40 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--brand-plum)] px-3 text-center text-sm font-bold leading-tight text-white shadow-[0_10px_28px_-18px_rgba(var(--brand-plum-rgb),0.85)]"
              data-offer-cta="sticky_header"
              data-offer-destination={stickyDestination}
              data-offer-selected-interval={stickySelectedInterval}
              data-offer-source-section={stickySourceSection}
              data-offer-sticky-cta=""
              data-offer-sticky-state={pricingReached ? "after_pricing" : "before_pricing"}
              onClick={stickyAction}
              type="button"
            >
              {pricingReached ? (
                <span
                  key={
                    checkoutSummary.commerceKind === "membership"
                      ? checkoutSummary.interval
                      : checkoutSummary.commerceKind
                  }
                  className="personal-plan-sticky-summary grid gap-0.5"
                  data-offer-sticky-summary=""
                >
                  {checkoutSummary.commerceKind === "one_time" && stickyReferencePriceLabel ? (
                    <>
                      <span className="text-[11px] leading-none">{checkoutSummary.planName}</span>
                      <span className="inline-flex items-baseline justify-center gap-1.5 text-[13px] leading-none">
                        <s className="text-white/70">{stickyReferencePriceLabel}</s>
                        <span>{checkoutSummary.priceLabel}</span>
                      </span>
                    </>
                  ) : (
                    <span className="text-[11px] leading-none">{checkoutSummary.stickyLine}</span>
                  )}
                  <span className="text-[13px] leading-none">Zur Zahlung</span>
                </span>
              ) : (
                "Angebot ansehen"
              )}
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
          <HairdresserProof />
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
              In deinem Haar steckt viel Potenzial.
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-center text-sm leading-6 text-[rgba(var(--brand-plum-rgb),0.68)] sm:text-base">
              Deine Antworten zeigen, wie wir deine Ausgangslage einordnen.
            </p>
            <div className="mt-4 space-y-3 sm:mt-5 sm:space-y-4">
              {model.diagnosticRows.map((row) => (
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
              checkoutPresentationFixture={checkoutPresentationFixture}
              leadId={leadId}
              offerTracking={offerTracking}
              offerVariant={offerVariant}
              onCheckoutSummaryChange={setCheckoutSummary}
              onPricingReached={handlePricingReached}
              openCheckoutRequestId={checkoutOpenRequest}
              pricingCatalog={resolvedPricingCatalog}
              referencePrices={
                pricingCatalogWasProvided
                  ? (getSubscriptionPlanReferencePrices(resolvedPricingCatalog) ??
                    QUIZ_RESULT_REFERENCE_PRICES)
                  : QUIZ_RESULT_REFERENCE_PRICES
              }
            />
          </div>
        </section>

        <TestimonialsSection />

        <section
          className="mx-auto max-w-4xl scroll-mt-16 px-4 py-7 sm:py-14"
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
                Unabhängig und passend zu deinem Haar ausgewählt. Kauflinks können Affiliate-Links
                sein.
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

        {!isOneTimeOffer ? (
          <section
            className="mx-auto max-w-4xl px-4 pb-6 pt-3 sm:py-14"
            data-offer-section="guarantee"
          >
            <div className="rounded-[1.5rem] border border-[rgba(var(--brand-plum-rgb),0.10)] bg-white p-5 text-center sm:rounded-[1.75rem] sm:p-6">
              <h2 className="mx-auto max-w-[18ch] font-serif text-[2rem] leading-[1.05] sm:max-w-none sm:text-4xl sm:leading-tight">
                14 Tage Geld-zurück-Garantie
              </h2>
              <p className="mx-auto mt-3 max-w-[34rem] text-sm leading-6 text-[rgba(var(--brand-plum-rgb),0.72)] sm:mt-4 sm:text-base sm:leading-7">
                Wenn Chaarlie für dich nicht hilfreich ist, erhältst du eine vollständige
                Rückerstattung.
              </p>
            </div>
          </section>
        ) : null}

        <section className="mx-auto max-w-4xl px-4 pb-12 pt-1" data-offer-section="faq">
          <h2 className="text-center font-serif text-[2rem] leading-tight tracking-[-0.035em] sm:text-4xl">
            Häufige Fragen
          </h2>
          <div className="mt-6 space-y-3">
            {[
              ...personalPlanSharedFaqItems,
              ...(isOneTimeOffer ? [] : personalPlanMembershipFaqItems),
            ].map((item) => (
              <AnimatedPersonalPlanFaqItem
                answer={item.answer}
                faqId={item.id}
                key={item.id}
                question={item.question}
              />
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
            {showQuizRestart ? <PersonalPlanQuizRestart className="mt-5" /> : null}
          </div>
        </section>
        <PersonalPlanOfferFooter />
      </main>
    </OfferTrackingProvider>
  )
}

export function PersonalPlanOfferRecovery({
  reloadEntryContext = "quiz_completion",
  showQuizRestart = false,
  leadId,
}: {
  reloadEntryContext?: OfferEntryContext
  showQuizRestart?: boolean
  leadId: string
}) {
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
          href={`/result/${leadId}?entry=${reloadEntryContext}`}
        >
          Ergebnis erneut laden
        </Link>
        {showQuizRestart ? <PersonalPlanQuizRestart className="mt-5" /> : null}
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
