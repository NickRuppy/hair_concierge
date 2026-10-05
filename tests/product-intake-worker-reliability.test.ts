import assert from "node:assert/strict"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import type { SpawnSyncReturns } from "node:child_process"

import * as worker from "../scripts/product-intake/codex-research-worker"

const job = {
  id: "job-1",
  stage: "source_research" as const,
  locked_by: "worker-1",
  locked_at: "2026-10-05T08:00:00Z",
  attempt_count: 1,
  max_attempts: 3,
}

function result(overrides: Partial<SpawnSyncReturns<string>> = {}): SpawnSyncReturns<string> {
  return { pid: 123, output: [], stdout: "", stderr: "", status: 0, signal: null, ...overrides }
}

function codexFixture(t: { after: (fn: () => void) => void }, raw: string) {
  const dir = mkdtempSync(join(tmpdir(), "intake-reliability-"))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const outputPath = join(dir, "last-message.json")
  writeFileSync(outputPath, raw)
  return {
    outputPath,
    prompt: "research packet",
    runtimeConfig: worker.codexResearchRuntimeConfig({}),
  }
}

const answer = {
  summary: "Research ready",
  nested: { note: 'braces { } and escaped " quote \\ end' },
}
const json = JSON.stringify(answer)

for (const [label, raw] of [
  ["trailing explanation", `${json}\nResearch complete. {not JSON}`],
  ["second JSON object", `${json}\n{"summary":"unrelated extra answer"}`],
  ["markdown fence", `\`\`\`json\n${json}\n\`\`\`\n{"summary":"trailing object"}`],
] as const) {
  test(`Codex reads one complete object from the last-message file with ${label}`, async (t) => {
    const params = codexFixture(t, raw)
    assert.deepEqual(
      await worker.runCodexJson(params, () => result({ stdout: '{"summary":"CLI noise"}' })),
      answer,
    )
  })
}

test("Codex closes stdin and keeps reading the last-message file rather than CLI logs", async (t) => {
  const params = codexFixture(t, json)
  const output = await worker.runCodexJson(params, (_command, args, options) => {
    assert.equal(options.stdio?.[0], "ignore")
    assert.equal(args[args.indexOf("--output-last-message") + 1], params.outputPath)
    return result({ stdout: "Reading additional input from stdin..." })
  })
  assert.deepEqual(output, answer)
})

for (const raw of [
  "No object was returned.",
  '[{"summary":"array element"}]',
  '{"outer":{"valid":true}',
]) {
  test(`Codex rejects output without a complete top-level object: ${raw}`, async (t) => {
    const params = codexFixture(t, raw)
    await assert.rejects(
      async () => worker.runCodexJson(params, () => result()),
      /no complete top-level JSON object/i,
    )
  })
}

test("Codex ETIMEDOUT is classified and retried within the job attempt budget", async (t) => {
  const params = codexFixture(t, json)
  const timeout = Object.assign(new Error("spawnSync codex ETIMEDOUT"), { code: "ETIMEDOUT" })
  await assert.rejects(
    async () =>
      await worker.runCodexJson(params, () =>
        result({ error: timeout, status: null, signal: "SIGTERM" }),
      ),
    (error: unknown) => {
      assert.ok(error instanceof Error)
      assert.equal((error as Error & { code: string }).code, "codex_timeout")
      assert.match(error.message, /^codex_timeout:/)
      return true
    },
  )
  const update = worker.researchFailureUpdate({
    job,
    error: new Error("codex_timeout: spawnSync codex ETIMEDOUT"),
    promptPacketPath: params.outputPath,
    workerId: "worker-1",
    executeCodex: true,
  })
  assert.equal(update.status, "queued")
  assert.equal(update.progress.retryable, true)
  assert.equal(update.progress.error_code, "codex_timeout")
  assert.equal(
    worker.researchFailureUpdate({
      job: { ...job, attempt_count: 3 },
      error: new Error("codex_timeout: timeout"),
      promptPacketPath: params.outputPath,
      workerId: "worker-1",
      executeCodex: true,
    }).status,
    "blocked",
  )
})

for (const [stream, message] of [
  ["stderr", "Not logged in. Please run codex login."],
  ["stdout", "Login required to continue."],
  ["stderr", "unexpected status 401 Unauthorized"],
  ["stdout", "Token expired. Please authenticate again."],
] as const) {
  test(`Codex classifies auth failure from ${stream}: ${message}`, async (t) => {
    const params = codexFixture(t, json)
    await assert.rejects(
      async () => worker.runCodexJson(params, () => result({ status: 1, [stream]: message })),
      (error: unknown) => {
        assert.ok(error instanceof Error)
        assert.equal((error as Error & { code: string }).code, "infra_auth")
        assert.match(error.message, /^infra_auth:/)
        return true
      },
    )
  })
}

