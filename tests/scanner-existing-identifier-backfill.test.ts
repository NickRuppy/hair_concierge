import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  applyScannerIdentifierBackfill,
  parseScannerIdentifierBackfillArgs,
  parseScannerIdentifierBackfillManifest,
  preflightScannerIdentifierBackfill,
  SCANNER_IDENTIFIER_BACKFILL_BRANCH,
  SCANNER_IDENTIFIER_BACKFILL_APPROVED_FINGERPRINTS,
  SCANNER_IDENTIFIER_BACKFILL_PROJECT_ID,
  scannerIdentifierBackfillFingerprint,
  type ScannerIdentifierBackfillReadAdapter,
} from "@/lib/product-intake/catalog-enrichment/scanner-identifier-backfill"
import { catalogEnrichmentFingerprint } from "@/lib/product-intake/catalog-enrichment"
import {
  parseScannerIdentifierBackfillLinkedMigrationState,
  scannerIdentifierBackfillOpenSubmissionIdentifiers,
  scannerIdentifierBackfillSupabaseWorkdir,
} from "../scripts/product-intake/catalog-enrichment/scanner-identifier-backfill-client"

function gtin(body: string): string {
  const weighted = body
    .split("")
    .reverse()
    .reduce((sum, digit, index) => sum + Number(digit) * (index % 2 === 0 ? 3 : 1), 0)
  return `${body}${(10 - (weighted % 10)) % 10}`
}

function manifest(batch: "E1" | "E2", count: number, gtinCount: number) {
  const items = Array.from({ length: count }, (_, index) => {
    const productId = `${String(index + 1).padStart(8, "0")}-1111-4111-8111-${String(index + 1).padStart(12, "0")}`
    const identifierCount = index < gtinCount - count ? 2 : 1
    const item = {
      item_key: `${batch.toLowerCase()}-product-${index + 1}`,
      product_id: productId,
      expected_product: {
        name: `Product ${index + 1}`,
        brand: index % 2 ? null : `Brand ${index + 1}`,
        category_key: "shampoo",
        is_active: index % 3 !== 0,
        lifecycle_status: index % 3 !== 0 ? "active" : "inactive",
      },
      identifiers: Array.from({ length: identifierCount }, (_, identifierIndex) => {
        const value = gtin(String(10_000_000_000 + index * 10 + identifierIndex))
        return {
          type: identifierIndex % 2 ? "barcode" : "ean",
          value,
          raw_gtin: value,
          source_url: `https://example.test/products/${index + 1}`,
        }
      }),
    }
    return { ...item, content_fingerprint: catalogEnrichmentFingerprint(item) }
  })
  return JSON.stringify({
    schema_version: "scanner-existing-identifier-backfill-v1",
    batch_id: `scanner-existing-identifiers-${batch.toLowerCase()}-v1`,
    batch: batch,
    items,
  })
}

test("computes the batch fingerprint over the exact raw UTF-8 bytes", () => {
  const raw = manifest("E1", 20, 21)
  assert.equal(
    scannerIdentifierBackfillFingerprint(raw),
    createHash("sha256").update(raw, "utf8").digest("hex"),
  )
  assert.notEqual(
    scannerIdentifierBackfillFingerprint(`${raw}\n`),
    scannerIdentifierBackfillFingerprint(raw),
  )
})

test("uses the linked primary checkout for Supabase migration checks from a task worktree", () => {
  assert.equal(
    scannerIdentifierBackfillSupabaseWorkdir(
      "/Users/nick/AI_work/hair_conscierge/.worktrees/scanner-catalog-coverage-plan",
    ),
    "/Users/nick/AI_work/hair_conscierge",
  )
  assert.equal(
    scannerIdentifierBackfillSupabaseWorkdir("/Users/nick/AI_work/hair_conscierge"),
    "/Users/nick/AI_work/hair_conscierge",
  )
  assert.equal(
    parseScannerIdentifierBackfillLinkedMigrationState(
      "                  | 20260826142000 | 2026-08-26 14:20:00\n",
      "20260826142000",
    ),
    "applied",
  )
  assert.equal(
    parseScannerIdentifierBackfillLinkedMigrationState(
      "   20260826142000 |                | 2026-08-26 14:20:00\n",
      "20260826142000",
    ),
    "absent",
  )
})

