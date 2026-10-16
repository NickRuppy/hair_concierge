import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import {
  publicationImage,
  publicationFinal,
  publicationTestDdl,
} from "./oil-lab-publication-fixture"
import { detailFixture, legacyDetailFixture } from "./oil-lab-handoff-fixture"
import {
  buildOilLabReviewPackage,
  OIL_CURRENT_LAB_PROPERTY_IDS,
} from "../src/lib/oil-research/lab-package"
import {
  oilReviewFingerprint,
  stableOilReviewJson,
} from "../packages/product-intake-core/src/oil-review-binding"

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
  current = true,
  preserveLatestWrapper = false,
) {
  const db = new PGlite()
  t.after(() => db.close())
  await db.exec(publicationTestDdl)
  if (preserveLatestWrapper)
    await db.exec(`
      CREATE TABLE latest_wrapper_writes(id uuid);
      CREATE OR REPLACE FUNCTION public.product_intake_approve_reviewed_product(
        p_submission_id uuid,p_final_payload jsonb,p_spec_operations jsonb,p_reviewed_by text,
        p_reviewed_at timestamptz DEFAULT now(),p_review_notes text DEFAULT NULL
      ) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
      BEGIN
        IF p_review_notes IS DISTINCT FROM 'preserved-chain' THEN
          RAISE EXCEPTION 'latest intake wrapper was bypassed';
        END IF;
        INSERT INTO public.latest_wrapper_writes VALUES(p_submission_id);
        RETURN public.product_intake_approve_reviewed_product_legacy(
          p_submission_id,p_final_payload,p_spec_operations,p_reviewed_by,p_reviewed_at,p_review_notes
        );
      END $$;
    `)
  await db.exec(v1Migration)
  await db.exec(v2Migration)
  const detail = current ? detailFixture() : legacyDetailFixture()
  const bundle = buildOilLabReviewPackage(detail)
  await db.query("INSERT INTO product_submissions VALUES($1,'oil','ready_for_review',$2)", [
    detail.id,
    detail.payload,
  ])
  await db.query(
    "INSERT INTO product_intake_research_jobs(id,submission_id,status) VALUES($1,$2,'waiting_for_review')",
    [detail.job!.id, detail.id],
  )
  for (const artifact of detail.artifacts)
    await db.query(
      "INSERT INTO product_intake_research_artifacts(id,submission_id,job_id,kind,status,payload) VALUES($1,$2,$3,$4,$5,$6)",
      [
        artifact.id,
        artifact.submission_id,
        artifact.job_id,
        artifact.kind,
        artifact.status,
        artifact.payload,
      ],
    )
  const receipt = {
    version: current ? "oil-lab-review-receipt-v2" : "oil-lab-review-receipt-v1",
    packageFingerprint: bundle.packageFingerprint,
    snapshotFingerprint: bundle.snapshotFingerprint,
    reviewRevision: 1,
    approvedAt: new Date().toISOString(),
    receiptId: current ? "c".repeat(64) : "d".repeat(64),
    approvedPropertyIds: current
      ? [...OIL_CURRENT_LAB_PROPERTY_IDS]
      : [
          "base",
          "named_oils",
          "weight",
          "dispenser",
          "penetration_potential",
          "provides_heat_protection",
          "provides_uv_protection",
          "supported_uses",
          "persistence_potential",
          "ingredient_flags.silicones",
          "ingredient_flags.mineral_oil",
          "ingredient_flags.drying_alcohol",
          "ingredient_flags.fragrance",
          "ingredient_flags.scalp_active_botanicals",
          "scenario_fit",
          "projection",
          "matching",
        ],
    manualMatchingApproved: true,
  }
  const importReview = (candidate = receipt) =>
    db.query("SELECT product_intake_import_oil_lab_review($1,$2,$3,$4,$5,$6)", [
      detail.id,
      candidate,
      bundle.intakeReviewSnapshot,
      bundle.snapshotFingerprint,
      bundle.packageFingerprint,
      stableOilReviewJson(bundle.intakeReviewSnapshot),
    ])
  return { db, detail, bundle, receipt, importReview }
}

