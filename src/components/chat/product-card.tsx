"use client"

import type { Product } from "@/lib/types"
import { ExternalLink } from "lucide-react"

interface ProductCardProps {
  product: Product
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <div className="flex gap-3 rounded-xl border bg-card p-3">
      {product.image_url && (
        <img
          src={product.image_url}
          alt={product.name}
          className="h-20 w-20 shrink-0 rounded-lg object-cover"
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div>
          {product.brand && (
            <p className="text-xs font-medium text-muted-foreground">
              {product.brand}
            </p>
          )}
          <p className="text-sm font-semibold leading-tight">{product.name}</p>
          {product.description && (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              {product.description}
            </p>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between">
          {product.price_eur && (
            <span className="text-sm font-bold text-primary">
              {product.price_eur.toFixed(2)} €
            </span>
          )}
          {product.affiliate_link && (
            <a
              href={product.affiliate_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Ansehen
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