test("accepts the two approved cohort shapes and canonicalizes all GTINs", () => {
  const first = parseScannerIdentifierBackfillManifest(manifest("E1", 20, 21)) as {
    items: unknown[]
    canonical_gtins: string[]
  }
  const second = parseScannerIdentifierBackfillManifest(manifest("E2", 21, 22)) as {
    items: unknown[]
    canonical_gtins: string[]
  }
  assert.equal(first.items.length, 20)
  assert.equal(first.canonical_gtins.length, 21)
  assert.equal(second.items.length, 21)
  assert.equal(second.canonical_gtins.length, 22)
})

test("loads the reviewed E1-E7 files with their exact pinned raw fingerprints", () => {
  for (const [batch, filename] of [
    ["E1", "phase1-existing-identifier-backfill-e1-v2.json"],
    ["E2", "phase1-existing-identifier-backfill-e2-v2.json"],
    ["E3", "phase1-existing-identifier-backfill-e3-v1.json"],
    ["E4", "phase1-existing-identifier-backfill-e4-v1.json"],
    ["E5", "phase1-existing-identifier-backfill-e5-v1.json"],
    ["E6", "phase1-existing-identifier-backfill-e6-v1.json"],
    ["E7", "phase1-existing-identifier-backfill-e7-v1.json"],
  ] as const) {
    const raw = readFileSync(`data/scanner-catalog-coverage/2026-08-26/${filename}`, "utf8")
    const parsed = parseScannerIdentifierBackfillManifest(raw)
    assert.equal(parsed.batch, batch)
    assert.equal(parsed.batch_fingerprint, SCANNER_IDENTIFIER_BACKFILL_APPROVED_FINGERPRINTS[batch])
  }
})

test("accepts only exact E3-E7 shapes", () => {
  for (const [batch, products, gtins] of [
    ["E3", 17, 17],
    ["E4", 20, 21],
    ["E5", 19, 20],
    ["E6", 19, 19],
    ["E7", 15, 15],
  ] as const) {
    const raw = readFileSync(
      `data/scanner-catalog-coverage/2026-08-26/phase1-existing-identifier-backfill-${batch.toLowerCase()}-v1.json`,
      "utf8",
    )
    const parsed = parseScannerIdentifierBackfillManifest(raw)
    assert.equal(parsed.items.length, products)
    assert.equal(parsed.canonical_gtins.length, gtins)
    const wrongShape = JSON.parse(raw)
    wrongShape.items.pop()
    assert.throws(
      () => parseScannerIdentifierBackfillManifest(JSON.stringify(wrongShape)),
      new RegExp(`${batch} must contain exactly ${products} products`, "i"),
    )
  }
})

test("rejects a transaction over 25 products and an invalid checksum", () => {
  assert.throws(() => parseScannerIdentifierBackfillManifest(manifest("E2", 26, 26)), /at most 25/i)
  const parsed = JSON.parse(manifest("E1", 20, 21))
  parsed.items[0].identifiers[0].value = "4006381333930"
  assert.throws(
    () => parseScannerIdentifierBackfillManifest(JSON.stringify(parsed)),
    /valid gs1|checksum/i,
  )
})

test("requires each frozen identifier's value", () => {
  const parsed = JSON.parse(manifest("E1", 20, 21))
  delete parsed.items[0].identifiers[0].value
  assert.throws(() => parseScannerIdentifierBackfillManifest(JSON.stringify(parsed)), /value/)
})

test("rejects drift-prone manifests without exact lifecycle, source URL, and content hash", () => {
  type MutableManifest = {
    items: Array<{
      expected_product: { lifecycle_status?: string }
      identifiers: Array<{ source_url: string }>
      content_fingerprint: string
    }>
  }
  for (const mutate of [
    (value: MutableManifest) => delete value.items[0].expected_product.lifecycle_status,
    (value: MutableManifest) =>
      (value.items[0].identifiers[0].source_url = "http://example.test/nope"),
    (value: MutableManifest) => (value.items[0].content_fingerprint = "0".repeat(64)),
  ]) {
    const parsed = JSON.parse(manifest("E1", 20, 21)) as MutableManifest
    mutate(parsed)
    assert.throws(() => parseScannerIdentifierBackfillManifest(JSON.stringify(parsed)))
  }
})

