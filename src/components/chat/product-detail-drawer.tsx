"use client"

import { useEffect, useState } from "react"
import type { Product, HairProfile } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { getProductIdentityDisplayParts } from "@/lib/product-lines/display"
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@/components/ui/bottom-sheet"
import { ExternalLink } from "lucide-react"
import {
  buildDrawerProductProfileRows,
  buildProductApplicationSentence,
  buildProductMatchSummary,
  formatProductPrice,
  getProductCategoryLabel,
  getProductShopCtaLabel,
  getPurchaseLinkHelperText,
  getValidAffiliateLink,
  shouldShowAffiliateDisclosure,
} from "./product-display-model"
import { ProductImage } from "./product-image"

const ROUTINE_ACTION_CATEGORIES = new Set([
  "shampoo",
  "conditioner",
  "leave_in",
  "mask",
  "oil",
  "heat_protectant",
  "bondbuilder",
  "deep_cleansing_shampoo",
  "dry_shampoo",
  "peeling",
])

export interface ProductDetailRoutineAction {
  category?: string | null
  productId?: string | null
  existingUsageId?: string | null
  alreadyInRoutine?: boolean
  onChanged?: () => Promise<void> | void
}

interface ProductDetailDrawerProps {
  product: Product | null
  hairProfile: HairProfile | null
  open: boolean
  onOpenChange: (open: boolean) => void
  routineAction?: ProductDetailRoutineAction
}

