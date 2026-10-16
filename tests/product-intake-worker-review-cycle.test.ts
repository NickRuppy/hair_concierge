import assert from "node:assert/strict"
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { createServer } from "node:http"
import { fileURLToPath } from "node:url"
import { randomUUID } from "node:crypto"
import {
  runCodexJson,
  runWorkerProcess,
  type WorkerSpawn,
} from "../scripts/product-intake/codex-research-worker"
import { withResearchModelCycle } from "../src/lib/product-intake/pipeline/review-cycle"

function runFixture(t: { after: (fn: () => void) => void }) {
  const root = mkdtempSync(join(tmpdir(), "intake-cycle-launch-"))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const outputPath = join(root, "output.json")
  const params = {
    outputPath,
    prompt: "Return an empty JSON object. Do not write anything else.",
    runtimeConfig: { model: "gpt-6-luna", reasoningEffort: "low", serviceTier: null },
  }
  return { outputPath, params }
}

function successfulChild(outputPath: string): ReturnType<WorkerSpawn> {
  writeFileSync(outputPath, "{}")
  return { pid: 1, output: [], stdout: "", stderr: "", status: 0, signal: null }
}

test("a refused durable reservation prevents the common Codex launcher from spawning", async (t) => {
  const f = runFixture(t)
  let children = 0
  await assert.rejects(
    withResearchModelCycle(
      async () => {
        throw new Error("model_run_limit")
      },
      () =>
        runCodexJson(f.params, () => {
          children++
          return successfulChild(f.outputPath)
        }),
    ),
    /model_run_limit/,
  )
  assert.equal(children, 0)
})

test("every launch reserves once and uses the cycle deadline as its child timeout", async (t) => {
  const f = runFixture(t)
  let reservations = 0
  const value = await withResearchModelCycle(
    async () => {
      reservations++
      return Date.now() + 5_000
    },
    () =>
      runCodexJson(f.params, (_command, _args, options) => {
        assert.ok(options.timeout! > 4_000 && options.timeout! <= 5_000)
        return successfulChild(f.outputPath)
      }),
  )
  assert.deepEqual(value, {})
  assert.equal(reservations, 1)
})

test("concurrent job contexts cannot borrow another product's reservation or deadline", async (t) => {
  const a = runFixture(t),
    b = runFixture(t)
  const calls: string[] = []
  await Promise.all([
    withResearchModelCycle(
      async () => {
        await Promise.resolve()
        calls.push("a")
        return Date.now() + 5_000
      },
      () =>
        runCodexJson(a.params, (_command, _args, options) => {
          assert.ok(options.timeout! > 4_000 && options.timeout! <= 5_000)
          return successfulChild(a.outputPath)
        }),
    ),
    withResearchModelCycle(
      async () => {
        await Promise.resolve()
        calls.push("b")
        return Date.now() + 9_000
      },
      () =>
        runCodexJson(b.params, (_command, _args, options) => {
          assert.ok(options.timeout! > 8_000 && options.timeout! <= 9_000)
          return successfulChild(b.outputPath)
        }),
    ),
  ])
  assert.deepEqual(calls.sort(), ["a", "b"])
})

test("a deadline elapsed between reservation and launch prevents any child process", async (t) => {
  const f = runFixture(t)
  let children = 0
  await assert.rejects(
    withResearchModelCycle(
      async () => Date.now() - 1,
      () =>
        runCodexJson(f.params, () => {
          children++
          return successfulChild(f.outputPath)
        }),
    ),
    /cycle_deadline/,
  )
  assert.equal(children, 0)
})

