import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import test from "node:test"
import { OPERATOR, publicationDatabase } from "./helpers/product-intake-publication-postgres"

type Database = Awaited<ReturnType<typeof publicationDatabase>>
type Job = {
  id: string
  submission_id: string
  locked_by: string
  locked_at: Date
  review_cycle_id: string
  progress: Record<string, unknown>
}
const SHA = "a".repeat(64)
const ARGUMENTS = [
  "target_job_id",
  "expected_locked_by",
  "expected_locked_at",
  "next_status",
  "next_stage",
  "next_progress",
  "next_last_error",
  "researched_payload",
  "resolve_decision_ids",
  "review_outcome",
  "notification_payload",
  "expected_review_cycle_id",
  "research_artifacts",
  "request_auto_rework",
  "expected_payload_revision",
  "review_assets",
]

async function runningJob(pg: Database): Promise<Job> {
  await pg.query(
    `INSERT INTO product_submissions(user_id,source,intake_method,category,frequency_range,status,researched_payload)
 VALUES($1,'chat','manual','conditioner','weekly_1x','pending_review','{}')`,
    [OPERATOR],
  )
  return (
    await pg.query<Job>("SELECT * FROM product_intake_claim_research_jobs('reconciliation-test',1)")
  ).rows[0]!
}
function manifest(job: Job, revision = 2) {
  return {
    kind: "final",
    sha256: SHA,
    storage_key: `${job.submission_id}/${revision}/${SHA}`,
    media_type: "image/webp",
    byte_length: 120,
  }
}
function request(job: Job, id = randomUUID()) {
  return {
    target_job_id: job.id,
    expected_locked_by: job.locked_by,
    expected_locked_at: job.locked_at,
    next_status: "waiting_for_review",
    next_stage: "preview_build",
    next_progress: { source_artifact_id: id },
    next_last_error: null,
    researched_payload: { final: { source_artifact_id: id } },
    resolve_decision_ids: [] as string[],
    review_outcome: "ready_for_review",
    notification_payload: {
      product_name: "Reconciliation test",
      category_label: "Conditioner",
      outcome_label: "Bereit zur Prüfung",
      question_1: "",
      question_2: "",
      question_3: "",
      review_url: `https://chaarlie.de/admin/produkt-intake/${job.submission_id}`,
      is_test: false,
    },
    expected_review_cycle_id: job.review_cycle_id,
    research_artifacts: [{ id, kind: "processed_image", payload: { source_artifact_id: id } }],
    request_auto_rework: false,
    expected_payload_revision: 1,
    review_assets: [manifest(job)],
  }
}
async function commit(pg: Database, input: Record<string, unknown>, legacy = false) {
  const names = legacy ? ARGUMENTS.slice(0, 14) : ARGUMENTS
  return (
    await pg.query<Job>(
      `SELECT * FROM product_intake_commit_research_pass(${names.map((name, i) => `${name}=>$${i + 1}`).join(",")})`,
      names.map((name) => input[name]),
    )
  ).rows[0]!
}
async function snapshot(pg: Database) {
  const tables = [
    "product_submissions",
    "product_intake_research_jobs",
    "product_intake_research_artifacts",
    "product_intake_review_assets",
    "product_intake_review_decisions",
    "product_intake_admin_notifications",
  ]
  return Promise.all(
    tables.map(async (table) => (await pg.query(`SELECT * FROM ${table} ORDER BY id`)).rows),
  )
}
async function submission(pg: Database, id: string) {
  return (
    await pg.query<{
      payload_revision: number
      payload_sha256: string
      researched_payload: unknown
    }>(
      "SELECT payload_revision,payload_sha256,researched_payload FROM product_submissions WHERE id=$1",
      [id],
    )
  ).rows[0]!
}

test("actual ordered migrations expose one service-only default-compatible handoff RPC", async (t) => {
  const pg = await publicationDatabase(t)
  const result = await pg.query<{
    pronargs: number
    pronargdefaults: number
    proargnames: string[]
    service: boolean
    anonymous: boolean
    authenticated: boolean
  }>(`SELECT pronargs,pronargdefaults,proargnames,
 has_function_privilege('service_role',oid,'EXECUTE') service,has_function_privilege('anon',oid,'EXECUTE') anonymous,has_function_privilege('authenticated',oid,'EXECUTE') authenticated
 FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='product_intake_commit_research_pass'`)
  // PostgREST matches JSON argument names against default-compatible candidates.
  // An exact PostgreSQL 14-argument call alone can conceal the overloaded API.
  assert.equal(result.rows.length, 1, "PostgREST must have exactly one matching handoff function")
  assert.equal(result.rows[0]!.pronargs, 16)
  assert.equal(result.rows[0]!.pronargdefaults, 9)
  assert.deepEqual(result.rows[0]!.proargnames, ARGUMENTS)
  assert.deepEqual(
    [result.rows[0]!.service, result.rows[0]!.anonymous, result.rows[0]!.authenticated],
    [true, false, false],
  )
})

