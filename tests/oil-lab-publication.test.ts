import {
  publicationTestDdl,
  publicationImage,
  publicationFinal,
} from "./oil-lab-publication-fixture"
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import {
  oilReviewFingerprint,
  stableOilReviewJson,
} from "../packages/product-intake-core/src/oil-review-binding"
import test from "node:test"
import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import { detailFixture } from "./oil-lab-handoff-fixture"
import { buildOilLabReviewPackage } from "../src/lib/oil-research/lab-package"
import { OIL_CURRENT_REVIEW_PROPERTY_IDS } from "../src/lib/oil-research/review-state"

const v1Migration = readFileSync(
  "supabase/migrations/20261016055747_oil_intake_review_binding_v1_baseline.sql",
  "utf8",
)
const v2Migration = readFileSync(
  "supabase/migrations/20261016055758_oil_intake_review_binding_v2_successor.sql",
  "utf8",
)
async function database(
  t: { after: (fn: () => Promise<void>) => void },
  apply = true,
  price?: number,
) {
  const db = new PGlite()
  t.after(() => db.close())
  await db.exec(publicationTestDdl)
  if (apply) {
    await db.exec(v1Migration)
    await db.exec(v2Migration)
  }
  const detail = detailFixture()
  if (price !== undefined) (detail.payload as any).final.product.price_eur = price
  const bundle = buildOilLabReviewPackage(detail)
  await db.query("INSERT INTO product_submissions VALUES($1,'oil','ready_for_review',$2)", [
    detail.id,
    detail.payload,
  ])
  await db.query(
    "INSERT INTO product_intake_research_jobs(id,submission_id,status) VALUES($1,$2,'waiting_for_review')",
    [detail.job!.id, detail.id],
  )
  for (const a of detail.artifacts)
    await db.query(
      "INSERT INTO product_intake_research_artifacts(id,submission_id,job_id,kind,status,payload) VALUES($1,$2,$3,$4,$5,$6)",
      [a.id, a.submission_id, a.job_id, a.kind, a.status, a.payload],
    )
  const receipt = {
    version: "oil-lab-review-receipt-v2",
    packageFingerprint: bundle.packageFingerprint,
    snapshotFingerprint: bundle.snapshotFingerprint,
    reviewRevision: 1,
    approvedAt: new Date().toISOString(),
    receiptId: "a".repeat(64),
    approvedPropertyIds: [...OIL_CURRENT_REVIEW_PROPERTY_IDS],
    manualMatchingApproved: true,
  }
  const importReview = () =>
    db.query<{ product_intake_import_oil_lab_review: Record<string, unknown> }>(
      "SELECT product_intake_import_oil_lab_review($1,$2,$3,$4,$5,$6)",
      [
        detail.id,
        receipt,
        bundle.intakeReviewSnapshot,
        bundle.snapshotFingerprint,
        bundle.packageFingerprint,
        stableOilReviewJson(bundle.intakeReviewSnapshot),
      ],
    )
  const publish = (
    final: Record<string, unknown> = publicationFinal(bundle.intakeReviewSnapshot.normalizedFinal),
    ops = bundle.intakeReviewSnapshot.specOperations,
  ) =>
    db.query("SELECT product_intake_approve_reviewed_product($1,$2,$3,'nick')", [
      detail.id,
      final,
      ops,
    ])
  const ready = async () => {
    await db.query(
      "INSERT INTO product_intake_research_artifacts(submission_id,job_id,kind,status,payload) VALUES($1,$2,'processed_image','pending_review',$3)",
      [detail.id, detail.job!.id, publicationImage],
    )
    await db.query(
      "INSERT INTO product_intake_review_decisions(submission_id,job_id,field_path,decision,reviewed_by) VALUES($1,$2,'final.image','image_approved','nick')",
      [detail.id, detail.job!.id],
    )
  }
  return { db, detail, bundle, receipt, importReview, publish, ready }
}

