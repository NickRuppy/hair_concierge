import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  CATALOG_ENRICHMENT_SCHEMA_VERSION,
  validateCatalogEnrichmentManifest,
} from "../src/lib/product-intake/catalog-enrichment"
import {
  LEAVE_IN_CALIBRATION_APPROVED_BATCH_FINGERPRINT,
  LEAVE_IN_CALIBRATION_BATCH_ID,
  LEAVE_IN_CALIBRATION_COHORT_INDEX_FINGERPRINT,
  LEAVE_IN_CALIBRATION_FIT_COLUMNS,
  LEAVE_IN_CALIBRATION_MIGRATION,
  LEAVE_IN_CALIBRATION_PRODUCT_COLUMNS,
  LEAVE_IN_CALIBRATION_RPC,
  LEAVE_IN_CALIBRATION_SPEC_COLUMNS,
  LEAVE_IN_CALIBRATION_TARGETS,
  LEAVE_IN_ELIGIBILITY_NATURAL_KEY,
  applyLeaveInCalibration,
  classifyLeaveInCalibrationRun,
  buildLeaveInCalibrationPackage,
  buildLeaveInCalibrationSnapshot,
  leaveInCalibrationTargetFingerprint,
  parseLeaveInCalibrationApplyArgs,
  preflightLeaveInCalibration,
  verifyLeaveInCalibration,
  type LeaveInCalibrationLedgerRow,
  type LeaveInCalibrationLiveRows,
  type LeaveInCalibrationSnapshot,
} from "../src/lib/product-intake/catalog-enrichment/leave-in-research-calibration"
import { buildStage5ProtocolApplyBatch } from "../src/lib/product-intake/catalog-enrichment/stage5-protocols"
import { validateProtocolResearchManifest } from "../scripts/product-intake/catalog-enrichment/stage5-protocol-research"
import { applicationGuidanceProtocolSchema } from "../src/lib/routines/personal-plan/application/contracts"

const batch = JSON.parse(
  readFileSync("plans/leave-in-apply/leave-in-research-enrichment-manifest.json", "utf8"),
) as {
  schema_version: string
  batch_id: string
  lifecycle_classification: string
  products: Array<Record<string, never>>
}

const projections = JSON.parse(
  readFileSync("data/research/leave-in-inci/v1.0/calibration-expected-projections.json", "utf8"),
).projections as Record<string, never>

type Manifest = Record<string, never> & {
  product_key: string
  target_product_id: string
  target_fingerprint: string
  identity: { slot: string }
  category_payload: {
    product_leave_in_specs: Record<string, unknown>
    product_leave_in_fit_specs: Record<string, unknown>
    product_leave_in_eligibility: Array<Record<string, string>>
  }
  planned_operations: Array<{ type: string; table: string; rows?: Array<Record<string, string>> }>
  current_catalog_target: LeaveInCalibrationSnapshot
  authored_protocols: Array<Record<string, never>>
  research: {
    required_protocol_roles: string[]
    missing_protocol_roles: string[]
    live_protocol_roles: string[]
  }
}

function manifestFor(productKey: string): Manifest {
  const found = batch.products.find(
    (candidate) => (candidate as { product_key?: string }).product_key === productKey,
  )
  assert.ok(found, `manifest missing for ${productKey}`)
  return found as unknown as Manifest
}

function naturalKey(row: Record<string, string>) {
  return LEAVE_IN_ELIGIBILITY_NATURAL_KEY.map((column) => row[column]).join("|")
}

/**
 * Replays the manifest's own frozen snapshot as if it were the live catalog.
 * The snapshot deliberately stores only (role, application_family) per protocol,
 * so a valid V2 pointer is synthesized here for the rows that exist — production
 * rows carry one (verified against prod), and it is the *absence* of a row for a
 * newly required role that the publication gate is about.
 */
/** A protocol row that satisfies BOTH halves of the curated-publication gate. */
function liveProtocolRow(productId: string, role: string, overrides: Record<string, unknown> = {}) {
  const sourceUrl = `https://example.test/${productId}/${role}`
  return {
    product_id: productId,
    category: "leave_in",
    role,
    source_url: sourceUrl,
    source_text: "Anwendungshinweis laut Hersteller.",
    guidance_payload: {
      scope: { kind: "product", category: "leave_in", productId },
      evidence: [{ sourceUrl, sourceType: "manufacturer", checkedAt: "2026-09-14" }],
    },
    guidance_payload_v2: {
      schemaVersion: 2,
      contractKind: "product_pointer",
      scope: { kind: "product", category: "leave_in", productId },
      runtimeBlockerCode: null,
    },
    ...overrides,
  }
}

