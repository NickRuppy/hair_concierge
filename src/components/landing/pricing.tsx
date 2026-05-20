import Link from "next/link"

import { SectionHeading } from "@/components/landing/section-heading"
import { STRIPE_PRICING_PLANS, type StripePricingPlan } from "@/lib/stripe/pricing-plans"
import type { BillingInterval } from "@/lib/stripe/intervals"

const FEATURES_BY_INTERVAL: Record<BillingInterval, readonly string[]> = {
  month: [
    "Vollständige Haar-Diagnose",
    "Persönliche Routine",
    "500+ Produktempfehlungen",
    "Persönlicher Haar-Coach",
  ],
  quarter: [
    "Alles aus dem Monats-Plan",
    "Fortschritts-Tracking",
    "Quartalsweise Anpassungen",
    "Premium-Routine-Templates",
  ],
  year: [
    "Alles aus dem Quartal-Plan",
    "Saisonale Anpassungen",
    "Bester Preis pro Monat",
    "Volle Routine-Library",
  ],
}

function PlanCard({ plan }: { plan: StripePricingPlan }) {
  const isPopular = Boolean(plan.badge)
  const features = FEATURES_BY_INTERVAL[plan.interval]
  const priceDigits = plan.price.replace(/^€/, "")

  const cardBorder = isPopular
    ? "border-[var(--brand-plum)] shadow-[0_20px_50px_-20px_rgba(var(--brand-plum-rgb),0.3)]"
    : "border-border"

  const ctaClasses = isPopular
    ? "bg-[var(--brand-coral)] hover:bg-[var(--brand-coral-dark)] text-white border-[1.5px] border-[var(--brand-coral)] focus-visible:ring-[var(--brand-coral-dark)]"
    : "bg-transparent text-[var(--brand-plum-darkest)] border-[1.5px] border-border hover:border-[var(--brand-plum)] hover:text-[var(--brand-plum)] focus-visible:ring-[var(--brand-plum)]"

  return (
    <div
      className={`relative flex flex-col bg-card rounded-[20px] p-7 sm:p-8 border-[1.5px] ${cardBorder}`}
    >
      {plan.badge ? (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[var(--brand-plum)] text-white px-3.5 py-1 rounded-full font-mono text-[10px] font-medium uppercase tracking-[0.06em]">
          {plan.badge}
        </span>
      ) : null}

      <p className="font-bold text-sm text-muted-foreground uppercase tracking-[0.08em] mb-3 flex items-center gap-2 flex-wrap">
        {plan.name}
        {plan.savings ? (
          <span className="bg-[var(--brand-coral-light)] text-[var(--brand-coral)] px-2 py-0.5 rounded-md font-mono text-[10px] font-medium tracking-[0.04em] normal-case">
            {plan.savings}
          </span>
        ) : null}
      </p>

      <p
        aria-label={`${plan.price} ${plan.perMonth}`}
        className="font-header text-[42px] font-semibold text-[var(--brand-plum-darkest)] leading-none"
      >
        <sup aria-hidden="true" className="text-2xl font-medium text-muted-foreground mr-0.5">
          €
        </sup>
        <span aria-hidden="true">{priceDigits}</span>
      </p>

      <p className="text-sm text-muted-foreground mt-1.5 mb-6">{plan.perMonth}</p>

      <ul className="list-none flex flex-col gap-2.5 mb-7 flex-1">
        {features.map((label) => (
          <li key={label} className="flex items-start gap-2 text-sm text-foreground">
            <svg
              width={16}
              height={16}
              viewBox="0 0 20 20"
              fill="none"
              stroke="#2D9F5E"
              strokeWidth={2.5}
              className="shrink-0 mt-0.5"
              aria-hidden="true"
            >
              <polyline points="16 6 8 14 4 10" />
            </svg>
            {label}
          </li>
        ))}
      </ul>

      <Link
        href={`/pricing?interval=${plan.interval}`}
        className={`block text-center py-3.5 rounded-[12px] font-semibold text-[15px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${ctaClasses}`}
      >
        Plan wählen
      </Link>
    </div>
  )
}

export function Pricing() {
  return (
    <section
      id="preise"
      className="bg-[linear-gradient(180deg,var(--brand-plum-ice)_0%,var(--background)_100%)] py-20"
    >
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading
          eyebrow="Preise"
          title="Klar und fair, ohne versteckte Kosten."
          lede="Drei Pläne, alle mit derselben App. Jederzeit kündbar."
        />
        <div className="mt-12 mx-auto max-w-[1000px] grid grid-cols-1 md:grid-cols-3 gap-5">
          {STRIPE_PRICING_PLANS.map((plan) => (
            <PlanCard key={plan.interval} plan={plan} />
          ))}
        </div>
      </div>
    </section>
  )
}
