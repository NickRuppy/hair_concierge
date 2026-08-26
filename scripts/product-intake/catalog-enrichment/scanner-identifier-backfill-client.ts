import { execFile } from "node:child_process"
import { sep } from "node:path"
import { promisify } from "node:util"

import {
  type ScannerBackfillBatchLedgerRow,
  type ScannerBackfillIdentifierRow,
  type ScannerBackfillItemLedgerRow,
  type ScannerBackfillProductRow,
} from "@/lib/product-intake/catalog-enrichment/scanner-identifier-backfill"
import { createSupabaseClientFromEnv } from "../cli"

const execFileAsync = promisify(execFile)

export function scannerIdentifierBackfillProjectIdFromUrl(value: string): string {
  try {
    return new URL(value).hostname.split(".")[0] ?? ""
  } catch {
    return ""
  }
}

export function scannerIdentifierBackfillSupabaseWorkdir(cwd = process.cwd()): string {
  const worktreeMarker = `${sep}.worktrees${sep}`
  const markerIndex = cwd.indexOf(worktreeMarker)
  return markerIndex === -1 ? cwd : cwd.slice(0, markerIndex)
}

export function parseScannerIdentifierBackfillLinkedMigrationState(
  output: string,
  migration: string,
): "absent" | "applied" {
  const version = migration.match(/^\d{14}/)?.[0]
  if (!version) throw new Error(`scanner migration has no timestamp version: ${migration}`)
  let remoteMatches = 0
  for (const line of output.split("\n")) {
    const row = line.match(/^\s*(\d{14})?\s*(?:│|\|)\s*(\d{14})?\s*(?:│|\|)/)
    if (row?.[2] === version) remoteMatches += 1
  }
  if (remoteMatches > 1)
    throw new Error(`linked migration list has duplicate remote scanner migration ${version}`)
  return remoteMatches === 1 ? "applied" : "absent"
}

export async function scannerIdentifierBackfillGitState() {
  const [head, branch, status] = await Promise.all([
    execFileAsync("git", ["rev-parse", "HEAD"]),
    execFileAsync("git", ["branch", "--show-current"]),
    execFileAsync("git", ["status", "--porcelain", "--untracked-files=all"]),
  ])
  return {
    head: head.stdout.trim(),
    branch: branch.stdout.trim(),
    clean: status.stdout.trim().length === 0,
  }
}

export function scannerIdentifierBackfillAdapters() {
  const client = createSupabaseClientFromEnv()
  let migrationOutput: Promise<string> | undefined
  async function linkedMigrations() {
    migrationOutput ??= execFileAsync("npm", [
      "exec",
      "--",
      "supabase",
      "migration",
      "list",
      "--linked",
      "--workdir",
      scannerIdentifierBackfillSupabaseWorkdir(),
    ]).then(({ stdout }) => stdout)
    return migrationOutput
  }
  return {
    read: {
      async listProducts(productIds: readonly string[]) {
        const { data, error } = await client
          .from("products")
          .select("id,name,brand,category_key,is_active,lifecycle_status")
          .in("id", [...productIds])
        if (error) throw new Error(`scanner product read failed: ${error.message}`)
        return (data ?? []) as ScannerBackfillProductRow[]
      },
      async listIdentifiers(canonicalGtins: readonly string[]) {
        const { data, error } = await client
          .from("product_identifiers")
          .select("product_id,identifier_type,identifier_value,canonical_gtin14,source")
          .in("canonical_gtin14", [...canonicalGtins])
        if (error) throw new Error(`scanner identifier read failed: ${error.message}`)
        return (data ?? []) as ScannerBackfillIdentifierRow[]
      },
      async listBatchLedger(batchId: string) {
        const { data, error } = await client
          .from("scanner_identifier_backfill_batches")
          .select("batch_id,batch_fingerprint,reviewed_head,reviewed_by,product_count,gtin_count")
          .eq("batch_id", batchId)
        if (error) throw new Error(`scanner batch ledger read failed: ${error.message}`)
        return (data ?? []) as ScannerBackfillBatchLedgerRow[]
      },
      async listItemLedger(batchId: string) {
        const { data, error } = await client
          .from("scanner_identifier_backfill_items")
          .select("batch_id,item_key,content_fingerprint,product_id,identifier_count")
          .eq("batch_id", batchId)
        if (error) throw new Error(`scanner item ledger read failed: ${error.message}`)
        return (data ?? []) as ScannerBackfillItemLedgerRow[]
      },
      async migrationState(version: string) {
        return parseScannerIdentifierBackfillLinkedMigrationState(await linkedMigrations(), version)
      },
    },
    write: {
      async apply(args: {
        p_batch_json: string
        p_expected_batch_fingerprint: string
        p_reviewed_head: string
        p_reviewed_by: "nick"
        p_execution_enabled: true
      }) {
        const { data, error } = await client.rpc(
          "apply_scanner_existing_identifier_backfill_v1",
          args,
        )
        if (error) throw new Error(`scanner identifier RPC failed: ${error.message}`)
        return data
      },
    },
  }
}