function liveRowsFrom(
  snapshot: LeaveInCalibrationSnapshot,
  liveProtocolRoles: readonly string[] = [],
  dispositions: Array<Record<string, unknown>> = [],
): LeaveInCalibrationLiveRows {
  return {
    product: snapshot.products,
    specs: snapshot.product_leave_in_specs,
    fitSpecs: snapshot.product_leave_in_fit_specs,
    eligibility: snapshot.product_leave_in_eligibility,
    protocols: liveProtocolRoles.map((role) => liveProtocolRow(snapshot.product_id, role)),
    dispositions,
  }
}

function stubRead(
  overrides: Record<string, LeaveInCalibrationSnapshot> = {},
  ledger: LeaveInCalibrationLedgerRow[] = [],
) {
  return {
    async appliedLedger() {
      return ledger
    },
    async liveRows(productId: string) {
      const target = LEAVE_IN_CALIBRATION_TARGETS.find(
        (candidate) => candidate.product_id === productId,
      )
      assert.ok(target)
      const manifest = manifestFor(target.product_key)
      const snapshot = overrides[productId] ?? manifest.current_catalog_target
      return liveRowsFrom(snapshot, manifest.research.live_protocol_roles)
    },
  }
}

test("the committed batch covers all nine calibration targets on the shared contract", () => {
  assert.equal(batch.schema_version, CATALOG_ENRICHMENT_SCHEMA_VERSION)
  assert.equal(batch.batch_id, LEAVE_IN_CALIBRATION_BATCH_ID)
  assert.equal(batch.lifecycle_classification, "existing_product_enrichment")
  assert.equal(batch.products.length, LEAVE_IN_CALIBRATION_TARGETS.length)

  for (const target of LEAVE_IN_CALIBRATION_TARGETS) {
    const manifest = manifestFor(target.product_key)
    assert.equal(manifest.target_product_id, target.product_id)
    const result = validateCatalogEnrichmentManifest(manifest)
    assert.equal(result.ok, true, `${target.product_key}: ${JSON.stringify(result)}`)
  }
})

test("every manifest pins the fingerprint of the snapshot it was built from", () => {
  for (const target of LEAVE_IN_CALIBRATION_TARGETS) {
    const manifest = manifestFor(target.product_key)
    const rebuilt = buildLeaveInCalibrationSnapshot(
      target.product_id,
      liveRowsFrom(manifest.current_catalog_target, manifest.research.live_protocol_roles),
    )
    assert.equal(
      manifest.target_fingerprint,
      leaveInCalibrationTargetFingerprint(rebuilt),
      target.product_key,
    )
  }
})

test("planned spec rows are the frozen projection verbatim", () => {
  for (const target of LEAVE_IN_CALIBRATION_TARGETS) {
    const manifest = manifestFor(target.product_key)
    const projection = (
      projections[`${target.slot}.json` as never] as never as {
        productionProjection: { category_specs: Manifest["category_payload"] }
      }
    ).productionProjection.category_specs

    assert.deepEqual(manifest.category_payload, projection, target.product_key)

    const specsOperation = manifest.planned_operations.find(
      (operation) => operation.table === "product_leave_in_specs" && operation.type === "upsert",
    )
    assert.ok(specsOperation?.rows)
    assert.deepEqual(specsOperation.rows[0], {
      product_id: target.product_id,
      ...projection.product_leave_in_specs,
    })
    // The contract's leave-in spec row is product_id plus twelve projected fields.
    assert.equal(Object.keys(specsOperation.rows[0] as object).length, 13)
  }
})

test("deletes are exactly the live eligibility rows the projection no longer contains", () => {
  for (const target of LEAVE_IN_CALIBRATION_TARGETS) {
    const manifest = manifestFor(target.product_key)
    const projected = new Set(
      manifest.category_payload.product_leave_in_eligibility.map(naturalKey),
    )
    const live = manifest.current_catalog_target.product_leave_in_eligibility as Array<
      Record<string, string>
    >
    const expected = live
      .filter((row) => !projected.has(naturalKey(row)))
      .map(naturalKey)
      .sort()

    const planned = manifest.planned_operations
      .filter((operation) => operation.type === "delete")
      .flatMap((operation) => operation.rows ?? [])
    assert.deepEqual(planned.map(naturalKey).sort(), expected, target.product_key)
    for (const row of planned) assert.equal(row.product_id, target.product_id)

    const upserted = manifest.planned_operations.find(
      (operation) =>
        operation.type === "upsert" && operation.table === "product_leave_in_eligibility",
    )
    assert.deepEqual(
      (upserted?.rows ?? []).map(naturalKey).sort(),
      [...projected].sort(),
      target.product_key,
    )
  }
})

