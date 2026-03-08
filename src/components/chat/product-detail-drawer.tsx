"use client"

import type { Product, HairProfile } from "@/lib/types"
import { getPersonalizationSentence } from "@/lib/product-utils"
import { HAIR_THICKNESS_LABELS } from "@/lib/vocabulary"
import { ProductImage } from "./product-image"
import { Badge } from "@/components/ui/badge"
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@/components/ui/bottom-sheet"
import { ExternalLink } from "lucide-react"

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

  const personalization = getPersonalizationSentence(product, hairProfile)
  const description = product.short_description || product.description

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent>
        <BottomSheetHeader className="gap-4 pb-4">
          <ProductImage
            imageUrl={product.image_url}
            category={product.category}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            {product.brand && (
              <p className="text-sm font-medium text-muted-foreground">
                {product.brand}
              </p>
            )}
            <BottomSheetTitle className="text-lg">{product.name}</BottomSheetTitle>
            {product.category && (
              <Badge variant="secondary" className="mt-2">
                {product.category}
              </Badge>
            )}
          </div>
        </BottomSheetHeader>

        <div className="space-y-4 pt-2">
          {/* Personalization */}
          {personalization && (
            <div className="rounded-lg bg-primary/10 px-4 py-3">
              <p className="text-sm font-medium text-primary">
                {personalization}
              </p>
            </div>
          )}

          {product.recommendation_meta && (
            <div className="space-y-2 rounded-lg border border-border/60 bg-muted/40 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Empfehlungskontext
              </p>
              <p className="text-sm font-medium text-foreground">
                Score: {product.recommendation_meta.score.toFixed(1)}
              </p>
              {product.recommendation_meta.top_reasons.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Warum passend</p>
                  <ul className="mt-1 space-y-1">
                    {product.recommendation_meta.top_reasons.map((reason) => (
                      <li key={reason} className="text-sm text-foreground">
                        - {reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {product.recommendation_meta.tradeoffs.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Trade-offs</p>
                  <ul className="mt-1 space-y-1">
                    {product.recommendation_meta.tradeoffs.map((tradeoff) => (
                      <li key={tradeoff} className="text-sm text-foreground">
                        - {tradeoff}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {product.recommendation_meta.usage_hint && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Anwendung</p>
                  <p className="text-sm text-foreground">
                    {product.recommendation_meta.usage_hint}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Tom's take */}
          {product.tom_take && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Toms Meinung
              </p>
              <p className="text-sm italic text-foreground">
                &ldquo;{product.tom_take}&rdquo;
              </p>
            </div>
          )}

          {/* Description */}
          {description && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Beschreibung
              </p>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          )}

          {/* Hair types */}
          {product.suitable_thicknesses?.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Geeignete Haardicke
              </p>
              <div className="flex flex-wrap gap-1.5">
                {product.suitable_thicknesses.map((ht) => (
                  <Badge key={ht} variant="outline" className="text-xs">
                    {HAIR_THICKNESS_LABELS[ht as keyof typeof HAIR_THICKNESS_LABELS] ?? ht}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Concerns */}
          {product.suitable_concerns?.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Hilft bei
              </p>
              <div className="flex flex-wrap gap-1.5">
                {product.suitable_concerns.map((c) => (
                  <Badge key={c} variant="outline" className="text-xs">
                    {c}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {product.tags?.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Tags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {product.tags.map((t) => (
                  <Badge key={t} variant="secondary" className="text-xs">
                    {t}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Price + affiliate link */}
          {(product.price_eur || product.affiliate_link) && (
            <div className="flex items-center justify-between border-t border-border pt-4">
              {product.price_eur && (
                <span className="text-lg font-bold text-primary">
                  {product.price_eur.toFixed(2)} \u20AC
                </span>
              )}
              {product.affiliate_link && (
                <a
                  href={product.affiliate_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Kaufen
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          )}
        </div>
      </BottomSheetContent>
    </BottomSheet>
  )
}
