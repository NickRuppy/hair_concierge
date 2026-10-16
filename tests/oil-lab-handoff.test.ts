import assert from "node:assert/strict"
import test from "node:test"
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { ProductIntakeSubmissionDetail } from "../packages/product-intake-core/src/jobs"
import {
  buildOilLabReviewPackage,
  readOilLabPackage,
  parseOilLabReviewPackage,
  packageFingerprint,
  intakeSnapshotFingerprint,
  oilLabMatchingBlockers,
} from "../src/lib/oil-research/lab-package"
import {
  mutateOilReview,
  OIL_REVIEW_PROPERTY_IDS,
  readOilReviewState,
} from "../src/lib/oil-research/review-state"
import {
  exportOilLabReview,
  importOilLabReview,
  OIL_LAB_IMPORT_RPC,
  OIL_LAB_READBACK_RPC,
} from "../scripts/product-intake/oil-lab-review"
import {
  assertOilReviewSnapshot,
  oilReviewFingerprint,
  stableOilReviewJson,
} from "../packages/product-intake-core/src/oil-review-binding"

import { detailFixture, id } from "./oil-lab-handoff-fixture"

function clientFor(
  detail: ProductIntakeSubmissionDetail,
  rpc: (name: string, args: Record<string, unknown>) => Promise<unknown>,
) {
  return {
    rpc,
    from(table: string) {
      const data =
        table === "product_submissions"
          ? detail
          : table === "product_intake_research_jobs"
            ? [detail.job]
            : table === "product_intake_research_artifacts"
              ? detail.artifacts
              : []
      const query: Record<string, unknown> = {
        then: (resolve: (value: unknown) => void) => resolve({ data, error: null }),
      }
      for (const method of ["select", "eq", "in", "order", "limit", "maybeSingle"])
        query[method] = () => query
      return query
    },
  } as unknown as Pick<SupabaseClient, "rpc" | "from">
}

test("current export binds actual manual drafts while images and private draft context cannot affect review", () => {
  const detail = detailFixture()
  const bundle = buildOilLabReviewPackage(detail)
  const serialized = JSON.stringify(bundle.intakeReviewSnapshot)
  assert.ok(!serialized.includes("SECRET"))
  assert.ok(!serialized.includes("https://example.com/image.jpg"))
  assert.ok(!serialized.includes("original_record"))
  assert.ok(Buffer.byteLength(serialized) < 32 * 1024)
  assert.equal(bundle.admissionContextJson, stableOilReviewJson(bundle.admissionContext))
  const changedImage = structuredClone(detail)
  const final = changedImage.payload!.final as { product: Record<string, unknown> }
  final.product.image_url = "https://example.com/new-image.jpg"
  assert.equal(buildOilLabReviewPackage(changedImage).packageFingerprint, bundle.packageFingerprint)
  final.product.suitable_thicknesses = ["coarse"]
  assert.notEqual(
    buildOilLabReviewPackage(changedImage).packageFingerprint,
    bundle.packageFingerprint,
  )
  detail.job!.status = "waiting_for_rework"
  assert.throws(() => buildOilLabReviewPackage(detail), /stale or missing/)
})

test("handoff rejects malformed UUIDs and missing thickness suggestions", () => {
  const snapshot = buildOilLabReviewPackage(detailFixture()).intakeReviewSnapshot
  assert.throws(
    () => assertOilReviewSnapshot({ ...snapshot, submissionId: "0".repeat(36) }),
    /Invalid oil snapshot submissionId/,
  )
  const bundle = buildOilLabReviewPackage(detailFixture())
  bundle.matchingSuggestions.suitable_thicknesses = []
  assert.match(oilLabMatchingBlockers(bundle).join(" "), /Haardicken/)
})

