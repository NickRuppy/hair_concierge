"use client"

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { trackAppEvent } from "@/lib/analytics/track-app-event"
import { canTrackOfferEngagement, claimOfferEngagement } from "@/lib/analytics/offer-engagement"
import { observeOnceEngaged } from "@/lib/analytics/observe-once-engaged"
import { buildOfferViewedPayload } from "@/lib/analytics/offer-viewed-payload"
import { trackMetaOfferViewOnce } from "@/lib/analytics/meta-offer-view-client"
import { sendCustomerIoOfferEngagement } from "@/lib/customerio/offer-engagement-client"
import { COOKIE_CONSENT_CHANGE_EVENT, loadConsent, type CookieConsent } from "@/lib/cookie-consent"
import type {
  FunnelAnalyticsEnvelope,
  OfferAnalyticsContext,
  OfferCtaId,
  OfferEntryContext,
  OfferSectionId,
} from "@/lib/analytics/events"
import { createFunnelEventId } from "@/lib/funnel/client"
import type { QuizOfferPreview } from "@/lib/quiz/offer-preview-types"

export const OFFER_REVISION = "product_led_v2"
export const OFFER_PRICING_REVISION = "pricing_v1"

const OfferTrackingContext = createContext<OfferAnalyticsContext | null>(null)

type PendingOfferEngagement = {
  reason: "cta_clicked" | "faq_opened" | "section_depth"
  sourceSection?: OfferSectionId
}

export function useOfferTrackingContext() {
  return useContext(OfferTrackingContext)
}

