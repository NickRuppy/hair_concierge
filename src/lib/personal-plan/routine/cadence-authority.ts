import "server-only"

import type { PlanDamageLevel } from "../types"
import type { ProductCadenceAuthorityFact } from "./cadence"

type Query = {
  select(columns: string): Query
  in(column: string, values: string[]): Promise<{ data: unknown[] | null; error: unknown | null }>
}

type NeedVersionQuery = {
  select(columns: string): NeedVersionQuery
  eq(column: string, value: string): NeedVersionQuery
  maybeSingle(): Promise<{ data: unknown | null; error: unknown | null }>
}

export type RoutineCadenceAuthorityReader = {
  load(input: { productIds: readonly string[] }): Promise<ProductCadenceAuthorityFact[]>
  /**
   * The refined version's `assessments.damage.structuralLevel` — read only when a loaded fact is
   * a `damage_branched` Bondbuilder cadence (S4). `null` when the version or level is missing.
   */
  loadStructuralDamageLevel?(input: {
    planId: string
    refinedVersionId: string
  }): Promise<PlanDamageLevel | null>
}

export type RoutineCadenceAuthorityReadClient = {
  from(table: "product_application_protocols"): Query
  from(table: "personal_plan_need_versions"): NeedVersionQuery
}

const PLAN_DAMAGE_LEVELS = new Set<string>(["none", "low", "moderate", "high", "severe"])

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
    async loadStructuralDamageLevel(input) {
      const result = await client
        .from("personal_plan_need_versions")
        .select("output_snapshot->assessments->damage->>structuralLevel")
        .eq("id", input.refinedVersionId)
        .eq("personal_plan_id", input.planId)
        .eq("kind", "refined")
        .maybeSingle()
      if (result.error) throw result.error
      const level = (result.data as { structuralLevel?: unknown } | null)?.structuralLevel
      return typeof level === "string" && PLAN_DAMAGE_LEVELS.has(level)
        ? (level as PlanDamageLevel)
        : null
    },
  }
}