test("CLI imports current native approval, reconciles committed timeout, and seals exact revision without publication", async () => {
  const directory = mkdtempSync(join(tmpdir(), "oil-handoff-"))
  try {
    const detail = detailFixture()
    let committed: Record<string, unknown> | null = null
    const calls: string[] = []
    const client = clientFor(detail, async (name, args) => {
      calls.push(name)
      if (name === OIL_LAB_READBACK_RPC) return { data: committed, error: null }
      assert.equal(name, OIL_LAB_IMPORT_RPC)
      assert.equal(
        args.p_snapshot_json,
        stableOilReviewJson(args.p_snapshot),
        "DB import receives the exact canonical snapshot bytes",
      )
      const receipt = args.p_receipt as Record<string, unknown>
      committed = {
        receipt_id: receipt.receiptId,
        package_fingerprint: receipt.packageFingerprint,
        snapshot_fingerprint: receipt.snapshotFingerprint,
        review_revision: receipt.reviewRevision,
      }
      detail.job!.status = "publish_preflight"
      throw new Error("Transport timeout after commit")
    })
    const exported = await exportOilLabReview({ client, submissionId: id, directory })
    const bundle = readOilLabPackage(exported.path)
    const storePath = join(directory, "state.json")
    const options = { client, bundlePath: exported.path, storePath, apply: false, confirm: false }
    await importOilLabReview(options)
    assert.equal(existsSync(storePath), false)
    await assert.rejects(
      importOilLabReview({ ...options, apply: true, confirm: true }),
      /vollständig geprüfte/,
    )
    const source = {
      key: `intake:${bundle.packageFingerprint}`,
      packageFingerprint: bundle.packageFingerprint,
      requiredPropertyIds: [...OIL_REVIEW_PROPERTY_IDS],
      blockers: [],
    }
    await mutateOilReview({
      loadSource: () => source,
      packageFingerprint: bundle.packageFingerprint,
      reviewRevision: 0,
      action: "approve_product",
      storePath,
    })
    await importOilLabReview({ ...options, apply: true, confirm: true })
    assert.equal(readOilReviewState(source, storePath).handoff?.status, "handed_off")
    await importOilLabReview({ ...options, apply: true, confirm: true })
    assert.equal(calls.filter((name) => name === OIL_LAB_IMPORT_RPC).length, 1)
    assert.equal(readOilLabPackage(exported.path).packageFingerprint, bundle.packageFingerprint)
    assert.ok(!readFileSync(storePath, "utf8").includes("original_record"))
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

// Local source files can be edited outside the Lab; recomputing a hash must not legitimize a contradictory projection.
test("Lab package parser refuses a rehashed projection or compiled-operation forgery", () => {
  const original = buildOilLabReviewPackage(detailFixture())
  for (const field of ["projection", "operations"]) {
    const bundle = structuredClone(original)
    if (field === "projection") {
      const specs = bundle.intakeReviewSnapshot.rawPropertyScope.category_specs as Record<
        string,
        { weight: string }
      >
      specs.product_oil_specs.weight = "rich"
    } else bundle.intakeReviewSnapshot.specOperations = []
    bundle.snapshotFingerprint = intakeSnapshotFingerprint(bundle.intakeReviewSnapshot)
    const { packageFingerprint: _old, ...body } = bundle
    bundle.packageFingerprint = packageFingerprint(body)
    assert.throws(() => parseOilLabReviewPackage(bundle), /projection|normalized/)
  }
})

test("Lab package parser refuses a rehashed identity-context substitution", () => {
  const bundle = structuredClone(buildOilLabReviewPackage(detailFixture()))
  ;(bundle.admissionContext.resolved_identity_artifact as Record<string, unknown>).unexpected =
    "substituted"
  bundle.admissionContextJson = stableOilReviewJson(bundle.admissionContext)
  bundle.intakeReviewSnapshot.admissionContextSha256 = oilReviewFingerprint(bundle.admissionContext)
  bundle.snapshotFingerprint = intakeSnapshotFingerprint(bundle.intakeReviewSnapshot)
  const { packageFingerprint: _old, ...body } = bundle
  bundle.packageFingerprint = packageFingerprint(body)
  assert.throws(
    () => parseOilLabReviewPackage(bundle),
    /differs from stored resolved identity artifact/,
  )
})

test("Lab package parser refuses rehashed source-name or package substitutions", () => {
  for (const mutation of [
    (product: Record<string, unknown>) => {
      product.clean_name = "Different oil"
    },
    (product: Record<string, unknown>) => {
      product.net_content_value = 50
    },
  ]) {
    const bundle = structuredClone(buildOilLabReviewPackage(detailFixture()))
    const product = bundle.intakeReviewSnapshot.rawPropertyScope.product as Record<string, unknown>
    mutation(product)
    const admitted = bundle.admissionContext.final_product_identity as Record<string, unknown>
    for (const key of [
      "canonical_brand",
      "product_line",
      "clean_name",
      "net_content_value",
      "net_content_unit",
    ])
      admitted[key] = product[key] ?? null
    bundle.admissionContextJson = stableOilReviewJson(bundle.admissionContext)
    bundle.intakeReviewSnapshot.admissionContextSha256 = oilReviewFingerprint(
      bundle.admissionContext,
    )
    bundle.snapshotFingerprint = intakeSnapshotFingerprint(bundle.intakeReviewSnapshot)
    const { packageFingerprint: _old, ...body } = bundle
    bundle.packageFingerprint = packageFingerprint(body)
    assert.throws(
      () => parseOilLabReviewPackage(bundle),
      /final product (name|package) differs from source identity/,
    )
  }
})

test("export refuses current identity and source changes while admitting JSONB key reordering", () => {
  const detail = detailFixture()
  const changedName = structuredClone(detail)
  ;(changedName.payload!.final as { product: Record<string, unknown> }).product.clean_name =
    "Different oil"
  assert.throws(() => buildOilLabReviewPackage(changedName), /identity/)
  const changedSource = structuredClone(detail)
  ;(
    (changedSource.payload!.draft as Record<string, unknown>).oil_authoritative_formula as Record<
      string,
      unknown
    >
  ).source_ids = ["other-maker"]
  assert.throws(() => buildOilLabReviewPackage(changedSource), /formula|source/)
  const changedCanonicalFormula = structuredClone(detail)
  ;(
    (changedCanonicalFormula.payload!.draft as Record<string, unknown>).formula as Record<
      string,
      unknown
    >
  ).normalized_ingredients = ["REPLACED"]
  assert.throws(
    () => buildOilLabReviewPackage(changedCanonicalFormula),
    /canonical formula differs from admission/,
  )
  const changedArtifact = structuredClone(detail)
  changedArtifact.artifacts[0].status = "needs_research"
  assert.throws(() => buildOilLabReviewPackage(changedArtifact), /identity/)
  function reverse(value: unknown): unknown {
    return Array.isArray(value)
      ? value.map(reverse)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.entries(value)
              .reverse()
              .map(([key, child]) => [key, reverse(child)]),
          )
        : value
  }
  assert.equal(
    buildOilLabReviewPackage(reverse(detail) as typeof detail).packageFingerprint,
    buildOilLabReviewPackage(detail).packageFingerprint,
  )
})
