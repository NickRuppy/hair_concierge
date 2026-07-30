"use client"

import { type ReactNode, useEffect, useRef } from "react"

import type { OfferPaymentOption, OfferPaymentOptionProvider } from "@/lib/analytics/events"
import {
  claimOfferPaymentOptionView,
  isOfferPaymentOptionViewEligible,
  observeOfferPaymentOptionView,
} from "@/lib/analytics/offer-payment-option-view"

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
  const eligible = isOfferPaymentOptionViewEligible({
    available,
    checkoutAttemptId,
    providerReady,
    visible,
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
