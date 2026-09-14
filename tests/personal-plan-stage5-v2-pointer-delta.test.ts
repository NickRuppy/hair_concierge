import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  STAGE5_V2_ARTIFACT_PATH,
  STAGE5_V2_POINTER_DELTA_DEFAULT_FILE,
  STAGE5_V2_POINTER_DELTA_MIGRATION,
  STAGE5_V2_POINTER_DELTA_RPC,
  buildStage5V2PointerDelta,
  findStage5V2PointerCoverageGaps,
  parseStage5V2PointerDeltaApplyArgs,
  preflightStage5V2PointerDelta,
  stage5V2PointerDeltaLedgerKey,
} from "../src/lib/product-intake/catalog-enrichment/stage5-v2-pointer-delta"
import type { Stage5V2ApplicationPreflightRead } from "../src/lib/product-intake/catalog-enrichment/stage5-v2-application"

const REDKEN_ID = "2b7db7e3-2058-4178-8a03-7d05f4a1d447"
const REDKEN_KEY = `${REDKEN_ID}:pre_heat_protection:pre_heat_damp`

const artifactText = readFileSync(STAGE5_V2_ARTIFACT_PATH, "utf8")
const deltaText = readFileSync(STAGE5_V2_POINTER_DELTA_DEFAULT_FILE, "utf8")
const delta = JSON.parse(deltaText)

/**
 * The authored S5-14 / S5R-05 V1 payload, i.e. the exact row the protocol batch
 * writes. Using the real payload rather than a stub is what makes the fingerprint
 * assertions below meaningful: `source_fingerprint` in the reviewed artifact is a
 * hash of THIS content.
 */
const carryForwardPayload = JSON.parse(
  readFileSync(
    "data/catalog-enrichment/personal-plan-stage5-v1/S5R-05-leave-in-calibration-protocol-carry-forward.json",
    "utf8",
  ),
).items[0].protocol.guidance_payload

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function readFor(overrides: {
  product?: Record<string, unknown> | null
  protocol?: Record<string, unknown> | null
}): Stage5V2ApplicationPreflightRead {
  return {
    async listProducts() {
      const product = overrides.product
      if (product === null) return []
      return [
        {
          id: REDKEN_ID,
          category_key: "leave_in",
          origin: "curated",
          is_active: true,
          lifecycle_status: "active",
          ...product,
        },
      ] as Awaited<ReturnType<Stage5V2ApplicationPreflightRead["listProducts"]>>
    },
    async listProtocols() {
      const protocol = overrides.protocol
      if (protocol === null) return []
      return [
        {
          product_id: REDKEN_ID,
          category: "leave_in",
          role: "pre_heat_protection",
          application_family: "pre_heat_damp",
          guidance_payload: carryForwardPayload,
          guidance_payload_v2: null,
          ...protocol,
        },
      ] as Awaited<ReturnType<Stage5V2ApplicationPreflightRead["listProtocols"]>>
    },
  }
}

test("the reviewed delta carries exactly the one Redken pointer, byte-derived from the artifact", () => {
  const built = buildStage5V2PointerDelta({ delta, artifactText })

  assert.equal(built.delta.batch_id, "S5V2D-01-leave-in-calibration-redken")
  assert.equal(built.delta.items.length, 1)
  assert.deepEqual(built.ledger_keys, [`v2-delta:${REDKEN_ID}:pre_heat_protection`])
  assert.equal(
    stage5V2PointerDeltaLedgerKey({ product_id: REDKEN_ID, source_role: "pre_heat_protection" }),
    `v2-delta:${REDKEN_ID}:pre_heat_protection`,
  )
  assert.equal(
    built.delta.items[0]!.source_fingerprint,
    "8e1b1bbc51ce497047f75891d18bc5b87125dbe6a0b20b01a95f7b5f8fa7b8cb",
  )
  assert.equal(
    built.fingerprint,
    createHash("sha256").update(built.canonical_json, "utf8").digest("hex"),
  )
  assert.match(built.fingerprint, /^[a-f0-9]{64}$/)

  // The delta is derived, never authored: it must equal the artifact item bytes.
  const reviewed = JSON.parse(artifactText).items.find(
    (item: { key: string }) => item.key === REDKEN_KEY,
  )
  assert.deepEqual(built.delta.items[0]!.guidance_payload_v2, reviewed.guidance_payload_v2)
  assert.equal(built.delta.items[0]!.source_fingerprint, reviewed.source_fingerprint)
})

