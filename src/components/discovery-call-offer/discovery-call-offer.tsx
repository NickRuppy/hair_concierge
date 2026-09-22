"use client"

import { useCallback, useEffect, useRef } from "react"

import Link from "next/link"

import { SiteFooter } from "@/components/landing/site-footer"
import { OfferTrackingProvider } from "@/components/quiz/offer-tracking-provider"
import type { FunnelOfferVariantProps } from "@/funnels/types"
import { trackAppEvent } from "@/lib/analytics/track-app-event"
import { createFunnelEventId } from "@/lib/funnel/client"
import { DISCOVERY_CALL_TRUSTPILOT_REVIEWS } from "@/lib/trustpilot-reviews"

const DISCOVERY_CALL_OFFER_REVISION = "discovery_call_v1"

const CALENDLY_EVENT_URL = "https://calendly.com/nick-chaarlie/20min"
const CALENDLY_ORIGIN = "https://calendly.com"

/** Jonas' walkthrough video: he builds his mother a routine on camera. */
const DISCOVERY_CALL_VIDEO_SRC = "/videos/funnels/discovery-call/call-vsl-v4-720.mp4"
const DISCOVERY_CALL_VIDEO_POSTER = "/images/funnels/discovery-call/call-vsl-v4-poster.jpg"

const callSteps = [
  {
    title: "Du buchst dir einen Termin",
    body: "Unten im Kalender. Video-Gespräch – du brauchst nur dein Handy und deine Produkte griffbereit.",
  },
  {
    title: "Wir schauen uns deine Haare an",
    body: "Wir gehen mit dir durch Kopfhaut, Längen und das, was aktuell in deinem Bad steht. Zusammen mit der Chaarlie-App, live.",
  },
  {
    title: "Du gehst mit deiner Routine raus",
    body: "Welche Produkte, in welcher Reihenfolge, wie oft. Aus der Drogerie, nicht aus dem Salon-Regal.",
  },
] as const

const proofStats = [
  ["5.000+", "Haartests ausgewertet"],
  ["Friseurmeister", "im Team"],
] as const