test("preflight is read-only and gates on the publication dependency the apply would hit", async () => {
  const report = await preflightLeaveInCalibration({ read: stubRead(), batch })
  assert.equal(report.writes, false)
  assert.equal(report.summary.products, 9)
  assert.equal(report.summary.staleFingerprints, 0)
  assert.equal(report.summary.totalDeleteRows, 27)
  for (const product of report.products) {
    const types = product.execution_order.map((operation) => operation.type)
    const firstUpsert = types.indexOf("upsert")
    const lastDelete = types.lastIndexOf("delete")
    if (lastDelete !== -1) assert.ok(lastDelete < firstUpsert, `${product.slot} deletes first`)
  }

  // Redken's projection newly claims heat protection, so the deferred
  // curated-publication trigger demands a pre_heat_protection row with a valid
  // V2 pointer. Until the Stage-5 steps land, the preflight must refuse.
  assert.equal(report.ok, false)
  assert.equal(report.summary.productsOk, 8)
  // Both halves of the gate are missing for that role: the V1 guidance_payload
  // and the V2 pointer.
  assert.equal(report.summary.publicationBlockers, 2)
  const redken = report.products.find((product) => product.slot === "slot-09")
  assert.equal(redken?.ok, false)
  assert.deepEqual(redken?.errors, [])
  assert.equal(redken?.publication_blockers.length, 2)
  assert.ok(redken?.publication_blockers.every((entry) => entry.includes("pre_heat_protection")))
  assert.ok(redken?.publication_blockers.some((entry) => entry.includes("V1 guidance_payload")))
  assert.ok(redken?.publication_blockers.some((entry) => entry.includes("guidance_payload_v2")))

  // Once that row exists with a valid pointer, the same preflight goes green.
  const redkenId = "2b7db7e3-2058-4178-8a03-7d05f4a1d447"
  const withProtocol = await preflightLeaveInCalibration({
    read: {
      async appliedLedger() {
        return []
      },
      async liveRows(productId: string) {
        const rows = await stubRead().liveRows(productId)
        if (productId !== redkenId) return rows
        return {
          ...rows,
          protocols: [...rows.protocols, liveProtocolRow(redkenId, "pre_heat_protection")],
        }
      },
    },
    batch,
  })
  assert.equal(withProtocol.summary.publicationBlockers, 0)
  assert.equal(withProtocol.ok, true)

  const drifted = LEAVE_IN_CALIBRATION_TARGETS[0]
  const snapshot = manifestFor(drifted.product_key).current_catalog_target
  const stale = await preflightLeaveInCalibration({
    read: stubRead({
      [drifted.product_id]: {
        ...snapshot,
        products: { ...(snapshot.products ?? {}), is_chaarlie_recommended: false },
      },
    }),
    batch,
  })
  assert.equal(stale.ok, false)
  assert.equal(stale.summary.staleFingerprints, 1)
  const staleProduct = stale.products.find((product) => product.slot === drifted.slot)
  assert.equal(staleProduct?.target_fingerprint_matches, false)
  assert.ok(staleProduct?.errors.includes("target fingerprint is stale"))
})

test("authored protocols cover the roles the projection newly requires", () => {
  const authored = batch.products.flatMap((manifest) =>
    ((manifest as unknown as Manifest).authored_protocols ?? []).map((protocol) => ({
      manifest: manifest as unknown as Manifest,
      protocol: protocol as unknown as Record<string, string>,
    })),
  )
  assert.equal(authored.length, 3)

  for (const { manifest, protocol } of authored) {
    assert.equal(protocol.product_id, manifest.target_product_id)
    assert.equal(protocol.category, "leave_in")
    assert.equal(protocol.category_key, "leave_in")
    assert.ok(protocol.application_family)
    assert.ok(protocol.source_text)
    const parsed = applicationGuidanceProtocolSchema.safeParse(protocol.guidance_payload)
    assert.equal(parsed.success, true, JSON.stringify(parsed.error?.issues))
  }

  for (const target of LEAVE_IN_CALIBRATION_TARGETS) {
    const manifest = manifestFor(target.product_key)
    const authoredRoles = manifest.authored_protocols
      .map((protocol) => (protocol as unknown as { role: string }).role)
      .sort()
    assert.deepEqual(
      authoredRoles,
      [...manifest.research.missing_protocol_roles].sort(),
      target.product_key,
    )
  }
})

