import type { Product } from "@/lib/types"
import { Icon, type IconName } from "@/components/ui/icon"

interface ProductCardProps {
  product: Product
  onClick: (product: Product) => void
}

/** Maps product.category to the icon name in our icon system. */
function categoryIconName(category: string | null): IconName {
  if (!category) return "product-shampoo"
  const mapped = `product-${category.replace("_", "-")}` as IconName
  // Check if the mapped name is a valid icon; fall back otherwise.
  const validIcons: IconName[] = [
    "product-shampoo",
    "product-conditioner",
    "product-oil",
    "product-mask",
    "product-leave-in",
    "product-peeling",
    "product-dry-shampoo",
    "product-bond-builder",
    "product-deep-cleansing",
  ]
  return validIcons.includes(mapped) ? mapped : "product-shampoo"
}

/** Formats a number as German-style price: `12,99 €` */
function formatPrice(price: number): string {
  return `${price.toFixed(2).replace(".", ",")} €`
}

export function ProductCard({ product, onClick }: ProductCardProps) {
  const iconName = categoryIconName(product.category)
  const topReason = product.recommendation_meta?.top_reasons?.[0]

  return (
    <button
      type="button"
      onClick={() => onClick(product)}
      className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm"
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
        {topReason && <p className="mt-0.5 truncate text-[11px] text-primary">{topReason}</p>}
      </div>

      {/* Price */}
      {product.price_eur != null && (
        <span className="shrink-0 font-mono text-[12px] font-medium text-[var(--text-heading)]">
          {formatPrice(product.price_eur)}
        </span>
      )}
    </button>
  )
}