test("apply arguments are fail-closed and pin all exact raw manifest fingerprints", () => {
  assert.deepEqual(SCANNER_IDENTIFIER_BACKFILL_APPROVED_FINGERPRINTS, {
    E1: "0002bbd596cc88acff0982ef147341d87d6c39a26a4b0709efd68aa48e733522",
    E2: "aa3c2a026c1a372e963f47d47e9c611d1b8dd8ca9edf0c334390a56443fda147",
    E3: "ef20870b5c5ca23b001cea92ce33524c6f1f2416f5e39225237ef05eb5fc7134",
    E4: "6335df5709bde47fadb5c2740ca96866d461d6a37fe192a989c66ca0773a2436",
    E5: "8b94a3a22d1e5554d00f84c9858b16a66d73afc3f24adbf7499f43d5d4a08136",
    E6: "92def27ab25378987eb0c9e01f7d4818c886b9b63363716410658cf6cb4ae903",
    E7: "c705507449cea92051853b15f1995f03d4b42b1fecdb1e439b8732d46c557e5e",
  })
  assert.throws(() => parseScannerIdentifierBackfillArgs(["--apply"]), /confirm-project/i)
  assert.throws(
    () =>
      parseScannerIdentifierBackfillArgs([
        "--apply",
        "--confirm-project=pqdkhefxsxkyeqelqegq",
        `--approved-fingerprint=${"a".repeat(64)}`,
        `--reviewed-head=${"b".repeat(40)}`,
      ]),
    /reviewer/i,
  )
  const dryRun = parseScannerIdentifierBackfillArgs(["--manifest=cohort.json"]) as {
    apply: boolean
  }
  assert.equal(dryRun.apply, false)
})

function reviewedE1() {
  return parseScannerIdentifierBackfillManifest(
    readFileSync(
      "data/scanner-catalog-coverage/2026-08-26/phase1-existing-identifier-backfill-e1-v2.json",
      "utf8",
    ),
  )
}

function readAdapter(
  manifest: ReturnType<typeof reviewedE1>,
  overrides: Partial<ScannerIdentifierBackfillReadAdapter> = {},
): ScannerIdentifierBackfillReadAdapter {
  return {
    async listProducts() {
      return manifest.items.map((item) => ({ id: item.product_id, ...item.expected_product }))
    },
    async listIdentifiers() {
      return []
    },
    async listOpenSubmissionIdentifiers() {
      return []
    },
    async listBatchLedger() {
      return []
    },
    async listItemLedger() {
      return []
    },
    async migrationState() {
      return "applied"
    },
    ...overrides,
  }
}

test("cohorts require only their applied executor migrations before reading live state", async () => {
  for (const [batch, missing] of [
    ["e1-v2", null],
    ["e3-v1", "20260828081500"],
    ["e4-v1", "20260828083000"],
  ] as const) {
    const manifest = parseScannerIdentifierBackfillManifest(
      readFileSync(
        `data/scanner-catalog-coverage/2026-08-26/phase1-existing-identifier-backfill-${batch}.json`,
        "utf8",
      ),
    )
    const result = await preflightScannerIdentifierBackfill({
      manifest,
      args: { apply: false, reviewed_head: "b".repeat(40) },
      read: readAdapter(manifest, {
        async migrationState(version) {
          return version === missing ? "absent" : "applied"
        },
      }),
      gitState: async () => ({
        head: "b".repeat(40),
        branch: SCANNER_IDENTIFIER_BACKFILL_BRANCH,
        clean: true,
      }),
      projectId: SCANNER_IDENTIFIER_BACKFILL_PROJECT_ID,
    })
    assert.deepEqual(
      result.blockers,
      missing ? [`required migration ${missing} is not applied`] : [],
    )
    assert.equal(result.ok, missing === null)
  }
})