test("protocol rows never ride planned_operations on this contract", () => {
  for (const target of LEAVE_IN_CALIBRATION_TARGETS) {
    const manifest = manifestFor(target.product_key)
    assert.equal(
      manifest.planned_operations.some(
        (operation) => operation.table === "product_application_protocols",
      ),
      false,
      target.product_key,
    )
  }

  // Why they cannot: the shared contract validates every planned upsert against
  // validateProductIntakeCategorySpecs, which for leave_in emits only the three
  // spec tables. Pin that so a future contract change is a deliberate one.
  const neqi = manifestFor("leave-in-slot-13-neqi-diamond-glass")
  const forced = validateCatalogEnrichmentManifest({
    ...neqi,
    planned_operations: [
      ...neqi.planned_operations,
      {
        type: "upsert",
        table: "product_application_protocols",
        rows: neqi.authored_protocols,
      },
    ],
  })
  assert.equal(forced.ok, false)
  if (!forced.ok)
    assert.ok(
      forced.errors.includes(
        "existing_product_enrichment planned spec operations do not match shared category validation",
      ),
    )
})

// ---------------------------------------------------------------------------
// Executor: package, migration pin, guard flags, apply, verify
// ---------------------------------------------------------------------------

const migrationSql = readFileSync(
  `supabase/migrations/${LEAVE_IN_CALIBRATION_MIGRATION}_catalog_enrichment_leave_in_calibration_v1_executor.sql`,
  "utf8",
)

const built = buildLeaveInCalibrationPackage(batch)

function applyArgs(overrides: Record<string, string> = {}) {
  const flags: Record<string, string> = {
    "confirm-batch": LEAVE_IN_CALIBRATION_BATCH_ID,
    "reviewed-by": "nick",
    "reviewed-head": "a".repeat(40),
    "expect-migration": "applied",
    "expected-batch-fingerprint": built.fingerprint,
    "expected-content-fingerprint": built.cohort_index_fingerprint,
    ...overrides,
  }
  return [
    "--apply",
    "--confirm",
    ...Object.entries(flags).flatMap(([key, value]) => [`--${key}`, value]),
  ]
}

test("the package reduces the reviewed manifests without losing a planned row", () => {
  assert.equal(built.package.products.length, 9)
  assert.equal(built.package.batch_id, LEAVE_IN_CALIBRATION_BATCH_ID)
  assert.equal(
    built.package.products.reduce((total, product) => total + product.eligibility_delete.length, 0),
    27,
  )
  for (const target of LEAVE_IN_CALIBRATION_TARGETS) {
    const manifest = manifestFor(target.product_key)
    const product = built.package.products.find(
      (candidate) => candidate.product_key === target.product_key,
    )
    assert.ok(product)
    assert.equal(product.target_fingerprint, manifest.target_fingerprint)
    assert.deepEqual(product.leave_in_specs, manifest.category_payload.product_leave_in_specs)
    assert.deepEqual(
      product.leave_in_fit_specs,
      manifest.category_payload.product_leave_in_fit_specs,
    )
    assert.equal(
      product.eligibility_upsert.length,
      manifest.category_payload.product_leave_in_eligibility.length,
    )
    // Research prose never reaches the executor payload.
    assert.equal("field_rationales" in product, false)
  }
})

test("the executor migration pins exactly the fingerprints this package produces", () => {
  assert.equal(built.fingerprint, LEAVE_IN_CALIBRATION_APPROVED_BATCH_FINGERPRINT)
  assert.equal(built.cohort_index_fingerprint, LEAVE_IN_CALIBRATION_COHORT_INDEX_FINGERPRINT)
  assert.ok(migrationSql.includes(built.fingerprint), "migration pins the batch fingerprint")
  assert.ok(
    migrationSql.includes(built.cohort_index_fingerprint),
    "migration pins the cohort index",
  )
  assert.ok(migrationSql.includes(LEAVE_IN_CALIBRATION_RPC))
  assert.ok(migrationSql.includes("GRANT EXECUTE ON FUNCTION public." + LEAVE_IN_CALIBRATION_RPC))
  assert.ok(migrationSql.includes("FROM PUBLIC, anon, authenticated"))
  // Every approved key/id pair is allowlisted inside the executor itself.
  for (const target of LEAVE_IN_CALIBRATION_TARGETS) {
    assert.ok(
      migrationSql.includes(`('${target.product_key}', '${target.product_id}')`),
      target.product_key,
    )
  }
})

/**
 * Extracts the literal jsonb_build_object keys of one named sub-object inside a
 * SQL function body. A string-grep would pass a rename in either direction; set
 * equality does not.
 */
function sqlObjectKeys(sql: string, label: string): string[] {
  const start = sql.indexOf(`'${label}', coalesce((`)
  assert.ok(start >= 0, `SQL has no ${label} sub-object`)
  const bodyStart = sql.indexOf("jsonb_build_object(", start)
  assert.ok(bodyStart >= 0, `${label} is not a jsonb_build_object`)
  let depth = 0
  let index = sql.indexOf("(", bodyStart)
  let end = -1
  for (; index < sql.length; index += 1) {
    if (sql[index] === "(") depth += 1
    else if (sql[index] === ")") {
      depth -= 1
      if (depth === 0) {
        end = index
        break
      }
    }
  }
  assert.ok(end > bodyStart, `${label} sub-object is unbalanced`)
  return [...sql.slice(bodyStart, end).matchAll(/'([a-z_]+)',/g)].map((match) => match[1]!)
}

