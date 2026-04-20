"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface Plan {
  interval: "month" | "quarter" | "year"
  name: string
  price: string
  perMonth: string
  badge?: string
  savings?: string
}

const PLANS: Plan[] = [
  { interval: "month", name: "Monatlich", price: "€14,99", perMonth: "/ Monat" },
  {
    interval: "quarter",
    name: "Quartal",
    price: "€34,99",
    perMonth: "~€11,66 / Monat",
    savings: "22% sparen",
  },
  {
    interval: "year",
    name: "Jährlich",
    price: "€99,99",
    perMonth: "~€8,33 / Monat",
    badge: "Beliebt",
    savings: "44% sparen",
  },
]

export function PricingCards({ leadId }: { leadId: string | null }) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  function choose(interval: Plan["interval"]) {
    setLoading(interval)
    const params = new URLSearchParams({ interval })
    if (leadId) params.set("lead", leadId)
    router.push(`/pricing/checkout?${params.toString()}`)
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {PLANS.map((plan) => (
        <div
          key={plan.interval}
          className={`relative rounded-xl border bg-card p-6 shadow-sm ${
            plan.badge ? "border-primary ring-2 ring-primary/20" : ""
          }`}
        >
          {plan.badge && (
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
              {plan.badge}
            </span>
          )}
          <h2 className="font-header text-2xl">{plan.name}</h2>
          <div className="mt-4 space-y-1">
            <p className="text-3xl font-bold">{plan.price}</p>
            <p className="text-sm text-muted-foreground">{plan.perMonth}</p>
            {plan.savings && <p className="text-sm font-medium text-primary">{plan.savings}</p>}
          </div>
          <button
            onClick={() => choose(plan.interval)}
            disabled={loading !== null}
            className="mt-6 w-full rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading === plan.interval ? "Wird geladen…" : "Jetzt starten"}
          </button>
        </div>
      ))}
    </div>
  )
}
