"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import type { RoutinePayload } from "@/lib/personal-plan/routine/contracts"

import { routineCategoryLabel, routinePurposeLabel } from "./routine-item-card"

type RoutineItem = RoutinePayload["items"][number]

export type RoutineCommerceSnapshot = {
  availabilityLabel: string | null
  freshnessLabel: string
  affiliateDisclosure?: string | null
  priceLabel?: string | null
  productUrl?: string | null
}

export type RoutineProductDetailProps = {
  item: RoutineItem
  commerce: RoutineCommerceSnapshot
  fitStatusLabel: string
  frozenFitSummary: string
  limitationLabel?: string | null
  onOpenProduct?: (item: RoutineItem) => void
}

function productName(item: RoutineItem) {
  const name = item.product.displayName
  return typeof name === "string" && name.length > 0 ? name : "Kein Produkt ausgewählt"
}

export function RoutineProductDetail({
  item,
  commerce,
  fitStatusLabel,
  frozenFitSummary,
  limitationLabel,
  onOpenProduct,
}: RoutineProductDetailProps) {
  const canOpenProduct = Boolean(onOpenProduct && commerce.productUrl)

  return (
    <section className="space-y-5" aria-label="Produktdetail">
      <header className="space-y-2">
        <p className="text-sm font-semibold text-primary">
          {routineCategoryLabel(item.category)} · {routinePurposeLabel(item.purposeKey)}
        </p>
        <h2 className="text-2xl font-semibold tracking-tight">{productName(item)}</h2>
      </header>

      <div className="space-y-3 rounded-[8px] border border-border p-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Eignung aus deiner Routine</p>
          <p className="mt-1 text-sm font-semibold">{fitStatusLabel}</p>
          <p className="mt-1 text-sm text-muted-foreground">{frozenFitSummary}</p>
        </div>
        {limitationLabel ? (
          <p className="rounded-[8px] bg-muted px-3 py-2 text-sm">{limitationLabel}</p>
        ) : null}
      </div>

      <div className="space-y-2 rounded-[8px] border border-border p-4">
        <p className="text-xs font-medium text-muted-foreground">Aktuelle Produktdaten</p>
        {commerce.priceLabel ? (
          <p className="text-sm font-semibold">{commerce.priceLabel}</p>
        ) : null}
        {commerce.availabilityLabel ? (
          <p className="text-sm">{commerce.availabilityLabel}</p>
        ) : null}
        <p className="text-sm text-muted-foreground">{commerce.freshnessLabel}</p>
        {commerce.affiliateDisclosure ? (
          <p className="text-xs text-muted-foreground">{commerce.affiliateDisclosure}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        {canOpenProduct ? (
          <Button
            className="sm:w-auto"
            type="button"
            variant="funnelCta"
            onClick={() => onOpenProduct?.(item)}
          >
            Zum Produkt
          </Button>
        ) : null}
      </div>
    </section>
  )
}