export function OfferTrackingProvider({
  children,
  entryContext,
  focusRoutine,
  leadId,
  offerTracking,
  offerVariant,
  preview,
}: {
  children: ReactNode
  entryContext: OfferEntryContext
  focusRoutine: boolean
  leadId: string | null
  offerTracking?: FunnelAnalyticsEnvelope | null
  offerVariant: string
  preview: QuizOfferPreview
}) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const offerTrackedRef = useRef(false)
  const offerEngagedRef = useRef(false)
  const pendingOfferEngagementRef = useRef<PendingOfferEngagement | null>(null)
  const viewedSectionsRef = useRef(new Set<OfferSectionId>())
  const ctaInteractionIndexRef = useRef(0)
  const [offerViewId] = useState(createFunnelEventId)
  const shampooModuleId =
    preview.products.find((product) => product.category === "shampoo")?.key ?? null
  const conditionerModuleId =
    preview.products.find((product) => product.category === "conditioner")?.key ?? null
  const suggestedCategory = preview.needs.extra?.category ?? null

  const context = useMemo<OfferAnalyticsContext>(
    () => ({
      conditionerModuleId,
      entryContext,
      focusRoutine,
      funnelPackageKey: offerTracking?.funnelPackageKey,
      funnelSessionId: offerTracking?.funnelSessionId,
      leadId,
      needLane: preview.lane,
      offerRevision: OFFER_REVISION,
      offerVariant,
      offerViewId,
      shampooModuleId,
      suggestedCategory,
    }),
    [
      conditionerModuleId,
      entryContext,
      focusRoutine,
      offerTracking?.funnelPackageKey,
      offerTracking?.funnelSessionId,
      leadId,
      offerVariant,
      offerViewId,
      preview.lane,
      shampooModuleId,
      suggestedCategory,
    ],
  )

  const flushOfferEngagement = useCallback(() => {
    if (offerEngagedRef.current || !pendingOfferEngagementRef.current) return
    if (!canTrackOfferEngagement(loadConsent())) return

    let storage: Storage | null = null
    try {
      storage = typeof window === "undefined" ? null : window.sessionStorage
    } catch {
      storage = null
    }
    if (!claimOfferEngagement(context, storage)) {
      offerEngagedRef.current = true
      pendingOfferEngagementRef.current = null
      return
    }

    const pending = pendingOfferEngagementRef.current
    const payload = {
      ...context,
      distinctSectionCount: viewedSectionsRef.current.size,
      funnelEventId: createFunnelEventId(),
      reason: pending.reason,
      sourceSection: pending.sourceSection,
    }
    offerEngagedRef.current = true
    pendingOfferEngagementRef.current = null
    trackAppEvent("offer_engaged", payload)
    void sendCustomerIoOfferEngagement(payload)
  }, [context])

  const trackOfferEngagement = useCallback(
    (reason: PendingOfferEngagement["reason"], sourceSection?: OfferSectionId) => {
      if (offerEngagedRef.current) return
      pendingOfferEngagementRef.current ??= { reason, sourceSection }
      flushOfferEngagement()
    },
    [flushOfferEngagement],
  )

  useEffect(() => {
    const handleConsentChange = (event: Event) => {
      const consent = (event as CustomEvent<CookieConsent>).detail
      if (consent?.analytics) flushOfferEngagement()
    }
    window.addEventListener(COOKIE_CONSENT_CHANGE_EVENT, handleConsentChange)
    return () => window.removeEventListener(COOKIE_CONSENT_CHANGE_EVENT, handleConsentChange)
  }, [flushOfferEngagement])

  useEffect(() => {
    if (offerTrackedRef.current) return
    offerTrackedRef.current = true
    trackAppEvent("offer_viewed", buildOfferViewedPayload(context, offerTracking?.funnelEventId))
  }, [context, offerTracking?.funnelEventId])

  useEffect(() => {
    if (entryContext !== "quiz_completion" || !leadId) return
    void trackMetaOfferViewOnce({
      entryContext,
      funnelPackageKey: offerTracking?.funnelPackageKey,
      funnelSessionId: offerTracking?.funnelSessionId,
      leadId,
      offerRevision: OFFER_REVISION,
      offerVariant,
    })
  }, [
    entryContext,
    leadId,
    offerTracking?.funnelPackageKey,
    offerTracking?.funnelSessionId,
    offerVariant,
  ])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const cleanups = Array.from(root.querySelectorAll<HTMLElement>("[data-offer-section]")).map(
      (element, sectionIndex) =>
        observeOnceEngaged(element, () => {
          const sectionId = element.dataset.offerSection as OfferSectionId | undefined
          if (!sectionId) return
          viewedSectionsRef.current.add(sectionId)
          trackAppEvent("offer_section_viewed", {
            ...context,
            funnelEventId: createFunnelEventId(),
            sectionId,
            sectionIndex,
          })
          if (viewedSectionsRef.current.size >= 3) {
            trackOfferEngagement("section_depth", sectionId)
          }
        }),
    )

    return () => cleanups.forEach((cleanup) => cleanup())
  }, [context, trackOfferEngagement])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const handleClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return
      const target = event.target.closest<HTMLElement>("[data-offer-cta]")
      if (!target || !root.contains(target)) return
      const ctaId = target.dataset.offerCta as OfferCtaId | undefined
      const sourceSection = target.dataset.offerSourceSection as OfferSectionId | undefined
      const destination = target.dataset.offerDestination
      if (!ctaId || !sourceSection || !destination) return

      trackOfferEngagement("cta_clicked", sourceSection)
      ctaInteractionIndexRef.current += 1
      trackAppEvent("offer_cta_clicked", {
        ...context,
        ctaId,
        destination,
        funnelEventId: createFunnelEventId(),
        interactionIndex: ctaInteractionIndexRef.current,
        selectedInterval: target.dataset.offerSelectedInterval as
          | "month"
          | "quarter"
          | "year"
          | undefined,
        sourceSection,
      })
    }

    root.addEventListener("click", handleClick)
    return () => root.removeEventListener("click", handleClick)
  }, [context, trackOfferEngagement])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const openedFaqs = new Set<string>()
    const details = Array.from(root.querySelectorAll<HTMLDetailsElement>("details[data-offer-faq]"))
    const cleanups = details.map((detail, faqIndex) => {
      const handleToggle = () => {
        const faqId = detail.dataset.offerFaq
        if (!detail.open || !faqId || openedFaqs.has(faqId)) return
        openedFaqs.add(faqId)
        trackOfferEngagement("faq_opened", "faq")
        trackAppEvent("offer_faq_opened", {
          ...context,
          faqId,
          faqIndex,
          funnelEventId: createFunnelEventId(),
        })
      }
      detail.addEventListener("toggle", handleToggle)
      return () => detail.removeEventListener("toggle", handleToggle)
    })

    return () => cleanups.forEach((cleanup) => cleanup())
  }, [context, trackOfferEngagement])

  return (
    <OfferTrackingContext.Provider value={context}>
      <div ref={rootRef}>{children}</div>
    </OfferTrackingContext.Provider>
  )
}
