import assert from "node:assert/strict"
import test from "node:test"

import {
  assertAllowedProductIntakeModel,
  buildBlindJudgePacket,
  captureOptionalTelemetryFailure,
  codexResearchExecArgs,
  codexResearchRuntimeConfig,
  finalizedImageOutputRoot,
  isModelGeneratedArtifactKind,
  modelEvaluationRuntimeConfig,
  normalizeModelJudgeVerdict,
  outputPathForModelLane,
  rembgContainerArgs,
  rembgRuntimeConfig,
  runNonFatalModelEvaluation,
  shouldRunShadowExperiment,
} from "../scripts/product-intake/codex-research-worker"

test("Codex product research defaults to the low-cost Luna standard lane", () => {
  assert.deepEqual(codexResearchRuntimeConfig({}), {
    model: "gpt-6-luna",
    reasoningEffort: "low",
    serviceTier: null,
  })
})

test("Codex product research permits an explicit stronger model override", () => {
  assert.deepEqual(
    codexResearchRuntimeConfig({
      PRODUCT_INTAKE_CODEX_RESEARCH_MODEL: "gpt-6-sol",
      PRODUCT_INTAKE_CODEX_RESEARCH_REASONING_EFFORT: "high",
      PRODUCT_INTAKE_CODEX_SERVICE_TIER: "fast",
    }),
    {
      model: "gpt-6-sol",
      reasoningEffort: "high",
      serviceTier: "fast",
    },
  )
})

test("blank worker model settings fall back instead of creating an invalid Codex command", () => {
  assert.deepEqual(
    codexResearchRuntimeConfig({
      PRODUCT_INTAKE_CODEX_RESEARCH_MODEL: "  ",
      PRODUCT_INTAKE_CODEX_RESEARCH_REASONING_EFFORT: " ",
      PRODUCT_INTAKE_CODEX_SERVICE_TIER: "",
    }),
    {
      model: "gpt-6-luna",
      reasoningEffort: "low",
      serviceTier: null,
    },
  )
})

test("Codex worker passes the selected research lane to the CLI", () => {
  const args = codexResearchExecArgs({
    cwd: "/tmp/research",
    outputPath: "/tmp/research/output.json",
    prompt: "research packet",
    runtimeConfig: {
      model: "gpt-6-luna",
      reasoningEffort: "low",
      serviceTier: null,
    },
  })

  assert.deepEqual(args.slice(0, 6), [
    "exec",
    "--skip-git-repo-check",
    "-m",
    "gpt-6-luna",
    "-c",
    'model_reasoning_effort="low"',
  ])
  assert.equal(
    args.some((arg) => arg.startsWith("service_tier=")),
    false,
  )
  assert.deepEqual(args.slice(-3), [
    "--output-last-message",
    "/tmp/research/output.json",
    "research packet",
  ])
  assert.equal(args.at(args.indexOf("--sandbox") + 1), "read-only")
  assert.equal(args.includes("--skip-git-repo-check"), true)
})

test("Codex worker only opts into Fast mode when explicitly configured", () => {
  const args = codexResearchExecArgs({
    cwd: "/tmp/research",
    outputPath: "/tmp/research/output.json",
    prompt: "research packet",
    runtimeConfig: {
      model: "gpt-6-luna",
      reasoningEffort: "low",
      serviceTier: "fast",
    },
  })

  assert.equal(args.includes('service_tier="fast"'), true)
})

test("judge lane can disable web search and stay on Standard processing", () => {
  const args = codexResearchExecArgs({
    cwd: "/tmp/research",
    outputPath: "/tmp/research/judge.json",
    prompt: "judge candidates",
    runtimeConfig: {
      model: "gpt-6-sol",
      reasoningEffort: "medium",
      serviceTier: null,
    },
    webSearch: "disabled",
  })

  assert.equal(args.includes('web_search="disabled"'), true)
  assert.equal(
    args.some((arg) => arg.startsWith("service_tier=")),
    false,
  )
})

