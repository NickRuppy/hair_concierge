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
import {
  claimOfferChapterReveals,
  isOfferEngagementDepthSection,
  resolveOfferFaqOpenClaim,
} from "@/lib/analytics/offer-tracking-claims"
import { buildOfferViewedPayload } from "@/lib/analytics/offer-viewed-payload"
import { trackMetaOfferViewOnce } from "@/lib/analytics/meta-offer-view-client"
import { sendCustomerIoOfferEngagement } from "@/lib/customerio/offer-engagement-client"
import { COOKIE_CONSENT_CHANGE_EVENT, loadConsent, type CookieConsent } from "@/lib/cookie-consent"
import type {
  FunnelAnalyticsEnvelope,
  OfferAnalyticsContext,
  OfferChapterId,
  OfferCtaId,
  OfferDetailType,
  OfferEntryContext,
  OfferSectionId,
} from "@/lib/analytics/events"
import { createFunnelEventId } from "@/lib/funnel/client"
import { resolveOfferSectionIndex } from "@/lib/analytics/offer-section-order"

export const OFFER_REVISION = "product_led_v2"
export const GUIDED_STORY_OFFER_REVISION = "guided_story_v1"
export const OFFER_PRICING_REVISION = "pricing_v1"

export interface OfferTrackingIdentity {
  conditionerModuleId: string | null
  needLane: string
  shampooModuleId: string | null
  suggestedCategory: string | null
}

const OfferTrackingContext = createContext<OfferAnalyticsContext | null>(null)

type OfferTrackingActions = {
  observeOfferSection: (sectionId: OfferSectionId, element: HTMLElement) => () => void
  trackDetailOpened: (detail: {
    detailId: string
    detailIndex: number
    detailType: OfferDetailType
    sourceSection: OfferSectionId
  }) => void
}

const OfferTrackingActionsContext = createContext<OfferTrackingActions>({
  observeOfferSection: () => () => {},
  trackDetailOpened: () => {},
})

type PendingOfferEngagement = {
  reason: "cta_clicked" | "faq_opened" | "section_depth"
  sourceSection?: OfferSectionId
}

export function useOfferTrackingContext() {
  return useContext(OfferTrackingContext)
}

export function useOfferTrackingActions() {
  return useContext(OfferTrackingActionsContext)
}

