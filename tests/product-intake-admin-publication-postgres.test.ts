import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import test from "node:test"
import { OPERATOR, publicationDatabase } from "./helpers/product-intake-publication-postgres"

type Database = Awaited<ReturnType<typeof publicationDatabase>>
const final = {
  product: {
    canonical_brand: "SQL Test",
    clean_name: "Review Conditioner",
    category_key: "conditioner",
    image_url: null,
    canonical_image_sha256: null,
    thumbnail_image_url: null,
    suitable_thicknesses: ["normal"],
    suitable_concerns: [],
    tags: [],
  },
  identifiers: [],
}
async function seed(pg: Database, job = true) {
  const id = randomUUID()
  await pg.query(
    `INSERT INTO product_submissions(id,user_id,source,intake_method,category,frequency_range,status,researched_payload)
    VALUES($1,$2,'chat','manual','conditioner','weekly_1x','ready_for_review',$3)`,
    [id, OPERATOR, { final }],
  )
  if (job)
    await pg.query(
      `INSERT INTO product_intake_research_jobs(submission_id,status,stage) VALUES($1,'waiting_for_review','preview_build')`,
      [id],
    )
  const s = (await pg.query<any>("SELECT * FROM product_submissions WHERE id=$1", [id])).rows[0]
  const j = (
    await pg.query<any>("SELECT * FROM product_intake_research_jobs WHERE submission_id=$1", [id])
  ).rows[0]
  return {
    request_id: randomUUID(),
    submission_id: id,
    job_id: j?.id ?? null,
    review_cycle_id: j?.review_cycle_id ?? null,
    payload_revision: s.payload_revision,
    payload_sha256: s.payload_sha256,
    reviewed_by: "nick",
  }
}
async function rpc(pg: Database, name: string, request: unknown) {
  return (await pg.query<any>(`SELECT public.${name}($1) result`, [request])).rows[0].result
}
const record = (
  pg: Database,
  common: Record<string, unknown>,
  action: string,
  more: Record<string, unknown> = {},
) =>
  rpc(pg, "product_intake_record_review_decision", {
    ...common,
    request_id: randomUUID(),
    action,
    ...more,
  })
const preflight = (pg: Database, id: string) => rpc(pg, "product_intake_review_preflight", id)

test("SQL decisions reject stale tokens, bind exact cycle and replay only identical requests", async (t) => {
  const pg = await publicationDatabase(t)
  const c = await seed(pg)
  const req = { ...c, action: "approve_data", field_path: "final.properties" }
  const first = await rpc(pg, "product_intake_record_review_decision", req)
  assert.equal(first.decision.payload_revision, c.payload_revision)
  assert.equal(first.decision.review_cycle_id, c.review_cycle_id)
  assert.equal(
    (await rpc(pg, "product_intake_record_review_decision", req)).decision.id,
    first.decision.id,
  )
  await assert.rejects(
    rpc(pg, "product_intake_record_review_decision", { ...req, comment: "changed" }),
    /replay/,
  )
  await assert.rejects(
    record(pg, { ...c, payload_revision: 99 }, "approve_data", { field_path: "final.properties" }),
    /revision/,
  )
  await assert.rejects(
    pg.query(
      "INSERT INTO product_intake_review_decisions(submission_id,field_path,decision,reviewed_by) VALUES($1,'final.product','publish_approved','nick')",
      [c.submission_id],
    ),
    /permission denied/,
  )
})

test("separate approvals, revoked image and explicit rework gate preflight", async (t) => {
  const pg = await publicationDatabase(t)
  const c = await seed(pg)
  await record(pg, c, "approve_data", { field_path: "final.properties" })
  assert.equal((await preflight(pg, c.submission_id)).ok, false)
  await record(pg, c, "approve_image", {
    field_path: "final.image",
    reviewer_value: { no_image: true },
  })
  assert.equal((await preflight(pg, c.submission_id)).ok, true)
  await record(pg, c, "reject_image", { field_path: "final.image", comment: "recheck" })
  assert.equal((await preflight(pg, c.submission_id)).ok, false)
  await record(pg, c, "approve_image", {
    field_path: "final.image",
    reviewer_value: { no_image: true },
  })
  const rework = await record(pg, c, "rework", {
    field_path: "review.rework",
    comment: "Please recheck sources",
  })
  assert.notEqual(rework.job.review_cycle_id, c.review_cycle_id)
  assert.equal((await preflight(pg, c.submission_id)).ok, false)
})

