import assert from "node:assert/strict"
import test from "node:test"
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { approveResearchPackage } from "../scripts/product-intake/approve-package"
import { publicationImage } from "./oil-lab-publication-fixture"
import { detailFixture } from "./oil-lab-handoff-fixture"
import type { ReviewActionSubmission } from "../scripts/product-intake/review-actions"

test("oil package rejects changed properties and stale DB binding before upload or payload replacement", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "oil-publication-package-"))
  t.after(() => rm(root, { recursive: true, force: true }))
  const detail = detailFixture(),
    payload = structuredClone(detail.payload) as any
  payload.final.review.manual_reviewed = true
  const dir = join(root, detail.id)
  await mkdir(dir)
  for (const [name, value] of Object.entries({
    "submission.json": { id: detail.id },
    "payload.json": payload,
    "validation.json": {},
  }))
    await writeFile(join(dir, name), JSON.stringify(value))
  for (const name of ["research.md", "approval.md"]) await writeFile(join(dir, name), "fixture")
  const calls: string[] = []
  const submission = {
    id: detail.id,
    category: "oil",
    status: "ready_for_review",
    researched_payload: structuredClone(payload),
  } as ReviewActionSubmission
  let allowPreflight = false
  const imageDecision = {
    status: "approved_asset",
    storage_bucket: "product-images",
    storage_path: "oil-fixture.png",
    public_url: publicationImage.planned_public_url,
    source_page_url: "https://example.com/product",
    source_type: "brand",
    quality_confidence: "high",
    processing_method: "local",
    final_file: "/fixture/final.png",
    asset_sha256: publicationImage.asset_sha256,
    thumbnail_storage_path: "thumbnails/search-v1/" + publicationImage.asset_sha256 + ".webp",
    thumbnail_public_url: publicationImage.thumbnail_public_url,
    thumbnail_final_file: "/fixture/thumb.webp",
    thumbnail_asset_sha256: "b".repeat(64),
    user_approved: true,
  }
  await writeFile(join(dir, "image-finalization.json"), JSON.stringify(imageDecision))
  const query: any = {
    select: () => query,
    eq: () => query,
    order: () => query,
    limit: () => query,
    maybeSingle: async () => ({
      data: {
        payload: {
          ...publicationImage,
          thumbnail_asset_sha256: imageDecision.thumbnail_asset_sha256,
        },
      },
      error: null,
    }),
  }
  const deps = {
    createSupabaseClient: () =>
      ({
        from: () => query,
        rpc: async (_name: string, args: any) => {
          calls.push("preflight")
          if (!allowPreflight)
            return { data: null, error: new Error("Current oil Lab approval required") }
          assert.equal(args.p_final_payload.product.image_url, publicationImage.planned_public_url)
          assert.equal(
            args.p_final_payload.product.canonical_image_sha256,
            publicationImage.asset_sha256,
          )
          assert.equal(
            args.p_final_payload.product.thumbnail_image_url,
            publicationImage.thumbnail_public_url,
          )
          return { data: {}, error: null }
        },
      }) as any,
    loadSubmissionById: async () => submission,
    uploadFinalImage: async () => {
      calls.push("upload")
      return { status: "uploaded" } as any
    },
    savePayload: async () => {
      calls.push("replace")
      throw new Error("unexpected replacement")
    },
    approveById: async () => {
      calls.push("approve")
      return { product_id: "fixture" } as any
    },
  }
  payload.final.product.price_eur = 11
  await writeFile(join(dir, "payload.json"), JSON.stringify(payload))
  await assert.rejects(
    approveResearchPackage({
      packageDir: dir,
      reviewedBy: "nick",
      reviewNotes: null,
      apply: true,
      confirm: true,
      deps,
    }),
    /package is stale/,
  )
  assert.deepEqual(calls, [])
  payload.final.product.price_eur = 10
  await writeFile(join(dir, "payload.json"), JSON.stringify(payload))
  await assert.rejects(
    approveResearchPackage({
      packageDir: dir,
      reviewedBy: "nick",
      reviewNotes: null,
      apply: true,
      confirm: true,
      deps,
    }),
    /Current oil Lab approval required/,
  )
  assert.deepEqual(calls, ["preflight"])
  calls.length = 0
  allowPreflight = true
  const result = await approveResearchPackage({
    packageDir: dir,
    reviewedBy: "nick",
    reviewNotes: null,
    apply: true,
    confirm: true,
    deps,
  })
  assert.equal(result.mode, "applied")
  assert.deepEqual(calls, ["preflight", "upload", "approve"])
  assert.equal(
    (submission.researched_payload as any).final.product.image_url,
    "https://example.com/image.jpg",
    "publication must not replace the stored payload",
  )
  calls.length = 0
  await writeFile(
    join(dir, "image-finalization.json"),
    JSON.stringify({ ...imageDecision, thumbnail_asset_sha256: "c".repeat(64) }),
  )
  await assert.rejects(
    approveResearchPackage({
      packageDir: dir,
      reviewedBy: "nick",
      reviewNotes: null,
      apply: true,
      confirm: true,
      deps,
    }),
    /image differs/,
  )
  assert.deepEqual(calls, [], "changed upload bytes must stop before preflight and upload")
  await writeFile(join(dir, "image-finalization.json"), JSON.stringify(imageDecision))
  const originalCurrent = submission.researched_payload
  Reflect.set(submission, "researched_payload", null)
  await assert.rejects(
    approveResearchPackage({
      packageDir: dir,
      reviewedBy: "nick",
      reviewNotes: null,
      apply: true,
      confirm: true,
      deps,
    }),
    /current payload is missing/,
  )
  submission.researched_payload = originalCurrent
  delete (submission.researched_payload as any).draft.oil_research_binding
  delete payload.draft.oil_research_binding
  await writeFile(join(dir, "payload.json"), JSON.stringify(payload))
  await assert.rejects(
    approveResearchPackage({
      packageDir: dir,
      reviewedBy: "nick",
      reviewNotes: null,
      apply: true,
      confirm: true,
      deps,
    }),
    /research binding is missing/,
  )
  assert.deepEqual(calls, [], "missing bindings must never compare equal and advance")
})
