import { decodeStoredToolRows } from "../tools/decode-stored"
import { routinePayloadSchema, type RoutinePayload } from "./contracts"

/**
 * The one read boundary for a stored Routine payload.
 *
 * Two things happen here that a bare `routinePayloadSchema.parse` cannot do:
 *
 * 1. Branch-era V2 rows carry the pre-`D7` Tool anchor shape and no
 *    `sessionKey`. They are mapped forward by the Tool decoders before parsing
 *    (see `tools/decode-stored.ts`).
 * 2. If the Tool slice is STILL invalid, the Routine degrades to product-only
 *    instead of failing. Tools is an unshipped, default-off addition; it may
 *    never take the released Routine down with it. The stored row is untouched.
 *
 * A failure in the product half is a real failure and still throws.
 */
export function parseStoredRoutinePayload(raw: unknown): RoutinePayload {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return routinePayloadSchema.parse(raw)
  }
  const record = raw as Record<string, unknown>
  if (record.schemaVersion !== 2) return routinePayloadSchema.parse(raw)

  const decodedRows = decodeStoredToolRows({
    assets: record.toolAssets,
    occurrences: record.toolOccurrences,
    guidance: record.toolGuidance,
  })
  const decoded = {
    ...record,
    toolAssets: decodedRows.assets,
    toolOccurrences: decodedRows.occurrences,
    toolGuidance: decodedRows.guidance,
  }
  const parsed = routinePayloadSchema.safeParse(decoded)
  if (parsed.success) return parsed.data

  const productOnly = routinePayloadSchema.safeParse(withoutStoredToolRows(record))
  if (productOnly.success) {
    console.warn("personal_plan_routine_tool_slice_dropped", {
      planId: typeof record.planId === "string" ? record.planId : null,
      versionId: typeof record.versionId === "string" ? record.versionId : null,
      issue: parsed.error.issues[0]?.message ?? "invalid_tool_slice",
    })
    return productOnly.data
  }
  // The product half is what failed; that is not a Tools degradation.
  return routinePayloadSchema.parse(decoded)
}

function withoutStoredToolRows(record: Record<string, unknown>): Record<string, unknown> {
  const rest = { ...record }
  delete rest.toolAssets
  delete rest.toolOccurrences
  delete rest.toolGuidance
  return { ...rest, schemaVersion: 1 }
}

/**
 * Removes the Tool projection from an already-parsed payload.
 *
 * This is the rollout contract, not a migration: stored Tool FACTS are
 * preserved untouched, and only what a gated-off owner would otherwise SEE is
 * dropped. A V1 payload passes through unchanged.
 */
export function stripRoutineToolPayload(payload: RoutinePayload): RoutinePayload {
  if (payload.schemaVersion !== 2) return payload
  const { toolAssets, toolOccurrences, toolGuidance, ...rest } = payload
  void toolAssets
  void toolOccurrences
  void toolGuidance
  return { ...rest, schemaVersion: 1 }
}
