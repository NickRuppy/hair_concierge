import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  prepareScannerContext,
  type ScannerSourceRead,
  type PreparedScannerContext,
} from "./scanner-context"

export async function loadSharedScannerContext(
  client: SupabaseClient,
  userId: string,
): Promise<{
  prepared: PreparedScannerContext
  source: ScannerSourceRead
  contextRevision: string
} | null> {
  // Both RPCs are service_role-only. The verified session UID comes from the
  // route; no body field or user metadata can select another profile.
  const { data, error } = await client.rpc("scanner_context_read_source", { p_user_id: userId })
  if (
    error ||
    !data ||
    data.userId !== userId ||
    !/^\d+$/.test(data.sourceRevision) ||
    !/^\d+$/.test(data.profileRevision)
  ) {
    throw new Error("scan_profile_context_unavailable")
  }
  const source = data as ScannerSourceRead
  const prepared = prepareScannerContext(source)
  if (!prepared) return null
  const { data: published, error: publishError } = await client.rpc("scanner_context_publish", {
    p_user_id: userId,
    p_expected_source_revision: source.sourceRevision,
    p_source_hash: prepared.sourceHash,
    p_engine_version: prepared.snapshot.computationVersion,
    p_input_snapshot: {
      source: prepared.source,
      userRefinementAnswers: prepared.userRefinementAnswers,
      assumedQuestionIds: prepared.assumedQuestionIds,
    },
    p_output_snapshot: prepared.snapshot,
    p_snapshot_source: prepared.snapshotSource,
  })
  if (
    publishError ||
    published?.outcome !== "ready" ||
    typeof published.contextRevision !== "string"
  ) {
    throw new Error("scan_profile_context_unavailable")
  }
  return {
    prepared: { ...prepared, refinedVersionId: published.contextRevision },
    source,
    contextRevision: published.contextRevision,
  }
}