test("successful Codex output mentioning an auth error as research content is not classified as auth failure", async (t) => {
  const params = codexFixture(t, json)
  assert.deepEqual(
    await worker.runCodexJson(params, () =>
      result({
        stderr: "Example page: 401 unauthorized; token expired or nearly expired, refreshing.",
      }),
    ),
    answer,
  )
})

for (const code of ["codex_timeout", "infra_auth"]) {
  test(`model-run measurement preserves ${code} as a thrown infrastructure failure`, async () => {
    const failure = new Error(`${code}: infrastructure failed`)
    await assert.rejects(
      async () =>
        worker.measureModelRun("production_low", worker.codexResearchRuntimeConfig({}), () => {
          throw failure
        }),
      (error: unknown) => error === failure,
    )
  })
}

test("optional model evaluation must propagate infra_auth instead of swallowing it", async () => {
  await assert.rejects(
    worker.runNonFatalModelEvaluation({
      job,
      targetSuccessfulJudgments: 10,
      run: async () => {
        throw new Error("infra_auth: Not logged in")
      },
      persistFailure: async () => {
        assert.fail("auth failure must escape optional telemetry")
      },
    }),
    /^Error: infra_auth:/,
  )
})

test("research failure persists auth code and keeps ordinary failures terminal", () => {
  const params = {
    job,
    promptPacketPath: "/tmp/prompt.json",
    workerId: "worker-1",
    executeCodex: true,
  }
  const auth = worker.researchFailureUpdate({
    ...params,
    error: new Error("infra_auth: Not logged in"),
  })
  assert.equal(auth.status, "blocked")
  assert.match(auth.lastError, /^infra_auth:/)
  assert.equal(auth.progress.error_code, "infra_auth")
  assert.equal(
    worker.researchFailureUpdate({ ...params, error: new Error("Invalid research payload") })
      .status,
    "failed",
  )
})

test("rembg run gets a deterministic Docker-safe unique name", () => {
  const params = {
    config: worker.rembgRuntimeConfig({}),
    sourceFile: "/tmp/job a/source.jpg",
    outputFile: "/tmp/job a/cutout.png",
  }
  const args = worker.rembgContainerArgs(params)
  assert.ok(args.includes("--name"))
  const name = args[args.indexOf("--name") + 1]
  assert.match(name, /^chaarlie-rembg-[a-zA-Z0-9_.-]+$/)
  assert.equal(worker.rembgContainerArgs(params)[args.indexOf("--name") + 1], name)
  const other = worker.rembgContainerArgs({ ...params, outputFile: "/tmp/job b/cutout.png" })
  assert.notEqual(other[other.indexOf("--name") + 1], name)
})

for (const failure of [
  result({
    error: Object.assign(new Error("docker ETIMEDOUT"), { code: "ETIMEDOUT" }),
    status: null,
  }),
  result({ status: 1, stderr: "container failed" }),
]) {
  test(`rembg cleans up its named container after ${failure.error ? "timeout" : "nonzero exit"}`, async (t) => {
    const params = codexFixture(t, json)
    const calls: string[][] = []
    const output = await worker.runRembgContainer(
      {
        config: worker.rembgRuntimeConfig({
          PRODUCT_INTAKE_REMBG_ENABLED: "true",
          PRODUCT_INTAKE_REMBG_MODEL_DIR: join(params.outputPath, "..", "models"),
        }),
        sourceFile: join(params.outputPath, "..", "source.jpg"),
        outputFile: join(params.outputPath, "..", "cutout.png"),
      },
      (_command, args) => {
        calls.push(args)
        if (args[0] === "rm") throw new Error("Docker unavailable during cleanup")
        return failure
      },
    )
    assert.equal(output, null)
    const runArgs = calls[0]
    assert.deepEqual(calls[1], ["rm", "-f", runArgs[runArgs.indexOf("--name") + 1]])
  })
}

test("rembg startup cleanup removes only prefixed container names, and continues after cleanup errors", async () => {
  const calls: Array<{ command: string; args: string[] }> = []
  await worker.cleanupStaleRembgContainers((command, args) => {
    calls.push({ command, args })
    if (args[0] === "ps")
      return result({
        stdout:
          "chaarlie-rembg-job-1\nunrelated\nchaarlie-rembg-job-2\nother-chaarlie-rembg-job-3\n",
      })
    if (args.at(-1) === "chaarlie-rembg-job-1") throw new Error("cleanup failed")
    return result()
  }, "custom-docker")
  assert.deepEqual(calls, [
    {
      command: "custom-docker",
      args: ["ps", "-a", "--filter", "name=chaarlie-rembg-", "--format", "{{.Names}}"],
    },
    { command: "custom-docker", args: ["rm", "-f", "chaarlie-rembg-job-1"] },
    { command: "custom-docker", args: ["rm", "-f", "chaarlie-rembg-job-2"] },
  ])
  await assert.doesNotReject(async () =>
    worker.cleanupStaleRembgContainers(() => {
      throw new Error("Docker missing")
    }),
  )
})