test("model evaluation defaults to Luna medium as challenger and Sol medium as judge", () => {
  assert.deepEqual(modelEvaluationRuntimeConfig({}), {
    enabled: true,
    targetSuccessfulJudgments: 10,
    challenger: {
      model: "gpt-6-luna",
      reasoningEffort: "medium",
      serviceTier: null,
    },
    judge: {
      model: "gpt-6-sol",
      reasoningEffort: "medium",
      serviceTier: null,
    },
  })
})

test("Astra is hard-blocked on every configurable model lane", () => {
  assert.throws(
    () =>
      codexResearchRuntimeConfig({
        PRODUCT_INTAKE_CODEX_RESEARCH_MODEL: "gpt-6-astra",
      }),
    /Astra is disabled/,
  )
  assert.throws(
    () =>
      modelEvaluationRuntimeConfig({
        PRODUCT_INTAKE_CODEX_JUDGE_MODEL: "gpt-6-astra-2026-09-01",
      }),
    /Astra is disabled/,
  )
  assert.doesNotThrow(() => assertAllowedProductIntakeModel("gpt-6-sol", "judge"))
})

test("shadow experiment stops after the successful judgment target", () => {
  assert.equal(
    shouldRunShadowExperiment({ enabled: true, successfulJudgments: 9, target: 10 }),
    true,
  )
  assert.equal(
    shouldRunShadowExperiment({ enabled: true, successfulJudgments: 10, target: 10 }),
    false,
  )
  assert.equal(
    shouldRunShadowExperiment({ enabled: false, successfulJudgments: 0, target: 10 }),
    false,
  )
})

test("blind judge packet can swap candidates without losing the production mapping", () => {
  const production = { summary: "low" }
  const challenger = { summary: "medium" }
  const packet = buildBlindJudgePacket(production, challenger, true)

  assert.deepEqual(packet.candidates, {
    A: challenger,
    B: production,
  })
  assert.deepEqual(packet.laneByCandidate, {
    A: "challenger_medium",
    B: "production_low",
  })
})

test("judge verdict is strict and maps the anonymous preference back to a lane", () => {
  const verdict = normalizeModelJudgeVerdict(
    {
      preferred_candidate: "A",
      confidence: 0.8,
      scores: {
        A: { identity: 4, evidence: 5, completeness: 4, uncertainty: 5 },
        B: { identity: 4, evidence: 3, completeness: 3, uncertainty: 4 },
      },
      material_issues: ["Candidate B lacks a primary source."],
      rationale: "A is better sourced.",
    },
    { A: "challenger_medium", B: "production_low" },
  )

  assert.equal(verdict.preferredLane, "challenger_medium")
  assert.equal(verdict.confidence, 0.8)
  assert.throws(
    () =>
      normalizeModelJudgeVerdict(
        {
          preferred_candidate: "C",
          confidence: 2,
          scores: {},
          material_issues: [],
          rationale: "invalid",
        },
        { A: "production_low", B: "challenger_medium" },
      ),
    /preferred_candidate/,
  )
})

test("model lanes use separate output files", () => {
  const prompt = "/tmp/job.json"
  assert.equal(
    outputPathForModelLane(prompt, "production_low"),
    "/tmp/job.production_low.codex-output.json",
  )
  assert.equal(
    outputPathForModelLane(prompt, "challenger_medium"),
    "/tmp/job.challenger_medium.codex-output.json",
  )
  assert.equal(outputPathForModelLane(prompt, "judge"), "/tmp/job.judge.codex-output.json")
})

test("research models cannot forge worker-owned telemetry artifacts", () => {
  assert.equal(isModelGeneratedArtifactKind("identity_candidate"), true)
  assert.equal(isModelGeneratedArtifactKind("model_run"), false)
  assert.equal(isModelGeneratedArtifactKind("model_judgment"), false)
})

