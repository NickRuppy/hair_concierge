import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  buildPhase1aLedger,
  PHASE_1A_TARGETS,
} from "../scripts/scanner-catalog-coverage/build-phase1a-ledger"
import type { LiveBaseline } from "../scripts/scanner-catalog-coverage/live-baseline-export"
import type { ReadinessBaseline } from "../scripts/scanner-catalog-coverage/readiness-export"

const baseline = JSON.parse(
  readFileSync("data/scanner-catalog-coverage/2026-08-26/live-baseline.json", "utf8"),
) as LiveBaseline
const readiness = JSON.parse(
  readFileSync("data/scanner-catalog-coverage/2026-08-26/readiness-baseline.json", "utf8"),
) as ReadinessBaseline
const pilotResearch = JSON.parse(
  readFileSync("data/scanner-catalog-coverage/2026-08-26/existing-pilot-research.json", "utf8"),
)

test("Phase 1A ledger selects the exact target coverage without static blockers", () => {
  const ledger = buildPhase1aLedger({
    baseline,
    readiness,
    pilotResearch,
    generatedAt: "2026-08-26T00:00:00.000Z",
  })
  assert.equal(ledger.reconciliation.selected_products, 102)
  assert.equal(new Set(ledger.rows.map((row) => row.product_id)).size, 102)
  for (const [category, target] of Object.entries(PHASE_1A_TARGETS)) {
    const selected = ledger.rows.filter((row) => row.category_key === category)
    assert.equal(selected.length, target, category)
    assert.ok(
      selected.every(
        (row) =>
          row.catalog_readiness.strict_status === "ready_for_ean_research" &&
          row.catalog_readiness.strict_blockers.length === 0 &&
          row.catalog_readiness.static_blockers.length === 0,
      ),
      category,
    )
  }
  assert.equal(ledger.rows.filter((row) => row.category_key === "deep_cleansing_shampoo").length, 5)
  assert.equal(ledger.rows.filter((row) => row.category_key === "bondbuilder").length, 3)
})

test("Phase 1A ledger retains every seed product and its 22 GTIN evidence packages", () => {
  const ledger = buildPhase1aLedger({
    baseline,
    readiness,
    pilotResearch,
    generatedAt: "2026-08-26T00:00:00.000Z",
  })
  const pilotRows = ledger.rows.filter((row) => row.wave === "pilot")
  assert.equal(pilotRows.length, 20)
  assert.deepEqual(
    new Set(pilotRows.map((row) => row.product_id)),
    new Set(pilotResearch.products.map((item: { product_id: string }) => item.product_id)),
  )
  assert.equal(
    pilotRows.reduce((sum, row) => sum + (row.pilot_gtin_evidence?.packages.length ?? 0), 0),
    22,
  )
  assert.ok(
    pilotRows.every(
      (row) =>
        row.gtin_research_status === "evidence_backed_pilot" &&
        row.inclusion_rank <= (PHASE_1A_TARGETS[row.category_key] ?? 0),
    ),
  )
})

test("Phase 1A content fingerprint is stable across capture times", () => {
  const first = buildPhase1aLedger({
    baseline,
    readiness,
    pilotResearch,
    generatedAt: "2026-08-26T00:00:00.000Z",
  })
  const second = buildPhase1aLedger({
    baseline,
    readiness,
    pilotResearch,
    generatedAt: "2030-01-01T00:00:00.000Z",
  })
  assert.equal(first.content_fingerprint, second.content_fingerprint)
})
