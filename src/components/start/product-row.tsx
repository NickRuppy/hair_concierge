"use client"

import type { Product } from "@/lib/types"
import { ExternalLink } from "lucide-react"

export function ProductRow({ products }: { products: Product[] }) {
  if (products.length === 0) return null

  return (
    <section>
      <h2 className="mb-4 text-lg font-bold">Empfohlen für dich</h2>
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
        {products.map((product) => (
          <div
            key={product.id}
            className="w-56 shrink-0 overflow-hidden rounded-xl border bg-card shadow-sm"
          >
            {product.image_url && (
              <img
                src={product.image_url}
                alt={product.name}
                className="h-40 w-full object-cover"
              />
            )}
            <div className="p-3">
              {product.brand && (
                <p className="text-xs font-medium text-muted-foreground">
                  {product.brand}
                </p>
              )}
              <p className="text-sm font-semibold leading-tight">
                {product.name}
              </p>
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
                    className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Ansehen
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