test("unreviewed oil cannot reach the catalog writer", async (t) => {
  const x = await database(t, process.env.OIL_PUBLICATION_BASELINE !== "1")
  await assert.rejects(x.publish(), /Current oil Lab approval required/)
  assert.equal(
    (await x.db.query<{ n: number }>("SELECT count(*)::int n FROM catalog_writes")).rows[0].n,
    0,
  )
})
test("Lab import is idempotent, no catalog writes; image-first and properties-first complete exactly once", async (t) => {
  const x = await database(t)
  const pending = (await x.importReview()).rows[0].product_intake_import_oil_lab_review
  assert.equal(pending.publication_ready, false)
  assert.deepEqual(pending.review_blockers, ["current_image_approval_pending"])
  await x.importReview()
  assert.equal(
    (await x.db.query<{ n: number }>("SELECT count(*)::int n FROM product_intake_review_decisions"))
      .rows[0].n,
    1,
  )
  await assert.rejects(x.publish(), /image and brand/)
  await x.ready()
  await x.db.query("SELECT product_intake_complete_oil_review($1)", [x.detail.id])
  const completed = (await x.importReview()).rows[0].product_intake_import_oil_lab_review
  assert.equal(completed.publication_ready, true)
  assert.deepEqual(completed.review_blockers, [])
  assert.equal(
    (
      await x.db.query<{ n: number }>(
        "SELECT count(*)::int n FROM product_intake_review_decisions WHERE field_path='final.product'",
      )
    ).rows[0].n,
    1,
  )
  await x.publish()
  assert.equal(
    (await x.db.query<{ n: number }>("SELECT count(*)::int n FROM catalog_writes")).rows[0].n,
    1,
  )
})
test("current image cannot revive old properties; JSONB roundtrip preserves exact-byte validation", async (t) => {
  const x = await database(t)
  await x.ready()
  await x.importReview()
  await x.db.query(
    "UPDATE product_submissions SET researched_payload=jsonb_set(researched_payload,'{final,product,price_eur}','12')",
  )
  await assert.rejects(x.publish(), /content changed/)
  await assert.rejects(x.importReview(), /content changed/)
  assert.equal(
    (await x.db.query<{ n: number }>("SELECT count(*)::int n FROM catalog_writes")).rows[0].n,
    0,
  )
})
test("changed operations, rework, unapproved image and tampered body roll back before writes", async (t) => {
  const x = await database(t)
  await x.ready()
  await x.importReview()
  await assert.rejects(
    x.publish(x.bundle.intakeReviewSnapshot.normalizedFinal, []),
    /differs from approved/,
  )
  await x.db.query("UPDATE product_intake_research_jobs SET status='waiting_for_rework'")
  await assert.rejects(x.publish(), /job or artifact/)
  await x.db.query("UPDATE product_intake_research_jobs SET status='waiting_for_review'")
  await x.db.query(
    "UPDATE product_intake_research_artifacts SET payload=jsonb_set(payload,'{oil_research_envelope_json}',to_jsonb((payload->>'oil_research_envelope_json') || ' ')) WHERE kind='property_synthesis'",
  )
  await assert.rejects(x.importReview(), /content changed/)
  assert.equal(
    (await x.db.query<{ n: number }>("SELECT count(*)::int n FROM catalog_writes")).rows[0].n,
    0,
  )
})
test("service-only RPCs and unchanged non-oil delegation", async (t) => {
  const x = await database(t)
  for (const role of ["anon", "authenticated"]) {
    await x.db.exec(`SET ROLE ${role}`)
    await assert.rejects(x.importReview(), /permission denied/)
    await assert.rejects(x.publish(), /permission denied/)
    await x.db.exec("RESET ROLE")
  }
  await x.db.exec("SET ROLE service_role")
  await assert.rejects(
    x.db.query(
      "SELECT product_intake_approve_reviewed_product_before_oil_lab($1,'{}','[]','nick')",
      [x.detail.id],
    ),
    /permission denied/,
  )
  await assert.rejects(
    x.db.query("SELECT product_intake_approve_reviewed_product_legacy($1,'{}','[]','nick')", [
      x.detail.id,
    ]),
    /permission denied/,
  )
  await x.db.exec("RESET ROLE")
  await x.db.query("UPDATE product_submissions SET category='shampoo'")
  const result = await x.publish({ product: { category_key: "shampoo" } }, [])
  assert.deepEqual(result.rows[0], { product_intake_approve_reviewed_product: { legacy: true } })
})