test("a payload-less technical correction preserves research bytes but advances the fenced revision and only its bounded counter", async (t) => {
  const pg = await publicationDatabase(t)
  const initial = await runningJob(pg)
  const job = (
    await pg.query<Job & { cycle_deadline_at: Date }>(
      "SELECT * FROM product_intake_reserve_model_run($1,$2,$3,$4)",
      [initial.id, initial.locked_by, initial.locked_at, initial.review_cycle_id],
    )
  ).rows[0]!
  const before = await submission(pg, job.submission_id)
  const result = await commit(pg, {
    ...request(job),
    next_status: "waiting_for_rework",
    next_stage: "rework",
    next_progress: { error_code: "model_output_invalid_json" },
    next_last_error: "Invalid model JSON",
    researched_payload: null,
    research_artifacts: [],
    review_assets: [],
    notification_payload: null,
    review_outcome: "continue",
    request_auto_rework: true,
  })
  const after = await submission(pg, job.submission_id)
  assert.deepEqual(after.researched_payload, before.researched_payload)
  assert.equal(after.payload_sha256, before.payload_sha256)
  assert.equal(after.payload_revision, 2)
  assert.equal(result.review_cycle_id, job.review_cycle_id)
  const saved = (
    await pg.query<{
      auto_rework_count: number
      reserved_model_runs: number
      cycle_deadline_at: Date
    }>(
      "SELECT auto_rework_count,reserved_model_runs,cycle_deadline_at FROM product_intake_research_jobs WHERE id=$1",
      [job.id],
    )
  ).rows[0]!
  assert.equal(saved.auto_rework_count, 1)
  assert.equal(saved.reserved_model_runs, 1)
  assert.equal(saved.cycle_deadline_at.toISOString(), job.cycle_deadline_at.toISOString())
  assert.deepEqual((await pg.query("SELECT id FROM product_intake_admin_notifications")).rows, [])
  assert.deepEqual((await pg.query("SELECT id FROM product_intake_review_assets")).rows, [])
  assert.deepEqual((await pg.query("SELECT id FROM product_intake_review_decisions")).rows, [])
})

test("legacy named 14-argument calls retain allocated IDs and exact replay through the single 16-argument RPC", async (t) => {
  const pg = await publicationDatabase(t)
  const job = await runningJob(pg)
  const input = request(job)
  const result = await commit(pg, input, true)
  const id = input.research_artifacts[0]!.id
  assert.deepEqual(result.progress.artifact_ids, [id])
  assert.equal(result.progress.processed_image_artifact_id, id)
  const saved = await submission(pg, job.submission_id)
  assert.equal(saved.payload_revision, 2)
  assert.equal(result.progress.payload_sha256, saved.payload_sha256)
  assert.equal(result.progress.payload_revision, 2)
  assert.equal(
    (await pg.query<{ n: number }>("SELECT count(*)::int n FROM product_intake_review_assets"))
      .rows[0]!.n,
    0,
  )
  const before = await snapshot(pg)
  assert.deepEqual((await commit(pg, input, true)).progress, result.progress)
  assert.deepEqual(await snapshot(pg), before)
  await assert.rejects(
    commit(
      pg,
      { ...input, research_artifacts: [{ ...input.research_artifacts[0]!, id: randomUUID() }] },
      true,
    ),
    /replay/,
  )
  assert.deepEqual(await snapshot(pg), before)
})

