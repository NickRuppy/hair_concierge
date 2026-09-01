import { execFile } from "node:child_process"
import { sep } from "node:path"
import { promisify } from "node:util"

import {
  type ScannerBackfillBatchLedgerRow,
  type ScannerBackfillIdentifierRow,
  type ScannerBackfillItemLedgerRow,
  type ScannerBackfillOpenSubmissionIdentifierRow,
  type ScannerBackfillProductRow,
} from "@/lib/product-intake/catalog-enrichment/scanner-identifier-backfill"
import { canonicalizeGtin } from "@/lib/product-identity/normalize"
import { createSupabaseClientFromEnv } from "../cli"

const execFileAsync = promisify(execFile)
const CLOSED_SUBMISSION_STATUSES = new Set([
  "approved",
  "matched_existing",
  "rejected",
  "cancelled_by_user",
])

type SubmissionIdentifierSourceRow = {
  id: string
  status: string
  scanned_identifier_type: string | null
  scanned_identifier_value: string | null
  researched_payload: unknown
}

function canonicalGtin(value: unknown): string | null {
  return typeof value === "string" ? canonicalizeGtin(value) : null
}

function isCanonicalGtinType(value: unknown): boolean {
  return (
    typeof value === "string" && ["ean", "gtin", "barcode"].includes(value.trim().toLowerCase())
  )
}

export function scannerIdentifierBackfillOpenSubmissionIdentifiers(
  row: SubmissionIdentifierSourceRow,
): ScannerBackfillOpenSubmissionIdentifierRow | null {
  if (CLOSED_SUBMISSION_STATUSES.has(row.status)) return null
  const canonicalGtins = new Set<string>()
  if (isCanonicalGtinType(row.scanned_identifier_type)) {
    const scanned = canonicalGtin(row.scanned_identifier_value)
    if (scanned) canonicalGtins.add(scanned)
  }
  const payload = row.researched_payload
  const final =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as { final?: unknown }).final
      : null
  const identifiers =
    final && typeof final === "object" && !Array.isArray(final)
      ? (final as { identifiers?: unknown }).identifiers
      : null
  if (Array.isArray(identifiers)) {
    for (const identifier of identifiers) {
      if (!identifier || typeof identifier !== "object" || Array.isArray(identifier)) continue
      const value = identifier as {
        type?: unknown
        value?: unknown
        identifier_type?: unknown
        identifier_value?: unknown
      }
      if (!isCanonicalGtinType(value.type ?? value.identifier_type)) continue
      const canonical = canonicalGtin(value.value ?? value.identifier_value)
      if (canonical) canonicalGtins.add(canonical)
    }
  }
  return {
    submission_id: row.id,
    status: row.status,
    canonical_gtin14s: [...canonicalGtins].sort(),
  }
}

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
      async listOpenSubmissionIdentifiers() {
        const submissions: ScannerBackfillOpenSubmissionIdentifierRow[] = []
        const pageSize = 1000
        for (let offset = 0; ; offset += pageSize) {
          const { data, error } = await client
            .from("product_submissions")
            .select("id,status,scanned_identifier_type,scanned_identifier_value,researched_payload")
            .not("status", "in", "(approved,matched_existing,rejected,cancelled_by_user)")
            .order("id", { ascending: true })
            .range(offset, offset + pageSize - 1)
          if (error) throw new Error(`scanner submission read failed: ${error.message}`)
          const page = (data ?? []) as SubmissionIdentifierSourceRow[]
          for (const row of page) {
            const submission = scannerIdentifierBackfillOpenSubmissionIdentifiers(row)
            if (submission) submissions.push(submission)
          }
          if (page.length < pageSize) return submissions
        }
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
