import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  leaveInCalibrationTargetFingerprint,
  type LeaveInCalibrationLiveRows,
  type LeaveInCalibrationReadAdapter,
  type LeaveInCalibrationSnapshot,
} from "../src/lib/product-intake/catalog-enrichment/leave-in-research-calibration"
import {
  LEAVE_IN_CALIBRATION_V2_T20_APPROVED_BATCH_FINGERPRINT,
  LEAVE_IN_CALIBRATION_V2_T20_BATCH_ID,
  LEAVE_IN_CALIBRATION_V2_T20_COHORT_INDEX_FINGERPRINT,
  LEAVE_IN_CALIBRATION_V2_T20_MANIFEST,
  LEAVE_IN_CALIBRATION_V2_T20_RPC,
  applyLeaveInCalibrationV2T20,
  buildLeaveInCalibrationV2T20Package,
  classifyLeaveInCalibrationV2T20Run,
  parseLeaveInCalibrationV2T20ApplyArgs,
  preflightLeaveInCalibrationV2T20,
  verifyLeaveInCalibrationV2T20,
} from "../src/lib/product-intake/catalog-enrichment/leave-in-research-calibration-v2-t20"

type Batch = { batch_id: string; products: Array<Record<string, unknown>> }

const loadBatch = (): Batch =>
  JSON.parse(readFileSync(LEAVE_IN_CALIBRATION_V2_T20_MANIFEST, "utf8")) as Batch

/** Live rows rebuilt from a pinned snapshot. A search disposition exempts the publication predicate. */
function rowsFromSnapshot(snapshot: LeaveInCalibrationSnapshot): LeaveInCalibrationLiveRows {
  return {
    product: { id: snapshot.product_id, ...(snapshot.products ?? {}) },
    specs: { product_id: snapshot.product_id, ...(snapshot.product_leave_in_specs ?? {}) },
    fitSpecs: { product_id: snapshot.product_id, ...(snapshot.product_leave_in_fit_specs ?? {}) },
    eligibility: snapshot.product_leave_in_eligibility.map((row) => ({
      product_id: snapshot.product_id,
      ...row,
    })),
    protocols: [],
    dispositions: [{ product_id: snapshot.product_id }],
  }
}

function readerFor(
  batch: Batch,
  edit: (productId: string, rows: LeaveInCalibrationLiveRows) => LeaveInCalibrationLiveRows = (
    _id,
    rows,
  ) => rows,
): LeaveInCalibrationReadAdapter {
  return {
    async liveRows(productId) {
      const manifest = batch.products.find((entry) => entry.target_product_id === productId)!
      return edit(
        productId,
        rowsFromSnapshot(manifest.current_catalog_target as LeaveInCalibrationSnapshot),
      )
    },
    async appliedLedger() {
      return []
    },
  }
}

const EXPECTED_CHANGES: Record<string, string[]> = {
  "leave-in-slot-05-evo-head-mistress": ["functional_benefits"],
  "leave-in-slot-08-gliss-ultimate-repair": [
    "care_benefits",
    "care_direction",
    "functional_benefits",
  ],
  "leave-in-slot-09-redken-extreme-anti-snap": ["functional_benefits"],
  "leave-in-slot-10-olaplex-no6-bond-smoother": [
    "care_benefits",
    "care_direction",
    "functional_benefits",
  ],
  "leave-in-slot-13-neqi-diamond-glass": ["care_benefits", "care_direction", "functional_benefits"],
}

test("v2-t20 batch: five manifests, one spec upsert each, pinned to their own snapshot", () => {
  const batch = loadBatch()
  assert.equal(batch.batch_id, LEAVE_IN_CALIBRATION_V2_T20_BATCH_ID)
  assert.deepEqual(
    batch.products.map((manifest) => manifest.product_key).sort(),
    Object.keys(EXPECTED_CHANGES),
  )
  for (const manifest of batch.products) {
    const operations = manifest.planned_operations as Array<{ type: string; table: string }>
    assert.deepEqual(
      operations.map((operation) => `${operation.type}:${operation.table}`),
      ["upsert:product_leave_in_specs"],
      `${String(manifest.product_key)}: no eligibility, fit or product operation`,
    )
    assert.equal(
      manifest.target_fingerprint,
      leaveInCalibrationTargetFingerprint(
        manifest.current_catalog_target as LeaveInCalibrationSnapshot,
      ),
      `${String(manifest.product_key)}: target_fingerprint is the fingerprint of the pinned snapshot`,
    )
    assert.equal(
      (manifest.research as { research_model_version: string }).research_model_version,
      "leave-in-inci-v1.1",
    )
  }
})

