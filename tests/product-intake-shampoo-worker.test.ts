import assert from "node:assert/strict"
import { createHash, randomUUID } from "node:crypto"
import { createServer } from "node:http"
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test, { type TestContext } from "node:test"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

import { runWorkerProcess } from "../scripts/product-intake/codex-research-worker"

// This is deliberately a subprocess/HTTP test: unit tests own the stage proof
// matrix.  Its independent contract is that the CLI carries that proof through
// reservation, the isolated child cwd, Sol judgment, and one atomic commit.
// The HTTP fixture only stores worker writes. Stage/projection units own research
// correctness; this boundary owns child launch arguments and persisted recovery.
async function workerFixture(t: TestContext, record = "A01") {
  const root = mkdtempSync(join(tmpdir(), "shampoo-worker-cli-"))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const repo = fileURLToPath(new URL("../", import.meta.url))
  const rawImage = await sharp({
    create: { width: 2, height: 2, channels: 4, background: "red" },
  })
    .png()
    .toBuffer()
  const rawHash = createHash("sha256").update(rawImage).digest("hex")
  const uploads: Array<{ key: string; bytes: Buffer }> = []
  const id = randomUUID(),
    submissionId = randomUUID(),
    cycleId = randomUUID()
  const inci = [
    "Aqua",
    "Sodium Laureth Sulfate",
    "Cocamidopropyl Betaine",
    "Sodium Chloride",
    "Parfum",
  ]
  const fingerprint = createHash("sha256")
    .update(inci.map((x) => x.toLowerCase()).join("|"))
    .digest("hex")
  const fixture = JSON.parse(
    readFileSync(
      join(repo, `tests/fixtures/shampoo-production-light/v1.6.2/${record}.json`),
      "utf8",
    ),
  )
  const source = {
    freeze_packet: {
      slot: "single",
      productId: submissionId,
      name: "Xylozent Hydra",
      brand: "Xylozent",
      packSize: "250 ml",
      gtins: ["4066447965414"],
      sources: [
        {
          url: "https://xylozent.invalid/hydra",
          retrievedAt: "2026-10-16T08:00:00Z",
          sourceType: "manufacturer",
          sourceKind: "manufacturer_de",
          gtinShown: "4066447965414",
          inciVerbatim: inci.join(", "),
          claimsVerbatim: "Pflege",
          directionsVerbatim: "Einmassieren und ausspülen.",
        },
      ],
      conflicts: [],
      canonicalInci: inci,
      canonicalReason: "DE manufacturer",
      inciFingerprintSha256: fingerprint,
      normalization: "ID-2",
      identityConfidence: "high",
      formulaCompleteness: "complete",
      formulaSourceTier: 2,
      status: "frozen",
      blockReason: null,
      notes: "",
    },
    intake_draft: { directions: "Einmassieren und ausspülen." },
  }
  fixture.identity = { productId: submissionId, formulaFingerprintSha256: fingerprint }
  const final = {
    summary: "Bereit",
    blockers: [],
    researched_payload: {
      draft: {
        protocol: {
          evidence: [
            {
              sourceText: "Einmassieren und ausspülen.",
              sourceUrl: "https://xylozent.invalid/hydra",
              sourceType: "manufacturer",
              checkedAt: "2026-10-16",
            },
          ],
        },
      },
      final: {
        product: {
          canonical_brand: "Xylozent",
          clean_name: "Hydra",
          category_key: "shampoo",
          image_url: "https://xylozent.invalid/hydra.jpg",
          affiliate_link: "https://xylozent.invalid/hydra",
          price_eur: 6.95,
          currency: "EUR",
          purchase_link_status: "available",
          purchase_link_checked_at: "2026-10-16T08:00:00Z",
          price_checked_at: "2026-10-16T08:00:00Z",
        },
        category_specs: {
          product_application_protocols: [
            {
              category: "shampoo",
              role: "shampoo_everyday",
              cadence: null,
              application_stage: "wash",
              application_state: "wet",
              placement: "scalp",
              contact_time_seconds: null,
              rinse_action: "rinse_out",
              reapplication: "not_stated",
              instruction_modifiers: [],
              source_label: "Hersteller",
              source_url: "https://xylozent.invalid/hydra",
              source_text: "Einmassieren und ausspülen.",
            },
          ],
        },
        sources: [
          { url: "https://xylozent.invalid/hydra", title: "Hersteller", evidence: "Anleitung" },
        ],
        field_rationales: {
          "product.canonical_brand": "Quelle",
          "product.clean_name": "Quelle",
          "product.category_key": "Quelle",
          "product.affiliate_link": "Quelle",
          "product.image_url": "Quelle",
          "product.price_eur": "Quelle",
          "product.purchase_link_status": "Quelle",
          "category_specs.product_application_protocols": "Quelle",
        },
      },
    },
    artifacts: [
      { kind: "property_synthesis", payload: { shampoo_research_envelope: fixture } },
      { kind: "image_candidate", payload: { image_url: "https://xylozent.invalid/raw.png" } },
    ],
  }
  const outputs = join(root, "outputs.json")
  writeFileSync(
    outputs,
    JSON.stringify({ source, final, blindProperties: fixture.directProperties }),
  )
  const binary = join(root, "codex")
  writeFileSync(
    binary,
    `#!/usr/bin/env node
const fs=require('node:fs'); const a=process.argv.slice(2); const out=a[a.indexOf('--output-last-message')+1]; const prompt=a.at(-1)==='-' ? fs.readFileSync(0,'utf8') : a.at(-1); process.chdir(a[a.indexOf('--cd')+1]); fs.appendFileSync(process.env.SHAMPOO_FAKE_LOG,JSON.stringify({args:a,cwd:process.cwd(),prompt64:Buffer.from(prompt).toString('base64')})+'\\n'); const data=JSON.parse(fs.readFileSync(process.env.SHAMPOO_FAKE_OUTPUTS,'utf8')); let v;
if(prompt.includes('Resolve the exact German Shampoo identity')) v=data.source;
else if(prompt.includes('Perform only the blind formula pass')) { const p=JSON.parse(prompt.split('\\nFORMULA\\n')[1].split('\\nSTANDARD\\n')[0]); v={blindId:p.blindId,inciFingerprintSha256:p.inciFingerprintSha256,formulaFacts:{surfactants:['SLES @2']},unresolvedMaterialIngredients:[],directProperties:data.blindProperties}; }
else if(out.includes('projected_judge')) v={defects:data.judgeDefects}; else v=data.final; fs.writeFileSync(out,JSON.stringify(v));`,
    { mode: 0o700 },
  )
  const log = join(root, "codex-calls.jsonl")
  const now = new Date().toISOString()
  let reserved = 0
  const calls: Array<{ name: string; body: Record<string, unknown> }> = []
  const artifacts: Record<string, unknown>[] = []
  const decisions: Record<string, unknown>[] = []
  const commits: Record<string, any>[] = []
  let payload: unknown = null
  let payloadRevision = 1
  const job: Record<string, unknown> = {
    id,
    submission_id: submissionId,
    status: "running",
    stage: "source_research",
    priority: 0,
    attempt_count: 1,
    max_attempts: 3,
    locked_by: "pending",
    locked_at: now,
    started_at: now,
    completed_at: null,
    next_run_at: now,
    last_error: null,
    progress: {},
    created_at: now,
    updated_at: now,
    review_cycle_id: cycleId,
    reserved_model_runs: 0,
    auto_rework_count: 0,
    cycle_deadline_at: null,
  }
  t.after(() => {
    const dir = join(repo, "tmp/product-intake-codex-worker")
    for (const name of readdirSync(dir))
      if (name.startsWith(`${id}.`)) rmSync(join(dir, name), { force: true })
  })
  const server = createServer(async (req, res) => {
    const u = new URL(req.url!, "http://x"),
      raw = await new Promise<Buffer>((r) => {
        const chunks: Buffer[] = []
        req.on("data", (c) => chunks.push(Buffer.from(c)))
        req.on("end", () => r(Buffer.concat(chunks)))
      }),
      body =
        raw.length && req.headers["content-type"]?.includes("application/json")
          ? JSON.parse(raw.toString("utf8"))
          : {}
    const reply = (v: unknown, status = 200) => {
      res.statusCode = status
      res.setHeader("content-type", "application/json")
      res.end(JSON.stringify(v))
    }
    const table = u.pathname.split("/").at(-1)!
    if (
      req.method === "POST" &&
      u.pathname.startsWith("/storage/v1/object/product-intake-review/")
    ) {
      const key = u.pathname.slice("/storage/v1/object/product-intake-review/".length)
      uploads.push({ key, bytes: raw })
      return reply({ Key: `product-intake-review/${key}` })
    }
    if (u.pathname.includes("/rpc/")) {
      calls.push({ name: table, body })
      if (table === "product_intake_claim_research_jobs") {
        job.locked_by = body.worker_id
        job.locked_at = new Date().toISOString()
        job.status = "running"
        return reply([job])
      }
      if (table === "product_intake_bind_research_job_engine") return reply(job)
      if (table === "product_intake_reserve_model_run") {
        reserved++
        job.reserved_model_runs = reserved
        job.cycle_deadline_at = new Date(Date.now() + 600000).toISOString()
        return reply(job)
      }
      if (table === "product_intake_update_research_job") {
        Object.assign(job, {
          status: body.next_status,
          stage: body.next_stage,
          progress: body.next_progress,
        })
        return reply(job)
      }
      if (table === "product_intake_renew_research_job_lease") return reply(job)
      if (table === "product_intake_commit_research_pass") {
        commits.push(body)
        payload = body.researched_payload
        payloadRevision++
        for (const artifact of body.research_artifacts)
          artifacts.push({
            ...artifact,
            id: randomUUID(),
            job_id: id,
            submission_id: submissionId,
            created_at: new Date().toISOString(),
          })
        Object.assign(job, {
          status: body.next_status,
          stage: body.next_stage,
          progress: body.next_progress,
          auto_rework_count: Number(job.auto_rework_count) + (body.request_auto_rework ? 1 : 0),
        })
        return reply(job)
      }
      return reply({ message: table }, 500)
    }
    if (req.method === "POST" && table === "product_intake_research_artifacts") {
      calls.push({ name: table, body })
      artifacts.push({ ...body, id: randomUUID(), created_at: new Date().toISOString() })
      return reply({ id: randomUUID(), ...body })
    }
    if (req.method === "GET" && table === "product_submissions")
      return reply([
        {
          id: submissionId,
          status: "researching",
          category: "shampoo",
          brand: "Xylozent",
          product_name: "Hydra",
          source: "admin",
          payload,
          payload_revision: payloadRevision,
          payload_sha256: "a".repeat(64),
          created_at: now,
          updated_at: now,
          intake_history: [],
        },
      ])
    if (req.method === "GET" && table === "product_intake_research_jobs") return reply([job])
    if (req.method === "GET" && table === "brands")
      return reply([{ id: randomUUID(), canonical_name: "Xylozent", normalized_name: "xylozent" }])
    if (req.method === "GET" && table === "product_intake_research_artifacts")
      return reply(artifacts)
    if (req.method === "GET" && table === "product_intake_review_decisions") return reply(decisions)
    if (
      req.method === "GET" &&
      ["brand_aliases", "product_lines", "product_intake_admin_notifications"].includes(table)
    )
      return reply([])
    return reply({ message: "unexpected" }, 500)
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  t.after(() => {
    server.closeAllConnections()
    return new Promise<void>((resolve) => server.close(() => resolve()))
  })
  const port = (server.address() as { port: number }).port
  const run = async (judgeDefects: unknown[] = [], autoRework = false) => {
    writeFileSync(
      outputs,
      JSON.stringify({ source, final, blindProperties: fixture.directProperties, judgeDefects }),
    )
    const result = await runWorkerProcess(
      process.execPath,
      [
        "--conditions=react-server",
        "--import",
        "tsx",
        "--import",
        join(repo, "tests/fixtures/shampoo-worker-image-preload.ts"),
        "scripts/product-intake/codex-research-worker.ts",
        "--execute-codex",
        "--json",
        "--concurrency=1",
      ],
      {
        cwd: repo,
        encoding: "utf8",
        timeout: 25_000,
        env: {
          ...process.env,
          NODE_ENV: "test",
          NEXT_PUBLIC_SENTRY_DSN: "",
          NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${port}`,
          SUPABASE_SERVICE_ROLE_KEY: "test",
          PRODUCT_INTAKE_CODEX_BIN: binary,
          SHAMPOO_FAKE_OUTPUTS: outputs,
          SHAMPOO_FAKE_LOG: log,
          SHAMPOO_FAKE_RAW_IMAGE: rawImage.toString("base64"),
          PRODUCT_INTAKE_CODEX_SHADOW_ENABLED: "false",
          PRODUCT_INTAKE_CODEX_RESEARCH_MODEL: "gpt-6-luna",
          PRODUCT_INTAKE_CODEX_RESEARCH_REASONING_EFFORT: "low",
          PRODUCT_INTAKE_CODEX_JUDGE_MODEL: "gpt-6-sol",
          PRODUCT_INTAKE_REVIEW_EMAILS: "false",
          PRODUCT_INTAKE_AUTO_PREPARE_IMAGES: "false",
          PRODUCT_INTAKE_AUTO_REWORK: String(autoRework),
          PRODUCT_INTAKE_COMMERCE_CHECK_ENABLED: "false",
        },
      },
    )
    assert.equal(result.status, 0, result.stderr)
    assert.ok(
      commits.length,
      JSON.stringify({ jobs: result.stdout, stderr: result.stderr, job, calls, artifacts }),
    )
    return commits.at(-1)!
  }
  return {
    run,
    commits,
    calls,
    artifacts,
    job,
    cycleId,
    submissionId,
    uploads,
    rawImage,
    rawHash,
    decisions,
    startNewCycle: () => {
      reserved = 0
      job.reserved_model_runs = 0
      job.auto_rework_count = 0
      job.review_cycle_id = randomUUID()
      job.stage = "rework"
    },
    launched: () =>
      readFileSync(log, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line))
        .map((v: { args: string[]; cwd: string; prompt64: string }) => ({
          ...v,
          prompt: Buffer.from(v.prompt64, "base64").toString(),
        })),
  }
}

test(
  "Shampoo CLI carries the isolated lane and Sol through four reservations and one atomic commit",
  { timeout: 30_000 },
  async (t) => {
    const f = await workerFixture(t)
    const committed = await f.run()
    assert.equal(f.job.reserved_model_runs, 4, JSON.stringify(committed.next_progress))
    assert.equal(committed.review_outcome, "ready_for_review")
    assert.equal(committed.expected_payload_revision, 1)
    assert.equal(committed.expected_review_cycle_id, f.cycleId)
    assert.equal(f.commits.length, 1)
    assert.deepEqual(f.uploads, [{ key: `${f.submissionId}/2/${f.rawHash}`, bytes: f.rawImage }])
    assert.deepEqual(committed.review_assets, [
      {
        kind: "raw",
        sha256: f.rawHash,
        storage_key: `${f.submissionId}/2/${f.rawHash}`,
        media_type: "image/png",
        byte_length: f.rawImage.length,
      },
    ])
    assert.equal(
      f.calls.some((c) => c.name === "product_intake_claim_admin_notification"),
      false,
    )
    const proof = committed.research_artifacts.find(
      (a: any) => a.kind === "formula" && a.payload.stage === "shampoo_research_stages_v1",
    )
    assert.ok(proof?.payload.proof)
    assert.equal(committed.researched_payload.final.review.manual_reviewed, false)
    const launched = f.launched()
    assert.equal(launched.length, 4)
    const blind = launched[1]
    assert.match(blind.prompt, /Perform only the blind formula pass/)
    assert.match(blind.args.join(" "), /web_search="disabled"/)
    for (const identity of ["Xylozent", "xylozent.invalid", f.submissionId, "4066447965414"])
      assert.ok(!blind.prompt.includes(identity), identity)
    assert.ok(blind.cwd.includes("lane-a"))
    assert.notEqual(blind.cwd, launched[2].cwd)
    assert.match(launched[2].args.join(" "), /web_search="disabled"/)
    const judge = f.artifacts.find(
      (a) => (a.payload as Record<string, unknown>)?.lane === "projected_judge",
    )!
    assert.equal((judge.payload as Record<string, unknown>).role, "judge")
    assert.equal(judge.model, "gpt-6-sol")
  },
)

test(
  "Shampoo CLI keeps D2 rows for Nick despite a clean Sol verdict",
  { timeout: 30_000 },
  async (t) => {
    const f = await workerFixture(t, "U2")
    const committed = await f.run([], true)
    assert.equal(f.job.reserved_model_runs, 4, JSON.stringify(committed.next_progress))
    assert.equal(committed.review_outcome, "needs_nick")
    assert.equal(committed.next_status, "blocked")
    assert.equal(committed.request_auto_rework, false)
    assert.equal(committed.researched_payload.final.category_specs.product_shampoo_specs.length, 2)
    assert.match(committed.notification_payload.question_1, /Auch als Tiefenreiniger anlegen/)
    assert.equal(
      f.calls.some((c) => c.name === "product_intake_claim_admin_notification"),
      false,
    )
  },
)

test(
  "a second Shampoo CLI pass reuses persisted blind evidence for repair plus Sol and ends at six runs",
  { timeout: 30_000 },
  async (t) => {
    const f = await workerFixture(t)
    const first = await f.run(
      [
        {
          code: "schema_or_adapter_invalid",
          field: "final.sources",
          reason: "Clarify the source rationale.",
        },
      ],
      true,
    )
    assert.equal(first.next_status, "waiting_for_rework")
    assert.equal(first.request_auto_rework, true)
    assert.equal(f.job.reserved_model_runs, 4)
    const firstProof = first.research_artifacts.find(
      (a: any) => a.kind === "formula" && a.payload.stage === "shampoo_research_stages_v1",
    ).payload.proof
    const second = await f.run([], true)
    assert.equal(second.expected_payload_revision, 2)
    assert.equal(second.review_outcome, "ready_for_review", JSON.stringify(second.next_progress))
    assert.equal(f.job.reserved_model_runs, 6)
    assert.equal(f.commits.length, 2)
    assert.equal(second.expected_review_cycle_id, first.expected_review_cycle_id)
    const repairedProof = second.research_artifacts.find(
      (a: any) => a.kind === "formula" && a.payload.stage === "shampoo_research_stages_v1",
    ).payload.proof
    assert.deepEqual(repairedProof.blind, firstProof.blind)
    assert.deepEqual(repairedProof.freeze, firstProof.freeze)
    assert.equal(repairedProof.repairs.length, 1)
    const launched = f.launched()
    assert.equal(launched.length, 6)
    assert.match(
      launched[4].prompt,
      /Correct the final intake package using the unchanged frozen blind assessment/,
    )
    assert.match(launched[4].args.join(" "), /web_search="disabled"/)
    assert.match(launched[5].args.join(" "), /gpt-6-sol/)
    assert.equal(
      f.calls.some((c) => c.name === "product_intake_claim_admin_notification"),
      false,
    )
  },
)

test(
  "Shampoo uses only the durable answer matching its formula and method, and retains other Sol blockers",
  { timeout: 30_000 },
  async (t) => {
    const f = await workerFixture(t, "U2")
    const first = await f.run([], false)
    const engine = first.research_artifacts.find((a: any) => a.kind === "property_synthesis")
      .payload.engine
    f.decisions.push({
      id: randomUUID(),
      submission_id: f.submissionId,
      job_id: f.job.id,
      field_path: "research.separate_deep_cleanser_listing",
      decision: "approved",
      reviewed_by: "nick",
      reviewed_at: new Date().toISOString(),
      review_source: "admin",
      review_action: "answer",
      request_id: randomUUID(),
      proposed_value: { engine },
      reviewer_value: { choice: "review_extra_separately" },
    })
    f.startNewCycle()
    const answered = await f.run([], false)
    assert.equal(
      answered.review_outcome,
      "ready_for_review",
      JSON.stringify(answered.next_progress),
    )
    assert.deepEqual(answered.next_progress.downstream_decisions, [])
    f.startNewCycle()
    const otherBlocker = await f.run(
      [{ code: "schema_or_adapter_invalid", field: "final.sources", reason: "Quelle fehlt." }],
      false,
    )
    assert.notEqual(otherBlocker.review_outcome, "ready_for_review")
    assert.doesNotMatch(
      JSON.stringify(otherBlocker.notification_payload),
      /Auch als Tiefenreiniger anlegen/,
    )
    f.decisions[0].proposed_value = { engine: { ...engine, input_hash: "f".repeat(64) } }
    f.startNewCycle()
    const changedFormula = await f.run([], false)
    assert.equal(changedFormula.review_outcome, "needs_nick")
    assert.match(
      JSON.stringify(changedFormula.notification_payload),
      /Auch als Tiefenreiniger anlegen/,
    )
  },
)
