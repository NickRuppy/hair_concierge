import { createSupabaseClientFromEnv } from "../cli"

import {
  deriveStage5CuratedCohortProduct,
  type Stage5ProtocolPreflightRead,
} from "@/lib/product-intake/catalog-enrichment/stage5-protocols"

type QueryResult<T> = Promise<{ data: T | null; error: { message: string } | null }>
type SelectBuilder<T> = PromiseLike<{
  data: T[] | null
  error: { message: string } | null
}> & {
  in: (column: string, values: string[]) => QueryResult<T[]>
  eq: (column: string, value: string | boolean) => SelectBuilder<T>
}
type Stage5ProtocolClient = {
  from: (table: string) => {
    select: <T = Record<string, unknown>>(columns: string) => SelectBuilder<T>
  }
  rpc: (
    name: "apply_personal_plan_stage5_protocol_batch_v1",
    args: {
      p_batch_json: string
      p_expected_batch_fingerprint: string
      p_reviewed_by: "nick"
    },
  ) => QueryResult<Record<string, unknown>[]>
}

export function createStage5ProtocolClientAdapters(client: Stage5ProtocolClient) {
  const read: Stage5ProtocolPreflightRead = {
    async listProducts(productIds) {
      const { data, error } = await client
        .from("products")
        .select<{
          id: string
          category_key: string | null
          origin: string | null
          is_active: boolean
          lifecycle_status: string
        }>("id,category_key,origin,is_active,lifecycle_status")
        .in("id", productIds)
      if (error) throw new Error(`Stage 5 product preflight failed: ${error.message}`)
      return data ?? []
    },
    async listProtocols(productIds) {
      const { data, error } = await client
        .from("product_application_protocols")
        .select<{
          product_id: string
          category: string
          role: string
          cadence: unknown
          source_url: string | null
          guidance_payload: unknown
        }>("product_id,category,role,cadence,source_url,guidance_payload")
        .in("product_id", productIds)
      if (error) throw new Error(`Stage 5 protocol preflight failed: ${error.message}`)
      return data ?? []
    },
  }
  return {
    read,
    audit: {
      async listCuratedProducts() {
        type LiveProduct = {
          id: string
          category_key: string | null
          origin: string | null
          is_active: boolean
          lifecycle_status: string
          is_chaarlie_recommended: boolean
          brand: string | null
          name: string
          affiliate_link: string | null
          product_shampoo_specs: Array<{ shampoo_bucket: string | null }>
          product_leave_in_specs: {
            plan_roles: string[] | null
            care_direction: string | null
            repair_support_level: string | null
            functional_benefits: string[] | null
          } | null
          product_oil_specs: {
            weight: string | null
            role_support: string[] | null
            provides_heat_protection: boolean | null
          } | null
          product_mask_specs: {
            repair_support_level: string | null
            functional_benefits: string[] | null
          } | null
          product_scalp_care_specs: { primary_role: string | null } | null
          product_deep_cleansing_shampoo_specs: { reset_focus: string | null } | null
        }
        const baseColumns =
          "id,category_key,origin,is_active,lifecycle_status,is_chaarlie_recommended,brand,name,affiliate_link,product_shampoo_specs(shampoo_bucket),product_scalp_care_specs(primary_role),product_deep_cleansing_shampoo_specs(reset_focus)"
        const run = (columns: string) =>
          client
            .from("products")
            .select<LiveProduct>(columns)
            .eq("origin", "curated")
            .eq("is_active", true)
            .eq("lifecycle_status", "active")
        let { data, error } = await run(
          `${baseColumns},product_leave_in_specs(plan_roles,care_direction,repair_support_level,functional_benefits),product_oil_specs(weight,role_support,provides_heat_protection),product_mask_specs(repair_support_level,functional_benefits)`,
        )
        if (
          error &&
          /(?:plan_roles|repair_support_level|role_support).*does not exist/i.test(error.message)
        ) {
          const fallback = await run(
            `${baseColumns},product_leave_in_specs(provides_heat_protection),product_oil_specs(provides_heat_protection),product_mask_specs(product_id)`,
          )
          data = (fallback.data ?? []).map((product) => ({
            ...product,
            product_leave_in_specs: product.product_leave_in_specs
              ? {
                  plan_roles: null,
                  care_direction: null,
                  repair_support_level: null,
                  functional_benefits: null,
                }
              : null,
            product_oil_specs: product.product_oil_specs
              ? {
                  weight: null,
                  role_support: null,
                  provides_heat_protection: product.product_oil_specs.provides_heat_protection,
                }
              : null,
            product_mask_specs: product.product_mask_specs
              ? { repair_support_level: null, functional_benefits: null }
              : null,
          }))
          error = fallback.error
        }
        if (error) throw new Error(`Stage 5 cohort audit failed: ${error.message}`)
        const supported = new Set([
          "shampoo",
          "conditioner",
          "leave_in",
          "mask",
          "oil",
          "dry_shampoo",
          "bondbuilder",
          "heat_protectant",
          "scalp_care",
          "deep_cleansing_shampoo",
        ])
        return (data ?? []).flatMap((product) => {
          const isDeepRepair =
            product.category_key === null && product.product_deep_cleansing_shampoo_specs !== null
          if (!isDeepRepair && !supported.has(product.category_key ?? "")) return []
          const category_key = isDeepRepair ? "deep_cleansing_shampoo" : product.category_key!
          return [
            deriveStage5CuratedCohortProduct({
              product_id: product.id,
              category_key,
              origin: product.origin,
              is_active: product.is_active,
              lifecycle_status: product.lifecycle_status,
              is_chaarlie_recommended: product.is_chaarlie_recommended,
              brand: product.brand,
              name: product.name,
              affiliate_link: product.affiliate_link,
              category_repair: isDeepRepair
                ? {
                    expected_current_category: null,
                    target_category: "deep_cleansing_shampoo",
                  }
                : null,
              shampoo_specs: product.product_shampoo_specs,
              leave_in_specs: product.product_leave_in_specs,
              oil_specs: product.product_oil_specs,
              mask_specs: product.product_mask_specs,
              scalp_care_specs: product.product_scalp_care_specs,
              deep_cleansing_specs: product.product_deep_cleansing_shampoo_specs,
            }),
          ]
        })
      },
      listProtocols: read.listProtocols,
      async listDispositions(productIds: string[]) {
        const { data, error } = await client
          .from("personal_plan_product_search_dispositions")
          .select<{
            product_id: string
            disposition: string
            reason_code: string
          }>("product_id,disposition,reason_code")
          .in("product_id", productIds)
        if (error) throw new Error(`Stage 5 disposition audit failed: ${error.message}`)
        return data ?? []
      },
    },
    async apply(canonicalJson: string, fingerprint: string) {
      const { data, error } = await client.rpc("apply_personal_plan_stage5_protocol_batch_v1", {
        p_batch_json: canonicalJson,
        p_expected_batch_fingerprint: fingerprint,
        p_reviewed_by: "nick",
      })
      if (error) throw new Error(`Stage 5 protocol apply failed: ${error.message}`)
      return data ?? []
    },
  }
}

export function stage5ProtocolClientAdapters() {
  return createStage5ProtocolClientAdapters(
    createSupabaseClientFromEnv() as unknown as Stage5ProtocolClient,
  )
}