export function DiscoveryCallOffer(props: FunnelOfferVariantProps) {
  const { entryContext, isInternalTest = false, leadId, name, offerTracking, offerVariant } = props

  const bookingTrackedRef = useRef(false)
  const handleScheduled = useCallback(() => {
    if (bookingTrackedRef.current) return
    bookingTrackedRef.current = true
    // The booking is its own conversion: it keeps the session/package
    // attribution but must not reuse the offer-view `funnelEventId`, which
    // PostHog consumes as the `$insert_id` of `offer_viewed`.
    trackAppEvent("discovery_call_booking_scheduled", {
      funnelEventId: createFunnelEventId(),
      funnelSessionId: offerTracking?.funnelSessionId ?? null,
      funnelPackageKey: offerTracking?.funnelPackageKey ?? null,
      testKind: offerTracking?.testKind ?? null,
      leadId,
      offerVariant,
    })
  }, [leadId, offerTracking, offerVariant])

  const normalizedName = name.trim()

  return (
    <OfferTrackingProvider
      entryContext={entryContext}
      focusRoutine={false}
      isInternalTest={isInternalTest}
      leadId={leadId}
      offerRevision={DISCOVERY_CALL_OFFER_REVISION}
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
            <a
              className="inline-flex min-h-11 items-center rounded-full bg-[var(--brand-plum)] px-5 text-sm font-bold text-white"
              data-offer-cta="sticky_header"
              data-offer-destination="booking"
              data-offer-source-section="hero"
              href="#termin"
            >
              Termin aussuchen
            </a>
          </div>
        </div>

        <section
          className="mx-auto max-w-4xl px-5 pb-4 pt-9 text-center sm:pt-14"
          data-offer-section="hero"
        >
          <SectionEyebrow>Kostenlos · Video-Gespräch · mit dem Chaarlie-Team</SectionEyebrow>
          <h1 className="mx-auto mt-3 max-w-[16ch] font-serif text-[2.1rem] leading-[1.05] tracking-[-0.03em] sm:text-5xl sm:leading-[1.05]">
            {normalizedName
              ? `${normalizedName}, daraus bauen wir dir jetzt live deine Routine.`
              : "Daraus bauen wir dir jetzt live deine Routine."}
          </h1>
          <p className="mx-auto mt-4 max-w-[36rem] text-base leading-7 text-[rgba(var(--brand-plum-rgb),0.72)]">
            Im Video-Gespräch gehen wir mit dir durch Kopfhaut, Längen und das, was aktuell in
            deinem Bad steht. Du gehst mit einer fertigen Routine raus: welche Produkte, in welcher
            Reihenfolge, wie oft. Such dir unten eine Zeit aus.
          </p>
          <a
            className="mt-6 inline-flex min-h-12 items-center rounded-full bg-[var(--brand-coral)] px-8 text-base font-bold text-white"
            data-offer-cta="hero_primary"
            data-offer-destination="booking"
            data-offer-source-section="hero"
            href="#termin"
          >
            Termin aussuchen
          </a>
          <div className="mx-auto mt-8 flex max-w-md items-stretch justify-center gap-3">
            {proofStats.map(([value, label]) => (
              <div
                className="flex-1 rounded-[1.25rem] border border-[rgba(var(--brand-plum-rgb),0.08)] bg-white px-4 py-4"
                key={label}
              >
                <span className="block font-serif text-2xl leading-none text-[var(--brand-plum)]">
                  {value}
                </span>
                <span className="mt-1.5 block text-[12.5px] font-semibold leading-[1.45] text-[rgba(var(--brand-plum-rgb),0.72)]">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-5 py-9 sm:py-14" data-offer-section="video">
          <SectionEyebrow>So sieht das aus</SectionEyebrow>
          <SectionHeading>
            Jonas baut seiner Mutter im Video eine Routine. Genau das machen wir mit dir.
          </SectionHeading>
          {/* The clip is portrait (720x1280), so it holds a phone-shaped column. */}
          <video
            className="mx-auto mt-6 aspect-[9/16] w-full max-w-[340px] rounded-[1.5rem] border border-[rgba(var(--brand-plum-rgb),0.10)] bg-black"
            controls
            playsInline
            poster={DISCOVERY_CALL_VIDEO_POSTER}
            preload="metadata"
            src={DISCOVERY_CALL_VIDEO_SRC}
          />
        </section>

        <section
          className="border-y border-[rgba(var(--brand-plum-rgb),0.08)] bg-white/55 px-5 py-9 sm:py-14"
          data-offer-section="method"
        >
          <div className="mx-auto max-w-4xl">
            <SectionEyebrow>So läuft das Gespräch ab</SectionEyebrow>
            <SectionHeading>Drei Schritte bis zu deiner Routine.</SectionHeading>
            <ol className="mt-6 grid gap-3 md:grid-cols-3">
              {callSteps.map((step, index) => (
                <li
                  className="rounded-[1.5rem] border border-[rgba(var(--brand-plum-rgb),0.06)] bg-white p-6 shadow-[0_16px_42px_-34px_rgba(var(--brand-plum-rgb),0.55)]"
                  key={step.title}
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand-plum-ice)] font-serif text-lg text-[var(--brand-plum)]">
                    {index + 1}
                  </span>
                  <strong className="mt-3 block">{step.title}</strong>
                  <p className="mt-2 text-sm leading-6 text-[rgba(var(--brand-plum-rgb),0.72)]">
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          className="mx-auto max-w-4xl scroll-mt-20 px-5 py-9 sm:py-14"
          data-offer-section="booking"
          id="termin"
        >
          <SectionEyebrow>Dein Termin</SectionEyebrow>
          <SectionHeading>Buch dir dein kostenloses Gespräch.</SectionHeading>
          <p className="mx-auto mt-3 max-w-[34rem] text-center text-sm leading-6 text-[rgba(var(--brand-plum-rgb),0.72)] sm:text-base sm:leading-7">
            Such dir eine Zeit aus, die dir passt. Den Link zum Video-Gespräch bekommst du direkt
            per E-Mail.
          </p>
          <CalendlyInline name={normalizedName} onScheduled={handleScheduled} />
        </section>

        <section
          className="border-y border-[rgba(var(--brand-plum-rgb),0.08)] bg-white/55 px-5 py-9 sm:py-14"
          data-offer-section="testimonials"
        >
          <div className="mx-auto max-w-4xl">
            <SectionEyebrow>Bewertungen auf Trustpilot</SectionEyebrow>
            <SectionHeading>Das sagen unsere Nutzer über Chaarlie.</SectionHeading>
            <div className="mt-6 grid items-stretch gap-3 md:grid-cols-3">
              {DISCOVERY_CALL_TRUSTPILOT_REVIEWS.map((testimonial) => (
                <blockquote
                  className="flex h-full flex-col items-center rounded-[1.5rem] border border-[rgba(var(--brand-plum-rgb),0.06)] bg-white p-6 text-center shadow-[0_16px_42px_-34px_rgba(var(--brand-plum-rgb),0.55)]"
                  key={testimonial.name}
                >
                  <span aria-label="5 von 5 Sternen" className="text-[#d96869]">
                    ★★★★★
                  </span>
                  <strong className="mt-2 block">{testimonial.name}</strong>
                  <p className="mt-3 text-base leading-7">„{testimonial.quote}“</p>
                  <a
                    className="mt-auto block pt-4 text-sm leading-6 underline underline-offset-4"
                    href={testimonial.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Auszug · Bewertung auf Trustpilot
                  </a>
                </blockquote>
              ))}
            </div>
          </div>
        </section>

        <section
          className="mx-auto max-w-4xl px-5 py-9 sm:py-14"
          data-offer-section="free_explanation"
        >
          <div className="rounded-[1.5rem] border border-[rgba(var(--brand-plum-rgb),0.10)] bg-white p-6 sm:rounded-[1.75rem] sm:p-8">
            <SectionEyebrow>Die ehrliche Antwort</SectionEyebrow>
            <h2 className="mt-2 text-center font-serif text-[1.75rem] leading-[1.08] tracking-[-0.03em] sm:text-4xl sm:leading-tight">
              Wieso ist das kostenlos?
            </h2>
            <div className="mx-auto mt-4 max-w-[36rem] space-y-4 text-base leading-7 text-[rgba(var(--brand-plum-rgb),0.8)]">
              <p>
                Chaarlie ist gerade in der letzten Entwicklungsphase, und wir sind auf dein Feedback
                angewiesen. Wir wollen mit echten Menschen arbeiten, die seit Jahren nicht das
                Ergebnis bekommen, das sie sich für ihre Haare wünschen – und erst einmal zeigen,
                dass wir abliefern.
              </p>
              <p>
                Was wir in diesen Gesprächen lernen, fließt direkt in die Finalisierung der App ein.
                Deshalb kostet dich das Gespräch nichts. Du bekommst deine Routine, wir bekommen
                dein Feedback.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-5" data-offer-section="final_cta">
          <div className="rounded-[1.5rem] bg-[var(--brand-plum)] p-6 text-center text-white">
            <h2 className="font-serif text-3xl leading-tight">Dein Termin wartet.</h2>
            <p className="mx-auto mt-2 max-w-[32rem] text-[15px] leading-[1.55] text-white/85">
              20 Minuten, dein Handy, deine Produkte – mehr brauchst du nicht.
            </p>
            <a
              className="mt-5 inline-flex rounded-full bg-white px-7 py-3 font-bold text-[var(--brand-plum-darkest)]"
              data-offer-cta="final"
              data-offer-destination="booking"
              data-offer-source-section="final_cta"
              href="#termin"
            >
              Zeit aussuchen
            </a>
          </div>
        </section>
      </main>
      <SiteFooter className="mt-10" />
    </OfferTrackingProvider>
  )
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-center text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--brand-plum)]">
      {children}
    </p>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mx-auto mt-2 max-w-[24ch] text-center font-serif text-[1.75rem] leading-[1.08] tracking-[-0.03em] sm:text-4xl sm:leading-tight">
      {children}
    </h2>
  )
}

/**
 * Calendly inline embed. The URL needs `embed_domain`, so the `src` is set
 * from an effect in the browser; the empty iframe reserves the height until
 * then. The visitor's first name from the quiz lead
 * prefills the booking form — deliberately no email prefill, because
 * `/result/<leadId>` is reachable by lead id alone and must not expose it.
 */
function CalendlyInline({ name, onScheduled }: { name: string; onScheduled: () => void }) {
  const frameRef = useRef<HTMLIFrameElement | null>(null)

  useEffect(() => {
    const url = new URL(CALENDLY_EVENT_URL)
    url.searchParams.set("embed_domain", window.location.hostname)
    url.searchParams.set("embed_type", "Inline")
    // Calendly keeps its own cookie banner inside the widget: Chaarlie's
    // consent settings neither disclose nor gate Calendly, and hiding the
    // banner is only allowed when the host site manages that consent.
    if (name) url.searchParams.set("name", name)
    if (frameRef.current) frameRef.current.src = url.toString()
  }, [name])

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== CALENDLY_ORIGIN) return
      const data = event.data as { event?: unknown } | null
      if (data && data.event === "calendly.event_scheduled") onScheduled()
    }

    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [onScheduled])

  return (
    <iframe
      className="mt-6 h-[720px] w-full rounded-[1.5rem] border border-[rgba(var(--brand-plum-rgb),0.10)] bg-white"
      ref={frameRef}
      title="Termin für dein Video-Gespräch buchen"
    />
  )
}
