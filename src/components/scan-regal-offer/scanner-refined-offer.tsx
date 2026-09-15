"use client"

import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react"
import Link from "next/link"
import { SiteFooter } from "@/components/landing/site-footer"
import { DiagnosticRow } from "@/components/organic-plan-offer/organic-plan-offer"
import { OfferTrackingProvider } from "@/components/quiz/offer-tracking-provider"
import type { FunnelOfferVariantProps } from "@/funnels/types"
import { buildPersonalPlanAssessmentRows } from "@/lib/personal-plan-quiz/assessment-copy"
import { assessPersonalPlanHair } from "@/lib/personal-plan-quiz/hair-assessment"
import { adaptLegacyQuizAnswersForAssessment } from "@/lib/personal-plan-quiz/offer-adapter"
import { scannerRefinedStyles } from "./scanner-refined-styles"

const images = "/images/funnels/scan-refinement"
const videos = "/videos/funnels/scan-refinement"
const exampleImage = `${images}/ogx-production-scan-390x844.jpg`
const whatsappHref = "https://wa.me/message/NIQW4GQHV7UTD1"
const benefits = [
  [
    "tour-scanner.png",
    "Scanner",
    "Produkt-Scanner",
    "Barcode scannen, Ergebnis und passende Alternativen sehen – im Regal und zu Hause.",
  ],
  [
    "tour-plan.png",
    "Plan",
    "Dein Plan",
    "Wenige Produkte, feste Reihenfolge – gebaut aus deinem Profil.",
  ],
  [
    "tour-anwendung.png",
    "Anwendung",
    "Anwendung",
    "Waschtag für Waschtag: Menge, Reihenfolge, Einwirkzeit.",
  ],
  [
    "tour-chat.png",
    "Chat",
    "Frag Chaarlie",
    "Antworten zu deinem Haar – Chaarlie kennt dein Profil.",
  ],
] as const
const testimonials = [
  [
    "Kim",
    "Der Fragebogen ist echt gut und leicht verständlich. Auch die Produktempfehlung fand ich gut.",
  ],
  [
    "Kerstin",
    "Ich finde die Interaktion sehr gut: meine Fragen stellen zu können und dann die benötigten Antworten zu bekommen.",
  ],
  [
    "Sarah",
    "Bei den Produkten stehen Preis, Anwendung und der Grund dabei, warum sie empfohlen werden.",
  ],
] as const

function profileLine(answers: FunnelOfferVariantProps["quizAnswers"]) {
  const textures: Record<string, string> = {
    straight: "glattes",
    wavy: "welliges",
    curly: "lockiges",
    coily: "krauses",
  }
  const thicknesses: Record<string, string> = {
    fine: "feines",
    normal: "mittelstarkes",
    coarse: "kräftiges",
  }
  const densities: Record<string, string> = {
    low: "geringer Dichte",
    medium: "mittlerer Dichte",
    high: "hoher Dichte",
  }
  const hair = [
    answers.structure && textures[answers.structure],
    answers.thickness && thicknesses[answers.thickness],
  ]
    .filter(Boolean)
    .join(", ")
  const density = answers.density && densities[answers.density]
  const sentence = hair ? hair.charAt(0).toUpperCase() + hair.slice(1) : null
  if (sentence && density) return `${sentence} Haar mit ${density}.`
  if (sentence) return `${sentence} Haar.`
  return density ? `Haar mit ${density}.` : "Für dein persönliches Haarprofil."
}

/** Native dialog provides modal focus containment, Escape and return focus. */
function showDialog(dialog: HTMLDialogElement | null, trigger: HTMLButtonElement) {
  if (dialog && !dialog.open) {
    // Safari does not focus clicked buttons; establish the native return-focus target.
    trigger.focus({ preventScroll: true })
    dialog.showModal()
  }
}