test("a delta whose pointer was edited is refused instead of applied", () => {
  const mutated = clone(delta)
  mutated.items[0].guidance_payload_v2.facts.applicationArea = "hair_ends"
  assert.throws(
    () => buildStage5V2PointerDelta({ delta: mutated, artifactText }),
    /item_diverges_from_artifact/,
  )
})

test("a delta whose source fingerprint was edited is refused", () => {
  const mutated = clone(delta)
  mutated.items[0].source_fingerprint = "a".repeat(64)
  assert.throws(
    () => buildStage5V2PointerDelta({ delta: mutated, artifactText }),
    /item_diverges_from_artifact/,
  )
})

test("a delta item that is not in the reviewed artifact is refused", () => {
  const mutated = clone(delta)
  mutated.items[0].key = `${REDKEN_ID}:pre_heat_protection:invented_family`
  assert.throws(
    () => buildStage5V2PointerDelta({ delta: mutated, artifactText }),
    /item_not_in_artifact/,
  )
})

test("a delta pinned to different artifact bytes is refused", () => {
  assert.throws(
    () => buildStage5V2PointerDelta({ delta, artifactText: `${artifactText}\n` }),
    /source_artifact_fingerprint_mismatch/,
  )
  const mutated = clone(delta)
  mutated.source_artifact.path = "data/somewhere-else.json"
  assert.throws(
    () => buildStage5V2PointerDelta({ delta: mutated, artifactText }),
    /unexpected_source_artifact_path/,
  )
})

test("the delta envelope is schema-pinned: batch id, count, size, and duplicates", () => {
  const badBatch = clone(delta)
  badBatch.batch_id = "S5-01-leave-in"
  assert.throws(() => buildStage5V2PointerDelta({ delta: badBatch, artifactText }))

  const badCount = clone(delta)
  badCount.observed_counts.items = 2
  assert.throws(
    () => buildStage5V2PointerDelta({ delta: badCount, artifactText }),
    /observed_item_count_mismatch/,
  )

  const duplicate = clone(delta)
  duplicate.items = [duplicate.items[0], clone(duplicate.items[0])]
  duplicate.observed_counts.items = 2
  assert.throws(
    () => buildStage5V2PointerDelta({ delta: duplicate, artifactText }),
    /duplicate_item_key/,
  )

  const empty = clone(delta)
  empty.items = []
  empty.observed_counts.items = 0
  assert.throws(() => buildStage5V2PointerDelta({ delta: empty, artifactText }))

  const extraField = clone(delta)
  extraField.notes = "hello"
  assert.throws(() => buildStage5V2PointerDelta({ delta: extraField, artifactText }))

  const oversized = clone(delta)
  oversized.items = Array.from({ length: 21 }, (_unused, index) => ({
    ...clone(delta.items[0]),
    key: `${REDKEN_KEY}-${index}`,
  }))
  oversized.observed_counts.items = 21
  assert.throws(() => buildStage5V2PointerDelta({ delta: oversized, artifactText }))
})

test("preflight classifies a NULL live pointer as will_write", async () => {
  const built = buildStage5V2PointerDelta({ delta, artifactText })
  const result = await preflightStage5V2PointerDelta({ built, read: readFor({}) })

  assert.equal(result.ok, true)
  assert.deepEqual(result.blockers, [])
  assert.deepEqual(result.items, [{ key: REDKEN_KEY, status: "will_write", blocker: null }])
  assert.deepEqual(result.observed, { items: 1, will_write: 1, already_applied: 0 })
  assert.equal(result.batch_id, "S5V2D-01-leave-in-calibration-redken")
  assert.equal(result.fingerprint, built.fingerprint)
})

