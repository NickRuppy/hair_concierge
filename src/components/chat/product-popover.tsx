"use client"

import { useState, useRef, useCallback, useEffect, type ReactNode } from "react"
import type { Product, HairProfile } from "@/lib/types"
import { ProductImage } from "./product-image"
import { Badge } from "@/components/ui/badge"
import { getPersonalizationSentence } from "@/lib/product-utils"

interface ProductPopoverProps {
  product: Product
  hairProfile: HairProfile | null
  children: ReactNode
}

export function ProductPopover({
  product,
  hairProfile,
  children,
}: ProductPopoverProps) {
  const [visible, setVisible] = useState(false)
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimers = useCallback(() => {
    if (showTimer.current) {
      clearTimeout(showTimer.current)
      showTimer.current = null
    }
    if (hideTimer.current) {
      clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
  }, [])

  useEffect(() => clearTimers, [clearTimers])

  const handleTriggerEnter = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
    showTimer.current = setTimeout(() => setVisible(true), 300)
  }, [])

  const handleTriggerLeave = useCallback(() => {
    if (showTimer.current) {
      clearTimeout(showTimer.current)
      showTimer.current = null
    }
    hideTimer.current = setTimeout(() => setVisible(false), 100)
  }, [])

  const handlePopoverEnter = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
  }, [])

  const handlePopoverLeave = useCallback(() => {
    hideTimer.current = setTimeout(() => setVisible(false), 100)
  }, [])

  const personalization = getPersonalizationSentence(product, hairProfile)

  return (
    <span
      className="relative inline"
      onMouseEnter={handleTriggerEnter}
      onMouseLeave={handleTriggerLeave}
    >
      {children}

      {visible && (
        <span
          className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2"
          onMouseEnter={handlePopoverEnter}
          onMouseLeave={handlePopoverLeave}
        >
          <span className="block w-72 rounded-xl border border-border bg-card p-3 shadow-lg">
            {/* Header: image + brand + name + category */}
            <span className="flex items-start gap-3">
              <ProductImage
                imageUrl={product.image_url}
                category={product.category}
                size="sm"
              />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                {product.brand && (
                  <span className="block text-[11px] font-medium text-muted-foreground">
                    {product.brand}
                  </span>
                )}
                <span className="block text-sm font-semibold leading-tight">
                  {product.name}
                </span>
                {product.category && (
                  <span className="mt-0.5 block">
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0"
                    >
                      {product.category}
                    </Badge>
                  </span>
                )}
              </span>
            </span>

            {/* Personalization */}
            {personalization && (
              <span className="mt-2 block rounded-md bg-primary/10 px-2.5 py-1.5">
                <span className="block text-xs font-medium text-primary">
                  {personalization}
                </span>
              </span>
            )}

            {/* Tom's take */}
            {product.tom_take && (
              <span className="mt-2 block">
                <span className="block text-xs italic text-muted-foreground line-clamp-2">
                  &ldquo;{product.tom_take}&rdquo;
                </span>
              </span>
            )}

            {/* Footer: price + hint */}
            <span className="mt-2 flex items-center justify-between border-t border-border pt-2">
              {product.price_eur ? (
                <span className="text-sm font-bold text-primary">
                  {product.price_eur.toFixed(2)} &euro;
                </span>
              ) : (
                <span />
              )}
              <span className="text-[11px] text-muted-foreground">
                Klicken f&uuml;r Details &rarr;
              </span>
            </span>
          </span>
        </span>
      )}
    </span>
  )
}
