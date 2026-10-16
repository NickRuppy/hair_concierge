import assert from "node:assert/strict"
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import {
  runRembgContainer,
  rembgRuntimeConfig,
  cleanupStaleRembgContainers,
} from "../src/lib/product-intake/pipeline/image-background"
import { ResearchModelReservationError } from "@chaarlie/product-intake-core"
import { runWorkerProcess } from "../src/lib/product-intake/pipeline/process"
import {
  WorkerJobLease,
  startWorkerHeartbeat,
} from "../scripts/product-intake/codex-research-worker"

async function waitForFile(path: string) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (existsSync(path)) return
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  assert.fail(`child did not create ${path}`)
}

test("an already cancelled image subprocess never spawns", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "intake-cancel-"))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const marker = join(dir, "launched")
  const result = await runWorkerProcess(
    process.execPath,
    ["-e", `require('node:fs').writeFileSync(${JSON.stringify(marker)}, '')`],
    {
      encoding: "utf8",
      signal: AbortSignal.abort(),
      timeout: 1000,
    },
  )
  assert.equal(result.pid, 0)
  assert.equal((result.error as NodeJS.ErrnoException).code, "ABORT_ERR")
  assert.equal(existsSync(marker), false)
})

test("heartbeat continues while an image waits, and lease loss cancels before work can start", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "intake-lease-wait-"))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const ready = join(dir, "waiting"),
    release = join(dir, "release"),
    launched = join(dir, "launched")
  let lost = false,
    renewals = 0,
    heartbeats = 0
  const client = {
    rpc: async (name: string) => {
      if (name.includes("renew")) {
        renewals++
        return { data: lost ? null : "2026-10-16T10:00:00Z", error: null }
      }
      heartbeats++
      return { data: null, error: null }
    },
  }
  const job = { id: "job-image", locked_by: "worker", locked_at: "2026-10-16T09:59:00Z" }
  const lease = new WorkerJobLease(job, client)
  const heartbeat = startWorkerHeartbeat({
    client,
    workerId: "worker",
    host: "fixture",
    pid: 1,
    leases: new Map([[job.id, lease]]),
    currentJobId: () => job.id,
  })
  t.after(() => heartbeat.stop())
  await heartbeat.tick()
  const lock = join(dir, "heavy.lock"),
    locked = join(dir, "locked")
  const holderAbort = new AbortController()
  const holder = runWorkerProcess(
    "python3",
    [
      "-c",
      `
import fcntl, pathlib, sys, time
with open(sys.argv[1], "a") as lock:
    fcntl.flock(lock, fcntl.LOCK_EX)
    pathlib.Path(sys.argv[2]).touch()
    while not pathlib.Path(sys.argv[3]).exists(): time.sleep(0.01)
`,
      lock,
      locked,
      release,
    ],
    { encoding: "utf8", signal: holderAbort.signal, timeout: 6000 },
  )
  t.after(async () => {
    holderAbort.abort()
    await holder
  })
  await waitForFile(locked)
  const child = runWorkerProcess(
    "python3",
    [
      "-c",
      `
import fcntl, pathlib, sys
with open(sys.argv[1], "a") as lock:
    pathlib.Path(sys.argv[2]).touch()
    fcntl.flock(lock, fcntl.LOCK_EX)
    pathlib.Path(sys.argv[3]).touch()
`,
      lock,
      ready,
      launched,
    ],
    { encoding: "utf8", signal: lease.signal, timeout: 3000 },
  )
  await waitForFile(ready)
  await heartbeat.tick()
  assert.ok(renewals >= 2 && heartbeats >= 2)
  lost = true
  await heartbeat.tick()
  await new Promise((resolve) => setTimeout(resolve, 40))
  writeFileSync(release, "")
  const result = await child
  assert.equal((await holder).status, 0)
  assert.equal(existsSync(launched), false, "lost lease must not start the waiting stage")
  assert.equal((result.error as NodeJS.ErrnoException).code, "ABORT_ERR")
  await assert.rejects(
    lease.write(async () => "forbidden"),
    /lease lost/,
  )
})

test("Linux image execution uses only the shared supervisor and keeps cleanup failures technical", async (t) => {
  const platform = Object.getOwnPropertyDescriptor(process, "platform")!
  Object.defineProperty(process, "platform", { value: "linux", configurable: true })
  t.after(() => Object.defineProperty(process, "platform", platform))
  const dir = mkdtempSync(join(tmpdir(), "intake-linux-stage-"))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const params = {
    sourceFile: join(dir, "source.png"),
    outputFile: join(dir, "out.png"),
    config: rembgRuntimeConfig({
      PRODUCT_INTAKE_REMBG_ENABLED: "true",
      PRODUCT_INTAKE_REMBG_MODEL_DIR: join(dir, "models"),
    }),
    execution: { signal: new AbortController().signal, deadlineMs: Date.now() + 60_000 },
  }
  for (const failure of [
    "HEAVY_STAGE_UNCONFIRMED",
    "HEAVY_STAGE_CANCELLED",
    "HEAVY_STAGE_DEADLINE",
    "permission denied",
  ]) {
    let calls = 0
    await assert.rejects(
      runRembgContainer(params, (command, args, options) => {
        calls++
        assert.equal(command, "python3")
        assert.equal(args[0], "deploy/product-intake/heavy-stage.py")
        assert.equal(args[args.indexOf("--deadline-ms") + 1], String(params.execution.deadlineMs))
        assert.equal(args[args.indexOf("--run-timeout-ms") + 1], "180000")
        assert.equal(options.signal, params.execution.signal)
        assert.equal(options.terminationGraceMs, 30000)
        return { pid: 1, output: [], stdout: "", stderr: failure, status: 1, signal: null }
      }),
      (error: unknown) =>
        failure === "HEAVY_STAGE_DEADLINE"
          ? error instanceof ResearchModelReservationError && error.code === "cycle_deadline"
          : error instanceof Error && /^HEAVY_STAGE_/.test(error.message),
    )
    assert.equal(calls, 1)
  }
  await cleanupStaleRembgContainers(() => {
    assert.fail("unowned Linux cleanup must never run")
  })
  let launched = false
  await assert.rejects(
    runRembgContainer(
      { ...params, execution: { ...params.execution, deadlineMs: Date.now() - 1 } },
      () => {
        launched = true
        assert.fail("expired image launched")
      },
    ),
    /cycle_deadline/,
  )
  assert.equal(launched, false)
})

test("an owned helper gets its requested cleanup grace after cancellation", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "intake-helper-grace-"))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const ready = join(dir, "ready"),
    cleaned = join(dir, "cleaned")
  const abort = new AbortController()
  const child = runWorkerProcess(
    process.execPath,
    [
      "-e",
      `
    const fs = require('node:fs');
    process.on('SIGTERM', () => setTimeout(() => {
      fs.writeFileSync(${JSON.stringify(cleaned)}, ''); process.exit(0);
    }, 1200));
    fs.writeFileSync(${JSON.stringify(ready)}, '');
    setInterval(() => {}, 1000);
  `,
    ],
    { encoding: "utf8", signal: abort.signal, terminationGraceMs: 2000, timeout: 5000 },
  )
  await waitForFile(ready)
  abort.abort()
  const result = await child
  assert.equal((result.error as NodeJS.ErrnoException).code, "ABORT_ERR")
  assert.equal(existsSync(cleaned), true, "forced kill interrupted the helper's cleanup grace")
})