test("v2-t20 package: fingerprints match the migration pins; deltas are exactly the ruled ones", () => {
  const built = buildLeaveInCalibrationV2T20Package(loadBatch())
  assert.equal(built.fingerprint, LEAVE_IN_CALIBRATION_V2_T20_APPROVED_BATCH_FINGERPRINT)
  assert.equal(built.cohort_index_fingerprint, LEAVE_IN_CALIBRATION_V2_T20_COHORT_INDEX_FINGERPRINT)
  for (const product of built.package.products) {
    assert.deepEqual(
      product.changed_spec_columns,
      EXPECTED_CHANGES[product.product_key],
      product.product_key,
    )
    assert.equal(
      product.projected_leave_in_specs.care_direction === "moisture",
      false,
      product.product_key,
    )
    assert.ok(
      !(product.projected_leave_in_specs.functional_benefits as string[]).includes(
        "moisture_softness",
      ),
      `${product.product_key}: AD-3a revision`,
    )
  }
})

test("v2-t20 package: refuses an eligibility operation or a non-allowlisted change", () => {
  const withDelete = loadBatch()
  ;(withDelete.products[0]!.planned_operations as unknown[]).push({
    type: "delete",
    table: "product_leave_in_eligibility",
    rows: [
      {
        product_id: withDelete.products[0]!.target_product_id,
        thickness: "coarse",
        need_bucket: "moisture_anti_frizz",
        styling_context: "air_dry",
      },
    ],
  })
  assert.throws(
    () => buildLeaveInCalibrationV2T20Package(withDelete),
    /exactly one product_leave_in_specs upsert|not a valid manifest/,
  )

  const weightMove = loadBatch()
  const manifest = weightMove.products[0]!
  const target = structuredClone(manifest.current_catalog_target) as LeaveInCalibrationSnapshot
  target.product_leave_in_specs = { ...target.product_leave_in_specs, weight: "rich" }
  manifest.current_catalog_target = target
  manifest.target_fingerprint = leaveInCalibrationTargetFingerprint(target)
  assert.throws(
    () => buildLeaveInCalibrationV2T20Package(weightMove),
    /weight would change but is not allowlisted/,
  )
})

test("v2-t20 preflight: green on the pinned state with zero eligibility operations", async () => {
  const batch = loadBatch()
  const report = await preflightLeaveInCalibrationV2T20({ read: readerFor(batch), batch })
  assert.equal(report.ok, true, JSON.stringify(report.products.filter((product) => !product.ok)))
  assert.equal(report.summary.staleFingerprints, 0)
  assert.equal(report.summary.eligibilityOperations, 0)
  assert.equal(report.summary.invariantViolations, 0)
})

test("v2-t20 preflight: a live row that drifted is stale and red", async () => {
  const batch = loadBatch()
  const read = readerFor(batch, (productId, rows) =>
    productId === "5dc2fae3-a0ca-4e6c-9c30-02dd192772f0"
      ? { ...rows, fitSpecs: { ...rows.fitSpecs, weight: "rich" } }
      : rows,
  )
  const report = await preflightLeaveInCalibrationV2T20({ read, batch })
  assert.equal(report.ok, false)
  const gliss = report.products.find((product) => product.product_key.includes("gliss"))!
  assert.equal(gliss.target_fingerprint_matches, false)
  assert.ok(gliss.invariant_violations.includes("product_leave_in_fit_specs.weight would change"))
})