test("distinct customer information requests persist distinct recovery events, retries reuse one", async (t) => {
  const pg = await publicationDatabase(t)
  const c = await seed(pg)
  const req = {
    ...c,
    action: "request_info",
    field_path: "review.request_info",
    reviewer_value: {
      reason: "Bild fehlt",
      next_step: "Bitte Bild senden",
      missing_fields: ["image"],
    },
  }
  const a = await rpc(pg, "product_intake_record_review_decision", req)
  assert.equal(a.decision.notification_status, "pending")
  assert.equal(
    (await rpc(pg, "product_intake_record_review_decision", req)).decision.id,
    a.decision.id,
  )
  const b = await rpc(pg, "product_intake_record_review_decision", {
    ...req,
    request_id: randomUUID(),
    reviewer_value: { ...req.reviewer_value, next_step: "Bitte Rückseite senden" },
  })
  assert.notEqual(b.decision.id, a.decision.id)
  await rpc(pg, "product_intake_finish_review_notification", {
    decision_id: a.decision.id,
    status: "sent",
    message_id: randomUUID(),
  })
  await rpc(pg, "product_intake_finish_review_notification", {
    decision_id: a.decision.id,
    status: "failed",
    error_code: "late_error",
  })
  assert.equal(
    (
      await pg.query<any>(
        "SELECT notification_status FROM product_intake_review_decisions WHERE id=$1",
        [a.decision.id],
      )
    ).rows[0].notification_status,
    "sent",
  )
})

test("legacy no-job review is explicit, revision-bound, and old catalog ABIs are closed", async (t) => {
  const pg = await publicationDatabase(t)
  const c = await seed(pg, false)
  await rpc(pg, "product_intake_register_legacy_review", {
    ...c,
    approve_data: true,
    approve_image: true,
    no_image: true,
    review_assets: [],
    comment: "Kein Bild verfügbar; ausdrücklich geprüft",
  })
  const p = await preflight(pg, c.submission_id)
  assert.equal(p.ok, true)
  assert.equal(p.legacy_package, true)
  await assert.rejects(
    pg.query("SELECT product_intake_approve_reviewed_product($1,$2,'[]','nick')", [
      c.submission_id,
      final,
    ]),
    /does not exist|permission denied/,
  )
  const grants =
    await pg.query<any>(`SELECT proname,has_function_privilege('service_role',oid,'EXECUTE') allowed FROM pg_proc
   WHERE pronamespace='public'::regnamespace AND (proname LIKE 'product_intake_approve_%' OR proname LIKE 'product_intake_link_existing_product%' OR proname IN ('product_intake_request_more_info','product_intake_reject_submission'))`)
  assert.ok(grants.rows.length > 3)
  assert.ok(grants.rows.every((r) => !r.allowed))
  const endpoints =
    await pg.query<any>(`SELECT proname,has_function_privilege('service_role',oid,'EXECUTE') service,
    has_function_privilege('anon',oid,'EXECUTE') anonymous,has_function_privilege('authenticated',oid,'EXECUTE') authenticated
    FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('product_intake_record_review_decision','product_intake_register_legacy_review',
    'product_intake_review_preflight','product_intake_publish_reviewed_submission','product_intake_finish_review_notification')`)
  assert.equal(endpoints.rows.length, 5)
  assert.ok(endpoints.rows.every((row) => row.service && !row.anonymous && !row.authenticated))
  await assert.rejects(
    pg.query("DELETE FROM product_intake_review_decisions WHERE submission_id=$1", [
      c.submission_id,
    ]),
    /permission denied/,
  )
  await assert.rejects(pg.exec("TRUNCATE product_intake_review_decisions"), /permission denied/)
})

