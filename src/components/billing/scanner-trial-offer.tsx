"use client"

import type { TrialOfferPricing } from "@/lib/billing/trial-offer"

import { getTrialOfferPresentation, type TrialOfferInterval } from "./trial-offer"

export function ScannerTrialOffer({
  disabled = false,
  onContinue,
  onSelect,
  pending = false,
  pricing,
  selectedInterval,
}: {
  disabled?: boolean
  onContinue: () => void
  onSelect: (interval: TrialOfferInterval) => void
  pending?: boolean
  pricing: TrialOfferPricing
  selectedInterval: TrialOfferInterval
}) {
  const isDisabled = disabled || pending
  const terms = getTrialOfferPresentation(pricing)
  const annualSelected = selectedInterval === "year"

  return (
    <section className="mx-auto w-full max-w-[390px] min-w-0 text-sm leading-[1.4] text-[var(--brand-plum-darkest)]">
      <div className="grid gap-3" aria-label="Tarif auswählen" role="group">
        <button
          aria-pressed={annualSelected}
          className={`flex min-h-[79px] min-w-0 items-center gap-[10px] rounded-[14px] border-[1.5px] px-3 py-[15px] text-left disabled:cursor-not-allowed disabled:opacity-60 ${
            annualSelected ? "border-[#7657a2] bg-[#f5f0fa]" : "border-[#e7deee] bg-white"
          }`}
          data-trial-offer-plan="year"
          disabled={isDisabled}
          onClick={() => {
            if (!isDisabled) onSelect("year")
          }}
          type="button"
        >
          <span
            aria-hidden="true"
            className={`grid size-[17px] shrink-0 place-items-center rounded-full border text-[10px] ${
              annualSelected ? "border-[#7657a2] bg-[#7657a2] text-white" : "border-[#b7a7c7]"
            }`}
          >
            {annualSelected ? "✓" : ""}
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] font-bold">Jahr</span>
            <span className="mt-1 block text-[11px] leading-[1.5] text-[#624c76]">
              {terms.hasIntroductoryAnnualPrice
                ? `Danach ${terms.annualRenewal} / Jahr`
                : "Jährliche Zahlung"}
            </span>
          </span>
          <span className="ml-auto shrink-0 text-right">
            <span className="block text-[20px] font-bold leading-none max-[360px]:text-[18px]">
              {terms.annualFirst}
            </span>
            <span className="mt-1 block text-[11px] leading-[1.5] text-[#624c76]">
              {terms.hasIntroductoryAnnualPrice ? "im ersten Jahr" : "/ Jahr"}
            </span>
          </span>
        </button>

        <button
          aria-pressed={!annualSelected}
          className={`flex min-h-[79px] min-w-0 items-center gap-[10px] rounded-[14px] border-[1.5px] px-3 py-[15px] text-left disabled:cursor-not-allowed disabled:opacity-60 ${
            !annualSelected ? "border-[#7657a2] bg-[#f5f0fa]" : "border-[#e7deee] bg-white"
          }`}
          data-trial-offer-plan="month"
          disabled={isDisabled}
          onClick={() => {
            if (!isDisabled) onSelect("month")
          }}
          type="button"
        >
          <span
            aria-hidden="true"
            className={`grid size-[17px] shrink-0 place-items-center rounded-full border text-[10px] ${
              !annualSelected ? "border-[#7657a2] bg-[#7657a2] text-white" : "border-[#b7a7c7]"
            }`}
          >
            {!annualSelected ? "✓" : ""}
          </span>
          <span className="text-[15px] font-bold">Monat</span>
          <span className="ml-auto shrink-0 text-right">
            <span className="block text-[20px] font-bold leading-none max-[360px]:text-[18px]">
              {terms.monthly}
            </span>
            <span className="mt-1 block text-[11px] leading-[1.5] text-[#624c76]">/ Monat</span>
          </span>
        </button>
      </div>

      <p className="mt-3 text-center text-xs leading-5 text-[rgba(var(--brand-plum-rgb),0.74)]">
        {pricing.trialDays} Tage kostenlos, dann{" "}
        {annualSelected ? terms.annualFirst : terms.monthly}
        {annualSelected
          ? terms.hasIntroductoryAnnualPrice
            ? ` im ersten Jahr, danach ${terms.annualRenewal} / Jahr.`
            : " / Jahr."
          : " / Monat."}
        <br />
        Vor Testende kündigen: keine Kosten.
      </p>

      <button
        aria-busy={pending || undefined}
        className="mt-5 min-h-[52px] w-full rounded-[14px] bg-[#ad4559] px-4 py-[15px] text-[15px] font-bold text-white shadow-[0_7px_16px_rgba(173,69,89,0.24)] disabled:cursor-wait disabled:opacity-60"
        data-trial-offer-continue=""
        data-offer-cta="pricing_primary"
        data-offer-destination="checkout"
        data-offer-selected-interval={selectedInterval}
        data-offer-source-section="pricing"
        disabled={isDisabled}
        onClick={() => {
          if (!isDisabled) onContinue()
        }}
        type="button"
      >
        {pending ? "Wird vorbereitet …" : `${pricing.trialDays} Tage kostenlos testen →`}
      </button>
      <p className="mt-3 text-center text-xs text-[rgba(var(--brand-plum-rgb),0.7)]">
        Karte oder PayPal zum Teststart erforderlich
      </p>
    </section>
  )
}
