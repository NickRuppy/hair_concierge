import type { SupabaseClient } from "@supabase/supabase-js"

import {
  LEAVE_IN_CALIBRATION_PROJECT_ID,
  type LeaveInCalibrationLiveRows,
  type LeaveInCalibrationLedgerRow,
  type LeaveInCalibrationReadAdapter,
  type LeaveInCalibrationWriteAdapter,
} from "@/lib/product-intake/catalog-enrichment/leave-in-research-calibration"
import { createSupabaseClientFromEnv } from "../cli"

export function assertLeaveInCalibrationProject(supabaseUrl: string): void {
  if (!supabaseUrl.includes(LEAVE_IN_CALIBRATION_PROJECT_ID))
    throw new Error(
      `Supabase URL does not target ${LEAVE_IN_CALIBRATION_PROJECT_ID}: ${supabaseUrl}`,
    )
}

/**
 * Read half only. The Leave-In calibration cohort never exposes a write adapter
 * from this client — generate, validate and preflight are all read-only, and the
 * apply executor is a separate, separately authorized step.
 */
export function createLeaveInCalibrationReadAdapter(
  client: SupabaseClient,
): LeaveInCalibrationReadAdapter {
  async function selectOne(table: string, productId: string) {
    const { data, error } = await client.from(table).select("*").eq("product_id", productId)
    if (error) throw new Error(`Leave-In calibration read ${table}: ${error.message}`)
    return (data?.[0] as Record<string, unknown> | undefined) ?? null
  }

  async function selectMany(table: string, productId: string) {
    const { data, error } = await client.from(table).select("*").eq("product_id", productId)
    if (error) throw new Error(`Leave-In calibration read ${table}: ${error.message}`)
    return (data ?? []) as Array<Record<string, unknown>>
  }

  return {
    async liveRows(productId: string): Promise<LeaveInCalibrationLiveRows> {
      const { data: productRows, error: productError } = await client
        .from("products")
        .select("*")
        .eq("id", productId)
      if (productError)
        throw new Error(`Leave-In calibration read products: ${productError.message}`)

      const [specs, fitSpecs, eligibility, protocols, dispositions] = await Promise.all([
        selectOne("product_leave_in_specs", productId),
        selectOne("product_leave_in_fit_specs", productId),
        selectMany("product_leave_in_eligibility", productId),
        selectMany("product_application_protocols", productId),
        // Publication-predicate parity only: both SQL assertion halves exempt a
        // product carrying a search disposition from the required-role check.
        selectMany("personal_plan_product_search_dispositions", productId),
      ])

      return {
        product: (productRows?.[0] as Record<string, unknown> | undefined) ?? null,
        specs,
        fitSpecs,
        eligibility,
        protocols,
        dispositions,
      }
    },
    async appliedLedger(batchId: string) {
      const { data, error } = await client
        .from("catalog_enrichment_applied_items")
        .select("batch_id,product_key,batch_fingerprint,content_fingerprint,product_id,reviewed_by")
        .eq("batch_id", batchId)
      if (error)
        throw new Error(
          `Leave-In calibration read catalog_enrichment_applied_items: ${error.message}`,
        )
      return (data ?? []) as LeaveInCalibrationLedgerRow[]
    },
  }
}

export function leaveInCalibrationReadAdapter(): LeaveInCalibrationReadAdapter {
  const client = createSupabaseClientFromEnv()
  assertLeaveInCalibrationProject(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
  return createLeaveInCalibrationReadAdapter(client)
}

/**
 * Write half. Deliberately a single method: the cohort's only write path is the
 * fingerprint-pinned executor RPC, mirroring `createHeatClientAdapters`, which
 * likewise never exposes a generic table writer.
 */
export function createLeaveInCalibrationWriteAdapter(
  client: SupabaseClient,
): LeaveInCalibrationWriteAdapter {
  return {
    async rpc(name, args) {
      const { error } = await client.rpc(name, args)
      if (error) throw new Error(`${name}: ${error.message}`)
    },
  }
}

export function leaveInCalibrationWriteAdapter(): LeaveInCalibrationWriteAdapter {
  const client = createSupabaseClientFromEnv()
  assertLeaveInCalibrationProject(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
  return createLeaveInCalibrationWriteAdapter(client)
}
