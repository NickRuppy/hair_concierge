import assert from "node:assert/strict"
import { createHash, randomUUID } from "node:crypto"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import sharp from "sharp"
import type { ProductIntakeResearchJob } from "@chaarlie/product-intake-core"

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
import { processApprovedImageForReview } from "../src/lib/product-intake/pipeline/image"

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

test("transparent image completion commits the ready notification snapshot with the worker lease", async () => {
  const submissionId = randomUUID()
  const incompleteSubmissionId = randomUUID()
  const outputRoot = mkdtempSync(join(tmpdir(), "product-intake-finalized-test-"))
  const workRoot = join(process.cwd(), "tmp", "product-intake-image-processing", submissionId)
  const originalFetch = globalThis.fetch
  const originalEnv = {
    finalized: process.env.PRODUCT_INTAKE_FINALIZED_IMAGE_DIR,
    visualJudge: process.env.PRODUCT_INTAKE_CODEX_IMAGE_JUDGE_ENABLED,
    rembg: process.env.PRODUCT_INTAKE_REMBG_ENABLED,
  }
  const source = await sharp({
    create: { width: 320, height: 400, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      {
        input: Buffer.from(
          '<svg width="320" height="400" xmlns="http://www.w3.org/2000/svg"><rect x="105" y="50" width="110" height="260" rx="18" fill="#8a5b3d"/><rect x="122" y="85" width="76" height="105" rx="8" fill="#f5ead6"/><rect x="128" y="98" width="64" height="14" fill="#342119"/></svg>',
        ),
      },
    ])
    .png()
    .toBuffer()
  const commits: Array<Record<string, unknown>> = []
  const artifacts: Array<Record<string, unknown>> = []
  const uploads: Array<{ key: string; bytes: Buffer }> = []
  const storageClient = {
    storage: {
      from(bucket: string) {
        assert.equal(bucket, "product-intake-review")
        return {
          upload: async (key: string, bytes: Buffer, options: { upsert: boolean }) => {
            assert.equal(options.upsert, false)
            uploads.push({ key, bytes: Buffer.from(bytes) })
            return { data: { path: key }, error: null }
          },
        }
      },
    },
  }
  const job: ProductIntakeResearchJob = {
    id: "image-job-1",
    submission_id: submissionId,
    status: "running",
    stage: "image_judging",
    priority: 0,
    attempt_count: 0,
    max_attempts: 3,
    locked_by: "codex-image-worker",
    locked_at: "2026-10-15T12:00:00.000Z",
    started_at: "2026-10-15T11:59:00.000Z",
    completed_at: null,
    next_run_at: "2026-10-15T12:00:00.000Z",
    last_error: null,
    progress: { readiness_check: "passed" },
    created_at: "2026-10-15T11:50:00.000Z",
    updated_at: "2026-10-15T12:00:00.000Z",
  }

  process.env.PRODUCT_INTAKE_FINALIZED_IMAGE_DIR = outputRoot
  process.env.PRODUCT_INTAKE_CODEX_IMAGE_JUDGE_ENABLED = "false"
  process.env.PRODUCT_INTAKE_REMBG_ENABLED = "false"
  globalThis.fetch = (async (url: string | URL | Request) => {
    assert.equal(String(url), "https://images.example.test/transparent-product.png")
    return new Response(source, { headers: { "content-type": "image/png" } })
  }) as typeof fetch
  const deps = {
    appendResearchArtifact: async (_client: unknown, params: Record<string, unknown>) => {
      throw new Error(
        "Final image evidence must be part of the atomic pass, not appended before it",
      )
    },
    commitResearchPass: async (_client: unknown, params: Record<string, unknown>) => {
      commits.push(params)
      artifacts.push(...((params.artifacts as Array<Record<string, unknown>>) ?? []))
      return { ...job, status: params.status, stage: params.stage } as never
    },
    measureModelRun: async () => {
      throw new Error("visual judge must remain disabled")
    },
    refreshModelRunLease: async () => {
      throw new Error("visual judge lease refresh must remain unused")
    },
    captureOptionalTelemetryFailure: async () => null,
    runCodexJson: async () => {
      throw new Error("Codex image judge must remain disabled")
    },
    outputPathForModelLane: () => "/tmp/unreachable.json",
  }

  try {
    await processApprovedImageForReview(
      {
        supabase: storageClient as never,
        job,
        detail: {
          id: submissionId,
          payload_revision: 4,
          status: "researching",
          category: "mask",
          brand: "Chaarlie",
          product_name: "Test Mask",
          source: "catalog_scan",
          payload: {
            final: {
              product: {
                canonical_brand: "Chaarlie",
                clean_name: "Test Mask",
                image_url: "https://images.example.test/transparent-product.png",
              },
            },
          },
          created_at: job.created_at,
          updated_at: job.updated_at,
          job,
          artifacts: [],
          decisions: [],
        },
        workerId: "codex-image-worker",
        promptPacketPath: "/tmp/product-intake-image-stage.json",
        executeCodex: false,
      },
      deps as never,
    )

    assert.equal(artifacts.length, 1)
    assert.equal(artifacts[0]?.kind, "processed_image")
    assert.equal((artifacts[0]?.payload as Record<string, unknown>).final_image_ready, true)
    const finalFile = String((artifacts[0]?.payload as Record<string, unknown>).final_file)
    assert.ok(finalFile.startsWith(join(outputRoot, submissionId)))
    assert.ok(existsSync(finalFile))

    assert.equal(commits.length, 1)
    const commit = commits[0]!
    assert.equal(commit.expectedPayloadRevision, 4)
    const manifest = commit.reviewAssets as Array<{
      kind: string
      sha256: string
      storage_key: string
    }>
    assert.deepEqual(
      manifest.map((asset) => asset.kind),
      ["raw", "magenta", "neutral", "final", "search_thumbnail"],
    )
    assert.equal(uploads.length, 5)
    assert.deepEqual(uploads[0].bytes, source)
    for (const [index, asset] of manifest.entries()) {
      assert.equal(asset.storage_key, `${submissionId}/5/${asset.sha256}`)
      assert.equal(uploads[index].key, asset.storage_key)
      assert.equal(createHash("sha256").update(uploads[index].bytes).digest("hex"), asset.sha256)
    }
    assert.equal(commit.reviewOutcome, "ready_for_review")
    assert.equal(commit.status, "waiting_for_review")
    assert.equal(commit.expectedLockedBy, job.locked_by)
    assert.equal(commit.expectedLockedAt, job.locked_at)
    assert.equal("researchedPayload" in commit, false)
    assert.deepEqual(commit.notificationPayload, {
      product_name: "Chaarlie Test Mask",
      category_label: "Haarmaske",
      outcome_label: "Bereit zur Prüfung",
      question_1: "",
      question_2: "",
      question_3: "",
      review_url: `https://chaarlie.de/admin/produkt-intake/${submissionId}`,
      is_test: false,
    })

    const incompleteJob = {
      ...job,
      id: "image-job-2",
      submission_id: incompleteSubmissionId,
      progress: {},
    }
    await processApprovedImageForReview(
      {
        supabase: storageClient as never,
        job: incompleteJob,
        detail: {
          id: incompleteSubmissionId,
          payload_revision: 4,
          status: "researching",
          category: "mask",
          brand: "Chaarlie",
          product_name: "Test Mask",
          source: "catalog_scan",
          payload: {
            final: {
              product: {
                canonical_brand: "Chaarlie",
                clean_name: "Test Mask",
                image_url: "https://images.example.test/transparent-product.png",
              },
            },
          },
          created_at: incompleteJob.created_at,
          updated_at: incompleteJob.updated_at,
          job: incompleteJob,
          artifacts: [],
          decisions: [],
        },
        workerId: "codex-image-worker",
        promptPacketPath: "/tmp/product-intake-image-stage-missing-readiness.json",
        executeCodex: false,
      },
      deps as never,
    )
    const missingReadinessCommit = commits[1]!
    assert.equal(missingReadinessCommit.reviewOutcome, "needs_nick")
    assert.deepEqual(
      (missingReadinessCommit.notificationPayload as Record<string, unknown>).question_1,
      "Bitte prüfe die noch fehlenden Rechercheangaben.",
    )
    assert.equal(
      (missingReadinessCommit.notificationPayload as Record<string, unknown>).outcome_label,
      "Entscheidung nötig",
    )
  } finally {
    globalThis.fetch = originalFetch
    if (originalEnv.finalized === undefined) delete process.env.PRODUCT_INTAKE_FINALIZED_IMAGE_DIR
    else process.env.PRODUCT_INTAKE_FINALIZED_IMAGE_DIR = originalEnv.finalized
    if (originalEnv.visualJudge === undefined)
      delete process.env.PRODUCT_INTAKE_CODEX_IMAGE_JUDGE_ENABLED
    else process.env.PRODUCT_INTAKE_CODEX_IMAGE_JUDGE_ENABLED = originalEnv.visualJudge
    if (originalEnv.rembg === undefined) delete process.env.PRODUCT_INTAKE_REMBG_ENABLED
    else process.env.PRODUCT_INTAKE_REMBG_ENABLED = originalEnv.rembg
    rmSync(outputRoot, { recursive: true, force: true })
    rmSync(workRoot, { recursive: true, force: true })
    rmSync(join(process.cwd(), "tmp", "product-intake-image-processing", incompleteSubmissionId), {
      recursive: true,
      force: true,
    })
  }
})