test("the SQL drift snapshot covers exactly the columns the TypeScript snapshot hashes", () => {
  const guard = migrationSql.slice(
    migrationSql.indexOf("FUNCTION public.leave_in_calibration_current_target"),
    migrationSql.indexOf("FUNCTION public.leave_in_calibration_normalize_target"),
  )
  assert.ok(guard.length > 0)

  const compare = (sql: string, label: string, expected: readonly string[]) => {
    const actual = sqlObjectKeys(sql, label)
    return (
      actual.length === expected.length &&
      JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort())
    )
  }

  assert.ok(
    compare(guard, "products", LEAVE_IN_CALIBRATION_PRODUCT_COLUMNS),
    `products keys: ${sqlObjectKeys(guard, "products").join(",")}`,
  )
  assert.ok(
    compare(guard, "product_leave_in_specs", LEAVE_IN_CALIBRATION_SPEC_COLUMNS),
    `spec keys: ${sqlObjectKeys(guard, "product_leave_in_specs").join(",")}`,
  )
  assert.ok(
    compare(guard, "product_leave_in_fit_specs", LEAVE_IN_CALIBRATION_FIT_COLUMNS),
    `fit keys: ${sqlObjectKeys(guard, "product_leave_in_fit_specs").join(",")}`,
  )

  // The comparator must actually catch a rename — prove it on a mutated copy
  // rather than trusting that a grep would have noticed.
  const renamed = guard.replace("'weight', spec.weight,", "'format', spec.weight,")
  assert.notEqual(renamed, guard, "rename fixture did not apply")
  assert.equal(
    compare(renamed, "product_leave_in_specs", LEAVE_IN_CALIBRATION_SPEC_COLUMNS),
    false,
    "a renamed SQL column must fail the parity check",
  )
  const dropped = guard.replace("'image_url', product.image_url", "product.image_url")
  assert.notEqual(dropped, guard, "drop fixture did not apply")
  assert.equal(
    compare(dropped, "products", LEAVE_IN_CALIBRATION_PRODUCT_COLUMNS),
    false,
    "a dropped SQL column must fail the parity check",
  )

  for (const column of LEAVE_IN_ELIGIBILITY_NATURAL_KEY)
    assert.ok(guard.includes(`'${column}',`), `eligibility.${column}`)
  // Deletes must run before the upserts inside the executor, too.
  const body = migrationSql.slice(
    migrationSql.indexOf(`FUNCTION public.${LEAVE_IN_CALIBRATION_RPC}`),
  )
  assert.ok(
    body.indexOf("DELETE FROM public.product_leave_in_eligibility") <
      body.indexOf("INSERT INTO public.product_leave_in_specs"),
    "delete precedes upsert",
  )
  // Row locks must be taken before the snapshot is read (TOCTOU).
  assert.ok(
    body.indexOf("FOR UPDATE") < body.indexOf("public.leave_in_calibration_current_target(v_pid)"),
    "row locks precede the drift read",
  )
  // The OUT columns must not shadow table columns used in ON CONFLICT targets.
  assert.ok(body.includes("#variable_conflict use_column"))
  assert.equal(/RETURNS TABLE\(\s*product_id /.test(migrationSql), false)
})

test("apply guard flags fail closed", () => {
  assert.deepEqual(parseLeaveInCalibrationApplyArgs([]).apply, false)
  assert.equal(parseLeaveInCalibrationApplyArgs(applyArgs()).apply, true)
  for (const broken of [
    applyArgs({ "reviewed-by": "someone-else" }),
    applyArgs({ "confirm-batch": "another-batch" }),
    applyArgs({ "reviewed-head": "short" }),
    applyArgs({ "expect-migration": "absent" }),
    applyArgs().filter((token) => token !== "--confirm"),
    applyArgs().filter(
      (token, index, all) =>
        token !== "--expected-batch-fingerprint" &&
        all[index - 1] !== "--expected-batch-fingerprint",
    ),
  ]) {
    assert.throws(
      () => parseLeaveInCalibrationApplyArgs(broken),
      /Leave-In calibration apply requires/,
    )
  }
})

