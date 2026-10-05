import assert from "node:assert/strict"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import * as worker from "../scripts/product-intake/codex-research-worker"

function leaseJob(id = "job-a") {
  return { id, locked_by: "worker-a", locked_at: "2026-10-05T08:00:00Z" }
}

test("heartbeat records idle liveness and renews all claimed jobs while a child runs", async (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] })
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args })
      return { data: name.includes("renew") ? "2026-10-05T08:01:00Z" : null, error: null }
    },
  }
  const job = leaseJob()
  const waiting = leaseJob("job-b")
  const leases = new Map<string, worker.WorkerJobLease>()
  const loop = worker.startWorkerHeartbeat({
    client,
    workerId: "worker-a",
    host: "host-a",
    pid: 123,
    releaseSha: "release-a",
    intervalMs: 60_000,
    leases,
    currentJobId: () => (leases.size ? job.id : null),
  })
  t.after(() => loop.stop())
  await loop.tick()
  assert.equal(calls[0]!.args.current_job_id, null)
  assert.equal(calls[0]!.args.release_sha, "release-a")
  leases.set(job.id, new worker.WorkerJobLease(job, client))
  leases.set(waiting.id, new worker.WorkerJobLease(waiting, client))
  const child = worker.runWorkerProcess(process.execPath, ["-e", "setTimeout(() => {}, 100)"], {
    encoding: "utf8",
  })
  t.mock.timers.tick(60_000)
  await loop.tick()
  assert.equal(job.locked_at, "2026-10-05T08:01:00Z")
  assert.equal(waiting.locked_at, "2026-10-05T08:01:00Z")
  assert.equal(calls.filter((call) => call.name.includes("renew")).length, 2)
  assert.equal(calls.findLast((call) => call.name.includes("record"))!.args.current_job_id, job.id)
  assert.equal((await child).status, 0)
  loop.stop()
  const count = calls.length
  t.mock.timers.tick(60_000)
  await loop.tick()
  assert.equal(calls.length, count)
})

test("renewal and writes serialize, with the latest in-memory lease used by the write", async () => {
  const job = leaseJob()
  let finish!: (value: { data: string; error: null }) => void
  const client = {
    rpc: () =>
      new Promise<{ data: string; error: null }>((resolve) => {
        finish = resolve
      }),
  }
  const lease = new worker.WorkerJobLease(job, client)
  const renewing = lease.renew()
  await Promise.resolve()
  let written: string | null = null
  const writing = lease.write(async () => {
    written = job.locked_at
  })
  await Promise.resolve()
  assert.equal(written, null)
  finish({ data: "2026-10-05T08:02:00Z", error: null })
  await Promise.all([renewing, writing])
  assert.equal(written, "2026-10-05T08:02:00Z")
})

test("heartbeat lease loss sets abort and prevents a queued job write", async (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] })
  const job = leaseJob()
  let finish!: (value: { data: null; error: null }) => void
  const client = {
    rpc: async (name: string) =>
      name.includes("renew")
        ? new Promise<{ data: null; error: null }>((resolve) => {
            finish = resolve
          })
        : { data: null, error: null },
  }
  const lease = new worker.WorkerJobLease(job, client)
  const statuses: string[] = []
  const loop = worker.startWorkerHeartbeat({
    client,
    workerId: "worker-a",
    host: "host",
    pid: 1,
    leases: new Map([[job.id, lease]]),
    currentJobId: () => job.id,
    checkIn: (status) => {
      statuses.push(status)
    },
  })
  t.after(() => loop.stop())
  await Promise.resolve()
  const writing = assert.rejects(
    lease.write(async () => assert.fail("lost owner wrote")),
    /lease lost/i,
  )
  finish({ data: null, error: null })
  await loop.tick()
  await writing
  assert.equal(lease.aborted, true)
  assert.deepEqual(statuses, ["error"])
  assert.equal(job.locked_at, "2026-10-05T08:00:00Z")
})

test("heartbeat failures do not crash the worker or suppress lease renewal and Sentry", async (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] })
  const job = leaseJob()
  let failRenewal = true
  const client = {
    rpc: async (name: string) => {
      if (name.includes("record")) throw new Error("heartbeat offline")
      return failRenewal
        ? { data: null, error: new Error("renew offline") }
        : { data: "new-lease", error: null }
    },
  }
  const lease = new worker.WorkerJobLease(job, client)
  const warnings: unknown[] = []
  let checkIns = 0
  const loop = worker.startWorkerHeartbeat({
    client,
    workerId: "worker-a",
    host: "host",
    pid: 1,
    intervalMs: 60_000,
    leases: new Map([[job.id, lease]]),
    currentJobId: () => job.id,
    onError: (error) => warnings.push(error),
    checkIn: () => {
      checkIns++
      throw new Error("Sentry offline")
    },
  })
  t.after(() => loop.stop())
  await loop.tick()
  assert.equal(lease.aborted, false, "a transport error does not prove lease loss")
  failRenewal = false
  t.mock.timers.tick(60_000)
  await loop.tick()
  assert.equal(job.locked_at, "new-lease")
  assert.ok(warnings.length >= 3)
  assert.equal(checkIns, 2)
})

test("async child closes stdin and enforces the output cap", async () => {
  const result = await worker.runWorkerProcess(
    process.execPath,
    ["-e", "process.stdin.on('end', () => console.log('eof')); process.stdin.resume()"],
    { encoding: "utf8", timeout: 2_000 },
  )
  assert.equal(result.status, 0)
  assert.equal(result.stdout.trim(), "eof")
  for (const stream of ["stdout", "stderr"] as const) {
    const capped = await worker.runWorkerProcess(
      process.execPath,
      ["-e", `process.${stream}.write('x'.repeat(10000)); setTimeout(() => {}, 1000)`],
      { encoding: "utf8", maxBuffer: 100, timeout: 2_000 },
    )
    assert.equal((capped.error as NodeJS.ErrnoException).code, "ENOBUFS")
    assert.ok(Buffer.byteLength(capped[stream]) <= 100)
  }
})

test("an async child timeout remains codex_timeout", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "intake-heartbeat-"))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const outputPath = join(dir, "answer.json")
  writeFileSync(outputPath, '{"summary":"unused"}')
  await assert.rejects(
    async () =>
      worker.runCodexJson(
        { outputPath, prompt: "packet", runtimeConfig: worker.codexResearchRuntimeConfig({}) },
        (_command, _args, options) =>
          worker.runWorkerProcess(process.execPath, ["-e", "setTimeout(() => {}, 10000)"], {
            ...options,
            timeout: 30,
          }),
      ),
    (error: unknown) => {
      assert.equal((error as Error & { code: string }).code, "codex_timeout")
      return true
    },
  )
})
