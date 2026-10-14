import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  prepareScannerContext,
  type ScannerSourceRead,
  type PreparedScannerContext,
} from "./scanner-context"

export async function readScannerProfileSource(
  client: SupabaseClient,
  userId: string,
): Promise<ScannerSourceRead> {
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
  return data as ScannerSourceRead
}

export async function loadSharedScannerContext(
  client: SupabaseClient,
  userId: string,
): Promise<{
  prepared: PreparedScannerContext
  source: ScannerSourceRead
  contextRevision: string
} | null> {
  const source = await readScannerProfileSource(client, userId)
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
      userRefinementQuestionIds: prepared.userRefinementQuestionIds,
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
  // Keep the usable edited context while making rejected paid publications
  // visible to operators. No identity, quiz answers or tokens enter this event.
  if (prepared.rejectedPaidSources?.length) {
    console.warn("scanner_context_source_conflict", {
      sourceRevision: source.sourceRevision,
      profileRevision: source.profileRevision,
      rejectedPaidSources: prepared.rejectedPaidSources,
    })
  }
  return {
    prepared: { ...prepared, refinedVersionId: published.contextRevision },
    source,
    contextRevision: published.contextRevision,
  }
}