test("apply refuses anything but a green preflight on the exact reviewed head", async () => {
  const calls: Array<Record<string, unknown>> = []
  const write = {
    async rpc(name: typeof LEAVE_IN_CALIBRATION_RPC, args: Record<string, unknown>) {
      calls.push({ name, ...args })
    },
  }
  const cleanHead = { head: "a".repeat(40), clean: true }
  const greenPreflight = await preflightLeaveInCalibration({ read: stubRead(), batch })
  const forced = { ...greenPreflight, ok: true }

  await assert.rejects(
    applyLeaveInCalibration({
      args: parseLeaveInCalibrationApplyArgs(applyArgs()),
      preflight: { ...greenPreflight, ok: false },
      built,
      run: { mode: "first_apply" as const },
      gitState: async () => cleanHead,
      write,
    }),
    /preflight is not green/,
  )
  await assert.rejects(
    applyLeaveInCalibration({
      args: parseLeaveInCalibrationApplyArgs(
        applyArgs({ "expected-batch-fingerprint": "b".repeat(64) }),
      ),
      preflight: forced,
      built,
      run: { mode: "first_apply" as const },
      gitState: async () => cleanHead,
      write,
    }),
    /batch fingerprint does not match/,
  )
  await assert.rejects(
    applyLeaveInCalibration({
      args: parseLeaveInCalibrationApplyArgs(applyArgs()),
      preflight: forced,
      built,
      run: { mode: "first_apply" as const },
      gitState: async () => ({ head: "a".repeat(40), clean: false }),
      write,
    }),
    /exact clean reviewed head/,
  )
  assert.equal(calls.length, 0, "no RPC call on any rejected path")

  const result = await applyLeaveInCalibration({
    args: parseLeaveInCalibrationApplyArgs(applyArgs()),
    preflight: forced,
    built,
    run: { mode: "first_apply" },
    gitState: async () => cleanHead,
    write,
  })
  assert.equal(result.applied, true)
  assert.equal(result.deleted_rows, 27)
  assert.equal(calls.length, 1)
  assert.equal(calls[0]?.name, LEAVE_IN_CALIBRATION_RPC)
  assert.equal(calls[0]?.p_batch_json, built.canonical_json)
  assert.equal(calls[0]?.p_expected_batch_fingerprint, built.fingerprint)
  assert.equal(calls[0]?.p_reviewed_by, "nick")
})

test("verify is read-only and catches a surviving deleted row", async () => {
  const appliedRead = {
    async appliedLedger() {
      return [] as LeaveInCalibrationLedgerRow[]
    },
    async liveRows(productId: string) {
      const product = built.package.products.find(
        (candidate) => candidate.product_id === productId,
      )!
      return {
        product: { suitable_thicknesses: product.suitable_thicknesses },
        specs: product.leave_in_specs,
        fitSpecs: product.leave_in_fit_specs,
        eligibility: product.eligibility_upsert.map((row) => ({ ...row })),
        protocols: [],
        dispositions: [],
      }
    },
  }
  const green = await verifyLeaveInCalibration({ read: appliedRead, built })
  assert.equal(green.writes, false)
  assert.equal(green.ok, true)
  assert.equal(green.products.length, 9)

  const leftover = built.package.products.find((product) => product.eligibility_delete.length > 0)!
  const stale = await verifyLeaveInCalibration({
    read: {
      async appliedLedger() {
        return [] as LeaveInCalibrationLedgerRow[]
      },
      async liveRows(productId: string) {
        const rows = await appliedRead.liveRows(productId)
        return productId === leftover.product_id
          ? { ...rows, eligibility: [...rows.eligibility, { ...leftover.eligibility_delete[0]! }] }
          : rows
      },
    },
    built,
  })
  assert.equal(stale.ok, false)
  const failed = stale.products.find((product) => product.product_id === leftover.product_id)
  assert.ok(failed?.mismatches.some((entry) => entry.startsWith("deleted row still present")))
})

