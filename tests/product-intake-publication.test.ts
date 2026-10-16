import assert from "node:assert/strict"
import { createHash, randomUUID } from "node:crypto"
import { createServer } from "node:http"
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test, { type TestContext } from "node:test"
import { createClient } from "@supabase/supabase-js"
import { buildPublishPreflight } from "@chaarlie/product-intake-core"
import sharp from "sharp"
import {
  OPERATOR,
  publicationDatabase,
  publicationMaskBatch,
} from "./helpers/product-intake-publication-postgres"
import {
  executeReviewAction,
  loadReviewPublicationPreflight,
  publishReviewedProduct,
  retryReviewNotification,
  reviewBinding,
} from "../src/lib/product-intake/review-publication"
import {
  copyReviewImagesToPublic,
  reviewPublicImage,
} from "../src/lib/product-intake/publication-images"
import { approveResearchPackage } from "../scripts/product-intake/approve-package"
import { validateProductIntakeApprovalPayload } from "../src/lib/product-intake/category-validators"

// Real SDK serialization/Storage and actual migration functions. The HTTP shim
// supplies PostgREST framing only; SQL owns decisions, revisions and catalog state.
async function boundary(t: TestContext) {
  const pg = await publicationDatabase(t)
  const objects = new Map<string, Buffer>()
  const requests: string[] = []
  const server = createServer(async (req, res) => {
    const url = new URL(req.url!, "http://fixture")
    requests.push(`${req.method} ${url.pathname}`)
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(Buffer.from(chunk))
    const raw = Buffer.concat(chunks)
    const send = (body: unknown, status = 200) => {
      res.statusCode = status
      res.setHeader("content-type", "application/json")
      res.end(JSON.stringify(body))
    }
    try {
      if (url.pathname.startsWith("/storage/v1/object/")) {
        const key = decodeURIComponent(url.pathname.slice("/storage/v1/object/".length)).replace(
          /^authenticated\//,
          "",
        )
        if (req.method === "POST") {
          assert.equal(req.headers["x-upsert"], "false")
          if (objects.has(key))
            return send({ statusCode: "409", error: "Duplicate", message: "exists" }, 409)
          objects.set(key, raw)
          return send({ Key: key })
        }
        const bytes = objects.get(key)
        if (!bytes) return send({ statusCode: "404", message: "missing" }, 404)
        res.setHeader("content-type", "image/webp")
        res.end(bytes)
        return
      }
      const table = url.pathname.split("/").at(-1)!
      assert.match(table, /^[a-z_]+$/)
      const body = raw.length ? JSON.parse(raw.toString()) : null
      if (url.pathname.includes("/rpc/")) {
        assert.match(table, /^product_intake_/)
        const value = body.p_request ?? body.p_submission_id
        const result = await pg.query<{ result: unknown }>(`SELECT public.${table}($1) result`, [
          value,
        ])
        return send(result.rows[0].result)
      }
      // Deliberate downstream outage: product commit must survive notification failure.
      if (["conversations", "conversation_states", "messages"].includes(table))
        return send({ message: "fixture customer transport unavailable" }, 503)
      const filters: string[] = [],
        values: unknown[] = []
      for (const [key, value] of url.searchParams) {
        if (["select", "order", "limit"].includes(key)) continue
        assert.match(key, /^[a-z_]+$/)
        if (value.startsWith("eq.")) {
          values.push(value.slice(3))
          filters.push(`${key}=$${values.length}`)
        } else if (value.startsWith("in.(")) {
          values.push(value.slice(4, -1).split(","))
          filters.push(`${key}=ANY($${values.length})`)
        } else throw new Error(`Unsupported fixture filter ${key}=${value}`)
      }
      const where = filters.length ? ` WHERE ${filters.join(" AND ")}` : ""
      let result
      if (req.method === "PATCH") {
        const set = Object.entries(body)
          .map(([key, value]) => {
            assert.match(key, /^[a-z_]+$/)
            values.push(value)
            return `${key}=$${values.length}`
          })
          .join(",")
        result = await pg.query(`UPDATE ${table} SET ${set}${where} RETURNING *`, values)
      } else {
        assert.equal(req.method, "GET")
        const order = url.searchParams
          .get("order")
          ?.split(",")
          .map((part) => {
            const [key, direction] = part.split(".")
            assert.match(key, /^[a-z_]+$/)
            return `${key} ${direction === "desc" ? "DESC" : "ASC"}`
          })
          .join(",")
        result = await pg.query(
          `SELECT * FROM ${table}${where}${order ? ` ORDER BY ${order}` : ""}${url.searchParams.has("limit") ? ` LIMIT ${Number(url.searchParams.get("limit"))}` : ""}`,
          values,
        )
      }
      return send(
        req.headers.accept?.includes("application/vnd.pgrst.object")
          ? (result.rows[0] ?? null)
          : result.rows,
      )
    } catch (error) {
      t.diagnostic(error instanceof Error ? error.message : "fixture failed")
      send(
        {
          message: error instanceof Error ? error.message : "fixture failed",
          code: (error as { code?: string }).code,
        },
        400,
      )
    }
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  t.after(async () => {
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })
  const client = createClient(
    `http://127.0.0.1:${(server.address() as { port: number }).port}`,
    "test",
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  const item = (await publicationMaskBatch()).items[0]!
  if (item.kind !== "new_product") throw new Error("fixture requires a create item")
  const final = structuredClone(item.final_payload)
  if (!final.product || typeof final.product !== "object" || Array.isArray(final.product)) {
    throw new Error("fixture requires a product object")
  }
  Object.assign(final.product, {
    image_url: null,
    canonical_image_sha256: null,
    thumbnail_image_url: null,
  })
  const validation = validateProductIntakeApprovalPayload({ final })
  assert.equal(validation.ok, true, JSON.stringify(validation))
  if (!validation.ok) throw new Error("fixture payload invalid")
  const payload = validation.normalizedPayload
  async function seed(job = true) {
    const id = randomUUID()
    await pg.query(
      `INSERT INTO product_submissions(id,user_id,source,intake_method,category,frequency_range,status,researched_payload) VALUES($1,$2,'chat','manual','mask','weekly_1x','ready_for_review',$3)`,
      [id, OPERATOR, payload],
    )
    if (job)
      await pg.query(
        "INSERT INTO product_intake_research_jobs(submission_id,status,stage) VALUES($1,'waiting_for_review','preview_build')",
        [id],
      )
    return id
  }
  return { pg, client, objects, requests, seed, payload }
}

test("shared service uses exact approvals, commits once before chat failure, and recovery never republishes", async (t) => {
  const f = await boundary(t),
    id = await f.seed()
  let preflight = await loadReviewPublicationPreflight(f.client, id)
  assert.equal(preflight.ok, false)
  assert.equal(preflight.can_approve_no_image, true)
  const common = { ...reviewBinding(preflight), reviewed_by: "nick" }
  await executeReviewAction(f.client, {
    ...common,
    request_id: randomUUID(),
    action: "approve_data",
  })
  await executeReviewAction(f.client, {
    ...common,
    request_id: randomUUID(),
    action: "approve_image",
    reviewer_value: { no_image: true },
    comment: "Ohne Bild geprüft.",
  })
  preflight = await loadReviewPublicationPreflight(f.client, id)
  assert.equal(preflight.ok, true, preflight.blockers.join(","))
  assert.deepEqual(preflight.proposed_final, f.payload.final)
  const request = {
    ...common,
    request_id: randomUUID(),
    data_decision_id: preflight.data_decision_id!,
    image_decision_id: preflight.image_decision_id!,
    confirm: true as const,
  }
  await assert.rejects(
    publishReviewedProduct(f.client, { ...request, payload_revision: 99 }),
    /review_stale/,
  )
  assert.equal((await f.pg.query<any>("SELECT count(*)::int n FROM products")).rows[0].n, 0)
  const first = await publishReviewedProduct(f.client, request)
  assert.equal(first.publication.notification_status, "failed")
  assert.equal(first.publication.persisted_payload_revision, request.payload_revision + 1)
  assert.equal("notification_snapshot" in first.publication, false)
  const catalogCalls = f.requests.filter((value) =>
    value.includes("/rpc/product_intake_publish_reviewed_submission"),
  ).length
  const repeated = await publishReviewedProduct(f.client, request)
  assert.equal(repeated.publication.id, first.publication.id)
  assert.equal(
    f.requests.filter((value) => value.includes("/rpc/product_intake_publish_reviewed_submission"))
      .length,
    catalogCalls,
  )
  await assert.rejects(
    publishReviewedProduct(f.client, { ...request, reviewed_by: "another" }),
    /review_request_conflict/,
  )
  // A retained receipt must not message a deleted owner on later retry.
  await f.pg.exec(
    "RESET ROLE; ALTER TABLE product_submissions ALTER COLUMN user_id DROP NOT NULL; SET ROLE service_role",
  )
  await f.pg.query("UPDATE product_submissions SET user_id=NULL WHERE id=$1", [id])
  assert.deepEqual(
    await retryReviewNotification(f.client, { publicationId: first.publication.id }),
    { notification_status: "not_required" },
  )
  assert.equal((await f.pg.query<any>("SELECT count(*)::int n FROM products")).rows[0].n, 1)
})

test("superseded information requests remain held for reconciliation without contacting chat", async (t) => {
  const f = await boundary(t)
  for (const status of ["approved", "matched_existing"]) {
    const id = await f.seed()
    const preflight = await loadReviewPublicationPreflight(f.client, id)
    const result = await executeReviewAction(f.client, {
      ...reviewBinding(preflight),
      request_id: randomUUID(),
      reviewed_by: "nick",
      action: "request_info",
      reviewer_value: {
        reason: "INCI fehlen",
        next_step: "Bitte INCI senden",
        missing_fields: ["inci"],
      },
    })
    assert.equal(result.decision.notification_status, "failed")
    const productId = randomUUID()
    await f.pg.query(
      "INSERT INTO products(id,name,category_key,origin) VALUES($1,'Later product','mask','user_submitted')",
      [productId],
    )
    await f.pg.query(
      "UPDATE product_submissions SET status=$2,approved_product_id=$3 WHERE id=$1",
      [id, status, productId],
    )
    const before = f.requests.length
    assert.deepEqual(await retryReviewNotification(f.client, { decisionId: result.decision.id }), {
      notification_status: "failed",
    })
    assert.equal(
      f.requests
        .slice(before)
        .some((request) => /\/(conversations|conversation_states|messages)$/.test(request)),
      false,
    )
    const decision = (
      await f.pg.query<{
        notification_status: string
        notification_error_code: string
        notification_message_id: string | null
      }>(
        "SELECT notification_status,notification_error_code,notification_message_id FROM product_intake_review_decisions WHERE id=$1",
        [result.decision.id],
      )
    ).rows[0]
    assert.deepEqual(decision, {
      notification_status: "failed",
      notification_error_code: "notification_requires_reconciliation",
      notification_message_id: null,
    })
  }
})

test("private image copies verify both hashes and dimensions and refuse conflicting immutable public bytes", async (t) => {
  const f = await boundary(t),
    id = randomUUID()
  const canonical = await sharp({
    create: { width: 1200, height: 1200, channels: 3, background: "#f3efe8" },
  })
    .webp()
    .toBuffer()
  const thumbnail = await sharp(canonical).resize(144, 144).webp().toBuffer()
  const binding = {
    submission_id: id,
    payload_revision: 1,
    payload_sha256: "a".repeat(64),
    job_id: null,
    review_cycle_id: null,
  }
  const asset = (kind: "final" | "search_thumbnail", bytes: Buffer) => ({
    id: randomUUID(),
    submission_id: id,
    payload_revision: 1,
    job_id: null,
    created_at: "2026-10-16",
    kind,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    storage_key: `${id}/1/${createHash("sha256").update(bytes).digest("hex")}`,
    byte_length: bytes.length,
    media_type: "image/webp",
  })
  const final = asset("final", canonical),
    small = asset("search_thumbnail", thumbnail)
  f.objects.set(`product-intake-review/${final.storage_key}`, canonical)
  f.objects.set(`product-intake-review/${small.storage_key}`, thumbnail)
  const image = await copyReviewImagesToPublic(f.client, binding, final, small)
  assert.deepEqual(image, reviewPublicImage(final.sha256, small.sha256))
  assert.deepEqual(await copyReviewImagesToPublic(f.client, binding, final, small), image)
  const thumbnailKey = `product-images/thumbnails/search-v1/${final.sha256}.webp`
  const conflictingThumbnail = Buffer.from(thumbnail)
  conflictingThumbnail[conflictingThumbnail.length - 1] ^= 1
  f.objects.set(thumbnailKey, conflictingThumbnail)
  await assert.rejects(
    copyReviewImagesToPublic(f.client, binding, final, small),
    /review_image_bytes_conflict/,
  )
  assert.deepEqual(f.objects.get(thumbnailKey), conflictingThumbnail)
  f.objects.set(`product-intake-review/${small.storage_key}`, conflictingThumbnail)
  const posts = f.requests.filter((value) => value.startsWith("POST /storage")).length
  await assert.rejects(
    copyReviewImagesToPublic(f.client, binding, final, small),
    /review_image_bytes_conflict/,
  )
  assert.equal(f.requests.filter((value) => value.startsWith("POST /storage")).length, posts)
})

test("legacy no-image package saves normalized evidence then records separate approvals and replays without resaving", async (t) => {
  const f = await boundary(t),
    id = await f.seed(false)
  const root = await mkdtemp(join(tmpdir(), "publication-legacy-"))
  t.after(() => rm(root, { recursive: true, force: true }))
  const previousCwd = process.cwd()
  process.chdir(root)
  t.after(() => {
    process.chdir(previousCwd)
  })
  const dir = join(root, id)
  await mkdir(dir)
  const files = {
    "submission.json": { id },
    "payload.json": f.payload,
    "image-finalization.json": {
      status: "no_image_approved_for_now",
      reason: "not_needed_for_v1",
      notes: "Explizit ohne Bild freigegeben.",
      reviewed_by: "nick",
      reviewed_at: "2026-10-16T12:00:00Z",
    },
    "validation.json": {},
  }
  for (const [name, value] of Object.entries(files))
    await writeFile(join(dir, name), JSON.stringify(value))
  for (const name of ["research.md", "approval.md"])
    await writeFile(join(dir, name), "Offline fixture")
  const params = {
    packageDir: dir,
    reviewedBy: "nick",
    reviewNotes: null,
    apply: true,
    confirm: true,
    deps: { createSupabaseClient: () => f.client },
  }
  const first = await approveResearchPackage(params)
  assert.equal(first.mode, "applied")
  const before = (
    await f.pg.query<any>("SELECT payload_revision FROM product_submissions WHERE id=$1", [id])
  ).rows[0].payload_revision
  await approveResearchPackage(params)
  assert.equal(
    (await f.pg.query<any>("SELECT payload_revision FROM product_submissions WHERE id=$1", [id]))
      .rows[0].payload_revision,
    before,
  )
  assert.equal(
    (
      await f.pg.query<any>(
        "SELECT count(*)::int n FROM product_intake_review_decisions WHERE submission_id=$1",
        [id],
      )
    ).rows[0].n,
    2,
  )
  assert.equal((await f.pg.query<any>("SELECT count(*)::int n FROM products")).rows[0].n, 1)
})

test("old cockpit mutation routes direct to authenticated Admin and cannot accept a publish or approval payload", async () => {
  const routes = [
    await import("../apps/product-intake-review/app/api/submissions/[submissionId]/publish/route"),
    await import("../apps/product-intake-review/app/api/submissions/[submissionId]/review-decision/route"),
    await import("../apps/product-intake-review/app/api/submissions/[submissionId]/rework/route"),
  ]
  for (const route of routes) {
    const response = await route.POST(
      new Request("http://localhost:3910/api/submissions/test/publish", {
        method: "POST",
        headers: { host: "localhost:3910" },
        body: JSON.stringify({ confirm: true, decision: "publish_approved" }),
      }),
      { params: Promise.resolve({ submissionId: "11111111-1111-4111-8111-111111111111" }) },
    )
    assert.equal(response.status, 409)
    assert.equal(response.headers.get("cache-control"), "private, no-store")
    const body = await response.json()
    assert.equal(body.ok, false)
    assert.equal(body.admin_path, "/admin/produkt-intake/11111111-1111-4111-8111-111111111111")
  }
})

test("cockpit preflight reports rejected image and unresolved research question truthfully", async (t) => {
  const f = await boundary(t),
    id = await f.seed()
  const common = {
    ...reviewBinding(await loadReviewPublicationPreflight(f.client, id)),
    reviewed_by: "nick",
  }
  for (const request of [
    { action: "approve_data" as const },
    {
      action: "approve_image" as const,
      reviewer_value: { no_image: true },
      comment: "Explicit exception",
    },
    { action: "reject_image" as const, comment: "Image needs correction" },
  ])
    await executeReviewAction(f.client, { ...common, ...request, request_id: randomUUID() })
  await f.pg.exec("RESET ROLE")
  await f.pg.query(
    "INSERT INTO product_intake_review_decisions(submission_id,job_id,field_path,decision,reviewed_by) VALUES($1,$2,'product.clean_name','change_requested','nick')",
    [id, common.job_id],
  )
  await f.pg.exec("SET ROLE service_role")
  const result = await buildPublishPreflight(f.client, id)
  assert.equal(result.ok, false)
  assert.equal(result.unresolved_decisions, 1)
  assert.equal(result.latest_image_decision, "image_rejected")
  assert.equal(result.latest_publish_decision, "approved")
})
