"use client"

import { useState } from "react"
import type { Product, HairProfile } from "@/lib/types"
import { ProductCard } from "./product-card"
import { ChevronDown } from "lucide-react"

interface ProductRecommendationsProps {
  products: Product[]
  hairProfile: HairProfile | null
  onProductClick: (product: Product) => void
}

export function ProductRecommendations({
  products,
  hairProfile,
  onProductClick,
}: ProductRecommendationsProps) {
  const [expanded, setExpanded] = useState(false)

  if (products.length === 0) return null

  const hero = products[0]
  const compact = products.slice(1, 3)
  const overflow = products.slice(3)
  const hasOverflow = overflow.length > 0

  return (
    <div className="space-y-2 animate-fade-in-up">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground font-header">
        Toms Empfehlungen
      </p>

      {/* Hero card */}
      <div className="animate-fade-in-up" style={{ animationDelay: "50ms" }}>
        <ProductCard
          product={hero}
          variant="hero"
          hairProfile={hairProfile}
          onClick={() => onProductClick(hero)}
        />
      </div>

      {/* Compact cards */}
      {compact.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {compact.map((product, i) => (
            <div
              key={product.id}
              className="animate-fade-in-up"
              style={{ animationDelay: `${(i + 1) * 80 + 50}ms` }}
            >
              <ProductCard
                product={product}
                variant="compact"
                hairProfile={hairProfile}
                onClick={() => onProductClick(product)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Overflow */}
      {hasOverflow && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex w-full items-center justify-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          Mehr anzeigen ({overflow.length})
          <ChevronDown className="h-3 w-3" />
        </button>
      )}

      {expanded && (
        <div className="grid grid-cols-2 gap-2">
          {overflow.map((product, i) => (
            <div
              key={product.id}
              className="animate-fade-in-up"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <ProductCard
                product={product}
                variant="compact"
                hairProfile={hairProfile}
                onClick={() => onProductClick(product)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