test("actual catalog publication records N and N+1, replays once, and never retries catalog for notification", async (t) => {
  const { publicationMaskBatch } = await import("./helpers/product-intake-publication-postgres")
  const pg = await publicationDatabase(t)
  const batch = await publicationMaskBatch()
  const item = batch.items[0]!
  assert.ok(item.kind === "new_product", "mask publication fixture must create a product")
  const approved = structuredClone(item.final_payload) as any
  Object.assign(approved.product, {
    image_url: null,
    canonical_image_sha256: null,
    thumbnail_image_url: null,
  })
  const c = await seed(pg)
  await pg.query(
    "UPDATE product_submissions SET category='mask',researched_payload=$2 WHERE id=$1",
    [c.submission_id, { final: approved }],
  )
  const s = (
    await pg.query<any>("SELECT * FROM product_submissions WHERE id=$1", [c.submission_id])
  ).rows[0]
  Object.assign(c, { payload_revision: s.payload_revision, payload_sha256: s.payload_sha256 })
  await record(pg, c, "approve_data", { field_path: "final.properties" })
  await record(pg, c, "approve_image", {
    field_path: "final.image",
    reviewer_value: { no_image: true },
  })
  const p = await preflight(pg, c.submission_id)
  assert.equal(p.ok, true)
  const req = {
    ...c,
    request_id: randomUUID(),
    data_decision_id: p.data_decision_id,
    image_decision_id: p.image_decision_id,
    confirm: true,
    final_payload: approved,
    spec_operations: item.spec_operations,
    public_image: null,
    owner_default: false,
  }
  const first = await rpc(pg, "product_intake_publish_reviewed_submission", req)
  assert.equal(first.publication.payload_revision, c.payload_revision)
  assert.equal(first.publication.persisted_payload_revision, c.payload_revision + 1)
  assert.equal(first.publication.notification_status, "pending")
  assert.equal(first.job.status, "done")
  assert.equal(first.submission.status, "approved")
  assert.equal((await pg.query<any>("SELECT count(*)::int n FROM products")).rows[0].n, 1)
  assert.equal(
    (await rpc(pg, "product_intake_publish_reviewed_submission", req)).publication.id,
    first.publication.id,
  )
  await assert.rejects(
    rpc(pg, "product_intake_publish_reviewed_submission", { ...req, request_id: randomUUID() }),
    /replay/,
  )
  await rpc(pg, "product_intake_finish_review_notification", {
    publication_id: first.publication.id,
    status: "failed",
    error_code: "db_unavailable",
  })
  await rpc(pg, "product_intake_finish_review_notification", {
    publication_id: first.publication.id,
    status: "sent",
    message_id: randomUUID(),
  })
  await rpc(pg, "product_intake_finish_review_notification", {
    publication_id: first.publication.id,
    status: "failed",
    error_code: "late_failure",
  })
  assert.equal((await preflight(pg, c.submission_id)).publication.notification_status, "sent")
  assert.equal((await pg.query<any>("SELECT count(*)::int n FROM products")).rows[0].n, 1)
  // A separately authorized parent deletion keeps the existing ownership contract.
  // Direct service deletion of a decision/receipt is denied; deleting its parent
  // atomically removes the review history and receipt, but retains the product.
  await assert.rejects(
    pg.query("DELETE FROM product_intake_publication_receipts WHERE id=$1", [first.publication.id]),
    /permission denied/,
  )
  await pg.query("DELETE FROM product_submissions WHERE id=$1", [c.submission_id])
  for (const table of [
    "product_intake_publication_receipts",
    "product_intake_review_decisions",
    "product_intake_research_jobs",
  ])
    assert.equal(
      (
        await pg.query<any>(`SELECT count(*)::int n FROM ${table} WHERE submission_id=$1`, [
          c.submission_id,
        ])
      ).rows[0].n,
      0,
    )
  assert.equal((await pg.query<any>("SELECT count(*)::int n FROM products")).rows[0].n, 1)
})

test("guarded scan-expansion batch still reaches actual catalog delegate and rejects unapproved batches", async (t) => {
  const { publicationMaskBatch } = await import("./helpers/product-intake-publication-postgres")
  const { createHash } = await import("node:crypto")
  const pg = await publicationDatabase(t)
  const batch = await publicationMaskBatch()
  const json = JSON.stringify(batch)
  const hash = createHash("sha256").update(json).digest("hex")
  const item = batch.items[0]!
  const apply = () =>
    pg.query<any>("SELECT * FROM apply_scan_expansion_batch_v1($1,$2,$3,'nick',$4,true)", [
      json,
      hash,
      "b".repeat(40),
      item.item_key,
    ])
  await assert.rejects(apply(), /approved|approval/)
  await pg.exec("RESET ROLE")
  await pg.query(
    "INSERT INTO scan_expansion_approved_batches(batch_id,batch_fingerprint,reviewed_head,reviewed_by,item_count) VALUES($1,$2,$3,'nick',$4)",
    [batch.batch_id, hash, "b".repeat(40), batch.items.length],
  )
  await pg.exec("SET ROLE service_role")
  const first = (await apply()).rows[0]
  assert.ok(first.product_id)
  assert.equal((await apply()).rows[0].product_id, first.product_id)
  assert.equal(
    (await pg.query<any>("SELECT count(*)::int n FROM product_intake_publication_receipts")).rows[0]
      .n,
    0,
  )
})

