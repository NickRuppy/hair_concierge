import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  buildExistingResearchBatches,
  fingerprint,
  type VerifiedPackage,
  validateLaneArtifact,
} from "../scripts/scanner-catalog-coverage/build-existing-research-batches"

const directory = "data/scanner-catalog-coverage/2026-08-26"
const assignment = JSON.parse(
  readFileSync(`${directory}/existing-catalog-research-lane-d.json`, "utf8"),
)
const artifact = JSON.parse(
  readFileSync(`${directory}/existing-catalog-gtin-research-lane-d-v1.json`, "utf8"),
)
const allAssignments = Object.fromEntries(
  ["A", "B", "C", "D"].map((lane) => [
    lane,
    JSON.parse(
      readFileSync(
        `${directory}/existing-catalog-research-lane-${lane.toLowerCase()}.json`,
        "utf8",
      ),
    ),
  ]),
) as Parameters<typeof buildExistingResearchBatches>[0]["assignments"]
const allArtifacts = Object.fromEntries(
  ["A", "B", "C", "D"].map((lane) => [
    lane,
    JSON.parse(
      readFileSync(
        `${directory}/existing-catalog-gtin-research-lane-${lane.toLowerCase()}-v1.json`,
        "utf8",
      ),
    ),
  ]),
) as Parameters<typeof buildExistingResearchBatches>[0]["artifacts"]
const baseline = JSON.parse(readFileSync(`${directory}/live-baseline.json`, "utf8"))
const e1 = JSON.parse(
  readFileSync(`${directory}/phase1-existing-identifier-backfill-e1-v1.json`, "utf8"),
)
const e2 = JSON.parse(
  readFileSync(`${directory}/phase1-existing-identifier-backfill-e2-v1.json`, "utf8"),
)

function clone() {
  return JSON.parse(JSON.stringify(artifact))
}
function resign(value: Record<string, unknown>) {
  const { generated_at: _generatedAt, content_fingerprint: _fingerprint, ...content } = value
  value.content_fingerprint = fingerprint(content)
  return value
}

test("Lane artifact validates exact assigned products and reconciliation schema", () => {
  const result = validateLaneArtifact(artifact, assignment, "D")
  assert.equal(result.products.length, 39)
  assert.equal(result.reconciliation.verified_products, 1)
  assert.equal(result.reconciliation.blocked_products, 38)
})

test("Lane artifact fails closed on assignment, identity, checksum, and URL drift", () => {
  const wrongAssignment = { ...assignment, content_fingerprint: "drift" }
  assert.throws(
    () => validateLaneArtifact(artifact, wrongAssignment, "D"),
    /assignment_fingerprint_drift/,
  )
  const duplicate = clone()
  duplicate.products[1].product_id = duplicate.products[0].product_id
  assert.throws(
    () => validateLaneArtifact(resign(duplicate), assignment, "D"),
    /unknown_or_duplicate_product/,
  )
  const checksum = clone()
  checksum.products.find(
    (row: { status: string }) => row.status === "verified",
  ).packages[0].raw_gtin = "123"
  assert.throws(() => validateLaneArtifact(resign(checksum), assignment, "D"), /invalid_gtin/)
  const source = clone()
  source.products.find(
    (row: { status: string }) => row.status === "verified",
  ).packages[0].source_url = "ftp://invalid"
  assert.throws(
    () => validateLaneArtifact(resign(source), assignment, "D"),
    /direct_http_url_required/,
  )
})

test("real research batches reconcile all 150 products, split at 20, and fingerprint stably", () => {
  const input = { assignments: allAssignments, artifacts: allArtifacts, baseline, e1, e2 }
  const first = buildExistingResearchBatches({ ...input, generatedAt: "2026-08-26T00:00:00.000Z" })
  const second = buildExistingResearchBatches({ ...input, generatedAt: "2030-01-01T00:00:00.000Z" })
  assert.equal(first.summary.reconciliation.assigned_products, 150)
  assert.equal(first.summary.reconciliation.verified_products, 97)
  assert.equal(first.summary.content_fingerprint, second.summary.content_fingerprint)
  assert.deepEqual(
    first.candidates.map((candidate) => candidate.items.length),
    [20, 20, 20, 20, 17],
  )
  assert.deepEqual(
    first.candidates.map((candidate) => candidate.content_fingerprint),
    second.candidates.map((candidate) => candidate.content_fingerprint),
  )
})

test("research batches reject a cross-product GTIN ownership collision", () => {
  const artifacts = JSON.parse(JSON.stringify(allArtifacts))
  const aPackage = artifacts.A.products.find((row: { status: string }) => row.status === "verified")
    .packages[0]
  const bRow = artifacts.B.products.find((row: { status: string }) => row.status === "verified")
  bRow.packages[0] = { ...aPackage }
  resign(artifacts.B)
  assert.throws(
    () =>
      buildExistingResearchBatches({
        assignments: allAssignments,
        artifacts,
        baseline,
        e1,
        e2,
        generatedAt: "2026-08-26T00:00:00.000Z",
      }),
    /duplicate_research_gtin/,
  )
})

test("research batches reject a GTIN claimed by an unresolved open submission", () => {
  const snapshot = JSON.parse(JSON.stringify(baseline))
  const laneA = allArtifacts.A as {
    products: Array<{ status: string; packages: VerifiedPackage[] }>
  }
  const candidate = laneA.products.find((row: { status: string }) => row.status === "verified")!
    .packages[0]!
  snapshot.open_submission_identity_candidates.resolved_identity_candidates.push({
    submission_id: "pending-submission",
    canonical_gtin14: "04006381333931",
    canonical_gtin14s: ["04006381333931", candidate.canonical_gtin14],
  })
  assert.throws(
    () =>
      buildExistingResearchBatches({
        assignments: allAssignments,
        artifacts: allArtifacts,
        baseline: snapshot,
        e1,
        e2,
        generatedAt: "2026-08-26T00:00:00.000Z",
      }),
    /open_submission_overlap/,
  )
})
