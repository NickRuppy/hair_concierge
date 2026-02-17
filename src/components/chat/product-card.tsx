"use client"

import type { Product, HairProfile } from "@/lib/types"
import { ProductImage } from "./product-image"
import { Badge } from "@/components/ui/badge"

interface ProductCardProps {
  product: Product
  variant: "hero" | "compact"
  hairProfile: HairProfile | null
  onClick: () => void
}

/** Build a short German personalization string from profile + product overlap */
function getPersonalizationText(
  product: Product,
  hairProfile: HairProfile | null
): string | null {
  if (!hairProfile) return null

  const parts: string[] = []

  // Hair type match
  if (
    hairProfile.thickness &&
    product.suitable_hair_textures?.includes(hairProfile.thickness)
  ) {
    const labels: Record<string, string> = {
      fine: "feines",
      normal: "normales",
      coarse: "dickes",
    }
    parts.push(`Passt zu deinem ${labels[hairProfile.thickness] || hairProfile.thickness} Haar`)
  }

  // Concern matches
  const matchedConcerns = (hairProfile.concerns || []).filter((c) =>
    product.suitable_concerns?.includes(c)
  )
  if (matchedConcerns.length > 0) {
    parts.push(`Hilft bei ${matchedConcerns.slice(0, 2).join(" & ")}`)
  }

  return parts.length > 0 ? parts.join(" \u00B7 ") : null
}

export function ProductCard({
  product,
  variant,
  hairProfile,
  onClick,
}: ProductCardProps) {
  const personalization = getPersonalizationText(product, hairProfile)
  const description = product.short_description || product.description

  if (variant === "hero") {
    return (
      <button
        type="button"
        onClick={onClick}
        className="group flex w-full gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-card/80"
      >
        <ProductImage
          imageUrl={product.image_url}
          category={product.category}
          size="lg"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div>
            {product.brand && (
              <p className="text-xs font-medium text-muted-foreground">
                {product.brand}
              </p>
            )}
            <p className="text-sm font-semibold leading-tight line-clamp-2">
              {product.name}
            </p>
          </div>

          {personalization && (
            <p className="text-xs font-medium text-primary">
              {personalization}
            </p>
          )}

          {product.tom_take && (
            <p className="text-xs italic text-muted-foreground line-clamp-2">
              &ldquo;{product.tom_take}&rdquo;
            </p>
          )}

          {description && !product.tom_take && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {description}
            </p>
          )}

          {product.category && (
            <div className="mt-1">
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0"
              >
                {product.category}
              </Badge>
            </div>
          )}
        </div>
      </button>
    )
  }

  // Compact variant
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-card/80"
    >
      <ProductImage
        imageUrl={product.image_url}
        category={product.category}
        size="sm"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div>
          {product.brand && (
            <p className="text-[10px] font-medium text-muted-foreground">
              {product.brand}
            </p>
          )}
          <p className="text-xs font-semibold leading-tight line-clamp-2">
            {product.name}
          </p>
        </div>
        {personalization && (
          <p className="text-[10px] font-medium text-primary line-clamp-1">
            {personalization}
          </p>
        )}
      </div>
    </button>
  )
}