test("exact private manifests gate image review and RAW approval starts a new bounded image cycle", async (t) => {
  const pg = await publicationDatabase(t)
  const c = await seed(pg)
  const hashes = { raw: "a".repeat(64), final: "b".repeat(64), search_thumbnail: "c".repeat(64) }
  await pg.query("UPDATE product_intake_research_jobs SET status='running' WHERE id=$1", [c.job_id])
  for (const [kind, hash] of Object.entries(hashes))
    await pg.query(
      `INSERT INTO product_intake_review_assets(submission_id,payload_revision,job_id,kind,sha256,storage_key,media_type,byte_length)
 VALUES($1,$2,$3,$4,$5,$6,'image/webp',120)`,
      [
        c.submission_id,
        c.payload_revision,
        c.job_id,
        kind,
        hash,
        `${c.submission_id}/${c.payload_revision}/${hash}`,
      ],
    )
  await pg.query(
    "UPDATE product_intake_research_jobs SET status='waiting_for_review',reserved_model_runs=5 WHERE id=$1",
    [c.job_id],
  )
  await record(pg, c, "approve_data")
  await assert.rejects(
    record(pg, c, "approve_image", { approved_asset_sha256: hashes.raw }),
    /exact current private asset/,
  )
  await assert.rejects(
    record(pg, c, "approve_image", { reviewer_value: { no_image: true } }),
    /explicit null/,
  )
  await record(pg, c, "approve_image", { approved_asset_sha256: hashes.final })
  assert.equal((await preflight(pg, c.submission_id)).ok, true)
  const raw = await record(pg, c, "approve_raw", { approved_asset_sha256: hashes.raw })
  assert.equal(raw.decision.review_cycle_id, c.review_cycle_id)
  assert.notEqual(raw.job.review_cycle_id, c.review_cycle_id)
  assert.equal(raw.job.reserved_model_runs, 0)
  assert.equal(raw.job.status, "queued")
  assert.equal(raw.job.stage, "image_judging")
  assert.equal(raw.job.progress.approved_raw_asset_sha256, hashes.raw)
  assert.equal(raw.job.progress.approved_raw_payload_revision, c.payload_revision)
  assert.equal(raw.job.progress.review_decision_id, raw.decision.id)
  assert.equal((await preflight(pg, c.submission_id)).ok, false)
  // A failed raw-processing cycle may be followed by an ordinary human rework.
  // Its old rendition approval cannot authorize the new research/image cycle.
  await pg.query(
    "UPDATE product_intake_research_jobs SET status='blocked',reserved_model_runs=6 WHERE id=$1",
    [c.job_id],
  )
  const rework = await record(pg, { ...c, review_cycle_id: raw.job.review_cycle_id }, "rework", {
    comment: "Recheck the complete research",
  })
  assert.notEqual(rework.job.review_cycle_id, raw.job.review_cycle_id)
  assert.equal(rework.job.reserved_model_runs, 0)
  assert.equal(rework.job.cycle_deadline_at, null)
  for (const key of [
    "approved_raw_asset_id",
    "approved_raw_asset_sha256",
    "approved_raw_payload_revision",
  ])
    assert.equal(Object.hasOwn(rework.job.progress, key), false)
  assert.equal(rework.job.progress.review_decision_id, rework.decision.id)
  assert.equal((await preflight(pg, c.submission_id)).ok, false)
})

