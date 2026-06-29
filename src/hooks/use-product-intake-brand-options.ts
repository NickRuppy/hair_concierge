"use client"

import { useEffect, useState } from "react"
import type { ProductIntakeBrandOption } from "@/lib/product-intake/client"

export function useProductIntakeBrandOptions(query: string, enabled = true) {
  const [brandOptions, setBrandOptions] = useState<ProductIntakeBrandOption[]>([])
  const trimmedQuery = query.trim()
  const shouldFetch = enabled && trimmedQuery.length >= 2

  useEffect(() => {
    if (!shouldFetch) {
      return
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => {
      fetch(`/api/product-intake/brand-options?q=${encodeURIComponent(trimmedQuery)}`, {
        signal: controller.signal,
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((body: { options?: ProductIntakeBrandOption[] } | null) => {
          setBrandOptions(body?.options ?? [])
        })
        .catch((error) => {
          if ((error as Error).name !== "AbortError") setBrandOptions([])
        })
    }, 180)

    return () => {
      clearTimeout(timeout)
      controller.abort()
    }
  }, [shouldFetch, trimmedQuery])

  return shouldFetch ? brandOptions : []
}