test("allocated artifact IDs, manifest, revision, decision resolution and outbox commit atomically", async (t) => {
  const pg = await publicationDatabase(t)
  const job = await runningJob(pg)
  const input = request(job)
  await pg.exec("RESET ROLE")
  const decision = (
    await pg.query<{ id: string }>(
      "INSERT INTO product_intake_review_decisions(submission_id,job_id,field_path,decision,reviewed_by) VALUES($1,$2,'review.rework','change_requested','nick') RETURNING id",
      [job.submission_id, job.id],
    )
  ).rows[0]!
  await pg.exec("SET ROLE service_role")
  input.resolve_decision_ids = [decision.id]
  const result = await commit(pg, input)
  const saved = await submission(pg, job.submission_id)
  const id = input.research_artifacts[0]!.id
  assert.equal(saved.payload_revision, 2)
  assert.equal(result.progress.payload_sha256, saved.payload_sha256)
  assert.deepEqual(result.progress.artifact_ids, [id])
  assert.equal(result.progress.processed_image_artifact_id, id)
  assert.deepEqual(saved.researched_payload, input.researched_payload)
  const artifact = (
    await pg.query<{ id: string; job_id: string; submission_id: string }>(
      "SELECT id,job_id,submission_id FROM product_intake_research_artifacts",
    )
  ).rows[0]!
  assert.deepEqual(artifact, { id, job_id: job.id, submission_id: job.submission_id })
  assert.deepEqual(
    (
      await pg.query(
        "SELECT submission_id,payload_revision,kind,sha256,storage_key FROM product_intake_review_assets",
      )
    ).rows,
    [
      {
        submission_id: job.submission_id,
        payload_revision: 2,
        kind: "final",
        sha256: SHA,
        storage_key: manifest(job).storage_key,
      },
    ],
  )
  assert.ok(
    (
      await pg.query<{ resolved_at: Date }>(
        "SELECT resolved_at FROM product_intake_review_decisions WHERE id=$1",
        [decision.id],
      )
    ).rows[0]!.resolved_at,
  )
  assert.equal(
    (
      await pg.query<{ n: number }>(
        "SELECT count(*)::int n FROM product_intake_admin_notifications",
      )
    ).rows[0]!.n,
    1,
  )
  const before = await snapshot(pg)
  assert.deepEqual((await commit(pg, input)).progress, result.progress)
  await assert.rejects(
    commit(pg, { ...input, review_assets: [{ ...manifest(job), byte_length: 121 }] }),
    /replay/,
  )
  await assert.rejects(
    commit(pg, {
      ...input,
      research_artifacts: [{ ...input.research_artifacts[0]!, id: randomUUID() }],
    }),
    /replay/,
  )
  assert.deepEqual(await snapshot(pg), before)
  // The same reconciled body also preserves the image-only revision transition.
  await pg.query("SELECT * FROM product_intake_request_rework_job($1)", [job.submission_id])
  const next = (
    await pg.query<Job>(
      "SELECT * FROM product_intake_claim_research_jobs('image-reconciliation',1)",
    )
  ).rows[0]!
  const imageOnly = {
    ...request(next),
    researched_payload: null,
    expected_payload_revision: 2,
    review_assets: [manifest(next, 3)],
  }
  const imageResult = await commit(pg, imageOnly)
  assert.equal(imageResult.progress.payload_revision, 3)
  assert.deepEqual(
    (await submission(pg, job.submission_id)).researched_payload,
    saved.researched_payload,
  )
  assert.deepEqual(
    (
      await pg.query(
        "SELECT payload_revision FROM product_intake_review_assets ORDER BY payload_revision",
      )
    ).rows,
    [{ payload_revision: 2 }, { payload_revision: 3 }],
  )
})

test("stale fences and malformed or colliding allocated IDs roll back the complete handoff", async (t) => {
  const pg = await publicationDatabase(t)
  const job = await runningJob(pg)
  const input = request(job)
  const checks: [Record<string, unknown>, RegExp][] = [
    [{ ...input, expected_payload_revision: 99 }, /revision/],
    [{ ...input, expected_locked_by: "stale-worker" }, /lock no longer matches/],
    [{ ...input, expected_review_cycle_id: randomUUID() }, /cycle no longer matches/],
    [
      { ...input, research_artifacts: [{ ...input.research_artifacts[0]!, id: 9 }] },
      /invalid research artifact/,
    ],
    [
      { ...input, research_artifacts: [{ ...input.research_artifacts[0]!, id: "not-a-uuid" }] },
      /uuid/,
    ],
    [
      {
        ...input,
        research_artifacts: [input.research_artifacts[0]!, input.research_artifacts[0]!],
      },
      /duplicate key/,
    ],
  ]
  for (const [bad, error] of checks) {
    const before = await snapshot(pg)
    await assert.rejects(commit(pg, bad), error)
    assert.deepEqual(await snapshot(pg), before)
  }
  // A collision with another submission is never an upsert or a cross-owner bind.
  const foreign = await runningJob(pg)
  const foreignId = randomUUID()
  await pg.query(
    "INSERT INTO product_intake_research_artifacts(id,submission_id,job_id,kind,payload) VALUES($1,$2,$3,'processed_image','{}')",
    [foreignId, foreign.submission_id, foreign.id],
  )
  const before = await snapshot(pg)
  await assert.rejects(
    commit(pg, {
      ...input,
      research_artifacts: [
        input.research_artifacts[0]!,
        { ...input.research_artifacts[0]!, id: foreignId },
      ],
    }),
    /duplicate key/,
  )
  assert.deepEqual(await snapshot(pg), before)
})

