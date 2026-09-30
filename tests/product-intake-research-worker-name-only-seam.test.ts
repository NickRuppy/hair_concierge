import assert from "node:assert/strict"
import { readFileSync, rmSync } from "node:fs"
import test from "node:test"

import {
  loadScanIntakeSeedForSubmission,
  writePromptPacket,
  type BrandResolutionPromptContext,
} from "../scripts/product-intake/codex-research-worker"
import type {
  ProductIntakeResearchJob,
  ProductIntakeSubmissionDetail,
} from "@chaarlie/product-intake-core"

/**
 * Task 5's runnable worker oracle (plan Rev. 6 §4, final-review F7): proves the research
 * worker handles a null-identifier (name-only) submission end to end through the ACTUAL
 * worker functions, not a regex over the script's source text (that pattern is what
 * `tests/product-intake-research-jobs.test.ts`'s `workerScript` fixture already does for
 * everything else in this file, and is explicitly what this task must not repeat).
 *
 * `codex-research-worker.ts` is a script that used to run `main()` unconditionally at
 * module load — unsafe to `import` from a test. It now guards that call behind an
 * `import.meta.url` entry-point check (the same pattern already used by
 * `scripts/catalog-authority/audit.ts` and others), so importing it here for its two named
 * exports below is side-effect-free: `main()` never fires under `import`, only under
 * `tsx scripts/product-intake/codex-research-worker.ts` directly (proven implicitly by
 * every test in this file running without a Supabase connection or a claimed job).
 *
 * The null-identifier path is split across the worker's two extracted seams:
 * - `loadScanIntakeSeedForSubmission` (the "submission-loading" half): reads
 *   `scanned_identifier_type/value` off a `product_submissions` row and builds the
 *   `scannedIdentifier`/`retailerEnrichment` the prompt packet embeds. A null-identifier
 *   row must load without throwing and answer `scannedIdentifier: null` — never invent a
 *   dm-enrichment lead for a submission that was never resolved against a GTIN.
 * - `writePromptPacket` (the "packet-building" half): the packet's `product.brand`/
 *   `product.product_name` come from the submission's brand/name texts regardless of
 *   whether an identifier exists, and the packet carries no identifier field for a
 *   null-identifier submission (there is none to carry).
 */

function fakeSupabaseForSubmissionRow(row: {
  scanned_identifier_type: string | null
  scanned_identifier_value: string | null
  intake_history: unknown
}) {
  const calls: Array<{ table: string; columns: string; id: string }> = []
  return {
    calls,
    client: {
      from(table: string) {
        return {
          select(columns: string) {
            return {
              eq(_column: string, id: string) {
                calls.push({ table, columns, id })
                return {
                  async maybeSingle() {
                    return { data: row, error: null }
                  },
                }
              },
            }
          },
        }
      },
    },
  }
}

test("loadScanIntakeSeedForSubmission: a null-identifier (name-only) submission row loads cleanly with no scanned identifier and no invented enrichment", async () => {
  const fake = fakeSupabaseForSubmissionRow({
    scanned_identifier_type: null,
    scanned_identifier_value: null,
    intake_history: [
      {
        at: "2026-09-20T10:00:00.000Z",
        source: "scan",
        intake_method: "manual",
        category: "shampoo",
        frequency_range: null,
        fields: {
          brand_text: "Kérastase",
          brand_id: null,
          product_line_id: null,
          product_name_text: "Ciment Thermique",
          scanned_identifier: null,
        },
      },
    ],
  })

  const seed = await loadScanIntakeSeedForSubmission(fake.client as never, "sub-name-only-1")

  assert.deepEqual(seed, {
    scannedIdentifier: null,
    retailerEnrichment: null,
    retailerEnrichmentWarning: null,
  })
  // Proves the row actually loaded through the real Supabase-shaped call chain, not a
  // stub that never queried anything.
  assert.deepEqual(fake.calls, [
    {
      table: "product_submissions",
      columns: "scanned_identifier_type, scanned_identifier_value, intake_history",
      id: "sub-name-only-1",
    },
  ])
})

test("loadScanIntakeSeedForSubmission: an identifier-based submission row is unaffected (byte-identical EAN lane)", async () => {
  const fake = fakeSupabaseForSubmissionRow({
    scanned_identifier_type: "ean",
    scanned_identifier_value: "4006381333931",
    intake_history: [],
  })

  const seed = await loadScanIntakeSeedForSubmission(fake.client as never, "sub-ean-1")

  assert.deepEqual(seed.scannedIdentifier, { type: "ean", value: "4006381333931" })
})