test("current source and identity drift cannot reuse the original receipt", async (t) => {
  const x = await database(t)
  await x.ready()
  await x.importReview()
  await x.db.query(
    "UPDATE product_submissions SET researched_payload=jsonb_set(researched_payload,'{draft,oil_authoritative_formula,source_ids}','[\"new-source\"]')",
  )
  await assert.rejects(x.publish(), /content changed/)
  await x.db.query("UPDATE product_submissions SET researched_payload=$1", [x.detail.payload])
  await x.db.query(
    "UPDATE product_intake_research_artifacts SET status='needs_review' WHERE id=$1",
    [x.bundle.intakeReviewSnapshot.resolvedIdentityArtifactId],
  )
  await assert.rejects(x.publish(), /identity admission changed/)
  await x.db.query("UPDATE product_intake_research_artifacts SET status='resolved' WHERE id=$1", [
    x.bundle.intakeReviewSnapshot.resolvedIdentityArtifactId,
  ])
  // Same identity artifact, status, brand and line; only its resolved package
  // evidence changes after review. Neither import nor publication may reuse it.
  await x.db.query(
    'UPDATE product_intake_research_artifacts SET payload=jsonb_set(payload,\'{net_content}\',\'{"value":100,"unit":"ml"}\') WHERE id=$1',
    [x.bundle.intakeReviewSnapshot.resolvedIdentityArtifactId],
  )
  await assert.rejects(x.importReview(), /identity admission changed/)
  await assert.rejects(x.publish(), /identity admission changed/)
  assert.equal(
    (await x.db.query<{ n: number }>("SELECT count(*)::int n FROM catalog_writes")).rows[0].n,
    0,
  )
})

// Database admission must reject missing required values even when JSONB nulls
// compare equal. These cases bypass TS only to exercise the service RPC boundary.
test("missing status or digest and changed canonical formula cannot silently pass oil SQL admission", async (t) => {
  const x = await database(t)
  await x.ready()
  await x.importReview()
  for (const mutation of [
    "UPDATE product_submissions SET status=NULL",
    "UPDATE product_intake_research_jobs SET status=NULL",
    "UPDATE product_intake_research_artifacts SET status=NULL WHERE kind='processed_image'",
    "UPDATE product_submissions SET researched_payload=researched_payload #- '{draft,formula}'",
    "UPDATE product_submissions SET researched_payload=jsonb_set(researched_payload,'{draft,formula,raw_inci}','\"different declaration\"')",
    "UPDATE product_submissions SET researched_payload=jsonb_set(researched_payload,'{draft,formula,normalized_ingredients}','[\"OTHER OIL\"]')",
    "UPDATE product_submissions SET researched_payload=jsonb_set(researched_payload,'{draft,formula,fingerprint_sha256}','\"wrong\"')",
    "UPDATE product_submissions SET researched_payload=jsonb_set(researched_payload,'{draft,formula,source}','\"model_formula\"')",
  ]) {
    await x.db.exec("BEGIN")
    await x.db.exec(mutation)
    await assert.rejects(x.publish(), /stale|job or artifact|image and brand|content changed/)
    await x.db.exec("ROLLBACK")
  }
  const snapshot = structuredClone(x.bundle.intakeReviewSnapshot) as any
  const payload = structuredClone(x.detail.payload) as any
  const artifact = structuredClone(
    x.detail.artifacts.find((a) => a.kind === "property_synthesis")!.payload,
  ) as any
  const envelope = JSON.parse(artifact.oil_research_envelope_json)
  delete envelope.formula.raw_sha256
  artifact.oil_research_envelope_json = JSON.stringify(envelope)
  artifact.oil_research_envelope = envelope
  artifact.oil_research_envelope_sha256 = createHash("sha256")
    .update(artifact.oil_research_envelope_json)
    .digest("hex")
  payload.draft.oil_research_binding.envelope_sha256 = artifact.oil_research_envelope_sha256
  delete payload.draft.oil_research_binding.raw_sha256
  delete snapshot.rawSha256
  snapshot.envelopeSha256 = artifact.oil_research_envelope_sha256
  await x.db.query("UPDATE product_submissions SET researched_payload=$1", [payload])
  await x.db.query(
    "UPDATE product_intake_research_artifacts SET payload=$1 WHERE kind='property_synthesis'",
    [artifact],
  )
  const fingerprint = oilReviewFingerprint(snapshot)
  await assert.rejects(
    x.db.query("SELECT product_intake_import_oil_lab_review($1,$2,$3,$4,$5,$6)", [
      x.detail.id,
      { ...x.receipt, receiptId: "c".repeat(64), snapshotFingerprint: fingerprint },
      snapshot,
      fingerprint,
      x.bundle.packageFingerprint,
      stableOilReviewJson(snapshot),
    ]),
    /content changed|incomplete/,
  )
})