test("chronological publication retains the Oil guard chain while non-Oil review publication succeeds", async (t) => {
  const { publicationMaskBatch } = await import("./helpers/product-intake-publication-postgres")
  const pg = await publicationDatabase(t)
  const delegate = (
    await pg.query<{ body: string }>(
      "SELECT pg_get_functiondef('public.product_intake_approve_catalog_private(uuid,jsonb,jsonb,text,timestamptz,text)'::regprocedure) body",
    )
  ).rows[0]!.body
  assert.match(delegate, /product_intake_oil_publication_preflight/)
  assert.match(delegate, /product_intake_approve_reviewed_product_before_oil_lab/)
  const inner = (
    await pg.query<{ allowed: boolean }>(
      "SELECT has_function_privilege('service_role','public.product_intake_approve_reviewed_product_before_oil_lab(uuid,jsonb,jsonb,text,timestamptz,text)','EXECUTE') allowed",
    )
  ).rows[0]!
  assert.equal(inner.allowed, false)
  await assert.rejects(
    pg.query(
      "SELECT public.product_intake_approve_reviewed_product_before_oil_lab(NULL,NULL,NULL,'test')",
    ),
    /permission denied/,
  )
  async function reviewReady(category: string, final: unknown) {
    const job = await runningJob(pg)
    await pg.query("UPDATE product_submissions SET category=$2 WHERE id=$1", [
      job.submission_id,
      category,
    ])
    const committed = await commit(pg, {
      ...request(job),
      researched_payload: { final },
      review_assets: [],
    })
    const binding = {
      submission_id: job.submission_id,
      job_id: job.id,
      review_cycle_id: job.review_cycle_id,
      payload_revision: committed.progress.payload_revision,
      payload_sha256: committed.progress.payload_sha256,
      reviewed_by: "nick",
    }
    for (const action of ["approve_data", "approve_image"]) {
      await pg.query("SELECT product_intake_record_review_decision($1)", [
        {
          ...binding,
          request_id: randomUUID(),
          action,
          ...(action === "approve_image" ? { reviewer_value: { no_image: true } } : {}),
        },
      ])
    }
    const preflight = (
      await pg.query<{
        result: { ok: boolean; data_decision_id: string; image_decision_id: string }
      }>("SELECT product_intake_review_preflight($1) result", [job.submission_id])
    ).rows[0]!.result
    assert.equal(preflight.ok, true)
    return {
      ...binding,
      request_id: randomUUID(),
      data_decision_id: preflight.data_decision_id,
      image_decision_id: preflight.image_decision_id,
      final_payload: final,
      public_image: null,
      confirm: true,
      owner_default: false,
    }
  }
  const item = (await publicationMaskBatch()).items[0]!
  assert.ok(item.kind === "new_product")
  const mask = structuredClone(item.final_payload)
  assert.ok(mask.product && typeof mask.product === "object" && !Array.isArray(mask.product))
  Object.assign(mask.product, {
    image_url: null,
    canonical_image_sha256: null,
    thumbnail_image_url: null,
  })
  const maskRequest = await reviewReady("mask", mask)
  const published = (
    await pg.query<{ result: { publication: { product_id: string } } }>(
      "SELECT product_intake_publish_reviewed_submission($1) result",
      [{ ...maskRequest, spec_operations: item.spec_operations }],
    )
  ).rows[0]!.result
  assert.ok(published.publication.product_id)
  const oil = {
    product: {
      canonical_brand: "Synthetic Oil Guard",
      clean_name: "Missing receipt",
      category_key: "oil",
      image_url: null,
      canonical_image_sha256: null,
      thumbnail_image_url: null,
      suitable_thicknesses: ["normal"],
    },
  }
  const oilRequest = await reviewReady("oil", oil)
  const before = await snapshot(pg)
  const productsBefore = (await pg.query("SELECT * FROM products ORDER BY id")).rows
  const receiptsBefore = (
    await pg.query("SELECT * FROM product_intake_publication_receipts ORDER BY id")
  ).rows
  await assert.rejects(
    pg.query("SELECT product_intake_publish_reviewed_submission($1)", [
      { ...oilRequest, spec_operations: [] },
    ]),
    /Current oil Lab approval required/,
  )
  assert.deepEqual(await snapshot(pg), before)
  assert.deepEqual((await pg.query("SELECT * FROM products ORDER BY id")).rows, productsBefore)
  assert.deepEqual(
    (await pg.query("SELECT * FROM product_intake_publication_receipts ORDER BY id")).rows,
    receiptsBefore,
  )
})