function fakeJob(id: string): ProductIntakeResearchJob {
  return {
    id,
    submission_id: `submission-${id}`,
    status: "running",
    stage: "source_research",
    priority: 0,
    attempt_count: 1,
    max_attempts: 3,
    locked_by: "worker-test",
    locked_at: "2026-09-20T10:00:00.000Z",
    started_at: "2026-09-20T10:00:00.000Z",
    completed_at: null,
    next_run_at: "2026-09-20T10:05:00.000Z",
    last_error: null,
    progress: {},
    created_at: "2026-09-20T09:59:00.000Z",
    updated_at: "2026-09-20T10:00:00.000Z",
  }
}

function fakeSubmissionDetail(
  overrides: Partial<ProductIntakeSubmissionDetail> = {},
): ProductIntakeSubmissionDetail {
  return {
    id: "submission-name-only",
    status: "researching",
    category: "shampoo",
    brand: "Kérastase",
    product_name: "Ciment Thermique",
    source: "scan",
    payload: {},
    created_at: "2026-09-20T09:59:00.000Z",
    updated_at: "2026-09-20T10:00:00.000Z",
    job: null,
    artifacts: [],
    decisions: [],
    ...overrides,
  }
}

function fakeBrandResolutionContext(): BrandResolutionPromptContext {
  return {
    submitted_brand_text: "Kérastase",
    submitted_product_name_text: "Ciment Thermique",
    scanned_identifier: null,
    lookup_text: "Kérastase Ciment Thermique",
    resolved_brand: null,
    nearby_brand_options: [],
    catalog_summary: {},
    rules: [],
  }
}

test("writePromptPacket: a null-identifier submission's packet carries the brand/name texts and no identifier field", (t) => {
  const job = fakeJob("packet-name-only-1")
  const path = writePromptPacket(
    job,
    "worker-test",
    fakeSubmissionDetail(),
    fakeBrandResolutionContext(),
    // A name-only submission never runs the dm lookup (Task 5, route.ts) -- retailer
    // enrichment is always null on this path.
    null,
  )
  t.after(() => rmSync(path, { force: true }))

  const packet = JSON.parse(readFileSync(path, "utf8")) as {
    product: { brand: string | null; product_name: string | null; category: string | null }
    retailer_enrichment: unknown
    retailer_enrichment_contract: unknown[]
    brand_resolution_context: { scanned_identifier: unknown }
  }

  assert.equal(packet.product.brand, "Kérastase")
  assert.equal(packet.product.product_name, "Ciment Thermique")
  assert.equal(packet.product.category, "shampoo")
  assert.equal(packet.retailer_enrichment, null)
  assert.deepEqual(packet.retailer_enrichment_contract, [])
  // No identifier of any kind flows through: the brand-resolution context's own
  // identifier slot is null (this submission has no scanned identifier to carry), and
  // nothing else in the packet mentions an actual identifier value/type pair.
  assert.equal(packet.brand_resolution_context.scanned_identifier, null)
  assert.doesNotMatch(JSON.stringify(packet), /"type":"ean"|"type":"gtin"|"type":"barcode"/)
})

test("writePromptPacket: an identifier-based submission's packet still carries the retailer enrichment contract (byte-identical EAN lane)", (t) => {
  const job = fakeJob("packet-ean-1")
  const path = writePromptPacket(
    job,
    "worker-test",
    fakeSubmissionDetail({ brand: "Kérastase", product_name: "Ciment Thermique 150ml" }),
    {
      ...fakeBrandResolutionContext(),
      scanned_identifier: { type: "ean", value: "4006381333931" },
    },
    {
      source: "dm",
      fetched_at: "2026-09-20T10:00:00.000Z",
      gtin: "04006381333931",
      dan: "1234567",
      product_name: "Ciment Thermique",
      brand: "Kérastase",
      ingredients_text: null,
      product_url: null,
      image_url_candidate: null,
      suggested_category: "shampoo",
    },
  )
  t.after(() => rmSync(path, { force: true }))

  const packet = JSON.parse(readFileSync(path, "utf8")) as {
    retailer_enrichment: { gtin: string } | null
  }
  assert.equal(packet.retailer_enrichment?.gtin, "04006381333931")
})
