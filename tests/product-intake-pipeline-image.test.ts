import assert from "node:assert/strict"
import test from "node:test"

import * as worker from "../scripts/product-intake/codex-research-worker"

test("shared image stage keeps the worker's existing public functions", async () => {
  const image = await import("../src/lib/product-intake/pipeline/image")
  for (const name of [
    "buildImageQualityJudgePrompt",
    "cleanupStaleRembgContainers",
    "finalizedImageOutputRoot",
    "imageQualityJudgeRuntimeConfig",
    "imageQualityPreparationDecision",
    "loadImageQualityReferenceSet",
    "normalizeImageQualityVerdict",
    "rembgContainerArgs",
    "rembgRuntimeConfig",
    "runRembgContainer",
    "shouldAutoPrepareImage",
  ] as const) {
    assert.equal(typeof image[name], "function", name)
    assert.equal(worker[name], image[name], name)
  }
})

test("worker process compatibility uses the shared async process implementation", async () => {
  const { runWorkerProcess } = await import("../src/lib/product-intake/pipeline/process")
  assert.equal(typeof runWorkerProcess, "function")
  assert.equal(worker.runWorkerProcess, runWorkerProcess)
})