test("current v0.10 Oil receipt requires the exact lean property scope and a separate matching approval", async (t) => {
  const x = await database(t)
  await assert.rejects(
    x.importReview({ ...x.receipt, manualMatchingApproved: false }),
    /Oil Lab receipt is incomplete/,
  )
  await assert.rejects(
    x.importReview({
      ...x.receipt,
      approvedPropertyIds: [...OIL_CURRENT_LAB_PROPERTY_IDS].slice(0, -1),
    }),
    /Oil Lab receipt is incomplete/,
  )
  await x.importReview()
  const decisions = await x.db.query<{ field_path: string; decision: string }>(
    "SELECT field_path,decision FROM product_intake_review_decisions ORDER BY field_path",
  )
  assert.deepEqual(decisions.rows, [{ field_path: "final.properties", decision: "approved" }])
  await x.db.query(
    "INSERT INTO product_intake_research_artifacts(submission_id,job_id,kind,status,payload) VALUES($1,$2,'processed_image','pending_review',$3)",
    [x.detail.id, x.detail.job!.id, publicationImage],
  )
  await x.db.query(
    "INSERT INTO product_intake_review_decisions(submission_id,job_id,field_path,decision,reviewed_by) VALUES($1,$2,'final.image','image_approved','nick')",
    [x.detail.id, x.detail.job!.id],
  )
  await x.db.query("SELECT product_intake_complete_oil_review($1)", [x.detail.id])
  await x.db.query("SELECT product_intake_oil_publication_preflight($1,$2,$3)", [
    x.detail.id,
    publicationFinal(x.bundle.intakeReviewSnapshot.normalizedFinal),
    x.bundle.intakeReviewSnapshot.specOperations,
  ])
})

test("current v0.10 receipts bind the exact policy tuple, while v1 receipts retain their historical 17-row route", async (t) => {
  const current = await database(t)
  const tampered = structuredClone(current.bundle.intakeReviewSnapshot) as any
  tampered.method.policy_pins["docs/research/oil-inci/v1.0/01_property-set-v0.4.md"] = "0".repeat(
    64,
  )
  const fingerprint = oilReviewFingerprint(tampered)
  await assert.rejects(
    current.db.query("SELECT product_intake_import_oil_lab_review($1,$2,$3,$4,$5,$6)", [
      current.detail.id,
      { ...current.receipt, receiptId: "e".repeat(64), snapshotFingerprint: fingerprint },
      tampered,
      fingerprint,
      current.bundle.packageFingerprint,
      stableOilReviewJson(tampered),
    ]),
    /content changed|incomplete/,
  )
  const legacy = await database(t, false)
  await legacy.importReview()
  assert.equal(
    (
      await legacy.db.query<{ n: number }>(
        "SELECT count(*)::int n FROM product_intake_review_decisions WHERE field_path='final.properties'",
      )
    ).rows[0].n,
    1,
  )
})

test("Oil review migration preserves the latest intake writer wrapper", async (t) => {
  const x = await database(t, true, true)
  await x.importReview()
  await x.db.query(
    "INSERT INTO product_intake_research_artifacts(submission_id,job_id,kind,status,payload) VALUES($1,$2,'processed_image','pending_review',$3)",
    [x.detail.id, x.detail.job!.id, publicationImage],
  )
  await x.db.query(
    "INSERT INTO product_intake_review_decisions(submission_id,job_id,field_path,decision,reviewed_by) VALUES($1,$2,'final.image','image_approved','nick')",
    [x.detail.id, x.detail.job!.id],
  )
  await x.db.query("SELECT product_intake_complete_oil_review($1)", [x.detail.id])
  await x.db.query(
    "SELECT product_intake_approve_reviewed_product($1,$2,$3,'nick',now(),'preserved-chain')",
    [
      x.detail.id,
      publicationFinal(x.bundle.intakeReviewSnapshot.normalizedFinal),
      x.bundle.intakeReviewSnapshot.specOperations,
    ],
  )
  assert.equal(
    (await x.db.query<{ n: number }>("SELECT count(*)::int n FROM latest_wrapper_writes")).rows[0]
      .n,
    1,
  )
})
