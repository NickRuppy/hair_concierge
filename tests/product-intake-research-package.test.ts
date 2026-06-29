import assert from "node:assert/strict"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import test from "node:test"

import {
  REQUIRED_RESEARCH_PACKAGE_FILES,
  buildResearchPackagePath,
  prepareResearchPackages,
  validateResearchPackage,
} from "../scripts/product-intake/prepare-research"
import type { ProductIntakeQueueRow } from "../scripts/product-intake/queue-reporting"

function pendingRow(overrides: Partial<ProductIntakeQueueRow> = {}): ProductIntakeQueueRow {
  return {
    id: "submission-123",
    created_at: "2026-06-26T07:00:00.000Z",
    updated_at: "2026-06-26T08:00:00.000Z",
    user_id: "user-123",
    source: "chat",
    category: "shampoo",
    brand_text: "Brand",
    product_name_text: "Product",
    front_image_path: "front/path.jpg",
    barcode_image_path: null,
    status: "pending_review",
    researched_payload: null,
    ...overrides,
  }
}

test("buildResearchPackagePath creates date and submission scoped package paths", () => {
  assert.equal(
    buildResearchPackagePath({
      rootDir: "/repo",
      now: new Date("2026-06-26T10:30:00.000Z"),
      submissionId: "submission-123",
    }),
    "/repo/ops/product-intake-research/2026-06-26/submission-123",
  )
})

test("prepareResearchPackages creates the required read-only research package files", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "product-intake-research-"))
  try {
    const result = await prepareResearchPackages({
      rootDir,
      now: new Date("2026-06-26T10:30:00.000Z"),
      rows: [pendingRow()],
      imageMetadataBySubmissionId: {
        "submission-123": {
          front_image_signed_url: "https://signed.example/front",
          barcode_image_signed_url: null,
          signed_url_expires_at: "2026-06-26T11:30:00.000Z",
        },
      },
    })

    assert.equal(result.created.length, 1)
    assert.equal(result.skipped.length, 0)
    for (const fileName of REQUIRED_RESEARCH_PACKAGE_FILES) {
      assert.equal(existsSync(join(result.created[0].packagePath, fileName)), true, fileName)
    }
    assert.equal(existsSync(join(result.created[0].packagePath, "image-finalization.json")), true)

    const submission = JSON.parse(
      await readFile(join(result.created[0].packagePath, "submission.json"), "utf8"),
    ) as Record<string, unknown>
    const validation = JSON.parse(
      await readFile(join(result.created[0].packagePath, "validation.json"), "utf8"),
    ) as Record<string, unknown>
    const approval = await readFile(join(result.created[0].packagePath, "approval.md"), "utf8")

    assert.equal(submission.id, "submission-123")
    assert.deepEqual(submission.image_review, {
      front_image_signed_url: "https://signed.example/front",
      barcode_image_signed_url: null,
      signed_url_expires_at: "2026-06-26T11:30:00.000Z",
    })
    assert.equal(validation.ok, false)
    assert.match(approval, /submission-123/)
    assert.match(approval, /image-finalization\.json/)
    assert.match(approval, /Chaarlie-hosted/)
    assert.match(approval, /products:intake:approve-package/)
  } finally {
    await rm(rootDir, { recursive: true, force: true })
  }
})

test("prepareResearchPackages skips existing package folders by default", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "product-intake-research-"))
  try {
    const first = await prepareResearchPackages({
      rootDir,
      now: new Date("2026-06-26T10:30:00.000Z"),
      rows: [pendingRow()],
    })
    await writeFile(join(first.created[0].packagePath, "research.md"), "keep me")

    const second = await prepareResearchPackages({
      rootDir,
      now: new Date("2026-06-26T10:30:00.000Z"),
      rows: [pendingRow()],
    })

    assert.equal(second.created.length, 0)
    assert.equal(second.skipped.length, 1)
    assert.equal(
      await readFile(join(first.created[0].packagePath, "research.md"), "utf8"),
      "keep me",
    )
  } finally {
    await rm(rootDir, { recursive: true, force: true })
  }
})

test("validateResearchPackage rejects packages missing required files", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "product-intake-research-"))
  try {
    await writeFile(join(rootDir, "submission.json"), "{}")

    const validation = await validateResearchPackage(rootDir)

    assert.equal(validation.ok, false)
    assert.deepEqual(validation.missingFiles.sort(), [
      "approval.md",
      "payload.json",
      "research.md",
      "validation.json",
    ])
  } finally {
    await rm(rootDir, { recursive: true, force: true })
  }
})

test("prepare research script has no apply flags or Supabase write/RPC calls", () => {
  const source = readFileSync("scripts/product-intake/prepare-research.ts", "utf8")

  assert.doesNotMatch(source, /flagBool\(args,\s*["']apply["']/)
  assert.doesNotMatch(source, /\.update\(/)
  assert.doesNotMatch(source, /\.insert\(/)
  assert.doesNotMatch(source, /\.upsert\(/)
  assert.doesNotMatch(source, /\.delete\(/)
  assert.doesNotMatch(source, /\.rpc\(/)
  assert.doesNotMatch(source, /--apply/)
})