test("answer allowlist binds D2 frozen committed artifact and does not resolve unrelated human blockers", async (t) => {
  const pg = await publicationDatabase(t)
  const c = await seed(pg)
  await pg.query("UPDATE product_submissions SET category='shampoo' WHERE id=$1", [c.submission_id])
  await assert.rejects(
    record(pg, c, "answer", {
      field_path: "arbitrary.question",
      reviewer_value: { choice: "yes" },
    }),
    /known field/,
  )
  await assert.rejects(
    record(pg, c, "answer", {
      field_path: "research.separate_deep_cleanser_listing",
      reviewer_value: { choice: null },
    }),
    /invalid deep/,
  )
  await pg.exec("RESET ROLE")
  const unresolved = (
    await pg.query<any>(
      "INSERT INTO product_intake_review_decisions(submission_id,field_path,decision,reviewed_by,comment) VALUES($1,'product.other','change_requested','nick','Verify evidence') RETURNING id",
      [c.submission_id],
    )
  ).rows[0]
  await pg.exec("SET ROLE service_role")
  const engine = {
    id: "shampoo",
    methodology: "shampoo-test-v1",
    input_hash: "e".repeat(64),
    projection_hash: "f".repeat(64),
  }
  const artifact = (
    await pg.query<any>(
      "INSERT INTO product_intake_research_artifacts(submission_id,job_id,kind,payload) VALUES($1,$2,'property_synthesis',$3) RETURNING id",
      [c.submission_id, c.job_id, { engine }],
    )
  ).rows[0]
  await pg.query(
    "UPDATE product_intake_research_jobs SET progress=jsonb_build_object('artifact_ids',jsonb_build_array($2::text)) WHERE id=$1",
    [c.job_id, artifact.id],
  )
  const answer = await record(pg, c, "answer", {
    field_path: "research.separate_deep_cleanser_listing",
    reviewer_value: { choice: "keep_regular_only" },
  })
  assert.deepEqual(answer.decision.proposed_value, { engine })
  assert.notEqual(answer.job.review_cycle_id, c.review_cycle_id)
  assert.equal(answer.decision.resolved_at, null)
  assert.equal(
    (
      await pg.query<any>("SELECT resolved_at FROM product_intake_review_decisions WHERE id=$1", [
        unresolved.id,
      ])
    ).rows[0].resolved_at,
    null,
  )
  assert.ok((await preflight(pg, c.submission_id)).blockers.includes("unresolved_review_questions"))
  assert.equal((await preflight(pg, c.submission_id)).ok, false)
})

test("publication guard failures roll back catalog, revision, receipt and job atomically", async (t) => {
  const { publicationMaskBatch } = await import("./helpers/product-intake-publication-postgres")
  const pg = await publicationDatabase(t)
  const item = (await publicationMaskBatch()).items[0]!
  assert.ok(item.kind === "new_product", "mask publication fixture must create a product")
  const approved = structuredClone(item.final_payload) as any
  Object.assign(approved.product, {
    image_url: null,
    canonical_image_sha256: null,
    thumbnail_image_url: null,
  })
  const c = await seed(pg)
  await pg.query(
    "UPDATE product_submissions SET category='mask',researched_payload=$2 WHERE id=$1",
    [c.submission_id, { final: approved }],
  )
  const before = (
    await pg.query<any>("SELECT * FROM product_submissions WHERE id=$1", [c.submission_id])
  ).rows[0]
  Object.assign(c, {
    payload_revision: before.payload_revision,
    payload_sha256: before.payload_sha256,
  })
  await record(pg, c, "approve_data")
  await record(pg, c, "approve_image", { reviewer_value: { no_image: true } })
  const p = await preflight(pg, c.submission_id)
  const req = {
    ...c,
    request_id: randomUUID(),
    data_decision_id: p.data_decision_id,
    image_decision_id: p.image_decision_id,
    confirm: true,
    final_payload: approved,
    spec_operations: item.spec_operations,
    public_image: null,
    owner_default: false,
  }
  await assert.rejects(
    rpc(pg, "product_intake_publish_reviewed_submission", {
      ...req,
      final_payload: {
        ...approved,
        product: { ...approved.product, clean_name: "Changed after approval" },
      },
    }),
    /differs from approved/,
  )
  await assert.rejects(
    rpc(pg, "product_intake_publish_reviewed_submission", { ...req, spec_operations: [] }),
    /protocol|spec|canonical/,
  )
  assert.deepEqual(
    (await pg.query("SELECT * FROM product_submissions WHERE id=$1", [c.submission_id])).rows[0],
    before,
  )
  assert.equal((await pg.query<any>("SELECT count(*)::int n FROM products")).rows[0].n, 0)
  assert.equal(
    (await pg.query<any>("SELECT count(*)::int n FROM product_intake_publication_receipts")).rows[0]
      .n,
    0,
  )
  assert.equal(
    (await pg.query<any>("SELECT status FROM product_intake_research_jobs WHERE id=$1", [c.job_id]))
      .rows[0].status,
    "waiting_for_review",
  )
})