test("v2-t20 apply flags: dry run by default, every guard flag required with --apply", () => {
  assert.equal(parseLeaveInCalibrationV2T20ApplyArgs([]).apply, false)
  assert.throws(
    () => parseLeaveInCalibrationV2T20ApplyArgs(["--apply"]),
    /requires --apply --confirm/,
  )
  const full = [
    "--apply",
    "--confirm",
    "--confirm-batch",
    LEAVE_IN_CALIBRATION_V2_T20_BATCH_ID,
    "--reviewed-by",
    "nick",
    "--reviewed-head",
    "a".repeat(40),
    "--expect-migration=applied",
    "--expected-batch-fingerprint",
    LEAVE_IN_CALIBRATION_V2_T20_APPROVED_BATCH_FINGERPRINT,
    "--expected-content-fingerprint",
    LEAVE_IN_CALIBRATION_V2_T20_COHORT_INDEX_FINGERPRINT,
  ]
  assert.equal(parseLeaveInCalibrationV2T20ApplyArgs(full).apply, true)
  assert.throws(
    () =>
      parseLeaveInCalibrationV2T20ApplyArgs(
        full.map((value) =>
          value === LEAVE_IN_CALIBRATION_V2_T20_BATCH_ID
            ? "leave-in-research-calibration-v1"
            : value,
        ),
      ),
    /requires --apply/,
  )
  assert.throws(
    () =>
      parseLeaveInCalibrationV2T20ApplyArgs(
        full.map((value) => (value === "nick" ? "someone" : value)),
      ),
    /requires --apply/,
  )
})

test("v2-t20 run classification and apply: one RPC call with the canonical package", async () => {
  const batch = loadBatch()
  const built = buildLeaveInCalibrationV2T20Package(batch)
  const preflight = await preflightLeaveInCalibrationV2T20({ read: readerFor(batch), batch })
  const run = classifyLeaveInCalibrationV2T20Run({ built, preflight, ledger: [] })
  assert.deepEqual(run, { mode: "first_apply" })

  const partial = classifyLeaveInCalibrationV2T20Run({
    built,
    preflight,
    ledger: [
      {
        batch_id: LEAVE_IN_CALIBRATION_V2_T20_BATCH_ID,
        product_key: built.package.products[0]!.product_key,
        batch_fingerprint: built.fingerprint,
        content_fingerprint: built.package.products[0]!.content_fingerprint,
        product_id: built.package.products[0]!.product_id,
        reviewed_by: "nick",
      },
    ],
  })
  assert.equal(partial.mode, "blocked")

  const args = parseLeaveInCalibrationV2T20ApplyArgs([
    "--apply",
    "--confirm",
    "--confirm-batch",
    LEAVE_IN_CALIBRATION_V2_T20_BATCH_ID,
    "--reviewed-by",
    "nick",
    "--reviewed-head",
    "b".repeat(40),
    "--expect-migration=applied",
    "--expected-batch-fingerprint",
    built.fingerprint,
    "--expected-content-fingerprint",
    built.cohort_index_fingerprint,
  ])
  const calls: unknown[] = []
  const write = {
    async rpc(name: string, rpcArgs: unknown) {
      calls.push({ name, rpcArgs })
    },
  }
  await assert.rejects(
    applyLeaveInCalibrationV2T20({
      args,
      preflight,
      built,
      run,
      gitState: async () => ({ head: "b".repeat(40), clean: false }),
      write,
    }),
    /exact clean reviewed head/,
  )
  assert.equal(calls.length, 0)
  const result = await applyLeaveInCalibrationV2T20({
    args,
    preflight,
    built,
    run,
    gitState: async () => ({ head: "b".repeat(40), clean: true }),
    write,
  })
  assert.equal(result.eligibility_rows_written, 0)
  assert.deepEqual(calls, [
    {
      name: LEAVE_IN_CALIBRATION_V2_T20_RPC,
      rpcArgs: {
        p_batch_json: built.canonical_json,
        p_expected_batch_fingerprint: built.fingerprint,
        p_reviewed_by: "nick",
      },
    },
  ])
})

test("v2-t20 verify: red on the pre-apply state, green on the projected state", async () => {
  const batch = loadBatch()
  const built = buildLeaveInCalibrationV2T20Package(batch)
  const before = await verifyLeaveInCalibrationV2T20({ read: readerFor(batch), built })
  assert.equal(before.ok, false)
  const applied = readerFor(batch, (productId, rows) => {
    const product = built.package.products.find((entry) => entry.product_id === productId)!
    return { ...rows, specs: { ...rows.specs, ...product.projected_leave_in_specs } }
  })
  const after = await verifyLeaveInCalibrationV2T20({ read: applied, built })
  assert.equal(after.ok, true, JSON.stringify(after.products.filter((product) => !product.ok)))
})
