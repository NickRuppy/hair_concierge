"use client"

import Image from "next/image"

import type { TrialOfferPricing as TrialOfferPricingContract } from "@/lib/billing/trial-offer"

import { ScannerTrialOffer } from "./scanner-trial-offer"

export type { TrialOfferPricing } from "@/lib/billing/trial-offer"

export type TrialOfferInterval = "month" | "year"

function formatEuro(amountMinor: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amountMinor / 100)
}

export function getTrialOfferPresentation(pricing: TrialOfferPricingContract) {
  if (
    pricing.trialDays !== 7 ||
    !Number.isSafeInteger(pricing.monthlyAmountMinor) ||
    !Number.isSafeInteger(pricing.annualFirstAmountMinor) ||
    !Number.isSafeInteger(pricing.annualRenewalAmountMinor) ||
    pricing.monthlyAmountMinor <= 0 ||
    pricing.annualFirstAmountMinor <= 0 ||
    pricing.annualRenewalAmountMinor <= 0
  ) {
    throw new RangeError("Ungültige Angebotskonditionen")
  }

  const annualMonthlyEquivalent = pricing.annualFirstAmountMinor / 12
  const annualSavingsPercent = Math.round(
    (1 - pricing.annualFirstAmountMinor / (pricing.monthlyAmountMinor * 12)) * 100,
  )
  const hasIntroductoryAnnualPrice =
    pricing.annualFirstAmountMinor !== pricing.annualRenewalAmountMinor

  return {
    annualFirst: formatEuro(pricing.annualFirstAmountMinor),
    annualMonthlyEquivalent: formatEuro(annualMonthlyEquivalent),
    annualRenewal: formatEuro(pricing.annualRenewalAmountMinor),
    annualSavingsPercent,
    hasIntroductoryAnnualPrice,
    monthly: formatEuro(pricing.monthlyAmountMinor),
  }
}

