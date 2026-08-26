import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  buildExistingCoverageLedger,
  buildResearchLanes,
  EXISTING_CATALOG_CATEGORY_TOTALS,
} from "../scripts/scanner-catalog-coverage/build-existing-coverage-ledger"
import type { LiveBaseline } from "../scripts/scanner-catalog-coverage/live-baseline-export"
import type { ReadinessBaseline } from "../scripts/scanner-catalog-coverage/readiness-export"

const directory = "data/scanner-catalog-coverage/2026-08-26"
const baseline = JSON.parse(readFileSync(`${directory}/live-baseline.json`, "utf8")) as LiveBaseline
const readiness = JSON.parse(
  readFileSync(`${directory}/readiness-baseline.json`, "utf8"),
) as ReadinessBaseline
const e1 = JSON.parse(
  readFileSync(`${directory}/phase1-existing-identifier-backfill-e1-v1.json`, "utf8"),
)
const e2 = JSON.parse(
  readFileSync(`${directory}/phase1-existing-identifier-backfill-e2-v1.json`, "utf8"),
)

function build(generatedAt = "2026-08-26T00:00:00.000Z") {
  return buildExistingCoverageLedger({ baseline, readiness, e1, e2, generatedAt })
}

test("existing catalog coverage ledger closes the complete 259-product partition", () => {
  const ledger = build()
  assert.deepEqual(ledger.reconciliation.by_partition, {
    already_scan_result_ready: 26,
    safe_e1: 20,
    safe_e2: 22,
    ready_for_gtin_research: 150,
    authority_repair: 41,
  })
  assert.equal(ledger.rows.length, 259)
  assert.equal(new Set(ledger.rows.map((row) => row.product_id)).size, 259)
  assert.equal(ledger.reconciliation.linked_baseline_products, 38)
  assert.deepEqual(ledger.reconciliation.by_category, EXISTING_CATALOG_CATEGORY_TOTALS)
  assert.equal(
    ledger.rows.find((row) => row.product_id === "f184aef4-d8f9-4956-bcd6-ba1bf1ebeace")?.partition,
    "authority_repair",
  )
})

test("research lanes are complete, category-disjoint, and stable", () => {
  const first = build()
  const second = build("2030-01-01T00:00:00.000Z")
  assert.equal(first.content_fingerprint, second.content_fingerprint)
  const lanes = buildResearchLanes(first, "2026-08-26T00:00:00.000Z")
  const rows = lanes.flatMap((lane) => lane.rows)
  assert.equal(rows.length, 150)
  assert.equal(new Set(rows.map((row) => row.product_id)).size, 150)
  assert.deepEqual(Object.fromEntries(lanes.map((lane) => [lane.lane, lane.rows.length])), {
    A: 41,
    B: 32,
    C: 38,
    D: 39,
  })
  assert.ok(
    lanes[0]?.rows.every((row) =>
      ["shampoo", "deep_cleansing_shampoo", "dry_shampoo"].includes(row.category_key),
    ),
  )
  assert.ok(lanes[1]?.rows.every((row) => row.category_key === "conditioner"))
  assert.ok(lanes[2]?.rows.every((row) => ["leave_in", "bondbuilder"].includes(row.category_key)))
  assert.ok(lanes[3]?.rows.every((row) => ["mask", "oil"].includes(row.category_key)))
  assert.deepEqual(
    lanes.map((lane) => lane.content_fingerprint),
    buildResearchLanes(first, "2030-01-01T00:00:00.000Z").map((lane) => lane.content_fingerprint),
  )
})