test("preflight requires exact clean branch/head, live identity, migrations, and global ownership", async () => {
  const manifest = reviewedE1()
  const args = parseScannerIdentifierBackfillArgs([
    `--manifest=unused.json`,
    `--reviewed-head=${"b".repeat(40)}`,
  ])
  const baseline = await preflightScannerIdentifierBackfill({
    manifest,
    args,
    read: readAdapter(manifest),
    gitState: async () => ({
      head: "b".repeat(40),
      branch: SCANNER_IDENTIFIER_BACKFILL_BRANCH,
      clean: true,
    }),
    projectId: SCANNER_IDENTIFIER_BACKFILL_PROJECT_ID,
  })
  assert.deepEqual(baseline, { ok: true, blockers: [], replay: false })

  const collision = await preflightScannerIdentifierBackfill({
    manifest,
    args,
    read: readAdapter(manifest, {
      async listIdentifiers() {
        const identifier = manifest.items[0].identifiers[0]
        return [
          {
            product_id: "90000000-1111-4111-8111-000000000009",
            identifier_type: identifier.type,
            identifier_value: identifier.value,
            canonical_gtin14: identifier.canonical_gtin14,
          },
        ]
      },
    }),
    gitState: async () => ({ head: "a".repeat(40), branch: "main", clean: false }),
    projectId: "wrong-project",
  })
  assert.equal(collision.ok, false)
  assert.match(collision.blockers.join("; "), /project|clean|branch|HEAD|owner collision/i)
})

test("sanitizes open-submission identifiers and excludes closed statuses", () => {
  const first = gtin("400638133393")
  const second = gtin("761303462684")
  const retailerSku = gtin("590123412345")
  assert.deepEqual(
    scannerIdentifierBackfillOpenSubmissionIdentifiers({
      id: "open-submission",
      status: "research_complete",
      scanned_identifier_type: " EAN ",
      scanned_identifier_value: first,
      researched_payload: {
        final: {
          identifiers: [
            { type: "barcode", value: second },
            { identifier_type: "ean", identifier_value: first },
            { type: "retailer_sku", value: retailerSku },
            { type: "ean", value: "4006381333930" },
          ],
        },
      },
    }),
    {
      submission_id: "open-submission",
      status: "research_complete",
      canonical_gtin14s: [`0${first}`, `0${second}`].sort(),
    },
  )
  for (const status of ["approved", "matched_existing", "rejected", "cancelled_by_user"]) {
    assert.equal(
      scannerIdentifierBackfillOpenSubmissionIdentifiers({
        id: "closed-submission",
        status,
        scanned_identifier_type: "ean",
        scanned_identifier_value: first,
        researched_payload: {},
      }),
      null,
    )
  }
  assert.deepEqual(
    scannerIdentifierBackfillOpenSubmissionIdentifiers({
      id: "retailer-sku-only",
      status: "queued",
      scanned_identifier_type: "retailer_sku",
      scanned_identifier_value: retailerSku,
      researched_payload: {},
    }),
    {
      submission_id: "retailer-sku-only",
      status: "queued",
      canonical_gtin14s: [],
    },
  )
})

test("preflight blocks a second researched identifier held by an unresolved submission", async () => {
  const manifest = reviewedE1()
  const secondIdentifier = manifest.items.find((item) => item.identifiers.length > 1)!
    .identifiers[1]
  const result = await preflightScannerIdentifierBackfill({
    manifest,
    args: parseScannerIdentifierBackfillArgs([
      "--manifest=unused.json",
      `--reviewed-head=${"b".repeat(40)}`,
    ]),
    read: readAdapter(manifest, {
      async listOpenSubmissionIdentifiers() {
        return [
          {
            submission_id: "open-submission-researched-second-identifier",
            status: "research_complete",
            canonical_gtin14s: [secondIdentifier.canonical_gtin14],
          },
        ]
      },
    }),
    gitState: async () => ({
      head: "b".repeat(40),
      branch: SCANNER_IDENTIFIER_BACKFILL_BRANCH,
      clean: true,
    }),
    projectId: SCANNER_IDENTIFIER_BACKFILL_PROJECT_ID,
  })
  assert.equal(result.ok, false)
  assert.match(result.blockers.join("; "), /open submission.*second-identifier/i)
})

