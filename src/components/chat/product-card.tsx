import { ChevronRight } from "lucide-react"

import {
  buildCompactProductFacts,
  formatProductPrice,
} from "@/components/chat/product-display-model"
import type { Product } from "@/lib/types"
import { Icon, type IconName } from "@/components/ui/icon"

interface ProductCardProps {
  product: Product
  onClick: (product: Product) => void
}

/** Maps product.category to the icon name in our icon system. */
function categoryIconName(category: string | null): IconName {
  if (!category) return "product-shampoo"
  const normalizedCategory = category
    .trim()
    .toLowerCase()
    .replace(/[()]/g, "")
    .replace(/[\s_-]+/g, "-")

  const categoryIcons: Record<string, IconName> = {
    shampoo: "product-shampoo",
    conditioner: "product-conditioner",
    "conditioner-drogerie": "product-conditioner",
    oil: "product-oil",
    oel: "product-oil",
    öl: "product-oil",
    öle: "product-oil",
    oele: "product-oil",
    mask: "product-mask",
    maske: "product-mask",
    "leave-in": "product-leave-in",
    leavein: "product-leave-in",
    peeling: "product-peeling",
    "dry-shampoo": "product-dry-shampoo",
    trockenshampoo: "product-dry-shampoo",
    bondbuilder: "product-bond-builder",
    "bond-builder": "product-bond-builder",
    "deep-cleansing-shampoo": "product-deep-cleansing",
    "deep-cleansing": "product-deep-cleansing",
  }

  return categoryIcons[normalizedCategory] ?? "product-shampoo"
}

export function ProductCard({ product, onClick }: ProductCardProps) {
  const iconName = categoryIconName(product.category)
  const facts = buildCompactProductFacts(product)
  const price = formatProductPrice(product.price_eur, product.currency)

  return (
    <button
      type="button"
      onClick={() => onClick(product)}
      className="flex w-full min-w-0 cursor-pointer items-center gap-3 overflow-hidden rounded-xl border border-border bg-card p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm"
    >
      {/* Category icon */}
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--brand-plum-ice)]">
        <Icon name={iconName} size={18} className="text-primary" />
      </div>

      {/* Product info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-[var(--text-heading)]">
          {product.name}
        </p>
        {product.brand && (
          <p className="truncate text-[11px] text-[var(--text-caption)]">{product.brand}</p>
        )}
        {facts.length > 0 && (
          <div className="mt-1 flex min-w-0 flex-wrap gap-1">
            {facts.map((fact) => (
              <span
                key={`${fact.source}:${fact.label}`}
                className="max-w-full truncate rounded-full bg-[var(--brand-plum-ice)] px-2 py-0.5 text-[10px] font-medium leading-4 text-primary"
              >
                {fact.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {price && (
        <span className="shrink-0 whitespace-nowrap text-[12px] font-semibold text-[var(--text-heading)]">
          {price}
        </span>
      )}

      <span className="sr-only">Produktdetails öffnen</span>
      <ChevronRight
        aria-hidden="true"
        className="h-4 w-4 shrink-0 text-[var(--text-caption)]"
        strokeWidth={1.8}
      />
    </button>
  )
}
