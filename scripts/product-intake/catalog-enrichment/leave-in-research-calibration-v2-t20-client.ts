import type { SupabaseClient } from "@supabase/supabase-js"

import type { LeaveInV2T20WriteAdapter } from "@/lib/product-intake/catalog-enrichment/leave-in-research-calibration-v2-t20"
import { createSupabaseClientFromEnv } from "../cli"
import { assertLeaveInCalibrationProject } from "./leave-in-research-calibration-client"

// The read half is shared with the v1 lane (`leaveInCalibrationReadAdapter`): the
// same live rows, the same ledger table. Only the write half is batch-specific.

/**
 * Write half. A single method: the batch's only write path is the
 * fingerprint-pinned v2-t20 executor RPC; no generic table writer is reachable.
 */
export function createLeaveInCalibrationV2T20WriteAdapter(
  client: SupabaseClient,
): LeaveInV2T20WriteAdapter {
  return {
    async rpc(name, args) {
      const { error } = await client.rpc(name, args)
      if (error) throw new Error(`${name}: ${error.message}`)
    },
  }
}

export function leaveInCalibrationV2T20WriteAdapter(): LeaveInV2T20WriteAdapter {
  const client = createSupabaseClientFromEnv()
  assertLeaveInCalibrationProject(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
  return createLeaveInCalibrationV2T20WriteAdapter(client)
}
