"use client"

import { useSyncExternalStore, useState } from "react"

import {
  TrialOffer,
  type TrialOfferInterval,
  type TrialOfferPricing,
} from "@/components/billing/trial-offer"
import { ScanRegalOffer } from "@/components/scan-regal-offer/scan-regal-offer"
import type { QuizResultNarrative } from "@/lib/quiz/result-narrative"
import type { QuizAnswers } from "@/lib/quiz/types"

const PRICING: TrialOfferPricing = {
  trialDays: 7,
  monthlyAmountMinor: 999,
  annualFirstAmountMinor: 6999,
  annualRenewalAmountMinor: 9999,
}

const subscribeToHydration = () => () => {}
const hydratedSnapshot = () => true
const serverHydrationSnapshot = () => false

export function ScannerRefinementLabClient({
  narrative,
  quizAnswers,
}: {
  narrative: QuizResultNarrative
  quizAnswers: QuizAnswers
}) {
  const [selectedInterval, setSelectedInterval] = useState<TrialOfferInterval>("year")
  const [checkoutConfirmed, setCheckoutConfirmed] = useState(false)
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    hydratedSnapshot,
    serverHydrationSnapshot,
  )

  return (
    <div
      data-scanner-refinement-hydrated={hydrated ? "true" : "false"}
      data-scanner-refinement-selected-interval={selectedInterval}
    >
      <div className="sr-only" aria-live="polite" data-scanner-refinement-lab-status="">
        {checkoutConfirmed
          ? `Lokale Auswahl bestätigt: ${selectedInterval === "year" ? "jährlich" : "monatlich"}. Kein Checkout wurde geöffnet.`
          : "Lokale QA-Vorschau. Kein Checkout wird geöffnet."}
      </div>
      <ScanRegalOffer
        entryContext="quiz_completion"
        isInternalTest
        leadId={null}
        name="Lea"
        narrative={narrative}
        offerTracking={{
          funnelPackageKey: "scanner-refinement-lab",
          funnelSessionId: "22222222-2222-4222-8222-222222222222",
        }}
        offerVariant="scan-regal-v1"
        pricingSlot={
          <TrialOffer
            onContinue={() => setCheckoutConfirmed(true)}
            onSelect={(interval) => {
              setSelectedInterval(interval)
              setCheckoutConfirmed(false)
            }}
            presentation="scanner"
            pricing={PRICING}
            selectedInterval={selectedInterval}
          />
        }
        quizAnswers={quizAnswers}
        scannerRefinementEnabled
        trialOfferPricing={PRICING}
      />
    </div>
  )
}