test("real Oil Lab publication preserves reviewed product thicknesses without unioning eligibility rows", async (t) => {
  const { detailFixture } = await import("./oil-lab-handoff-fixture")
  const { buildOilLabReviewPackage, OIL_CURRENT_LAB_PROPERTY_IDS } =
    await import("../src/lib/oil-research/lab-package")
  const { oilReviewRecord, stableOilReviewJson } =
    await import("../packages/product-intake-core/src/oil-review-binding")
  const { validateProductIntakeApprovalPayload } =
    await import("../src/lib/product-intake/category-validators")
  const pg = await publicationDatabase(t)
  const detail = detailFixture()
  // The compact shared fixture omits these real base-table timestamps.
  // The actual catalog writer updates updated_at (20260321113000, lines10–11).
  await pg.exec(
    "RESET ROLE; ALTER TABLE product_oil_eligibility ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(), ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(); SET ROLE service_role",
  )
  assert.ok(detail.payload && detail.job)
  const draftFinal = oilReviewRecord(detail.payload.final)
  const specs = oilReviewRecord(draftFinal.category_specs)
  const eligibility = specs.product_oil_eligibility
  assert.ok(Array.isArray(eligibility) && eligibility.length === 1)
  specs.product_oil_eligibility = [
    ...eligibility,
    { ...oilReviewRecord(eligibility[0]), thickness: "normal" },
  ]
  const canonicalHash = "b".repeat(64),
    thumbnailHash = "c".repeat(64)
  const prefix = "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/"
  const publicImage = {
    canonical_url: `${prefix}product-intake/review/${canonicalHash}.webp`,
    canonical_sha256: canonicalHash,
    thumbnail_url: `${prefix}thumbnails/search-v1/${canonicalHash}.webp`,
    thumbnail_sha256: thumbnailHash,
  }
  const validation = validateProductIntakeApprovalPayload({
    final: {
      ...draftFinal,
      category_specs: specs,
      product: {
        ...oilReviewRecord(draftFinal.product),
        image_url: publicImage.canonical_url,
        canonical_image_sha256: canonicalHash,
        thumbnail_image_url: publicImage.thumbnail_url,
      },
      review: { manual_reviewed: true },
    },
  })
  assert.ok(validation.ok, validation.ok ? "" : validation.missingFields.join(","))
  detail.payload.final = validation.normalizedPayload.final
  const bundle = buildOilLabReviewPackage(detail)
  assert.deepEqual(
    oilReviewRecord(bundle.intakeReviewSnapshot.normalizedFinal.product).suitable_thicknesses,
    ["fine"],
  )
  const oilEligibility = bundle.intakeReviewSnapshot.specOperations
    .map(oilReviewRecord)
    .find((op) => op.table === "product_oil_eligibility")
  assert.ok(oilEligibility && Array.isArray(oilEligibility.rows))
  assert.deepEqual(oilEligibility.rows.map((row) => oilReviewRecord(row).thickness).sort(), [
    "fine",
    "normal",
  ])
  await pg.query(
    "INSERT INTO product_submissions(id,user_id,source,intake_method,category,frequency_range,status,researched_payload) VALUES($1,$2,'chat','manual','oil','weekly_1x','ready_for_review',$3)",
    [detail.id, OPERATOR, detail.payload],
  )
  await pg.query(
    "INSERT INTO product_intake_research_jobs(id,submission_id,status,stage) VALUES($1,$2,'waiting_for_review','preview_build')",
    [detail.job.id, detail.id],
  )
  for (const artifact of detail.artifacts)
    await pg.query(
      "INSERT INTO product_intake_research_artifacts(id,submission_id,job_id,kind,status,payload) VALUES($1,$2,$3,$4,$5,$6)",
      [artifact.id, detail.id, artifact.job_id, artifact.kind, artifact.status, artifact.payload],
    )
  const receipt = {
    version: "oil-lab-review-receipt-v2",
    packageFingerprint: bundle.packageFingerprint,
    snapshotFingerprint: bundle.snapshotFingerprint,
    reviewRevision: 1,
    approvedAt: new Date().toISOString(),
    receiptId: "d".repeat(64),
    approvedPropertyIds: [...OIL_CURRENT_LAB_PROPERTY_IDS],
    manualMatchingApproved: true,
  }
  await pg.query("SELECT product_intake_import_oil_lab_review($1,$2,$3,$4,$5,$6)", [
    detail.id,
    receipt,
    bundle.intakeReviewSnapshot,
    bundle.snapshotFingerprint,
    bundle.packageFingerprint,
    stableOilReviewJson(bundle.intakeReviewSnapshot),
  ])
  const saved = await submission(pg, detail.id)
  await pg.query(
    "INSERT INTO product_intake_research_artifacts(submission_id,job_id,kind,status,payload) VALUES($1,$2,'processed_image','pending_review',$3)",
    [
      detail.id,
      detail.job.id,
      {
        planned_public_url: publicImage.canonical_url,
        asset_sha256: canonicalHash,
        thumbnail_public_url: publicImage.thumbnail_url,
        final_image_ready: true,
        transparent_background_detected: true,
      },
    ],
  )
  await pg.query("UPDATE product_intake_research_jobs SET status='running' WHERE id=$1", [
    detail.job.id,
  ])
  for (const [kind, hash] of [
    ["final", canonicalHash],
    ["search_thumbnail", thumbnailHash],
  ])
    await pg.query(
      "INSERT INTO product_intake_review_assets(submission_id,payload_revision,job_id,kind,sha256,storage_key,media_type,byte_length) VALUES($1,$2,$3,$4,$5,$6,'image/webp',120)",
      [
        detail.id,
        saved.payload_revision,
        detail.job.id,
        kind,
        hash,
        `${detail.id}/${saved.payload_revision}/${hash}`,
      ],
    )
  await pg.query(
    "UPDATE product_intake_research_jobs SET status='waiting_for_review' WHERE id=$1",
    [detail.job.id],
  )
  const cycle = (
    await pg.query<{ review_cycle_id: string }>(
      "SELECT review_cycle_id FROM product_intake_research_jobs WHERE id=$1",
      [detail.job.id],
    )
  ).rows[0]!.review_cycle_id
  const binding = {
    submission_id: detail.id,
    job_id: detail.job.id,
    review_cycle_id: cycle,
    payload_revision: saved.payload_revision,
    payload_sha256: saved.payload_sha256,
    reviewed_by: "nick",
  }
  for (const action of ["approve_data", "approve_image"])
    await pg.query("SELECT product_intake_record_review_decision($1)", [
      {
        ...binding,
        request_id: randomUUID(),
        action,
        ...(action === "approve_image" ? { approved_asset_sha256: canonicalHash } : {}),
      },
    ])
  await pg.query("SELECT product_intake_complete_oil_review($1)", [detail.id])
  const preflight = (
    await pg.query<{
      result: { ok: boolean; data_decision_id: string; image_decision_id: string }
    }>("SELECT product_intake_review_preflight($1) result", [detail.id])
  ).rows[0]!.result
  assert.equal(preflight.ok, true)
  const published = (
    await pg.query<{ result: { publication: { product_id: string } } }>(
      "SELECT product_intake_publish_reviewed_submission($1) result",
      [
        {
          ...binding,
          request_id: randomUUID(),
          data_decision_id: preflight.data_decision_id,
          image_decision_id: preflight.image_decision_id,
          final_payload: validation.normalizedPayload.final,
          spec_operations: bundle.intakeReviewSnapshot.specOperations,
          public_image: publicImage,
          confirm: true,
          owner_default: false,
        },
      ],
    )
  ).rows[0]!.result
  assert.deepEqual(
    (
      await pg.query("SELECT suitable_thicknesses FROM products WHERE id=$1", [
        published.publication.product_id,
      ])
    ).rows[0],
    { suitable_thicknesses: ["fine"] },
  )
  // Inspect the untouched eligibility rows as fixture owner; the compact schema
  // deliberately grants no direct service access to that catalog table.
  await pg.exec("RESET ROLE")
  assert.deepEqual(
    (
      await pg.query(
        "SELECT thickness FROM product_oil_eligibility WHERE product_id=$1 ORDER BY thickness",
        [published.publication.product_id],
      )
    ).rows,
    [{ thickness: "fine" }, { thickness: "normal" }],
  )
})