test("the Stage-5 protocol batch is a valid lane input with Neqi explicitly blocked", () => {
  // Deliberately NOT in the lane's own input directory: protocol-research/ is
  // baseline-pinned (a new file there breaks personal-plan:application-audit) and
  // protocol-amendments/ requires a disposition row Redken does not have. The
  // manifest is still validated through the lane's own validator so whichever
  // route Nick picks starts from something the lane accepts.
  const laneManifest = JSON.parse(
    readFileSync("plans/leave-in-apply/S5-14-leave-in-calibration.json", "utf8"),
  ) as {
    schema_version: string
    batch_id: string
    category_key: string
    products: Array<{
      product_id: string
      role: string
      research_status: string
      blockers: string[]
      guidance_payload: unknown
      sources: Array<{ url: string; text: string }>
    }>
  }

  assert.equal(laneManifest.schema_version, "personal-plan-stage5-protocol-research-v1")
  assert.equal(laneManifest.category_key, "leave_in")
  assert.match(laneManifest.batch_id, /^S5-[0-9]{2}-[a-z0-9-]+$/)
  assert.equal(laneManifest.products.length, 3)

  const identities = laneManifest.products.map((product) => `${product.product_id}:${product.role}`)
  assert.equal(new Set(identities).size, identities.length)

  const redken = laneManifest.products.filter(
    (product) => product.product_id === "2b7db7e3-2058-4178-8a03-7d05f4a1d447",
  )
  assert.equal(redken.length, 1)
  assert.equal(redken[0]?.research_status, "verified")
  assert.equal(redken[0]?.role, "pre_heat_protection")
  assert.deepEqual(redken[0]?.blockers, [])
  assert.equal(
    applicationGuidanceProtocolSchema.safeParse(redken[0]?.guidance_payload).success,
    true,
  )

  const neqi = laneManifest.products.filter(
    (product) => product.product_id === "42a2fe20-bd7e-49a3-a880-8ae89015a5c9",
  )
  assert.equal(neqi.length, 2)
  for (const product of neqi) {
    assert.equal(product.research_status, "blocked_identity_or_commercial")
    assert.equal(product.guidance_payload, null)
    assert.equal(product.blockers.length, 1)
    assert.match(product.blockers[0]!, /user_submitted/)
  }

  // The blocked rows keep their authored copy in the enrichment manifest.
  const authored = manifestFor("leave-in-slot-13-neqi-diamond-glass").authored_protocols
  assert.equal(authored.length, 2)

  const builtBatch = buildStage5ProtocolApplyBatch(validateProtocolResearchManifest(laneManifest))
  assert.equal(builtBatch.batch.protocols.length, 1)
  assert.equal(builtBatch.batch.protocols[0]?.product_id, "2b7db7e3-2058-4178-8a03-7d05f4a1d447")
  assert.equal(builtBatch.batch.batch_id, "S5-14-leave-in-calibration")
})

test("publication parity exempts a product carrying a search disposition", async () => {
  // Both SQL halves (assert_personal_plan_curated_publication_v1_without_v2 and
  // the V2 wrapper) RETURN early when a personal_plan_product_search_dispositions
  // row exists, so the required-role protocol check never runs for that product.
  // The CLI preflight has to agree, or it blocks an apply the database allows.
  const redkenId = "2b7db7e3-2058-4178-8a03-7d05f4a1d447"
  const readWith = (dispositions: Array<Record<string, unknown>>) => ({
    async appliedLedger() {
      return []
    },
    async liveRows(productId: string) {
      const rows = await stubRead().liveRows(productId)
      // Protocols absent for every product in both arms of this probe.
      if (productId !== redkenId) return rows
      return { ...rows, dispositions }
    },
  })

  // Disposition absent + protocols absent -> still blocked.
  const withoutDisposition = await preflightLeaveInCalibration({ read: readWith([]), batch })
  const blockedRedken = withoutDisposition.products.find((product) => product.slot === "slot-09")
  assert.equal(blockedRedken?.publication_blockers.length, 2)
  assert.equal(withoutDisposition.summary.publicationBlockers, 2)
  assert.equal(withoutDisposition.ok, false)

  // Disposition present + protocols absent -> publication check passes.
  const withDisposition = await preflightLeaveInCalibration({
    read: readWith([
      {
        product_id: redkenId,
        disposition: "awaiting_exact_analysis",
        reason_code: "insufficient_executable_directions",
        reviewed_by: "nick",
      },
    ]),
    batch,
  })
  const exemptRedken = withDisposition.products.find((product) => product.slot === "slot-09")
  assert.deepEqual(exemptRedken?.publication_blockers, [])
  assert.equal(exemptRedken?.ok, true)
  assert.equal(withDisposition.summary.publicationBlockers, 0)
  assert.equal(withDisposition.summary.productsOk, 9)
  assert.equal(withDisposition.ok, true)
})

