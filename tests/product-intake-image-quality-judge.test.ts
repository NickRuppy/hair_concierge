import assert from "node:assert/strict"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import {
  buildImageQualityJudgePrompt,
  codexResearchExecArgs,
  imageQualityPreparationDecision,
  imageQualityJudgeRuntimeConfig,
  imageProcessingFailureUpdate,
  loadImageQualityReferenceSet,
  normalizeImageQualityVerdict,
  shouldAutoPrepareImage,
} from "../scripts/product-intake/codex-research-worker"

test("Codex image judge attaches current images and retained references in stable order", () => {
  const args = codexResearchExecArgs({
    cwd: "/tmp/research",
    outputPath: "/tmp/research/image-judge.json",
    prompt: "judge image",
    runtimeConfig: {
      model: "gpt-6-sol",
      reasoningEffort: "medium",
      serviceTier: null,
    },
    webSearch: "disabled",
    imagePaths: ["/tmp/raw.jpg", "/tmp/magenta.webp", "/tmp/final.webp", "/tmp/reference.webp"],
  })

  const imageFlag = args.indexOf("-i")
  assert.ok(imageFlag > 0)
  assert.deepEqual(args.slice(imageFlag, imageFlag + 5), [
    "-i",
    "/tmp/raw.jpg",
    "/tmp/magenta.webp",
    "/tmp/final.webp",
    "/tmp/reference.webp",
  ])
  assert.equal(args.at(-1), "judge image")
})

test("image quality judge defaults to Sol medium and keeps Astra disabled", () => {
  assert.deepEqual(imageQualityJudgeRuntimeConfig({}), {
    enabled: false,
    model: "gpt-6-sol",
    reasoningEffort: "medium",
    serviceTier: null,
  })
  assert.throws(
    () =>
      imageQualityJudgeRuntimeConfig({
        PRODUCT_INTAKE_CODEX_IMAGE_JUDGE_ENABLED: "true",
        PRODUCT_INTAKE_CODEX_IMAGE_JUDGE_MODEL: "gpt-6-astra",
      }),
    /Astra is disabled/,
  )
})

test("image quality verdict preserves localized defects and rejects malformed decisions", () => {
  assert.deepEqual(
    normalizeImageQualityVerdict({
      verdict: "rework",
      confidence: 0.94,
      defects: [
        {
          kind: "edge_residue",
          region: "lower_left",
          severity: "material",
          explanation: "A pale rectangular remnant remains below the bottle.",
        },
      ],
      rationale: "The product is intact but the lower-left edge is not clean.",
    }),
    {
      verdict: "rework",
      confidence: 0.94,
      defects: [
        {
          kind: "edge_residue",
          region: "lower_left",
          severity: "material",
          explanation: "A pale rectangular remnant remains below the bottle.",
        },
      ],
      rationale: "The product is intact but the lower-left edge is not clean.",
    },
  )

  assert.throws(
    () =>
      normalizeImageQualityVerdict({
        verdict: "approved",
        confidence: 1,
        defects: [],
        rationale: "Wrong contract.",
      }),
    /verdict/,
  )
})

test("reference loader caps examples and rejects paths outside the shared root", () => {
  const root = join(tmpdir(), `product-intake-image-refs-${process.pid}-${Date.now()}`)
  const images = join(root, "images")
  mkdirSync(images, { recursive: true })
  for (let index = 0; index < 6; index += 1) {
    writeFileSync(join(images, `${index}.webp`), `reference-${index}`)
  }

  const manifestPath = join(root, "manifest.json")
  writeFileSync(
    manifestPath,
    JSON.stringify({
      version: "test-v1",
      references: Array.from({ length: 6 }, (_, index) => ({
        id: `ref-${index}`,
        expected_verdict: index === 0 ? "rework" : "pass",
        relative_path: `images/${index}.webp`,
        rationale: `Reference ${index}`,
        defects: index === 0 ? [{ kind: "edge_residue", region: "lower_left" }] : [],
      })),
    }),
  )

  const loaded = loadImageQualityReferenceSet({ manifestPath, rootDir: root, maxReferences: 5 })
  assert.equal(loaded.version, "test-v1")
  assert.equal(loaded.references.length, 5)
  assert.deepEqual(
    loaded.references.map((reference) => reference.id),
    ["ref-0", "ref-1", "ref-2", "ref-3", "ref-4"],
  )

  writeFileSync(
    manifestPath,
    JSON.stringify({
      version: "invalid-v1",
      references: [
        {
          id: "escape",
          expected_verdict: "pass",
          relative_path: "../outside.webp",
          rationale: "Must not escape.",
          defects: [],
        },
      ],
    }),
  )
  assert.throws(
    () => loadImageQualityReferenceSet({ manifestPath, rootDir: root, maxReferences: 5 }),
    /outside the configured root/,
  )
})