test("preflight blocks an unresearched scanned identifier held by an unresolved submission", async () => {
  const manifest = reviewedE1()
  const scannedIdentifier = manifest.items[1].identifiers[0]
  const result = await preflightScannerIdentifierBackfill({
    manifest,
    args: parseScannerIdentifierBackfillArgs([
      "--manifest=unused.json",
      `--reviewed-head=${"b".repeat(40)}`,
    ]),
    read: readAdapter(manifest, {
      async listOpenSubmissionIdentifiers() {
        return [
          {
            submission_id: "open-submission-unresearched-scan",
            status: "queued",
            canonical_gtin14s: [scannedIdentifier.canonical_gtin14],
          },
        ]
      },
    }),
    gitState: async () => ({
      head: "b".repeat(40),
      branch: SCANNER_IDENTIFIER_BACKFILL_BRANCH,
      clean: true,
    }),
    projectId: SCANNER_IDENTIFIER_BACKFILL_PROJECT_ID,
  })
  assert.equal(result.ok, false)
  assert.match(result.blockers.join("; "), /open submission.*unresearched-scan/i)
})

test("preflight reports absent migrations without querying not-yet-created schema", async () => {
  const manifest = reviewedE1()
  let schemaReads = 0
  const blocked = await preflightScannerIdentifierBackfill({
    manifest,
    args: parseScannerIdentifierBackfillArgs([
      "--manifest=unused.json",
      `--reviewed-head=${"b".repeat(40)}`,
    ]),
    read: readAdapter(manifest, {
      async migrationState() {
        return "absent"
      },
      async listProducts() {
        schemaReads += 1
        throw new Error("products should not be queried")
      },
      async listIdentifiers() {
        schemaReads += 1
        throw new Error("canonical_gtin14 should not be queried")
      },
      async listOpenSubmissionIdentifiers() {
        schemaReads += 1
        throw new Error("product submissions should not be queried")
      },
      async listBatchLedger() {
        schemaReads += 1
        throw new Error("batch ledger should not be queried")
      },
      async listItemLedger() {
        schemaReads += 1
        throw new Error("item ledger should not be queried")
      },
    }),
    gitState: async () => ({
      head: "b".repeat(40),
      branch: SCANNER_IDENTIFIER_BACKFILL_BRANCH,
      clean: true,
    }),
    projectId: SCANNER_IDENTIFIER_BACKFILL_PROJECT_ID,
  })
  assert.equal(blocked.ok, false)
  assert.equal(blocked.blockers.filter((value) => /migration/.test(value)).length, 4)
  assert.equal(schemaReads, 0)
})

test("apply remains dry-run by default and needs both kill-switch layers", async () => {
  const manifest = reviewedE1()
  let calls = 0
  const write = {
    async apply() {
      calls += 1
      return []
    },
  }
  const dryRun = await applyScannerIdentifierBackfill({
    manifest,
    args: parseScannerIdentifierBackfillArgs(["--manifest=unused.json"]),
    preflight: { ok: true, blockers: [] },
    write,
    executionEnabled: "true",
  })
  assert.deepEqual(dryRun, { mode: "dry-run", applied: false })
  const applyArgs = parseScannerIdentifierBackfillArgs([
    "--apply",
    "--manifest=unused.json",
    `--confirm-project=${SCANNER_IDENTIFIER_BACKFILL_PROJECT_ID}`,
    `--approved-fingerprint=${manifest.batch_fingerprint}`,
    `--reviewed-head=${"b".repeat(40)}`,
    "--reviewer=nick",
  ])
  await assert.rejects(
    () =>
      applyScannerIdentifierBackfill({
        manifest,
        args: applyArgs,
        preflight: { ok: true, blockers: [] },
        write,
        executionEnabled: undefined,
      }),
    /kill switch/i,
  )
  await applyScannerIdentifierBackfill({
    manifest,
    args: applyArgs,
    preflight: { ok: true, blockers: [] },
    write,
    executionEnabled: "true",
  })
  assert.equal(calls, 1)
})