test("optional telemetry write failures are captured instead of failing production research", async () => {
  assert.equal(await captureOptionalTelemetryFailure(async () => undefined), null)
  assert.equal(
    await captureOptionalTelemetryFailure(async () => {
      throw new Error("transient artifact insert failure")
    }),
    "transient artifact insert failure",
  )
})

test("optional shadow evaluation failures preserve the production job", async () => {
  const job = { id: "production-job", lock: "initial" }
  const refreshedJob = { id: "production-job", lock: "refreshed" }
  let currentJob = job
  const persistedFailures: string[] = []

  const result = await runNonFatalModelEvaluation({
    job,
    currentJob: () => currentJob,
    targetSuccessfulJudgments: 10,
    run: async () => {
      currentJob = refreshedJob
      throw new Error("shadow lease refresh failed")
    },
    persistFailure: async (message) => {
      persistedFailures.push(message)
    },
  })

  assert.equal(result.job, refreshedJob)
  assert.deepEqual(result.result, {
    status: "telemetry_failed",
    successfulJudgments: 0,
    targetSuccessfulJudgments: 10,
  })
  assert.deepEqual(persistedFailures, ["shadow lease refresh failed"])
})

test("Hetzner background removal is explicit, pinned, isolated, and resource bounded", () => {
  const config = rembgRuntimeConfig({
    PRODUCT_INTAKE_REMBG_ENABLED: "true",
    PRODUCT_INTAKE_REMBG_MODEL_DIR: "/opt/chaarlie/product-intake/shared/rembg",
  })

  assert.equal(config.enabled, true)
  assert.equal(config.model, "isnet-general-use")
  assert.match(config.image, /^danielgatis\/rembg@sha256:[a-f0-9]{64}$/)
  assert.equal(config.modelDir, "/opt/chaarlie/product-intake/shared/rembg")

  const args = rembgContainerArgs({
    config,
    sourceFile: "/tmp/intake/source/product.jpg",
    outputFile: "/tmp/intake/cutout/product.png",
  })

  assert.deepEqual(args.slice(0, 8), [
    "run",
    "--rm",
    "--network=none",
    "--memory=2500m",
    "--memory-swap=3g",
    "--cpus=2",
    "--pids-limit=256",
    "--read-only",
  ])
  assert.equal(args.includes("--tmpfs=/tmp:rw,nosuid,nodev,size=256m"), true)
  assert.equal(args.includes("NUMBA_CACHE_DIR=/tmp/numba"), true)
  assert.equal(args.includes("XDG_CACHE_HOME=/tmp/cache"), true)
  assert.equal(args.includes("/tmp/intake/source:/input:ro"), true)
  assert.equal(args.includes("/tmp/intake/cutout:/output"), true)
  assert.equal(args.includes("/opt/chaarlie/product-intake/shared/rembg:/root/.rembg:ro"), true)
  assert.deepEqual(args.slice(-5), [
    "i",
    "-m",
    "isnet-general-use",
    "/input/product.jpg",
    "/output/product.png",
  ])
})

test("background removal stays disabled unless the deployment opts in", () => {
  assert.equal(rembgRuntimeConfig({}).enabled, false)
  assert.equal(rembgRuntimeConfig({ PRODUCT_INTAKE_REMBG_ENABLED: "false" }).enabled, false)
})

test("worker and review route can share one persistent finalized-image root", () => {
  assert.equal(
    finalizedImageOutputRoot(
      {
        PRODUCT_INTAKE_FINALIZED_IMAGE_DIR: "/opt/chaarlie/product-intake/shared/finalized-images",
      },
      "/opt/chaarlie/product-intake/current",
    ),
    "/opt/chaarlie/product-intake/shared/finalized-images",
  )
  assert.equal(
    finalizedImageOutputRoot({}, "/opt/chaarlie/product-intake/current"),
    "/opt/chaarlie/product-intake/current/apps/product-intake-review/public/product-intake-finalized",
  )
})