test("automatic preparation only queues complete unblocked research with a renderable image", () => {
  const ready = {
    summary: "ready",
    researched_payload: {
      final: {
        product: { image_url: "https://images.example.test/product.webp" },
      },
    },
    artifacts: [],
    blockers: [],
  }

  assert.equal(shouldAutoPrepareImage({ enabled: true, researchOutput: ready }), true)
  assert.equal(shouldAutoPrepareImage({ enabled: false, researchOutput: ready }), false)
  assert.equal(
    shouldAutoPrepareImage({
      enabled: true,
      researchOutput: { ...ready, blockers: ["Exact image identity is uncertain."] },
    }),
    false,
  )
  assert.equal(
    shouldAutoPrepareImage({
      enabled: true,
      researchOutput: {
        ...ready,
        researched_payload: { final: { product: { image_url: null } } },
      },
    }),
    false,
  )
})

test("visual judge controls preparation readiness without granting human approval", () => {
  assert.deepEqual(
    imageQualityPreparationDecision({
      deterministicReady: false,
      judgeEnabled: true,
      verdict: "pass",
    }),
    { finalImageReady: true, status: "pending_review" },
  )
  assert.deepEqual(
    imageQualityPreparationDecision({
      deterministicReady: true,
      judgeEnabled: true,
      verdict: "rework",
    }),
    { finalImageReady: false, status: "needs_image_work" },
  )
  assert.deepEqual(
    imageQualityPreparationDecision({
      deterministicReady: true,
      judgeEnabled: true,
      verdict: "needs_human_review",
    }),
    { finalImageReady: false, status: "needs_image_work" },
  )
  assert.deepEqual(
    imageQualityPreparationDecision({
      deterministicReady: true,
      judgeEnabled: false,
      verdict: null,
    }),
    { finalImageReady: true, status: "pending_review" },
  )
})

test("visual judge prompt explicitly covers shadows, packaging, and cutout edges", () => {
  const prompt = buildImageQualityJudgePrompt({
    referenceSet: { version: "test-v1", references: [], warnings: [] },
  })

  assert.match(prompt, /shadow/i)
  assert.match(prompt, /outer box|secondary packaging/i)
  assert.match(prompt, /edge residue|halo/i)
  assert.match(prompt, /cut away|missing product/i)
  assert.match(prompt, /dark bottle base/i)
})

test("image-processing failure uses the latest refreshed lease for its failed update", () => {
  const update = imageProcessingFailureUpdate({
    job: {
      id: "job-123",
      stage: "image_judging",
      locked_by: "codex-worker:new",
      locked_at: "2026-09-27T10:05:00.000Z",
    },
    error: new Error("processed-image artifact write failed"),
    promptPacketPath: "/tmp/prompt.json",
    workerId: "codex-worker:new",
  })

  assert.equal(update.status, "failed")
  assert.equal(update.stage, "image_judging")
  assert.equal(update.expectedLockedBy, "codex-worker:new")
  assert.equal(update.expectedLockedAt, "2026-09-27T10:05:00.000Z")
  assert.equal(update.lastError, "processed-image artifact write failed")

  const workerSource = readFileSync(
    join(process.cwd(), "scripts/product-intake/codex-research-worker.ts"),
    "utf8",
  )
  assert.match(workerSource, /let imageLeasedJob = job/)
  assert.match(
    workerSource,
    /onLeaseRefresh: \(refreshedJob\) => \{\s*imageLeasedJob = refreshedJob/,
  )
  assert.match(workerSource, /job: imageLeasedJob,\s*error,/)
})
