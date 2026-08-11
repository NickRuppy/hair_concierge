import { createSupabaseClientFromEnv } from "../cli"

import type { Stage5ProtocolPreflightRead } from "@/lib/product-intake/catalog-enrichment/stage5-protocols"

type QueryResult<T> = Promise<{ data: T | null; error: { message: string } | null }>
type SelectBuilder<T> = {
  in: (column: string, values: string[]) => QueryResult<T[]>
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
          category_key: string
          is_active: boolean
          lifecycle_status: string
        }>("id,category_key,is_active,lifecycle_status")
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