export function TrialOffer({
  disabled = false,
  onContinue,
  onSelect,
  pending = false,
  presentation = "default",
  pricing,
  selectedInterval,
}: {
  disabled?: boolean
  onContinue: () => void
  onSelect: (interval: TrialOfferInterval) => void
  pending?: boolean
  presentation?: "default" | "scanner"
  pricing: TrialOfferPricingContract
  selectedInterval: TrialOfferInterval
}) {
  if (presentation === "scanner") {
    return (
      <ScannerTrialOffer
        disabled={disabled}
        onContinue={onContinue}
        onSelect={onSelect}
        pending={pending}
        pricing={pricing}
        selectedInterval={selectedInterval}
      />
    )
  }

  const isDisabled = disabled || pending
  const terms = getTrialOfferPresentation(pricing)
  const annualSelected = selectedInterval === "year"

  return (
    <section className="mx-auto w-full max-w-[390px] overflow-hidden bg-white font-[Arial,Helvetica,sans-serif] text-sm leading-[1.4] text-[var(--brand-plum-darkest)]">
      <div className="relative h-80 overflow-hidden bg-[#eee9e4]">
        <Image
          alt="Chaarlie-Scanner: Pflegeprodukt und persönliche Einschätzung auf dem Smartphone"
          className="object-cover object-[center_28%]"
          fill
          priority
          sizes="(max-width: 390px) 100vw, 390px"
          src="/images/billing/trial-scanner.webp"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-white" />
        <span className="absolute right-5 top-5 rounded-full bg-white/95 px-3 py-1 font-serif text-[19px] font-bold tracking-[-0.7px]">
          chaarlie
        </span>
      </div>

      <div className="relative -mt-1 px-6 pb-5">
        <h2 className="mb-6 text-center text-[27px] font-bold leading-[1.13] tracking-[-0.6px]">
          Teste chaarlie
          <br />
          {pricing.trialDays} Tage kostenlos.
        </h2>

        <div className="grid gap-3" aria-label="Abo auswählen" role="group">
          <button
            aria-pressed={annualSelected}
            className={`overflow-hidden rounded-[13px] border bg-white text-left disabled:cursor-not-allowed disabled:opacity-60 ${
              annualSelected ? "border-2 border-[var(--brand-plum-darkest)]" : "border-[#e5e0e8]"
            }`}
            data-trial-offer-plan="year"
            disabled={isDisabled}
            onClick={() => {
              if (!isDisabled) onSelect("year")
            }}
            type="button"
          >
            <span className="block bg-[var(--brand-plum-darkest)] px-2 py-1 text-center text-[10px] font-bold tracking-[0.5px] text-white">
              {pricing.trialDays} TAGE KOSTENLOS
            </span>
            <span className="flex min-h-[63px] items-center gap-2.5 px-3 py-3.5">
              <span
                aria-hidden="true"
                className={`grid size-[18px] shrink-0 place-items-center rounded-full border text-[11px] ${
                  annualSelected
                    ? "border-[var(--brand-plum-darkest)] bg-[var(--brand-plum-darkest)] text-white"
                    : "border-[#d9d3df]"
                }`}
              >
                {annualSelected ? "✓" : ""}
              </span>
              <span>
                <span className="block text-sm font-semibold">
                  Jährlich · spare {terms.annualSavingsPercent} %*
                </span>
                <span className="mt-0.5 block text-xs text-[#77717c]">
                  {terms.hasIntroductoryAnnualPrice
                    ? `${terms.annualFirst} im ersten Jahr`
                    : `${terms.annualFirst} pro Jahr`}
                </span>
              </span>
              <span className="ml-auto whitespace-nowrap text-right text-xs text-[#77717c]">
                {terms.annualMonthlyEquivalent} / Monat*
              </span>
            </span>
          </button>

          <button
            aria-pressed={!annualSelected}
            className={`flex min-h-[63px] items-center gap-2.5 rounded-[13px] border bg-white px-3 py-3.5 text-left disabled:cursor-not-allowed disabled:opacity-60 ${
              !annualSelected ? "border-2 border-[var(--brand-plum-darkest)]" : "border-[#e5e0e8]"
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
              className={`grid size-[18px] shrink-0 place-items-center rounded-full border text-[11px] ${
                !annualSelected
                  ? "border-[var(--brand-plum-darkest)] bg-[var(--brand-plum-darkest)] text-white"
                  : "border-[#d9d3df]"
              }`}
            >
              {!annualSelected ? "✓" : ""}
            </span>
            <span className="text-sm font-normal text-[#77717c]">Monatlich</span>
            <span className="ml-auto whitespace-nowrap text-right text-xs text-[#77717c]">
              {terms.monthly} / Monat
            </span>
          </button>
        </div>

        <button
          className="mt-5 min-h-[54px] w-full rounded-full bg-[var(--brand-plum-darkest)] px-3 py-4 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60"
          aria-busy={pending || undefined}
          data-trial-offer-continue=""
          disabled={isDisabled}
          onClick={() => {
            if (!isDisabled) onContinue()
          }}
          type="button"
        >
          {pending ? "Wird vorbereitet …" : `${pricing.trialDays} Tage kostenlos testen`}
        </button>

        <div className="mt-4 space-y-3 text-center text-[11px] leading-[1.5] text-[#827b89]">
          <p>
            {pricing.trialDays} Tage kostenlos, dann{" "}
            {annualSelected ? terms.annualFirst : terms.monthly}
            {annualSelected
              ? terms.hasIntroductoryAnnualPrice
                ? " fürs erste Jahr."
                : " pro Jahr."
              : " pro Monat."}
            <br />
            {annualSelected
              ? terms.hasIntroductoryAnnualPrice
                ? `Danach ${terms.annualRenewal} jährlich. Automatische Verlängerung.`
                : "Automatische Verlängerung."
              : "Automatische Verlängerung."}
            <br />
            Vor Testende kündigen, dann zahlst du nichts.
          </p>
          {annualSelected ? (
            <p>
              {terms.hasIntroductoryAnnualPrice
                ? "*Monatsvergleich und Ersparnis gelten fürs erste Jahr."
                : "*Monatsvergleich bei jährlicher Zahlung."}
            </p>
          ) : null}
          <p>Karte oder PayPal · Alle Preise sind Endpreise.</p>
        </div>
      </div>
    </section>
  )
}