test("publication image must be the exact current reviewed artifact", async (t) => {
  const x = await database(t)
  await x.ready()
  const completed = (await x.importReview()).rows[0].product_intake_import_oil_lab_review
  assert.equal(completed.publication_ready, true, "properties arriving last completes review")
  assert.deepEqual(completed.review_blockers, [])
  const final = publicationFinal(x.bundle.intakeReviewSnapshot.normalizedFinal)
  for (const field of ["image_url", "canonical_image_sha256", "thumbnail_image_url"] as const) {
    await assert.rejects(
      x.publish({ ...final, product: { ...final.product, [field]: "different" } }),
      /image differs/,
    )
  }
  await x.publish()
  assert.equal(
    (await x.db.query<{ n: number }>("SELECT count(*)::int n FROM catalog_writes")).rows[0].n,
    1,
  )
})

test("review hashes preserve the exact JSON numeric representation", async (t) => {
  const x = await database(t, true, 1e-7)
  await x.importReview()
})

test("snapshot bytes and 128 KiB boundary survive JSONB formatting without accepting mismatches", async (t) => {
  const x = await database(t)
  const snapshot = structuredClone(x.bundle.intakeReviewSnapshot) as any
  const payload = structuredClone(x.detail.payload) as any
  const setText = (value: string) => {
    payload.final.field_rationales["category_specs.product_oil_specs"] = value
    snapshot.rawPropertyScope.field_rationales["category_specs.product_oil_specs"] = value
    snapshot.normalizedFinal.field_rationales["category_specs.product_oil_specs"] = value
  }
  const send = (bytes: string, fingerprint = createHash("sha256").update(bytes).digest("hex")) =>
    x.db.query("SELECT product_intake_import_oil_lab_review($1,$2,$3,$4,$5,$6)", [
      x.detail.id,
      { ...x.receipt, receiptId: fingerprint, snapshotFingerprint: fingerprint },
      snapshot,
      fingerprint,
      x.bundle.packageFingerprint,
      bytes,
    ])
  const initial = stableOilReviewJson(snapshot)
  await assert.rejects(send(initial + " ", oilReviewFingerprint(snapshot)), /receipt is incomplete/)
  await assert.rejects(
    send(initial.replace('"oil-intake-review-v2"', '"different"')),
    /receipt is incomplete/,
  )
  setText("")
  const padding = "a".repeat(
    Math.floor((128 * 1024 - Buffer.byteLength(stableOilReviewJson(snapshot))) / 2),
  )
  setText(padding)
  await x.db.query("UPDATE product_submissions SET researched_payload=$1", [payload])
  const bytes = stableOilReviewJson(snapshot)
  assert.ok(Buffer.byteLength(bytes) <= 128 * 1024)
  assert.ok(Buffer.byteLength(bytes) >= 128 * 1024 - 1)
  await send(bytes)
  setText(padding + "a")
  await x.db.query("UPDATE product_submissions SET researched_payload=$1", [payload])
  await assert.rejects(send(stableOilReviewJson(snapshot)), /receipt is incomplete/)
})