test("actual Bondbuilder owner delegate preserves user isolation and empty global eligibility", async (t) => {
  const { makeBondbuilderProfile, sealProfile } =
    await import("./fixtures/bondbuilder-research/profile")
  const pg = await publicationDatabase(t)
  const c = await seed(pg)
  const profile = makeBondbuilderProfile()
  profile.identity.product_name = "Example Treatment"
  profile.identity.brand = "Example"
  profile.assessment.claim_trust_level = "low"
  profile.assessment.trust_basis = "owner_default"
  profile.assessment.policy_reference = "owner-default-policy-2026-10-01"
  sealProfile(profile)
  const approved = {
    product: {
      canonical_brand: "Example",
      clean_name: "Treatment",
      category_key: "bondbuilder",
      origin: "user_submitted",
      is_chaarlie_recommended: false,
      suitable_thicknesses: [],
      image_url: null,
      canonical_image_sha256: null,
      thumbnail_image_url: null,
    },
  }
  const operations = [
    {
      table: "product_bondbuilder_specs",
      rows: [
        {
          technology_family: profile.assessment.technology_family,
          claim_trust_level: profile.assessment.claim_trust_level,
          trust_basis: profile.assessment.trust_basis,
          research_profile: profile,
        },
      ],
    },
  ]
  await pg.query(
    "UPDATE product_submissions SET category='bondbuilder',researched_payload=$2 WHERE id=$1",
    [c.submission_id, { final: approved }],
  )
  const before = (
    await pg.query<any>("SELECT * FROM product_submissions WHERE id=$1", [c.submission_id])
  ).rows[0]
  Object.assign(c, {
    payload_revision: before.payload_revision,
    payload_sha256: before.payload_sha256,
  })
  await record(pg, c, "approve_data")
  await record(pg, c, "approve_image", { reviewer_value: { no_image: true } })
  const p = await preflight(pg, c.submission_id)
  const req = {
    ...c,
    request_id: randomUUID(),
    data_decision_id: p.data_decision_id,
    image_decision_id: p.image_decision_id,
    confirm: true,
    final_payload: approved,
    spec_operations: operations,
    public_image: null,
    owner_default: true,
  }
  const result = await rpc(pg, "product_intake_publish_reviewed_submission", req)
  assert.deepEqual(
    (
      await pg.query(
        "SELECT origin,is_chaarlie_recommended,suitable_thicknesses FROM products WHERE id=$1",
        [result.publication.product_id],
      )
    ).rows[0],
    { origin: "user_submitted", is_chaarlie_recommended: false, suitable_thicknesses: [] },
  )
  assert.equal(
    (
      await pg.query<any>(
        "SELECT count(*)::int n FROM product_application_protocols WHERE product_id=$1",
        [result.publication.product_id],
      )
    ).rows[0].n,
    0,
  )
  assert.equal(
    (await rpc(pg, "product_intake_publish_reviewed_submission", req)).publication.id,
    result.publication.id,
  )
})

test("human existing-product disposition freezes worker lease and preserves real user-product synchronization", async (t) => {
  const pg = await publicationDatabase(t)
  const c = await seed(pg)
  const product = randomUUID()
  const owned = randomUUID()
  await pg.exec("RESET ROLE")
  await pg.query(
    "INSERT INTO products(id,name,brand,category_key,origin) VALUES($1,'Known Conditioner','SQL Test','conditioner','user_submitted')",
    [product],
  )
  await pg.query(
    "INSERT INTO user_products(id,user_id,category,identity_status,ownership_status) VALUES($1,$2,'conditioner','pending_review','owned')",
    [owned, OPERATOR],
  )
  await pg.query("UPDATE product_submissions SET user_product_id=$2 WHERE id=$1", [
    c.submission_id,
    owned,
  ])
  await pg.query(
    "UPDATE product_intake_research_jobs SET status='running',locked_by='worker',locked_at=now() WHERE id=$1",
    [c.job_id],
  )
  await pg.exec("SET ROLE service_role")
  const req = { ...c, action: "link_existing", reviewer_value: { product_id: product } }
  const result = await rpc(pg, "product_intake_record_review_decision", req)
  assert.equal(result.submission.status, "matched_existing")
  assert.equal(result.submission.approved_product_id, product)
  assert.equal(result.job.status, "cancelled")
  assert.equal(result.job.locked_by, null)
  assert.equal(result.decision.notification_snapshot.approved_product_id, product)
  assert.equal(
    (await rpc(pg, "product_intake_record_review_decision", req)).decision.id,
    result.decision.id,
  )
  await pg.exec("RESET ROLE")
  assert.deepEqual(
    (
      await pg.query(
        "SELECT catalog_product_id,identity_status,ownership_status FROM user_products WHERE id=$1",
        [owned],
      )
    ).rows[0],
    { catalog_product_id: product, identity_status: "matched", ownership_status: "owned" },
  )
})