export function ScannerRefinedOffer(props: FunnelOfferVariantProps) {
  const {
    quizAnswers,
    pricingSlot,
    trialOfferPricing,
    entryContext,
    leadId,
    offerTracking,
    offerVariant,
    isInternalTest = false,
  } = props
  const input = adaptLegacyQuizAnswersForAssessment(quizAnswers)
  const rows = buildPersonalPlanAssessmentRows(assessPersonalPlanHair(input), input)
  const dock = useRef<HTMLDivElement>(null)
  const example = useRef<HTMLDialogElement>(null)
  const tour = useRef<HTMLUListElement>(null)
  const pricing = useRef<HTMLElement>(null)
  const [dockHeight, setDockHeight] = useState<number | null>(null)
  const [videoFailed, setVideoFailed] = useState(false)
  const [captionsFailed, setCaptionsFailed] = useState(false)

  useEffect(() => {
    const element = dock.current
    if (!element) return
    const measure = () => setDockHeight(element.getBoundingClientRect().height)
    measure()
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure)
    observer?.observe(element)
    window.addEventListener("resize", measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener("resize", measure)
    }
  }, [])

  // The registered wrapper admits this presentation only with server trial terms.
  if (!trialOfferPricing) return null
  const days = trialOfferPricing.trialDays
  const faq = [
    [
      "Ist das Ergebnis auf mein Haar abgestimmt?",
      "Ja. Der Scanner gleicht die Produktfakten mit deinem Haarprofil ab. Die einzelnen Kriterien kannst du im Ergebnis nachlesen.",
    ],
    [
      "Funktioniert das mit Drogerie-Produkten?",
      "Ja, zum Beispiel mit Haarpflege-Produkten von dm und Rossmann. Noch nicht jedes Produkt ist erfasst.",
    ],
    [
      "Was passiert, wenn ein Produkt nicht erkannt wird?",
      "Du kannst es zur Prüfung aufnehmen. Wir prüfen das Produkt und melden uns im Chat.",
    ],
    [
      "Was ist außer dem Scanner enthalten?",
      "Dein persönlicher Plan, Anwendungshinweise und der Chat mit Chaarlie gehören zum Abo.",
    ],
    [
      `Was passiert nach den ${days} Tagen?`,
      `An Tag 5 erinnern wir dich per E-Mail. Nach ${days} Tagen beginnt dein gewählter Tarif, falls du nicht kündigst. Die Preise stehen oben bei der Tarifauswahl.`,
    ],
    [
      "Wie kündige ich den kostenlosen Test?",
      `In deinem Profil über die Abo-Verwaltung. Kündigst du vor Testende, zahlst du nichts. Dein Zugang bleibt bis Tag ${days} bestehen.`,
    ],
  ]
  const scrollToPricing = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    pricing.current?.focus({ preventScroll: true })
    pricing.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    })
  }
  const scrollTour = (direction: number) => {
    tour.current?.scrollBy({
      left: direction * 220,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    })
  }
  return (
    <OfferTrackingProvider
      entryContext={entryContext}
      focusRoutine={false}
      isInternalTest={isInternalTest}
      leadId={leadId}
      offerTracking={offerTracking}
      offerVariant={offerVariant}
      offerRevision="scan_regal_refinement_v20"
      testKind={null}
      trackingIdentity={{
        conditionerModuleId: null,
        needLane: null,
        shampooModuleId: null,
        suggestedCategory: null,
      }}
    >
      <div
        className="sr-offer"
        style={
          dockHeight === null
            ? undefined
            : ({ "--sr-dock-height": `${dockHeight}px` } as CSSProperties)
        }
      >
        <style>{scannerRefinedStyles}</style>
        <main className="sr-page">
          <header className="sr-header">
            <Link href="/" className="sr-wordmark" aria-label="chaarlie Startseite">
              chaarlie
            </Link>
            <a
              href="#pricing"
              onClick={scrollToPricing}
              data-offer-cta="sticky_header"
              data-offer-destination="pricing"
              data-offer-source-section="hero"
            >
              Angebot ansehen
            </a>
          </header>
          <section className="sr-hero" data-offer-section="hero">
            <p className="sr-eyebrow">Dein Ergebnis</p>
            <h1>Das ist dein Haarprofil.</h1>
            <p>{profileLine(quizAnswers)}</p>
          </section>
          <section className="sr-diagnosis" data-offer-section="personal_plan_diagnosis">
            <h2>Deine Ausgangslage</h2>
            <div className="sr-diagnostic-rows">
              {rows.map((row) => (
                <DiagnosticRow key={row.id} row={row} />
              ))}
            </div>
          </section>
          <section data-offer-section="scan_criteria" className="sr-scanner">
            <div className="sr-bridge">
              <p className="sr-eyebrow">Dein nächster Schritt</p>
              <h2>Dein Haarprofil steht.</h2>
              <p>Der Scanner zeigt dir, welche Produkte dazu passen.</p>
            </div>
            <div className="sr-examples">
              <article className="sr-example-card">
                <div className="sr-section-label">
                  <h2>So funktioniert der Scanner</h2>
                  <span>01</span>
                </div>
                {/* Preserve approved image bytes; native image avoids a second encoding. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="sr-shelf"
                  src={`${images}/photo-scanner-shelf.webp`}
                  alt="Beispiel: Ein Handy scannt ein Shampoo im Drogerieregal"
                  loading="lazy"
                />
              </article>
              <article className="sr-example-card sr-result-phone">
                <div className="sr-section-label">
                  <h2>So sieht ein Scan-Ergebnis aus</h2>
                  <span>Beispiel</span>
                </div>
                <button
                  className="sr-zoom-trigger"
                  type="button"
                  aria-label="Scan-Ergebnis für ein Beispielprofil vergrößern"
                  aria-haspopup="dialog"
                  onClick={(event) => showDialog(example.current, event.currentTarget)}
                >
                  <span className="sr-phone-stage">
                    <span className="sr-phone">
                      <span className="sr-camera" aria-hidden="true" />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={exampleImage}
                        width={390}
                        height={844}
                        alt="Echtes Chaarlie-Scan-Ergebnis für ein Beispielprofil: OGX Argan Oil of Morocco Shampoo, 2 von 3 Zielbereichen getroffen"
                        loading="lazy"
                      />
                    </span>
                  </span>
                  <span className="sr-zoom-hint">⌕ Vergrößern</span>
                </button>
              </article>
            </div>
          </section>
          <section className="sr-section sr-outcome" data-offer-section="highlights">
            <div className="sr-pain">
              <s>Auf Verdacht kaufen.</s>
            </div>
            <div className="sr-gain">
              <span aria-hidden="true">✓</span>
              <h2>Wissen, welche Produkte zu dir passen.</h2>
            </div>
          </section>
          <section className="sr-section sr-video" data-offer-section="method">
            <p className="sr-eyebrow">Im Alltag</p>
            <h2>Steffi zeigt dir den Scanner.</h2>
            <figure>
              {videoFailed ? (
                <p role="status">
                  Das Video konnte nicht geladen werden.{" "}
                  <a href={`${videos}/steffi-scanner.mp4`}>Video direkt öffnen</a>
                </p>
              ) : (
                <video
                  controls
                  playsInline
                  poster={`${images}/steffi-scanner-poster.jpg`}
                  preload="metadata"
                  aria-label="Steffi testet den Scanner an ihren eigenen Produkten"
                  onError={() => setVideoFailed(true)}
                  onLoadedMetadata={(event) => {
                    if (event.currentTarget.textTracks[0])
                      event.currentTarget.textTracks[0].mode = "showing"
                  }}
                >
                  <source
                    src={`${videos}/steffi-scanner.mp4`}
                    type="video/mp4"
                    onError={() => setVideoFailed(true)}
                  />
                  <track
                    kind="captions"
                    srcLang="de"
                    label="Deutsch"
                    src={`${videos}/steffi-de.vtt`}
                    default
                    onError={() => setCaptionsFailed(true)}
                  />
                  Dein Browser kann dieses Video nicht abspielen.{" "}
                  <a href={`${videos}/steffi-scanner.mp4`}>Video öffnen</a>
                </video>
              )}
              <figcaption>Steffi · Chaarlie-Kundin</figcaption>
              {captionsFailed && (
                <p role="status">
                  Die Untertitel konnten nicht geladen werden.{" "}
                  <a href={`${videos}/steffi-de.vtt`}>Untertitel öffnen</a>
                </p>
              )}
            </figure>
          </section>
          <section
            className="sr-section sr-pricing"
            data-offer-section="pricing"
            id="pricing"
            ref={pricing}
            tabIndex={-1}
          >
            <p className="sr-eyebrow">Dein nächster Schritt</p>
            <h2>Teste Chaarlie {days} Tage kostenlos.</h2>
            <div className="sr-trial-card">
              <ol className="sr-timeline" aria-label="Deine Testphase">
                <li>
                  <span aria-hidden="true" />
                  <div>
                    <strong>Heute</strong>
                    <p>{days} Tage voller Zugriff.</p>
                  </div>
                </li>
                <li>
                  <span aria-hidden="true" />
                  <div>
                    <strong>Tag 5</strong>
                    <p>Erinnerung per E-Mail.</p>
                  </div>
                </li>
                <li>
                  <span aria-hidden="true" />
                  <div>
                    <strong>Tag {days}</strong>
                    <p>Dein Abo startet – weiter voller Zugriff.</p>
                  </div>
                </li>
              </ol>
              {pricingSlot}
              <a className="sr-contact-inline" href={whatsappHref} target="_blank" rel="noopener">
                Fragen? Schreib uns auf WhatsApp
              </a>
            </div>
          </section>
          <section className="sr-section sr-benefits" data-offer-section="product_tour">
            <p className="sr-eyebrow">Alles in deinem Chaarlie-Abo</p>
            <h2>Das bekommst du mit Chaarlie.</h2>
            <ul
              className="sr-benefit-track"
              ref={tour}
              id="scanner-benefits"
              aria-label="Deine Vorteile"
              tabIndex={0}
            >
              {benefits.map(([src, label, title, copy]) => (
                <li key={src}>
                  <div className="sr-tour-image">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/images/funnels/scan/${src}`} alt={title} loading="lazy" />
                    <span>{label}</span>
                  </div>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </li>
              ))}
            </ul>
            <div className="sr-carousel-controls">
              <button
                type="button"
                aria-label="Vorherige Vorteile"
                aria-controls="scanner-benefits"
                onClick={() => scrollTour(-1)}
              >
                ←
              </button>
              <button
                type="button"
                aria-label="Weitere Vorteile"
                aria-controls="scanner-benefits"
                onClick={() => scrollTour(1)}
              >
                →
              </button>
            </div>
          </section>
          <section className="sr-section sr-testimonials" data-offer-section="testimonials">
            <p className="sr-eyebrow">Stimmen aus der Beta</p>
            <h2>Das sagen Kundinnen über Chaarlie.</h2>
            <div>
              {testimonials.map(([name, quote]) => (
                <figure key={name}>
                  <figcaption>{name}</figcaption>
                  <blockquote>„{quote}“</blockquote>
                </figure>
              ))}
            </div>
          </section>
          <section className="sr-section sr-faq" data-offer-section="faq">
            <h2>Noch Fragen?</h2>
            {faq.map(([question, answer], index) => (
              <details key={question} data-offer-faq={`scan-refinement-${index}`}>
                <summary>
                  {question}
                  <span aria-hidden="true">+</span>
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </section>
          <div className="sr-footer-contact">
            <a className="sr-contact-inline" href={whatsappHref} target="_blank" rel="noopener">
              Fragen? Schreib uns auf WhatsApp
            </a>
          </div>
          <SiteFooter className="sr-footer" />
          <a
            className="sr-whatsapp"
            aria-label="Frage per WhatsApp stellen"
            title="WhatsApp"
            href={whatsappHref}
            target="_blank"
            rel="noopener"
          >
            <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
              <path
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                d="M27 15.5A11.5 11.5 0 0 1 9 25l-6 2 2-6a11.5 11.5 0 1 1 22-5.5Z"
              />
              <path
                fill="currentColor"
                d="M11 9c-1 0-2 2-1 5 1 4 5 7 8 8 3 1 5-1 5-2l-4-3-2 2c-2-1-4-3-5-5l2-2-2-3Z"
              />
            </svg>
          </a>
          <div className="sr-dock" ref={dock}>
            <a
              href="#pricing"
              onClick={scrollToPricing}
              data-offer-cta="sticky_bottom"
              data-offer-destination="pricing"
              data-offer-source-section="pricing"
            >
              {days} Tage kostenlos testen <span aria-hidden="true">→</span>
            </a>
          </div>
          <dialog
            ref={example}
            className="sr-dialog sr-example-dialog"
            aria-labelledby="scanner-example-title"
          >
            <div className="sr-zoom-toolbar">
              <h2 id="scanner-example-title">Scan-Ergebnis · Beispielprofil</h2>
              <button
                type="button"
                aria-label="Vergrößerte Ansicht schließen"
                onClick={() => example.current?.close()}
              >
                ×
              </button>
            </div>
            <div className="sr-zoom-scroll">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={exampleImage}
                width={390}
                height={844}
                alt="Echtes OGX Scan-Ergebnis für ein Beispielprofil, 2 von 3 Zielbereichen getroffen"
              />
            </div>
          </dialog>
        </main>
      </div>
    </OfferTrackingProvider>
  )
}
