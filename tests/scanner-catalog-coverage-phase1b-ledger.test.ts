import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  buildPhase1bLedger,
  buildPilotManifest,
  isExactRetailerPdp,
  PHASE_1B_TARGETS,
} from "../scripts/scanner-catalog-coverage/build-phase1b-ledger"
import type { Phase1aLedger } from "../scripts/scanner-catalog-coverage/build-phase1a-ledger"

const artifact = (name: string) =>
  JSON.parse(readFileSync(`data/scanner-catalog-coverage/2026-08-26/${name}`, "utf8"))
const core = artifact("retailer-core-candidates.json")
const specialist = artifact("retailer-specialist-candidates.json")
const pilotResearch = artifact("new-pilot-research.json")
const phase1a = artifact("phase1a-existing-ledger.json") as Phase1aLedger

function ledger(generatedAt = "2026-08-26T00:00:00.000Z") {
  return buildPhase1bLedger({ core, specialist, pilotResearch, generatedAt })
}

test("Phase 1B selects 54 confirmed-new candidates at exact target coverage", () => {
  const result = ledger()
  assert.equal(result.rows.length, 54)
  assert.equal(new Set(result.rows.map((row) => row.candidate_id)).size, 54)
  for (const [category, target] of Object.entries(PHASE_1B_TARGETS)) {
    const rows = result.rows.filter((row) => row.category_key === category)
    assert.equal(rows.length, target, category)
    assert.ok(
      rows.every(
        (row) =>
          row.reconciliation.status === "new_candidate_confirmed" &&
          row.reconciliation.category_fit === "accepted_for_category_contract",
      ),
      category,
    )
    assert.ok(
      rows.every(
        (row) =>
          row.catalog_readiness.research_only &&
          !row.catalog_readiness.catalog_intake_ready &&
          !row.catalog_readiness.scan_result_ready,
      ),
      category,
    )
  }
})

test("Phase 1B retains all five new pilot seeds and exact-PDP evidence only", () => {
  const result = ledger()
  const pilotRows = result.rows.filter((row) => row.wave === "pilot")
  assert.deepEqual(
    new Set(pilotRows.map((row) => row.candidate_id)),
    new Set(pilotResearch.products.map((item: { candidate_id: string }) => item.candidate_id)),
  )
  assert.ok(
    result.rows.every(
      (row) => row.sources.pdp_urls.length > 0 && row.sources.pdp_urls.every(isExactRetailerPdp),
    ),
  )
  assert.ok(
    result.rows.every((row) =>
      row.sources.pdp_urls.every((url) => !url.includes("/marken/") && !url.includes("/c/")),
    ),
  )
})

test("dry-shampoo corrections bind each evidence upgrade to its exact identity", () => {
  const expected = new Map([
    [
      "dry-shampoo-002",
      "https://www.rossmann.de/de/pflege-und-duft-got2b-trockenshampoo-trocken-waesche-extra-frisch/p/4015100800203",
    ],
    [
      "dry-shampoo-004",
      "https://www.rossmann.de/de/pflege-und-duft-isana-trockenshampoo-dunkles-haar-anti-fett-formel-extra-volumen-200-ml-online-kaufen/p/4305615596723",
    ],
    [
      "dry-shampoo-005",
      "https://www.rossmann.de/de/pflege-und-duft-batiste-trockenshampoo-volumen-mit-aufpolsterndem-kollagen-200-ml-online-kaufen/p/5010724532966",
    ],
    [
      "dry-shampoo-007",
      "https://www.rossmann.de/de/pflege-und-duft-isana-trockenshampoo-helles-haar-anti-fett-formel-langanhaltende-frische-und-volumen-200-ml-online-kaufen/p/4305615596716",
    ],
  ])
  for (const candidate of specialist.candidates) {
    const expectedUrl = expected.get(candidate.candidate_id)
    if (expectedUrl) assert.equal(candidate.sources[0].url, expectedUrl, candidate.candidate_id)
  }
  const result = ledger()
  const dryRows = result.rows.filter((row) => row.category_key === "dry_shampoo")
  assert.equal(dryRows.length, 7)
  assert.ok(dryRows.every((row) => row.sources.pdp_urls.every(isExactRetailerPdp)))
})

test("heat-protectant 005 emits its exact Rossmann PDP and excludes supplemental category evidence", () => {
  const heat = ledger().rows.find((row) => row.candidate_id === "heat-protectant-005")
  assert.ok(heat)
  assert.ok(
    heat.sources.pdp_urls.some((url) =>
      url.includes("syoss-foehnschutz-spray-keratin-volume/p/4015100860160"),
    ),
  )
  assert.ok(heat.sources.pdp_urls.every((url) => !url.includes("/c/")))
})

test("Phase 1B and the 25-product frozen pilot fingerprints are stable across capture times", () => {
  const first = ledger("2026-08-26T00:00:00.000Z")
  const second = ledger("2030-01-01T00:00:00.000Z")
  assert.equal(first.content_fingerprint, second.content_fingerprint)
  const pilotFirst = buildPilotManifest({
    phase1a,
    phase1b: first,
    generatedAt: "2026-08-26T00:00:00.000Z",
  })
  const pilotSecond = buildPilotManifest({
    phase1a,
    phase1b: second,
    generatedAt: "2030-01-01T00:00:00.000Z",
  })
  assert.equal(pilotFirst.content_fingerprint, pilotSecond.content_fingerprint)
  assert.deepEqual(pilotFirst.totals, {
    existing_products: 20,
    new_products: 5,
    total_products: 25,
    existing_canonical_gtins: 22,
    new_canonical_gtins: 5,
    unique_canonical_gtins: 27,
  })
})