test("legacy package registers immutable manifests and publishes exact public hashes without a job", async (t) => {
  const { publicationMaskBatch } = await import("./helpers/product-intake-publication-postgres")
  const pg = await publicationDatabase(t)
  const item = (await publicationMaskBatch()).items[0]!
  assert.ok(item.kind === "new_product", "mask publication fixture must create a product")
  const approved = structuredClone(item.final_payload) as any
  const c = await seed(pg, false)
  await pg.query(
    "UPDATE product_submissions SET category='mask',researched_payload=$2 WHERE id=$1",
    [c.submission_id, { final: approved }],
  )
  const before = (
    await pg.query<any>("SELECT * FROM product_submissions WHERE id=$1", [c.submission_id])
  ).rows[0]
  Object.assign(c, {
    payload_revision: before.payload_revision,
    payload_sha256: before.payload_sha256,
  })
  const hash = "1".repeat(64),
    thumbnailHash = "2".repeat(64)
  const assets = [
    { kind: "final", sha256: hash },
    { kind: "search_thumbnail", sha256: thumbnailHash },
  ].map((a) => ({
    ...a,
    storage_key: `${c.submission_id}/${c.payload_revision}/${a.sha256}`,
    media_type: "image/webp",
    byte_length: 120,
  }))
  const legacy = {
    ...c,
    approve_data: true,
    approve_image: true,
    no_image: false,
    review_assets: assets,
    comment: "Exact package reviewed",
  }
  await assert.rejects(
    rpc(pg, "product_intake_register_legacy_review", {
      ...legacy,
      review_assets: assets.map((a) => ({
        ...a,
        storage_key: `${randomUUID()}/${c.payload_revision}/${a.sha256}`,
      })),
    }),
    /check constraint/,
  )
  assert.equal(
    (await pg.query<any>("SELECT count(*)::int n FROM product_intake_review_decisions")).rows[0].n,
    0,
  )
  const registered = await rpc(pg, "product_intake_register_legacy_review", legacy)
  assert.equal(
    (await rpc(pg, "product_intake_register_legacy_review", legacy)).data_decision.id,
    registered.data_decision.id,
  )
  await assert.rejects(
    pg.query("UPDATE product_intake_review_assets SET byte_length=200 WHERE submission_id=$1", [
      c.submission_id,
    ]),
    /permission denied/,
  )
  const p = await preflight(pg, c.submission_id)
  assert.equal(p.ok, true)
  const prefix = "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/"
  const image = {
    canonical_url: `${prefix}product-intake/review/${hash}.webp`,
    canonical_sha256: hash,
    thumbnail_url: `${prefix}thumbnails/search-v1/${hash}.webp`,
    thumbnail_sha256: thumbnailHash,
  }
  const supplied = {
    ...approved,
    product: {
      ...approved.product,
      image_url: image.canonical_url,
      canonical_image_sha256: hash,
      thumbnail_image_url: image.thumbnail_url,
    },
  }
  const req = {
    ...c,
    request_id: randomUUID(),
    data_decision_id: p.data_decision_id,
    image_decision_id: p.image_decision_id,
    confirm: true,
    final_payload: supplied,
    spec_operations: item.spec_operations,
    public_image: image,
    owner_default: false,
  }
  await assert.rejects(
    rpc(pg, "product_intake_publish_reviewed_submission", {
      ...req,
      public_image: { ...image, canonical_sha256: "3".repeat(64) },
    }),
    /approved bytes/,
  )
  const result = await rpc(pg, "product_intake_publish_reviewed_submission", req)
  assert.equal(result.job, null)
  assert.equal(result.publication.job_id, null)
  assert.equal(result.publication.approved_asset_sha256, hash)
  assert.equal(result.publication.persisted_payload_revision, c.payload_revision + 1)
  assert.equal(
    (await rpc(pg, "product_intake_publish_reviewed_submission", req)).publication.id,
    result.publication.id,
  )
})