test("publication parity rejects a V2-ok protocol whose V1 payload is incomplete", async () => {
  const redkenId = "2b7db7e3-2058-4178-8a03-7d05f4a1d447"
  // V2 pointer valid, V1 payload present but with no evidence entry matching
  // source_url — exactly what assert_personal_plan_curated_publication_v1_without_v2
  // rejects, and what a V2-only check would have waved through.
  const v1Broken = liveProtocolRow(redkenId, "pre_heat_protection", {
    guidance_payload: {
      scope: { kind: "product", category: "leave_in", productId: redkenId },
      evidence: [
        {
          sourceUrl: "https://example.test/other",
          sourceType: "manufacturer",
          checkedAt: "2026-09-14",
        },
      ],
    },
  })
  const report = await preflightLeaveInCalibration({
    read: {
      async appliedLedger() {
        return [] as LeaveInCalibrationLedgerRow[]
      },
      async liveRows(productId: string) {
        const rows = await stubRead().liveRows(productId)
        return productId === redkenId ? { ...rows, protocols: [...rows.protocols, v1Broken] } : rows
      },
    },
    batch,
  })
  const redken = report.products.find((product) => product.slot === "slot-09")
  assert.equal(redken?.ok, false)
  assert.equal(
    redken?.publication_blockers.some((entry) => entry.includes("V1 guidance_payload")),
    true,
  )
  assert.equal(
    redken?.publication_blockers.some((entry) => entry.includes("guidance_payload_v2")),
    false,
    "the V2 half is satisfied; only the V1 half must fail",
  )

  // Blank source_text is the other V1 rule the trigger enforces.
  const blankText = liveProtocolRow(redkenId, "pre_heat_protection", { source_text: "   " })
  const blankReport = await preflightLeaveInCalibration({
    read: {
      async appliedLedger() {
        return [] as LeaveInCalibrationLedgerRow[]
      },
      async liveRows(productId: string) {
        const rows = await stubRead().liveRows(productId)
        return productId === redkenId
          ? { ...rows, protocols: [...rows.protocols, blankText] }
          : rows
      },
    },
    batch,
  })
  assert.equal(
    blankReport.products
      .find((product) => product.slot === "slot-09")
      ?.publication_blockers.some((entry) => entry.includes("V1 guidance_payload")),
    true,
  )
})

function ledgerFor(fingerprintOverride?: Partial<LeaveInCalibrationLedgerRow>) {
  return built.package.products.map((product) => ({
    batch_id: LEAVE_IN_CALIBRATION_BATCH_ID,
    product_key: product.product_key,
    batch_fingerprint: built.fingerprint,
    content_fingerprint: product.content_fingerprint,
    product_id: product.product_id,
    reviewed_by: "nick",
    ...fingerprintOverride,
  })) as LeaveInCalibrationLedgerRow[]
}

test("a committed-but-lost apply retries into replay verification instead of refusing", async () => {
  // State after a successful apply: the ledger is written and every
  // target_fingerprint is stale, because the apply itself changed those rows.
  const appliedSnapshots = Object.fromEntries(
    LEAVE_IN_CALIBRATION_TARGETS.map((target) => {
      const manifest = manifestFor(target.product_key)
      const snapshot = manifest.current_catalog_target
      return [
        target.product_id,
        {
          ...snapshot,
          product_leave_in_specs: {
            ...(snapshot.product_leave_in_specs ?? {}),
            ...manifest.category_payload.product_leave_in_specs,
          },
        } as LeaveInCalibrationSnapshot,
      ]
    }),
  )

  const stalePreflight = await preflightLeaveInCalibration({
    read: stubRead(appliedSnapshots, ledgerFor()),
    batch,
  })
  assert.equal(stalePreflight.ok, false, "fingerprints are stale after a real apply")
  assert.ok(stalePreflight.summary.staleFingerprints > 0)

  const replay = classifyLeaveInCalibrationRun({
    built,
    preflight: stalePreflight,
    ledger: ledgerFor(),
  })
  assert.equal(replay.mode, "replay")
  if (replay.mode === "replay") assert.equal(replay.ledgerRows, 9)

  const calls: Array<Record<string, unknown>> = []
  const result = await applyLeaveInCalibration({
    args: parseLeaveInCalibrationApplyArgs(applyArgs()),
    preflight: stalePreflight,
    built,
    run: replay,
    gitState: async () => ({ head: "a".repeat(40), clean: true }),
    write: {
      async rpc(name: typeof LEAVE_IN_CALIBRATION_RPC, args: Record<string, unknown>) {
        calls.push({ name, ...args })
      },
    },
  })
  assert.equal(result.replay, true)
  assert.equal(result.deleted_rows, 0, "a replay deletes nothing")
  assert.equal(calls.length, 1, "the replay still reaches the executor's verification")
  assert.equal(calls[0]?.p_batch_json, built.canonical_json)

  // An empty ledger with a red preflight stays blocked.
  assert.deepEqual(
    classifyLeaveInCalibrationRun({ built, preflight: stalePreflight, ledger: [] }).mode,
    "blocked",
  )
  // A partial ledger is never treated as a replay.
  const partial = classifyLeaveInCalibrationRun({
    built,
    preflight: stalePreflight,
    ledger: ledgerFor().slice(0, 4),
  })
  assert.equal(partial.mode, "blocked")
  if (partial.mode === "blocked")
    assert.ok(partial.reasons.some((reason) => reason.includes("partial state")))
  // A ledger written by a different batch is never treated as a replay.
  const foreign = classifyLeaveInCalibrationRun({
    built,
    preflight: stalePreflight,
    ledger: ledgerFor({ batch_fingerprint: "c".repeat(64) }),
  })
  assert.equal(foreign.mode, "blocked")
  if (foreign.mode === "blocked")
    assert.ok(foreign.reasons.some((reason) => reason.includes("different batch fingerprint")))
})
