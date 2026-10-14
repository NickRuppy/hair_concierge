import "server-only"

import type { ProductCadenceAuthorityFact } from "./cadence"

type Query = {
  select(columns: string): Query
  in(column: string, values: string[]): Promise<{ data: unknown[] | null; error: unknown | null }>
}

export type RoutineCadenceAuthorityReader = {
  load(input: { productIds: readonly string[] }): Promise<ProductCadenceAuthorityFact[]>
}

export type RoutineCadenceAuthorityReadClient = {
  from(table: "product_application_protocols"): Query
}

export function createSupabaseRoutineCadenceAuthorityReader(
  client: RoutineCadenceAuthorityReadClient,
): RoutineCadenceAuthorityReader {
  return {
    async load(input) {
      const productIds = [...new Set(input.productIds)].filter(Boolean).sort()
      if (productIds.length === 0) return []
      const result = await client
        .from("product_application_protocols")
        .select("product_id,category,role,cadence")
        .in("product_id", productIds)
      if (result.error) throw result.error
      return (result.data ?? []).flatMap((row) => {
        if (!row || typeof row !== "object") return []
        const value = row as Record<string, unknown>
        return typeof value.product_id === "string" &&
          typeof value.category === "string" &&
          typeof value.role === "string"
          ? [
              {
                productId: value.product_id,
                category: value.category,
                role: value.role,
                cadence: value.cadence ?? null,
              } as ProductCadenceAuthorityFact,
            ]
          : []
      })
    },
  }
}
