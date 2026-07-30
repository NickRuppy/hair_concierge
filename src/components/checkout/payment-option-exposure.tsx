"use client"

import { createContext, type ReactNode, useContext, useEffect, useRef } from "react"

import type { OfferPaymentOption, OfferPaymentOptionProvider } from "@/lib/analytics/events"
import {
  claimOfferPaymentOptionView,
  isOfferPaymentOptionViewEligible,
  observeOfferPaymentOptionView,
} from "@/lib/analytics/offer-payment-option-view"

/**
 * An open checkout can be temporarily covered by a confirmation dialog while
 * its providers stay mounted. Treat that covered state exactly like a hidden
 * checkout: an in-flight dwell timer must be cleaned up, and it may only be
 * armed again after the checkout surface is exposed to the customer.
 */
const PaymentOptionExposureVisibilityContext = createContext(true)

export function PaymentOptionExposureVisibilityGate({
  children,
  visible,
}: {
  children: ReactNode
  visible: boolean
}) {
  return (
    <PaymentOptionExposureVisibilityContext.Provider value={visible}>
      {children}
    </PaymentOptionExposureVisibilityContext.Provider>
  )
}

export function PaymentOptionExposure({
  available = true,
  checkoutAttemptId,
  children,
  className,
  onViewed,
  option,
  provider,
  providerReady,
  visible,
}: {
  available?: boolean
  checkoutAttemptId?: string
  children: ReactNode
  className?: string
  onViewed?: (provider: OfferPaymentOptionProvider, option: OfferPaymentOption) => void
  option: OfferPaymentOption
  provider: OfferPaymentOptionProvider
  providerReady: boolean
  visible: boolean
}) {
  const elementRef = useRef<HTMLDivElement | null>(null)
  const viewedRef = useRef(new Set<string>())
  const checkoutSurfaceVisible = useContext(PaymentOptionExposureVisibilityContext)
  const eligible = isOfferPaymentOptionViewEligible({
    available,
    checkoutAttemptId,
    providerReady,
    visible: visible && checkoutSurfaceVisible,
  })

  useEffect(() => {
    const element = elementRef.current
    if (!eligible || !element || !onViewed || !checkoutAttemptId) return
    return observeOfferPaymentOptionView(element, () => {
      if (!claimOfferPaymentOptionView(viewedRef.current, checkoutAttemptId, option)) return
      onViewed(provider, option)
    })
  }, [checkoutAttemptId, eligible, onViewed, option, provider])

  return (
    <div className={className} data-offer-payment-option={option} ref={elementRef}>
      {children}
    </div>
  )
}
