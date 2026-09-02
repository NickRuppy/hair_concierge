import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"

import { createSupabaseClientFromEnv, flag, flagBool, parseArgs } from "../cli"

/**
 * Apply for the Scan DB Expansion batch adapter (T5).
 *
 * Invokes `public.apply_scan_expansion_batch_v1` ONCE PER ITEM. That is not a
 * convenience: the curated publication gate is a set of DEFERRABLE INITIALLY
 * DEFERRED constraint triggers that only fire at COMMIT, so one call per item is
 * what makes "a failing product fails alone" true (F-04).
 *
 * Usage:
 *   npm run products:intake:expansion:apply -- \
 *     --batch <path> --reviewed-by nick --reviewed-head <40-hex sha> --confirm
 */

type BatchItem = { item_key: string; kind: string }
type RpcRow = {
  item_key: string
  product_id: string
  outcome: string
  identifier_count: number
}

async function main() {
  const args = parseArgs()
  const batchPath = flag(args, "batch")
  const reviewedBy = flag(args, "reviewed-by")
  const reviewedHead = flag(args, "reviewed-head")
  const onlyItem = flag(args, "item")

  if (!batchPath || !reviewedBy || !reviewedHead) {
    process.stderr.write(
      "Usage: products:intake:expansion:apply -- --batch <path> --reviewed-by nick --reviewed-head <sha> --confirm\n",
    )
    process.exitCode = 1
    return
  }
  if (reviewedBy !== "nick") {
    process.stderr.write("Refusing to apply: --reviewed-by must be nick.\n")
    process.exitCode = 1
    return
  }
  if (!/^[a-f0-9]{40}$/.test(reviewedHead)) {
    process.stderr.write("Refusing to apply: --reviewed-head must be a 40-char lowercase sha.\n")
    process.exitCode = 1
    return
  }

  // The RPC fingerprints the RAW bytes, so the file is never re-serialized.
  const batchJson = await readFile(batchPath, "utf8")
  const fingerprint = createHash("sha256").update(batchJson, "utf8").digest("hex")
  const batch = JSON.parse(batchJson) as { batch_id: string; items: BatchItem[] }
  const items = onlyItem ? batch.items.filter((item) => item.item_key === onlyItem) : batch.items

  process.stdout.write(`Batch: ${batch.batch_id} (${batchPath})\n`)
  process.stdout.write(`Fingerprint: ${fingerprint}\n`)
  process.stdout.write(`Reviewed head: ${reviewedHead}\n`)
  process.stdout.write(`Items to apply: ${items.length}\n\n`)

  if (!flagBool(args, "confirm")) {
    process.stdout.write("Dry run — re-run with --confirm to execute.\n")
    return
  }

  const client = createSupabaseClientFromEnv()
  let applied = 0
  let replayed = 0
  const failures: Array<{ item_key: string; message: string }> = []

  for (const item of items) {
    const { data, error } = await client.rpc("apply_scan_expansion_batch_v1", {
      p_batch_json: batchJson,
      p_expected_batch_fingerprint: fingerprint,
      p_reviewed_head: reviewedHead,
      p_reviewed_by: reviewedBy,
      p_item_key: item.item_key,
      p_execution_enabled: true,
    })
    if (error) {
      failures.push({ item_key: item.item_key, message: error.message })
      process.stdout.write(`  [FAILED]   ${item.item_key} — ${error.message}\n`)
      continue
    }
    const rows = (data ?? []) as RpcRow[]
    for (const row of rows) {
      if (row.outcome === "replayed") replayed += 1
      else applied += 1
      process.stdout.write(
        `  [${row.outcome.toUpperCase().padEnd(8)}] ${row.item_key} → ${row.product_id} (+${row.identifier_count} identifiers)\n`,
      )
    }
  }

  process.stdout.write(
    `\nApplied: ${applied} · Replayed: ${replayed} · Failed: ${failures.length}\n`,
  )
  if (failures.length > 0) {
    process.stdout.write(
      "Each failure rolled back on its own; committed products are unaffected.\n",
    )
    process.exitCode = 1
  }
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
  process.exitCode = 1
})