test("preflight classifies an identical live pointer as already_applied", async () => {
  const built = buildStage5V2PointerDelta({ delta, artifactText })
  const result = await preflightStage5V2PointerDelta({
    built,
    read: readFor({
      protocol: { guidance_payload_v2: clone(built.delta.items[0]!.guidance_payload_v2) },
    }),
  })

  assert.equal(result.ok, true)
  assert.deepEqual(result.items, [{ key: REDKEN_KEY, status: "already_applied", blocker: null }])
  assert.deepEqual(result.observed, { items: 1, will_write: 0, already_applied: 1 })
})

test("preflight blocks on a conflicting live pointer, a missing row, and a diverged source", async () => {
  const built = buildStage5V2PointerDelta({ delta, artifactText })

  const conflicting = clone(built.delta.items[0]!.guidance_payload_v2) as {
    facts: { applicationArea: string }
  }
  conflicting.facts.applicationArea = "hair_ends"
  const conflict = await preflightStage5V2PointerDelta({
    built,
    read: readFor({ protocol: { guidance_payload_v2: conflicting } }),
  })
  assert.equal(conflict.ok, false)
  assert.deepEqual(conflict.blockers, [`v2_authority_conflict:${REDKEN_KEY}`])
  assert.equal(conflict.items[0]!.status, "conflict")

  const missing = await preflightStage5V2PointerDelta({ built, read: readFor({ protocol: null }) })
  assert.equal(missing.ok, false)
  assert.deepEqual(missing.blockers, [`source_protocol_missing:${REDKEN_KEY}`])

  const nullPayload = await preflightStage5V2PointerDelta({
    built,
    read: readFor({ protocol: { guidance_payload: null } }),
  })
  assert.deepEqual(nullPayload.blockers, [`source_protocol_missing:${REDKEN_KEY}`])

  const otherFamily = await preflightStage5V2PointerDelta({
    built,
    read: readFor({ protocol: { application_family: "pre_heat_dry" } }),
  })
  assert.deepEqual(
    otherFamily.blockers,
    [`source_protocol_missing:${REDKEN_KEY}`],
    "a row for another application family is not this item's source row",
  )

  const diverged = await preflightStage5V2PointerDelta({
    built,
    read: readFor({ protocol: { guidance_payload: { ...carryForwardPayload, locale: "en" } } }),
  })
  assert.equal(diverged.ok, false)
  assert.deepEqual(diverged.blockers, [`source_protocol_diverged:${REDKEN_KEY}`])
})

test("preflight blocks when the product is missing, inactive, or recategorised", async () => {
  const built = buildStage5V2PointerDelta({ delta, artifactText })
  for (const product of [
    null,
    { is_active: false },
    { lifecycle_status: "retired" },
    { origin: "user" },
    { category_key: "oil" },
  ]) {
    const result = await preflightStage5V2PointerDelta({ built, read: readFor({ product }) })
    assert.equal(result.ok, false, JSON.stringify(product))
    assert.deepEqual(result.blockers, [`product_state_diverged:${REDKEN_KEY}`])
    assert.equal(result.items[0]!.status, "blocked")
  }
})

test("the delta apply is a dry run unless every explicit production gate is present", () => {
  assert.deepEqual(parseStage5V2PointerDeltaApplyArgs([]), { apply: false })
  assert.deepEqual(parseStage5V2PointerDeltaApplyArgs(["--file=x.json"]), { apply: false })
  assert.throws(() => parseStage5V2PointerDeltaApplyArgs(["--apply"]), /confirm-project/)
  assert.throws(() => parseStage5V2PointerDeltaApplyArgs(["--wat"]), /unknown_argument/)
  assert.throws(
    () =>
      parseStage5V2PointerDeltaApplyArgs([
        "--apply",
        "--confirm-project=pqdkhefxsxkyeqelqegq",
        "--reviewed-head=nope",
        `--expected-fingerprint=${"a".repeat(64)}`,
      ]),
    /valid_reviewed_head_is_required/,
  )
  assert.throws(
    () =>
      parseStage5V2PointerDeltaApplyArgs([
        "--apply",
        "--confirm-project=pqdkhefxsxkyeqelqegq",
        "--reviewed-head=1111111111111111111111111111111111111111",
        "--expected-fingerprint=short",
      ]),
    /valid_expected_fingerprint_is_required/,
  )
  assert.deepEqual(
    parseStage5V2PointerDeltaApplyArgs([
      "--apply",
      "--confirm-project=pqdkhefxsxkyeqelqegq",
      "--reviewed-head=1111111111111111111111111111111111111111",
      `--expected-fingerprint=${"a".repeat(64)}`,
    ]),
    {
      apply: true,
      reviewedHead: "1111111111111111111111111111111111111111",
      expectedFingerprint: "a".repeat(64),
    },
  )
})

