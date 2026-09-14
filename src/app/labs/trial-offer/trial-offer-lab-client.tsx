"use client"

import { useState } from "react"

import {
  TrialOffer,
  type TrialOfferInterval,
  type TrialOfferPricing,
} from "@/components/billing/trial-offer"

const LAUNCH_COUPON_PRICING: TrialOfferPricing = {
  trialDays: 7,
  monthlyAmountMinor: 999,
  annualFirstAmountMinor: 6999,
  annualRenewalAmountMinor: 9999,
}

const STANDARD_ANNUAL_PRICING: TrialOfferPricing = {
  ...LAUNCH_COUPON_PRICING,
  annualFirstAmountMinor: 9999,
}

export function TrialOfferLabClient({
  launchCoupon,
  width,
}: {
  launchCoupon: boolean
  width: 360 | 390
}) {
  const [selectedInterval, setSelectedInterval] = useState<TrialOfferInterval>("year")
  const [continued, setContinued] = useState(false)
  const pricing = launchCoupon ? LAUNCH_COUPON_PRICING : STANDARD_ANNUAL_PRICING

  return (
    <main className="min-h-dvh overflow-x-auto bg-[#eeecf0] py-6 text-[var(--brand-plum-darkest)]">
      <div
        className="mx-auto mb-4 flex items-center justify-between gap-4 px-3 text-xs text-[#776f80]"
        style={{ width }}
      >
        <h1 className="font-semibold text-[var(--brand-plum-darkest)]">
          Externe QA · Trial-Angebot
        </h1>
        <span>{width} px Vorschau</span>
      </div>

      <div
        className="mx-auto overflow-hidden rounded-xl border border-[#d8d0df] bg-white shadow-sm"
        data-trial-offer-lab-width={width}
        style={{ width }}
      >
        <TrialOffer
          onContinue={() => setContinued(true)}
          onSelect={(interval) => {
            setSelectedInterval(interval)
            setContinued(false)
          }}
          pricing={pricing}
          selectedInterval={selectedInterval}
        />
      </div>

      <footer
        className="mx-auto mt-4 px-3 text-center text-xs leading-relaxed text-[#776f80]"
        style={{ width }}
      >
        <p>
          Lokale Vorschau · {launchCoupon ? "Launch-Angebot aktiv" : "ohne Launch-Angebot"} · keine
          Transaktion
        </p>
        <p aria-live="polite">
          {continued
            ? `Lokale Auswahl bestätigt: ${selectedInterval === "year" ? "jährlich" : "monatlich"}.`
            : "Die Schaltfläche bestätigt nur diese lokale Vorschau."}
        </p>
        <p>
          <code>?width=360</code> oder <code>?width=390</code> · <code>&amp;launchCoupon=off</code>
        </p>
      </footer>
    </main>
  )
}