test(
  "the actual worker CLI fences an exhausted cycle before spawning and records a human outcome",
  { timeout: 20_000 },
  async (t) => {
    const root = mkdtempSync(join(tmpdir(), "intake-worker-cli-cycle-"))
    t.after(() => rmSync(root, { recursive: true, force: true }))
    const repo = fileURLToPath(new URL("../", import.meta.url))
    const id = randomUUID(),
      submissionId = randomUUID(),
      cycleId = randomUUID()
    t.after(() =>
      rmSync(join(repo, "tmp", "product-intake-codex-worker", id + ".json"), { force: true }),
    )
    const marker = join(root, "spawned")
    const binary = join(root, "codex")
    writeFileSync(
      binary,
      "#!/usr/bin/env node\nrequire('node:fs').writeFileSync(" +
        JSON.stringify(marker) +
        ", 'unexpected model launch')\n",
      { mode: 0o700 },
    )
    const now = new Date().toISOString()
    const job = {
      id,
      submission_id: submissionId,
      status: "running",
      stage: "source_research",
      priority: 0,
      attempt_count: 1,
      max_attempts: 3,
      locked_by: "pending-claim",
      locked_at: now,
      started_at: now,
      completed_at: null,
      next_run_at: now,
      last_error: null,
      progress: {},
      created_at: now,
      updated_at: now,
      review_cycle_id: cycleId,
      reserved_model_runs: 6,
      auto_rework_count: 0,
      cycle_deadline_at: new Date(Date.now() + 60_000).toISOString(),
    }
    const calls: Array<{ name: string; body: Record<string, unknown> }> = []
    const unexpected: string[] = []
    const server = createServer(async (request, response) => {
      const url = new URL(request.url!, "http://localhost")
      let body = ""
      for await (const chunk of request) body += chunk.toString()
      const value = body ? (JSON.parse(body) as Record<string, unknown>) : {}
      response.setHeader("content-type", "application/json")
      const reply = (data: unknown, status = 200) => {
        response.statusCode = status
        response.end(JSON.stringify(data))
      }
      if (url.pathname.startsWith("/rest/v1/rpc/")) {
        const name = url.pathname.split("/").at(-1)!
        calls.push({ name, body: value })
        if (name === "product_intake_claim_research_jobs") {
          job.locked_by = String(value.worker_id)
          reply([job])
          return
        }
        if (name === "product_intake_bind_research_job_engine") {
          reply(job)
          return
        }
        if (name === "product_intake_reserve_model_run") {
          reply({ code: "23514", details: "model_run_limit", message: "cycle cap" }, 400)
          return
        }
        if (name === "product_intake_commit_research_pass") {
          reply({ ...job, status: value.next_status, stage: value.next_stage })
          return
        }
      } else if (request.method === "GET") {
        const table = url.pathname.split("/").at(-1)
        if (table === "product_submissions") {
          reply([
            {
              id: submissionId,
              status: "researching",
              category: "shampoo",
              brand: "Chaarlie",
              product_name: "Synthetic Shampoo",
              source: "admin",
              payload: null,
              created_at: now,
              updated_at: now,
              scanned_identifier_type: null,
              scanned_identifier_value: null,
              intake_history: [],
            },
          ])
          return
        }
        if (table === "product_intake_research_jobs") {
          reply([job])
          return
        }
        if (table === "brands") {
          reply([{ id: randomUUID(), canonical_name: "Chaarlie", normalized_name: "chaarlie" }])
          return
        }
        if (
          [
            "product_intake_research_artifacts",
            "product_intake_review_decisions",
            "product_lines",
            "brand_aliases",
          ].includes(table!)
        ) {
          reply([])
          return
        }
      }
      unexpected.push(request.method + " " + url.pathname)
      reply({ message: "Unexpected offline fixture endpoint" }, 500)
    })
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    t.after(() => {
      server.closeAllConnections()
      server.close()
    })
    const address = server.address() as { port: number }
    const result = await runWorkerProcess(
      process.execPath,
      [
        "--conditions=react-server",
        "--import",
        "tsx",
        "scripts/product-intake/codex-research-worker.ts",
        "--execute-codex",
        "--json",
        "--concurrency=1",
      ],
      {
        cwd: repo,
        encoding: "utf8",
        timeout: 15_000,
        env: {
          ...process.env,
          NODE_ENV: "test",
          NEXT_PUBLIC_SENTRY_DSN: "",
          NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${address.port}`,
          SUPABASE_SERVICE_ROLE_KEY: "offline-service-key",
          PRODUCT_INTAKE_CODEX_BIN: binary,
          PRODUCT_INTAKE_CODEX_SHADOW_ENABLED: "false",
          PRODUCT_INTAKE_REVIEW_EMAILS: "false",
          PRODUCT_INTAKE_AUTO_PREPARE_IMAGES: "false",
          PRODUCT_INTAKE_AUTO_REWORK: "false",
        },
      },
    )
    assert.deepEqual(unexpected, [])
    assert.equal(result.status, 0, result.stderr)
    assert.equal(existsSync(marker), false, "exhausted actual worker must not launch Codex")
    const reservation = calls.filter((c) => c.name === "product_intake_reserve_model_run")
    assert.equal(reservation.length, 1)
    assert.equal(reservation[0]!.body.expected_review_cycle_id, cycleId)
    const commits = calls.filter((c) => c.name === "product_intake_commit_research_pass")
    assert.equal(commits.length, 1)
    assert.equal(commits[0]!.body.next_status, "blocked")
    assert.equal(commits[0]!.body.review_outcome, "needs_nick")
    assert.equal(commits[0]!.body.expected_review_cycle_id, cycleId)
    assert.equal(
      calls.some((c) => c.name === "product_intake_claim_admin_notification"),
      false,
    )
  },
)