test("the coverage audit reports live curated rows that have V1 guidance but no V2 pointer", () => {
  const rows = [
    {
      product_id: REDKEN_ID,
      category: "leave_in",
      role: "pre_heat_protection",
      guidance_payload: carryForwardPayload,
      guidance_payload_v2: null,
    },
    {
      product_id: REDKEN_ID,
      category: "leave_in",
      role: "post_wash_leave_in",
      guidance_payload: carryForwardPayload,
      guidance_payload_v2: { schemaVersion: 2 },
    },
    {
      product_id: "aadbbab5-0000-0000-0000-000000000000",
      category: "bondbuilder",
      role: "pre_shampoo_treatment",
      guidance_payload: null,
      guidance_payload_v2: null,
    },
  ]
  const gaps = findStage5V2PointerCoverageGaps(rows)
  assert.equal(gaps.length, 1)
  assert.equal(gaps[0]!.role, "pre_heat_protection")
})

test("the retired full-registry apply refuses before it can reach the database", () => {
  const source = readFileSync(
    "scripts/product-intake/catalog-enrichment/stage5-v2-apply.ts",
    "utf8",
  )
  assert.match(source, /RETIRED/)
  assert.match(source, /stage5-v2-pointer-delta/)
  assert.match(source, /personal-plan:pointer-coverage-audit/)
  assert.match(source, /process\.exitCode = 1/)
  assert.doesNotMatch(
    source,
    /stage5ProtocolClientAdapters|createSupabaseClientFromEnv/,
    "the retired lane must not be able to reach the database at all",
  )

  // The read-only preflight stays runnable for the historical record, but says so.
  const preflightSource = readFileSync(
    "scripts/product-intake/catalog-enrichment/stage5-v2-preflight.ts",
    "utf8",
  )
  assert.match(preflightSource, /RETIRED/)
  assert.match(preflightSource, /stage5-v2-pointer-delta/)
  assert.match(preflightSource, /preflightStage5V2ApplicationArtifact/)
})

test("the delta executor migration is atomic, fingerprint-pinned, and service-role only", () => {
  const source = readFileSync(
    `supabase/migrations/${STAGE5_V2_POINTER_DELTA_MIGRATION}_personal_plan_stage5_v2_pointer_delta_executor.sql`,
    "utf8",
  )
  assert.match(source, new RegExp(`${STAGE5_V2_POINTER_DELTA_RPC}\\(text, text, text\\)`))
  assert.match(source, /SECURITY DEFINER/)
  assert.match(source, /SET search_path = ''/)
  assert.match(source, /#variable_conflict use_column/)
  assert.match(source, /pg_advisory_xact_lock/)
  // The shared cross-executor serialization key: every catalog-apply executor
  // that takes product row locks must hold this before locking, so two
  // executors with different product-lock orders can never deadlock.
  assert.match(source, /'catalog-enrichment:product-apply'/)
  assert.match(source, /personal_plan_stage5_v2_canonical_json_v1/)
  assert.match(source, /extensions\.digest\(/)
  assert.match(source, /\^S5V2D-\[0-9\]\{2\}-\[a-z0-9-\]\+\$/)
  assert.match(source, /v2-delta:/)
  assert.match(source, /REVOKE ALL[\s\S]*FROM PUBLIC, anon, authenticated/)
  assert.match(source, /GRANT EXECUTE[\s\S]*TO service_role/)
  assert.doesNotMatch(source, /DROP FUNCTION[\s\S]*apply_personal_plan_stage5_v2_artifact_v1/)
})