export function ProductDetailDrawer({
  product,
  hairProfile,
  open,
  onOpenChange,
  routineAction,
}: ProductDetailDrawerProps) {
  if (!product) return null

  const resolvedRoutineAction: ProductDetailRoutineAction | undefined = routineAction
    ? {
        ...routineAction,
        category:
          routineAction.category ??
          product.recommendation_meta?.category ??
          product.category ??
          null,
        productId: routineAction.productId ?? product.id,
      }
    : undefined
  const categoryLabel = getProductCategoryLabel(
    product.recommendation_meta?.category ?? product.category,
  )
  const matchSummary = buildProductMatchSummary(product, hairProfile)
  const applicationSentence = buildProductApplicationSentence(product, hairProfile)
  const profileRows = buildDrawerProductProfileRows(product)
  const price = formatProductPrice(product.price_eur, product.currency)
  const affiliateHref = getValidAffiliateLink(product.affiliate_link)
  const shopLabel = getProductShopCtaLabel(product)
  const purchaseLinkHelperText = getPurchaseLinkHelperText(product)
  const showAffiliateDisclosure = shouldShowAffiliateDisclosure(product)
  const [displayBrand, displayLine] = getProductIdentityDisplayParts(product)

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent>
        <BottomSheetHeader className="gap-4 pb-4">
          <ProductImage imageUrl={product.image_url} category={product.category} size="lg" />
          <div className="min-w-0 flex-1">
            {displayBrand && (
              <p className="text-sm font-medium text-muted-foreground">{displayBrand}</p>
            )}
            {displayLine && (
              <p className="text-xs font-medium text-muted-foreground">{displayLine}</p>
            )}
            <BottomSheetTitle className="text-lg">{product.name}</BottomSheetTitle>
            {categoryLabel && (
              <Badge variant="default" className="mt-2">
                {categoryLabel}
              </Badge>
            )}
          </div>
          <ProductRoutineActionButton routineAction={resolvedRoutineAction} />
        </BottomSheetHeader>

        <div className="space-y-5 pt-2">
          {matchSummary && (
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Warum es passt
              </h3>
              <div className="rounded-lg bg-primary/10 px-4 py-3">
                <p className="text-sm leading-6 text-foreground">{matchSummary}</p>
              </div>
            </section>
          )}

          {applicationSentence && (
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Anwendung
              </h3>
              <p className="text-sm leading-6 text-foreground">{applicationSentence}</p>
            </section>
          )}

          {profileRows.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Produktprofil
              </h3>
              <div className="divide-y divide-border/70 rounded-lg border border-border/70">
                {profileRows.map((row) => (
                  <div
                    key={`${row.label}-${row.value}`}
                    className="grid grid-cols-1 gap-1 px-4 py-3 text-sm sm:grid-cols-[minmax(8rem,0.8fr)_minmax(0,1.2fr)] sm:gap-4"
                  >
                    <span className="font-medium text-muted-foreground">{row.label}</span>
                    <span className="min-w-0 break-words text-foreground">{row.value}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {(price || affiliateHref || showAffiliateDisclosure) && (
            <footer className="space-y-2 border-t border-border pt-4">
              {(price || affiliateHref) && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  {price && <p className="text-lg font-bold text-primary">{price}</p>}
                  {affiliateHref && (
                    <a
                      href={affiliateHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:w-auto"
                    >
                      <span>{shopLabel}</span>
                      <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
                    </a>
                  )}
                </div>
              )}
              {purchaseLinkHelperText && (
                <p className="text-xs leading-5 text-muted-foreground">{purchaseLinkHelperText}</p>
              )}
              {showAffiliateDisclosure && (
                <p className="text-xs leading-5 text-muted-foreground">
                  Anzeige: Der Kauflink kann ein Affiliate-Link sein.
                </p>
              )}
            </footer>
          )}
        </div>
      </BottomSheetContent>
    </BottomSheet>
  )
}

export function ProductRoutineActionButton({
  routineAction,
}: {
  routineAction?: ProductDetailRoutineAction
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isConfirmingReplace, setIsConfirmingReplace] = useState(false)
  const [replacementUsageId, setReplacementUsageId] = useState<string | null>(
    routineAction?.existingUsageId ?? null,
  )
  const [error, setError] = useState<string | null>(null)

  const category = normalizeRoutineCategory(routineAction?.category)
  const productId = routineAction?.productId?.trim()

  useEffect(() => {
    setReplacementUsageId(routineAction?.existingUsageId ?? null)
    setIsConfirmingReplace(false)
    setError(null)
  }, [productId, routineAction?.existingUsageId])

  if (!routineAction || !category || !productId) return null

  if (routineAction.alreadyInRoutine) {
    return (
      <button
        type="button"
        disabled
        className="ml-auto inline-flex h-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted px-3 text-xs font-semibold text-muted-foreground"
      >
        Drin
      </button>
    )
  }

  const submitRoutineAction = async (confirmReplace: boolean) => {
    if (replacementUsageId && !confirmReplace) {
      setError(null)
      setIsConfirmingReplace(true)
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const body: Record<string, string | boolean> = {
        category,
        productId,
      }

      if (replacementUsageId) {
        body.replaceUsageId = replacementUsageId
        body.confirmReplace = true
      }

      const response = await fetch("/api/routine/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })

      if (response.status === 409) {
        const conflictBody = (await response.json().catch(() => null)) as {
          existingUsageId?: unknown
        } | null
        if (typeof conflictBody?.existingUsageId === "string") {
          setReplacementUsageId(conflictBody.existingUsageId)
          setIsConfirmingReplace(true)
          return
        }
      }

      if (!response.ok) {
        throw new Error("Routine product request failed")
      }

      setIsConfirmingReplace(false)
      await routineAction.onChanged?.()
    } catch {
      setError("Konnte nicht gespeichert werden.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isConfirmingReplace) {
    return (
      <div className="ml-auto flex shrink-0 flex-col items-end gap-1">
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => submitRoutineAction(true)}
            className="inline-flex h-8 items-center justify-center rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Ersetzen
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => {
              setError(null)
              setIsConfirmingReplace(false)
            }}
            className="inline-flex h-8 items-center justify-center rounded-full border border-border px-3 text-xs font-semibold text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            Abbrechen
          </button>
        </div>
        {error && <p className="max-w-32 text-right text-xs leading-4 text-destructive">{error}</p>}
      </div>
    )
  }

  return (
    <div className="ml-auto flex shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        disabled={isSubmitting}
        aria-label="Zur Routine hinzufügen"
        onClick={() => submitRoutineAction(false)}
        className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-primary px-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "..." : "+"}
      </button>
      {error && <p className="max-w-32 text-right text-xs leading-4 text-destructive">{error}</p>}
    </div>
  )
}

function normalizeRoutineCategory(category: string | null | undefined): string | null {
  if (!category) return null

  const normalized = category
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
  const aliases: Record<string, string> = {
    deep_cleansing: "deep_cleansing_shampoo",
    deep_cleansing_shampoo: "deep_cleansing_shampoo",
    tiefenreinigung: "deep_cleansing_shampoo",
    dry_shampoo: "dry_shampoo",
    trockenshampoo: "dry_shampoo",
    leave_in: "leave_in",
    leavein: "leave_in",
    leave_in_conditioner: "leave_in",
    öl: "oil",
    oel: "oil",
    haaröl: "oil",
    haaroel: "oil",
    scrub: "peeling",
  }

  const resolved = aliases[normalized] ?? normalized
  return ROUTINE_ACTION_CATEGORIES.has(resolved) ? resolved : null
}
