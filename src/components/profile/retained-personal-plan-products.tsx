import { Badge } from "@/components/ui/badge"
import type { Stage3RetainedOwnedProduct } from "@/lib/personal-plan/products/contracts"
import type { ProductDetailRow } from "@/lib/profile/product-usage-rows"

export function filterRetainedPersonalPlanProductRows(
  rows: ProductDetailRow[],
  retainedProducts: Stage3RetainedOwnedProduct[],
) {
  const retainedCatalogProducts = new Set(
    retainedProducts.map((product) => `${product.category}:${product.productId}`),
  )
  return rows.filter(
    (row) =>
      row.matchStatus !== "matched" ||
      !row.productId ||
      !retainedCatalogProducts.has(`${row.category}:${row.productId}`),
  )
}

export function RetainedPersonalPlanProducts({
  products,
}: {
  products: Stage3RetainedOwnedProduct[]
}) {
  if (products.length === 0) return null
  return (
    <div className="rounded-xl border border-border/80 bg-card/80 p-4 shadow-sm">
      <p className="text-sm font-semibold text-[var(--text-heading)]">Nicht verwendete Produkte</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Diese Produkte sind weiterhin als vorhanden gespeichert, gehören aber nicht zu deiner
        aktuellen Routine.
      </p>
      <div className="mt-4 space-y-2">
        {products.map((product) => (
          <div
            key={product.capturedProductId}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 px-3 py-2 text-sm"
          >
            <span>{product.displayName}</span>
            <Badge variant="outline">Nicht verwendet</Badge>
          </div>
        ))}
      </div>
    </div>
  )
}