test("rejection preserves optional next step while information requests require one", async (t) => {
  const pg = await publicationDatabase(t)
  const c = await seed(pg)
  await assert.rejects(
    record(pg, c, "request_info", {
      reviewer_value: { reason: "Bitte Etikett prüfen", next_step: null, missing_fields: ["inci"] },
    }),
    /next step/,
  )
  await assert.rejects(
    record(pg, c, "reject", {
      reviewer_value: {
        reason: "Produkt nicht unterstützt",
        next_step: { instruction: "invalid type" },
      },
    }),
    /next step/,
  )
  const result = await record(pg, c, "reject", {
    reviewer_value: { reason: "Produkt nicht unterstützt", next_step: null },
  })
  assert.equal(result.submission.status, "rejected")
  assert.equal(result.submission.user_facing_resolution_reason, "Produkt nicht unterstützt")
  assert.equal(result.submission.user_facing_next_step, null)
  assert.equal(result.job.status, "cancelled")
  assert.equal(result.decision.notification_snapshot.user_facing_next_step, null)
})

test("historical no-job dispositions retain exact binding and replay without opening approval or rework bypasses", async (t) => {
  const pg = await publicationDatabase(t)
  const product = randomUUID()
  await pg.query(
    "INSERT INTO products(id,name,brand,category_key,origin) VALUES($1,'Known historical conditioner','SQL Test','conditioner','user_submitted')",
    [product],
  )
  const values = {
    request_info: {
      reason: "Etikett fehlt",
      next_step: "Bitte Foto senden",
      missing_fields: ["inci"],
    },
    reject: { reason: "Produkt nicht unterstützt", next_step: null },
    link_existing: { product_id: product },
  }
  const statuses = {
    request_info: "needs_more_info",
    reject: "rejected",
    link_existing: "matched_existing",
  }
  for (const action of ["request_info", "reject", "link_existing"] as const) {
    const c = await seed(pg, false)
    const req = { ...c, action, reviewer_value: values[action] }
    await assert.rejects(
      rpc(pg, "product_intake_record_review_decision", {
        ...req,
        payload_revision: c.payload_revision + 1,
      }),
      /revision/,
    )
    await assert.rejects(
      rpc(pg, "product_intake_record_review_decision", { ...req, review_cycle_id: randomUUID() }),
      /genuinely no-job/,
    )
    const result = await rpc(pg, "product_intake_record_review_decision", req)
    assert.equal(result.submission.status, statuses[action])
    assert.equal(result.job, null)
    assert.equal(result.decision.job_id, null)
    assert.equal(result.decision.review_cycle_id, null)
    assert.equal(result.decision.payload_revision, c.payload_revision)
    assert.equal(result.decision.payload_sha256, c.payload_sha256)
    assert.equal(result.decision.notification_status, "pending")
    assert.equal(result.decision.notification_snapshot.status, statuses[action])
    const replay = await rpc(pg, "product_intake_record_review_decision", req)
    assert.equal(replay.decision.id, result.decision.id)
    assert.equal(replay.job, null)
  }
  const noJob = await seed(pg, false)
  for (const action of ["approve_data", "approve_image", "approve_raw", "answer", "rework"])
    await assert.rejects(
      record(pg, noJob, action, { comment: "Cannot invent a worker cycle" }),
      /job or cycle/,
    )
  const jobBacked = await seed(pg)
  for (const action of ["request_info", "reject", "link_existing"] as const)
    await assert.rejects(
      record(pg, { ...jobBacked, job_id: null, review_cycle_id: null }, action, {
        reviewer_value: values[action],
      }),
      /genuinely no-job/,
    )
  assert.equal(
    (
      await pg.query<any>("SELECT status FROM product_intake_research_jobs WHERE id=$1", [
        jobBacked.job_id,
      ])
    ).rows[0].status,
    "waiting_for_review",
  )
})