export function OfferTrackingProvider({
  children,
  entryContext,
  focusRoutine,
  leadId,
  offerTracking,
  offerVariant,
  trackingIdentity,
  offerRevision = OFFER_REVISION,
  revealedThrough,
  revealGeneration = 0,
}: {
  children: ReactNode
  entryContext: OfferEntryContext
  focusRoutine: boolean
  leadId: string | null
  offerTracking?: FunnelAnalyticsEnvelope | null
  offerVariant: string
  trackingIdentity: OfferTrackingIdentity
  offerRevision?: string
  revealedThrough?: 1 | 2 | 3 | 4
  revealGeneration?: number
}) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const offerTrackedRef = useRef(false)
  const offerEngagedRef = useRef(false)
  const pendingOfferEngagementRef = useRef<PendingOfferEngagement | null>(null)
  const viewedSectionsRef = useRef(new Set<OfferSectionId>())
  const openedFaqsRef = useRef(new Set<string>())
  const revealedChaptersRef = useRef(new Set<OfferChapterId>())
  const ctaInteractionIndexRef = useRef(0)
  const detailInteractionIndexRef = useRef(0)
  const faqOpenIndexRef = useRef(0)
  const [offerViewId] = useState(createFunnelEventId)
  const { conditionerModuleId, needLane, shampooModuleId, suggestedCategory } = trackingIdentity

  const context = useMemo<OfferAnalyticsContext>(
    () => ({
      conditionerModuleId,
      entryContext,
      focusRoutine,
      funnelPackageKey: offerTracking?.funnelPackageKey,
      funnelSessionId: offerTracking?.funnelSessionId,
      leadId,
      needLane,
      offerRevision,
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
      needLane,
      offerRevision,
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
      distinctSectionCount: [...viewedSectionsRef.current].filter(isOfferEngagementDepthSection)
        .length,
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
    if (revealedThrough === undefined) return
    const chapters = claimOfferChapterReveals(
      revealedChaptersRef.current,
      revealedThrough,
      revealGeneration,
    )
    for (const chapter of chapters) {
      revealedChaptersRef.current.add(chapter.chapterId)
      trackAppEvent("offer_chapter_revealed", {
        ...context,
        ...chapter,
        funnelEventId: createFunnelEventId(),
      })
    }
  }, [context, revealGeneration, revealedThrough])

  useEffect(() => {
    if (entryContext !== "quiz_completion" || !leadId) return
    void trackMetaOfferViewOnce({
      entryContext,
      funnelPackageKey: offerTracking?.funnelPackageKey,
      funnelSessionId: offerTracking?.funnelSessionId,
      leadId,
      offerRevision,
      offerVariant,
    })
  }, [
    entryContext,
    leadId,
    offerTracking?.funnelPackageKey,
    offerTracking?.funnelSessionId,
    offerRevision,
    offerVariant,
  ])

  const emitOfferSectionViewed = useCallback(
    (sectionId: OfferSectionId) => {
      if (viewedSectionsRef.current.has(sectionId)) return
      viewedSectionsRef.current.add(sectionId)
      trackAppEvent("offer_section_viewed", {
        ...context,
        funnelEventId: createFunnelEventId(),
        sectionId,
        sectionIndex: resolveOfferSectionIndex(offerVariant, sectionId),
      })
      if (
        isOfferEngagementDepthSection(sectionId) &&
        [...viewedSectionsRef.current].filter(isOfferEngagementDepthSection).length >= 3
      ) {
        trackOfferEngagement("section_depth", sectionId)
      }
    },
    [context, offerVariant, trackOfferEngagement],
  )

  const observeOfferSection = useCallback(
    (sectionId: OfferSectionId, element: HTMLElement) =>
      observeOnceEngaged(element, () => emitOfferSectionViewed(sectionId)),
    [emitOfferSectionViewed],
  )

  const trackDetailOpened = useCallback(
    ({
      detailId,
      detailIndex,
      detailType,
      sourceSection,
    }: Parameters<OfferTrackingActions["trackDetailOpened"]>[0]) => {
      detailInteractionIndexRef.current += 1
      trackAppEvent("offer_detail_opened", {
        ...context,
        detailId,
        detailIndex,
        detailInteractionIndex: detailInteractionIndexRef.current,
        detailType,
        funnelEventId: createFunnelEventId(),
        sourceSection,
      })
    },
    [context],
  )

  const actions = useMemo<OfferTrackingActions>(
    () => ({ observeOfferSection, trackDetailOpened }),
    [observeOfferSection, trackDetailOpened],
  )

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const cleanups = Array.from(root.querySelectorAll<HTMLElement>("[data-offer-section]")).flatMap(
      (element) => {
        const sectionId = element.dataset.offerSection as OfferSectionId | undefined
        return sectionId ? [observeOfferSection(sectionId, element)] : []
      },
    )

    return () => cleanups.forEach((cleanup) => cleanup())
  }, [observeOfferSection, revealGeneration])

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

    const details = Array.from(root.querySelectorAll<HTMLDetailsElement>("details[data-offer-faq]"))
    const cleanups = details.map((detail, faqIndex) => {
      const handleToggle = () => {
        const faqId = detail.dataset.offerFaq
        if (!detail.open || !faqId) return
        const previouslyOpened = openedFaqsRef.current.has(faqId)
        const faqOpenClaim = resolveOfferFaqOpenClaim(
          offerVariant,
          previouslyOpened,
          faqOpenIndexRef.current,
        )
        if (!faqOpenClaim) return
        openedFaqsRef.current.add(faqId)
        trackOfferEngagement("faq_opened", "faq")
        faqOpenIndexRef.current = faqOpenClaim.nextOpenIndex
        trackAppEvent("offer_faq_opened", {
          ...context,
          faqId,
          faqIndex,
          funnelEventId: createFunnelEventId(),
          openIndex: faqOpenClaim.openIndex,
        })
      }
      detail.addEventListener("toggle", handleToggle)
      return () => detail.removeEventListener("toggle", handleToggle)
    })

    return () => cleanups.forEach((cleanup) => cleanup())
  }, [context, offerVariant, revealGeneration, trackOfferEngagement])

  return (
    <OfferTrackingContext.Provider value={context}>
      <OfferTrackingActionsContext.Provider value={actions}>
        <div ref={rootRef}>{children}</div>
      </OfferTrackingActionsContext.Provider>
    </OfferTrackingContext.Provider>
  )
}
