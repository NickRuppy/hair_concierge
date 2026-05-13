"use client"

import type { Product, HairProfile } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
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
  getShopLabel,
  getValidAffiliateLink,
  shouldShowAffiliateDisclosure,
} from "./product-display-model"
import { ProductImage } from "./product-image"

interface ProductDetailDrawerProps {
  product: Product | null
  hairProfile: HairProfile | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ProductDetailDrawer({
  product,
  hairProfile,
  open,
  onOpenChange,
}: ProductDetailDrawerProps) {
  if (!product) return null

  const categoryLabel = getProductCategoryLabel(
    product.recommendation_meta?.category ?? product.category,
  )
  const matchSummary = buildProductMatchSummary(product, hairProfile)
  const applicationSentence = buildProductApplicationSentence(product, hairProfile)
  const profileRows = buildDrawerProductProfileRows(product)
  const price = formatProductPrice(product.price_eur, product.currency)
  const affiliateHref = getValidAffiliateLink(product.affiliate_link)
  const shopLabel = getShopLabel(affiliateHref)
  const showAffiliateDisclosure = shouldShowAffiliateDisclosure(product)

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent>
        <BottomSheetHeader className="gap-4 pb-4">
          <ProductImage imageUrl={product.image_url} category={product.category} size="lg" />
          <div className="min-w-0 flex-1">
            {product.brand && (
              <p className="text-sm font-medium text-muted-foreground">{product.brand}</p>
            )}
            <BottomSheetTitle className="text-lg">{product.name}</BottomSheetTitle>
            {categoryLabel && (
              <Badge variant="default" className="mt-2">
                {categoryLabel}
              </Badge>
            )}
          </div>
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
